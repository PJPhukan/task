import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCommentsRoute, POST as createCommentRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/comments/route";
import { PATCH as updateCommentRoute, DELETE as deleteCommentRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route";
import { prisma } from "@/server/lib/prisma";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let memberId: string;
let viewerId: string;
let projectId: string;
let taskId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ["admin@example.com", "member@example.com", "viewer@example.com"] } },
  });
  adminId = users.find((u) => u.email === "admin@example.com")!.id;
  memberId = users.find((u) => u.email === "member@example.com")!.id;
  viewerId = users.find((u) => u.email === "viewer@example.com")!.id;

  const project = await prisma.project.create({
    data: {
      name: "Comments Test Project",
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  await prisma.projectMember.createMany({
    data: [
      { projectId, userId: adminId },
      { projectId, userId: memberId },
      { projectId, userId: viewerId },
    ],
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: "Comments Board",
      position: 0,
      createdById: adminId,
    },
  });

  const column = await prisma.boardColumn.create({
    data: { boardId: board.id, name: "To Do", position: 0 },
  });

  const task = await prisma.task.create({
    data: {
      projectId,
      boardId: board.id,
      columnId: column.id,
      number: 1,
      title: "Test Task for Comments",
      reporterId: adminId,
      position: 0,
    },
  });
  taskId = task.id;
});

describe("Comments API", () => {
  it("POST /api/projects/:projectId/tasks/:taskId/comments creates comment", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: "This is a test comment" }),
    });
    const res = await createCommentRoute(req, { params: { projectId, taskId } });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.comment.body).toBe("This is a test comment");
    expect(data.comment.authorId).toBe(memberId);
    expect(data.comment.author.name).toBeDefined();
  });

  it("GET /api/projects/:projectId/tasks/:taskId/comments returns paginated list", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, { method: "GET", headers });
    const res = await getCommentsRoute(req, { params: { projectId, taskId } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.comments)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it("PATCH /api/projects/:projectId/tasks/:taskId/comments/:commentId only allows author to edit", async () => {
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Original comment" }),
    });
    const commentRes = await createCommentRoute(createReq, { params: { projectId, taskId } });
    const comment = await commentRes.json();

    // Try to edit as different user
    const invalidHeaders = new Headers();
    invalidHeaders.set("x-user-id", viewerId);
    invalidHeaders.set("content-type", "application/json");
    const invalidReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "PATCH",
      headers: invalidHeaders,
      body: JSON.stringify({ body: "Edited by someone else" }),
    });
    const invalidRes = await updateCommentRoute(invalidReq, { params: { projectId, taskId, commentId: comment.comment.id } });
    expect(invalidRes.status).toBe(403);

    // Edit as author
    const validHeaders = new Headers();
    validHeaders.set("x-user-id", memberId);
    validHeaders.set("content-type", "application/json");
    const validReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "PATCH",
      headers: validHeaders,
      body: JSON.stringify({ body: "Edited comment" }),
    });
    const validRes = await updateCommentRoute(validReq, { params: { projectId, taskId, commentId: comment.comment.id } });
    expect(validRes.status).toBe(200);
    const updated = await validRes.json();
    expect(updated.comment.body).toBe("Edited comment");
    expect(updated.comment.editedAt).toBeDefined();
  });

  it("DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId author can delete own", async () => {
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Comment to delete" }),
    });
    const commentRes = await createCommentRoute(createReq, { params: { projectId, taskId } });
    const comment = await commentRes.json();

    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", memberId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    const res = await deleteCommentRoute(deleteReq, { params: { projectId, taskId, commentId: comment.comment.id } });
    expect(res.status).toBe(200);

    const checkRes = await prisma.comment.findUnique({
      where: { id: comment.comment.id },
    });
    expect(checkRes).toBeNull();
  });

  it("GET comments returns 404 if task not found", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/nonexistent/comments`, { method: "GET", headers });
    const res = await getCommentsRoute(req, { params: { projectId, taskId: "nonexistent" } });
    expect(res.status).toBe(404);
  });

  it("DELETE with comment.delete.any allows deleting someone else's comment", async () => {
    // Admin has comment.delete.any
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Comment to delete by admin" }),
    });
    const commentRes = await createCommentRoute(createReq, { params: { projectId, taskId } });
    const comment = await commentRes.json();

    // Admin deletes member's comment
    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", adminId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    const deleteRes = await deleteCommentRoute(deleteReq, { params: { projectId, taskId, commentId: comment.comment.id } });
    expect(deleteRes.status).toBe(200);

    const checkRes = await prisma.comment.findUnique({
      where: { id: comment.comment.id },
    });
    expect(checkRes).toBeNull();
  });

  it("DELETE without comment.delete.any cannot delete someone else's comment", async () => {
    // Member does not have comment.delete.any
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", adminId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Admin comment" }),
    });
    const commentRes = await createCommentRoute(createReq, { params: { projectId, taskId } });
    const comment = await commentRes.json();

    // Member tries to delete admin's comment
    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", memberId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    const deleteRes = await deleteCommentRoute(deleteReq, { params: { projectId, taskId, commentId: comment.comment.id } });
    expect(deleteRes.status).toBe(403);

    const checkRes = await prisma.comment.findUnique({
      where: { id: comment.comment.id },
    });
    expect(checkRes).not.toBeNull();
  });

  it("Member role can create, edit and delete their own comments", async () => {
    // Create comment
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Member comment" }),
    });
    const createRes = await createCommentRoute(createReq, { params: { projectId, taskId } });
    expect(createRes.status).toBe(201);
    const comment = await createRes.json();

    // Edit own comment
    const editHeaders = new Headers();
    editHeaders.set("x-user-id", memberId);
    editHeaders.set("content-type", "application/json");
    const editReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "PATCH",
      headers: editHeaders,
      body: JSON.stringify({ body: "Edited member comment" }),
    });
    const editRes = await updateCommentRoute(editReq, { params: { projectId, taskId, commentId: comment.comment.id } });
    expect(editRes.status).toBe(200);

    // Delete own comment
    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", memberId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    const deleteRes = await deleteCommentRoute(deleteReq, { params: { projectId, taskId, commentId: comment.comment.id } });
    expect(deleteRes.status).toBe(200);
  });

});
