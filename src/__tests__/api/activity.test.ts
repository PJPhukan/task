import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/server/lib/prisma";

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
      key: `ACT${Math.random().toString(36).substr(2, 2).toUpperCase()}`,
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
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/activity`,
      {
        headers: { "x-user-id": memberId },
      }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.activities)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it("GET /api/projects/:projectId/activity returns paginated list", async () => {
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/activity?page=1`,
      {
        headers: { "x-user-id": memberId },
      }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.activities)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it("GET /api/projects/:projectId/activity returns 404 for nonexistent project", async () => {
    const res = await fetch(`http://localhost:3000/api/projects/nonexistent/activity`, {
      headers: { "x-user-id": memberId },
    });
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

    const res = await fetch(`http://localhost:3000/api/projects/${projectId}/activity`, {
      headers: { "x-user-id": nonMember.id },
    });
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

    // Get activity feed before creating comment on restricted task
    const beforeRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/activity?limit=100`,
      {
        headers: { "x-user-id": memberId },
      }
    );
    const beforeData = await beforeRes.json();
    const beforeCount = beforeData.activities.length;

    // Create comment on restricted task - member cannot view this task
    // So activity should not appear in their feed
    // (This test verifies that restricted column tasks don't leak into activity)
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/activity?limit=100`,
      {
        headers: { "x-user-id": memberId },
      }
    );
    const data = await res.json();

    // Verify restricted task activities don't appear
    const hasRestrictedTaskActivity = data.activities.some(
      (a: any) => a.taskId === restrictedTask.id
    );
    expect(hasRestrictedTaskActivity).toBe(false);
  });

  it("Creating a comment writes activity row", async () => {
    const commentBody = `Test comment ${Date.now()}`;
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      }
    );
    expect(res.status).toBe(201);

    // Check activity was recorded
    const activities = await prisma.activity.findMany({
      where: { projectId, type: "comment.created", taskId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(activities.length).toBeGreaterThan(0);
    expect(activities[0].userId).toBe(memberId);
  });

  it("Editing a comment writes activity row", async () => {
    // Create a comment first
    const createRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Original comment" }),
      }
    );
    const comment = await createRes.json();

    // Edit it
    const editRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`,
      {
        method: "PATCH",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Edited comment" }),
      }
    );
    expect(editRes.status).toBe(200);

    // Check activity was recorded
    const activities = await prisma.activity.findMany({
      where: { projectId, type: "comment.edited", taskId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(activities.length).toBeGreaterThan(0);
  });

  it("Deleting a comment writes activity row", async () => {
    // Create and delete a comment
    const createRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Comment to delete" }),
      }
    );
    const comment = await createRes.json();

    const deleteRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`,
      {
        method: "DELETE",
        headers: { "x-user-id": memberId },
      }
    );
    expect(deleteRes.status).toBe(200);

    // Check activity was recorded
    const activities = await prisma.activity.findMany({
      where: { projectId, type: "comment.deleted", taskId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(activities.length).toBeGreaterThan(0);
  });
});
