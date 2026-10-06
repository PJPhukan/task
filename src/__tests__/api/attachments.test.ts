import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/server/lib/prisma";

let adminId: string;
let projectId: string;
let taskId: string;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });
  adminId = admin!.id;

  const project = await prisma.project.create({
    data: {
      name: "Attachments Test",
      key: `ATT${Math.random().toString(36).substr(2, 2).toUpperCase()}`,
    },
  });
  projectId = project.id;

  await prisma.projectMember.create({
    data: { projectId, userId: adminId },
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: "Board",
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
      title: "Task",
      reporterId: adminId,
      position: 0,
    },
  });
  taskId = task.id;
});

describe("Attachments API", () => {
  it("GET /api/projects/:projectId/tasks/:taskId/attachments returns empty list initially", async () => {
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`,
      {
        headers: { "x-user-id": adminId },
      }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.attachments)).toBe(true);
  });

  it("POST /api/uploads/signature returns 503 when Cloudinary not configured", async () => {
    // Since env is not configured in tests, should return 503
    const res = await fetch(`http://localhost:3000/api/uploads/signature`, {
      method: "POST",
      headers: { "x-user-id": adminId, "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        kind: "attachment",
      }),
    });
    expect(res.status).toBe(503);
  });

  it("POST /api/uploads/signature returns 404 for nonexistent project", async () => {
    const res = await fetch(`http://localhost:3000/api/uploads/signature`, {
      method: "POST",
      headers: { "x-user-id": adminId, "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "nonexistent",
        kind: "attachment",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/projects/:projectId/tasks/:taskId/attachments returns 400 for missing resource", async () => {
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`,
      {
        method: "POST",
        headers: { "x-user-id": adminId, "content-type": "application/json" },
        body: JSON.stringify({
          publicId: "nonexistent",
          originalName: "test.jpg",
        }),
      }
    );
    expect(res.status).toBe(400);
  });
});
