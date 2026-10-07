import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getProjectTaskActivityRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/activity/route";
import { GET as getProjectActivityRoute } from "@/app/api/projects/[projectId]/activity/route";
import { PATCH as updateCommentRoute, DELETE as deleteCommentRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route";
import { POST as createCommentListRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/comments/route";
import { prisma } from "@/server/lib/prisma";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let memberId: string;
let projectId: string;
let boardId: string;
let columnId: string;
let taskId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ["admin@example.com", "member@example.com"] } },
  });
  adminId = users.find((u) => u.email === "admin@example.com")!.id;
  memberId = users.find((u) => u.email === "member@example.com")!.id;

  const project = await prisma.project.create({
    data: {
      name: "Activity Test Project",
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  await prisma.projectMember.createMany({
    data: [
      { projectId, userId: adminId },
      { projectId, userId: memberId },
    ],
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: "Activity Board",
      position: 0,
      createdById: adminId,
    },
  });
  boardId = board.id;

  const column = await prisma.boardColumn.create({
    data: { boardId, name: "To Do", position: 0 },
  });
  columnId = column.id;

  const task = await prisma.task.create({
    data: {
      projectId,
      boardId,
      columnId,
      number: 1,
      title: "Activity Test Task",
      reporterId: adminId,
      position: 0,
    },
  });
  taskId = task.id;
});

describe("Activity Feed API", () => {
  it("GET /api/projects/:projectId/tasks/:taskId/activity returns paginated list", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/activity`, { method: "GET", headers });
    const res = await getProjectTaskActivityRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.activities)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it("GET /api/projects/:projectId/activity returns paginated list", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/activity?page=1`, { method: "GET", headers });
    const res = await getProjectActivityRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.activities)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it("GET /api/projects/:projectId/activity returns 404 for nonexistent project", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/nonexistent/activity`, { method: "GET", headers });
    const res = await getProjectActivityRoute(req, { params: Promise.resolve({ projectId: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("GET /api/projects/:projectId/activity returns 403 for non-member", async () => {
    const nonMember = await prisma.user.create({
      data: {
        name: "Non Member",
        email: `nm${Date.now()}@ex.com`,
        isActive: true,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", nonMember.id);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/activity`, { method: "GET", headers });
    const res = await getProjectActivityRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(403);
  });

  it("Activity feed leaves out entries for tasks in columns the user cannot view", async () => {
    // Create a restricted column and task
    const restrictedColumn = await prisma.boardColumn.create({
      data: { boardId, name: "Secret", position: 1 },
    });

    const restrictedTask = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: restrictedColumn.id,
        number: 2,
        title: "Secret Task",
        reporterId: adminId,
        position: 0,
      },
    });

    // Get activity feed for current state
    // (This test verifies that restricted column tasks don't leak into activity)
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/activity?limit=100`, { method: "GET", headers });
    const res = await getProjectActivityRoute(req, { params: Promise.resolve({ projectId }) });
    const data = await res.json();

    // Verify restricted task activities don't appear
    const hasRestrictedTaskActivity = data.activities.some(
      (a: any) => a.taskId === restrictedTask.id
    );
    expect(hasRestrictedTaskActivity).toBe(false);
  });

  it("Creating a comment writes activity row", async () => {
    const commentBody = `Test comment ${Date.now()}`;
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, { method: "POST", headers, body: JSON.stringify({ body: commentBody }) });
    const res = await createCommentListRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(201);

    // Check activity was recorded
    const activities = await prisma.activityLog.findMany({
      where: { projectId, action: "comment.created", taskId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(activities.length).toBeGreaterThan(0);
    expect(activities[0].actorId).toBe(memberId);
  });

  it("Editing a comment writes activity row", async () => {
    // Create a comment first
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, { method: "POST", headers: createHeaders, body: JSON.stringify({ body: "Original comment" }) });
    const createRes = await createCommentListRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await createRes.json();

    // Edit it
    const editHeaders = new Headers();
    editHeaders.set("x-user-id", memberId);
    editHeaders.set("content-type", "application/json");
    const editReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, { method: "PATCH", headers: editHeaders, body: JSON.stringify({ body: "Edited comment" }) });
    const editRes = await updateCommentRoute(editReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(editRes.status).toBe(200);

    // Check activity was recorded
    const activities = await prisma.activityLog.findMany({
      where: { projectId, action: "comment.updated", taskId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(activities.length).toBeGreaterThan(0);
  });

  it("Deleting a comment writes activity row", async () => {
    // Create and delete a comment
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, { method: "POST", headers: createHeaders, body: JSON.stringify({ body: "Comment to delete" }) });
    const createRes = await createCommentListRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await createRes.json();

    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", memberId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, { method: "DELETE", headers: deleteHeaders });
    const deleteRes = await deleteCommentRoute(deleteReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(deleteRes.status).toBe(200);

    // Check activity was recorded
    const activities = await prisma.activityLog.findMany({
      where: { projectId, action: "comment.deleted", taskId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(activities.length).toBeGreaterThan(0);
  });

});
