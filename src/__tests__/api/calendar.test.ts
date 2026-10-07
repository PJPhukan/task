import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCalendarRoute } from "@/app/api/calendar/route";
import { prisma } from "@/server/lib/prisma";
import { reseedDatabase, cleanupNonSeededUsers } from "@/__tests__/__helpers__/seed";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let userId1: string;
let projectId: string;
let boardId: string;
let toDoColumnId: string;
let inProgressColumnId: string;
let doneColumnId: string;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });
  adminId = admin!.id;

  // Create test user
  const user1 = await prisma.user.create({
    data: {
      email: "calendar-test@example.com",
      name: "Calendar Test",
      isActive: true,
      status: "ACTIVE",
    },
  });
  userId1 = user1.id;

  // Create project
  const project = await prisma.project.create({
    data: {
      name: "Calendar Test",
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  // Add members
  await prisma.projectMember.create({
    data: { projectId, userId: adminId },
  });
  await prisma.projectMember.create({
    data: { projectId, userId: userId1 },
  });

  // Create board and columns
  const board = await prisma.board.create({
    data: {
      projectId,
      name: "Board",
      position: 0,
      createdById: adminId,
    },
  });
  boardId = board.id;

  const toDoCol = await prisma.boardColumn.create({
    data: { boardId, name: "To Do", position: 0 },
  });
  toDoColumnId = toDoCol.id;

  const inProgressCol = await prisma.boardColumn.create({
    data: { boardId, name: "In Progress", position: 1 },
  });
  inProgressColumnId = inProgressCol.id;

  const doneCol = await prisma.boardColumn.create({
    data: { boardId, name: "Done", position: 2, isDone: true },
  });
  doneColumnId = doneCol.id;
});

describe("Calendar API", () => {
  it("returns tasks that overlap the date range (start before, end after)", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 1,
        title: "Overlapping task",
        reporterId: adminId,
        startDate: new Date("2026-10-01"),
        dueDate: new Date("2026-10-31"),
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-10&to=2026-10-20`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(data.tasks.some((t: any) => t.title === "Overlapping task")).toBe(true);

    await prisma.task.delete({ where: { id: task.id } });
  });

  it("returns tasks that sit inside the window", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 2,
        title: "Inside task",
        reporterId: adminId,
        startDate: new Date("2026-10-12"),
        dueDate: new Date("2026-10-18"),
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-10&to=2026-10-20`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.title === "Inside task")).toBe(true);

    await prisma.task.delete({ where: { id: task.id } });
  });

  it("excludes tasks that sit outside the window", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 3,
        title: "Outside task",
        reporterId: adminId,
        startDate: new Date("2026-11-01"),
        dueDate: new Date("2026-11-10"),
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-10&to=2026-10-20`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.title === "Outside task")).toBe(false);

    await prisma.task.delete({ where: { id: task.id } });
  });

  it("includes tasks with only startDate in range", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 4,
        title: "Start date only",
        reporterId: adminId,
        startDate: new Date("2026-10-15"),
        dueDate: null,
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-10&to=2026-10-20`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.title === "Start date only")).toBe(true);

    await prisma.task.delete({ where: { id: task.id } });
  });

  it("includes tasks with only dueDate in range", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 5,
        title: "Due date only",
        reporterId: adminId,
        startDate: null,
        dueDate: new Date("2026-10-15"),
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-10&to=2026-10-20`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.title === "Due date only")).toBe(true);

    await prisma.task.delete({ where: { id: task.id } });
  });

  it("excludes tasks with no dates", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 6,
        title: "No dates",
        reporterId: adminId,
        startDate: null,
        dueDate: null,
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-10&to=2026-10-20`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.title === "No dates")).toBe(false);

    await prisma.task.delete({ where: { id: task.id } });
  });

  it("returns 400 for date range over 62 days", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-01&to=2026-12-15`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("BAD_REQUEST");
  });

  it("filters by assignedToMe", async () => {
    const task1 = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 7,
        title: "Assigned to user1",
        reporterId: adminId,
        assigneeId: userId1,
        startDate: new Date("2026-10-15"),
        dueDate: new Date("2026-10-20"),
        position: 0,
      },
    });

    const task2 = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 8,
        title: "Assigned to admin",
        reporterId: adminId,
        assigneeId: adminId,
        startDate: new Date("2026-10-15"),
        dueDate: new Date("2026-10-20"),
        position: 1,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", userId1);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-10&to=2026-10-25&assignedToMe=true`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.title === "Assigned to user1")).toBe(true);
    expect(data.tasks.some((t: any) => t.title === "Assigned to admin")).toBe(false);

    await prisma.task.deleteMany({ where: { id: { in: [task1.id, task2.id] } } });
  });

  it("returns 400 for invalid date format", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=10-01-2026&to=2026-10-20`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns task with project, board, column, assignee, and other fields", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: inProgressColumnId,
        number: 9,
        title: "Full details",
        reporterId: adminId,
        assigneeId: userId1,
        priority: "high",
        startDate: new Date("2026-10-15"),
        dueDate: new Date("2026-10-20"),
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-10&to=2026-10-25`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    const found = data.tasks.find((t: any) => t.title === "Full details");
    expect(found).toBeDefined();
    expect(found.project).toBe("Calendar Test");
    expect(found.board).toBe("Board");
    expect(found.column).toBe("In Progress");
    expect(found.assignee?.name).toBe("Calendar Test");
    expect(found.priority).toBe("high");
    expect(found.isDone).toBe(false);
    expect(typeof found.key).toBe("string");

    await prisma.task.delete({ where: { id: task.id } });
  });

  it("returns isDone=true for tasks in done column", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: doneColumnId,
        number: 10,
        title: "Done task",
        reporterId: adminId,
        startDate: new Date("2026-10-15"),
        dueDate: new Date("2026-10-20"),
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/calendar?from=2026-10-10&to=2026-10-25`,
      { method: "GET", headers }
    );
    const res = await getCalendarRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    const found = data.tasks.find((t: any) => t.title === "Done task");
    expect(found?.isDone).toBe(true);

    await prisma.task.delete({ where: { id: task.id } });
  });

  afterAll(async () => {
    // Clean up test data
    if (projectId) {
      await prisma.task.deleteMany({ where: { projectId } });
      await prisma.board.deleteMany({ where: { projectId } });
      await prisma.projectMember.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } });
    }
    await prisma.user.deleteMany({ where: { email: "calendar-test@example.com" } });
    await reseedDatabase();
    await cleanupNonSeededUsers();
  });
});
