import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/server/lib/prisma";

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
      key: `C${Date.now().toString().slice(-2)}`,
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
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "This is a test comment" }),
      }
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.comment.body).toBe("This is a test comment");
    expect(data.comment.authorId).toBe(memberId);
    expect(data.comment.author.name).toBeDefined();
  });

  it("GET /api/projects/:projectId/tasks/:taskId/comments returns paginated list", async () => {
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        headers: { "x-user-id": memberId },
      }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.comments)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it("PATCH /api/projects/:projectId/tasks/:taskId/comments/:commentId only allows author to edit", async () => {
    const commentRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Original comment" }),
      }
    );
    const comment = await commentRes.json();

    // Try to edit as different user
    const invalidRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`,
      {
        method: "PATCH",
        headers: { "x-user-id": viewerId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Edited by someone else" }),
      }
    );
    expect(invalidRes.status).toBe(403);

    // Edit as author
    const validRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`,
      {
        method: "PATCH",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Edited comment" }),
      }
    );
    expect(validRes.status).toBe(200);
    const updated = await validRes.json();
    expect(updated.comment.body).toBe("Edited comment");
    expect(updated.comment.editedAt).toBeDefined();
  });

  it("DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId author can delete own", async () => {
    const commentRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Comment to delete" }),
      }
    );
    const comment = await commentRes.json();

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`,
      {
        method: "DELETE",
        headers: { "x-user-id": memberId },
      }
    );
    expect(res.status).toBe(200);

    const checkRes = await prisma.comment.findUnique({
      where: { id: comment.comment.id },
    });
    expect(checkRes).toBeNull();
  });

  it("GET comments returns 404 if task not found", async () => {
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/nonexistent/comments`,
      {
        headers: { "x-user-id": memberId },
      }
    );
    expect(res.status).toBe(404);
  });

  it("DELETE with comment.delete.any allows deleting someone else's comment", async () => {
    // Admin has comment.delete.any
    const commentRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Comment to delete by admin" }),
      }
    );
    const comment = await commentRes.json();

    // Admin deletes member's comment
    const deleteRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`,
      {
        method: "DELETE",
        headers: { "x-user-id": adminId },
      }
    );
    expect(deleteRes.status).toBe(200);

    const checkRes = await prisma.comment.findUnique({
      where: { id: comment.comment.id },
    });
    expect(checkRes).toBeNull();
  });

  it("DELETE without comment.delete.any cannot delete someone else's comment", async () => {
    // Member does not have comment.delete.any
    const commentRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "x-user-id": adminId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Admin comment" }),
      }
    );
    const comment = await commentRes.json();

    // Member tries to delete admin's comment
    const deleteRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`,
      {
        method: "DELETE",
        headers: { "x-user-id": memberId },
      }
    );
    expect(deleteRes.status).toBe(403);

    const checkRes = await prisma.comment.findUnique({
      where: { id: comment.comment.id },
    });
    expect(checkRes).not.toBeNull();
  });

  it("Member role can create, edit and delete their own comments", async () => {
    // Create comment
    const createRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Member comment" }),
      }
    );
    expect(createRes.status).toBe(201);
    const comment = await createRes.json();

    // Edit own comment
    const editRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`,
      {
        method: "PATCH",
        headers: { "x-user-id": memberId, "content-type": "application/json" },
        body: JSON.stringify({ body: "Edited member comment" }),
      }
    );
    expect(editRes.status).toBe(200);

    // Delete own comment
    const deleteRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`,
      {
        method: "DELETE",
        headers: { "x-user-id": memberId },
      }
    );
    expect(deleteRes.status).toBe(200);
  });

});
