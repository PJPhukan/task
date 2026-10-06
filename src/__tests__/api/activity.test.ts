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
});
