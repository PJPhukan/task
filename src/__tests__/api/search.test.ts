import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as searchRoute } from "@/app/api/search/route";
import { prisma } from "@/server/lib/prisma";
import { reseedDatabase, cleanupNonSeededUsers } from "@/__tests__/__helpers__/seed";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let userId1: string;
let project1Id: string;
let project2Id: string;
let board1Id: string;
let board2Id: string;
let column1Id: string;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });
  adminId = admin!.id;

  // Clean up existing test user if present
  await prisma.user.deleteMany({ where: { email: "search-test@example.com" } });

  // Create test user
  const user1 = await prisma.user.create({
    data: {
      email: "search-test@example.com",
      name: "Search Test User",
      isActive: true,
      status: "ACTIVE",
    },
  });
  userId1 = user1.id;

  // Create project 1
  const project1 = await prisma.project.create({
    data: {
      name: "Search Test Project",
      key: generateProjectKey(),
    },
  });
  project1Id = project1.id;

  // Create project 2
  const project2 = await prisma.project.create({
    data: {
      name: "Another Project",
      key: generateProjectKey(),
    },
  });
  project2Id = project2.id;

  // Add members to projects
  await prisma.projectMember.create({
    data: { projectId: project1Id, userId: adminId },
  });
  await prisma.projectMember.create({
    data: { projectId: project1Id, userId: userId1 },
  });
  await prisma.projectMember.create({
    data: { projectId: project2Id, userId: adminId },
  });

  // Create boards
  const board1 = await prisma.board.create({
    data: {
      projectId: project1Id,
      name: "Search Board",
      position: 0,
      createdById: adminId,
    },
  });
  board1Id = board1.id;

  const board2 = await prisma.board.create({
    data: {
      projectId: project2Id,
      name: "Hidden Board",
      position: 0,
      createdById: adminId,
    },
  });
  board2Id = board2.id;

  // Create columns
  const column1 = await prisma.boardColumn.create({
    data: { boardId: board1Id, name: "To Do", position: 0 },
  });
  column1Id = column1.id;

  await prisma.boardColumn.create({
    data: { boardId: board2Id, name: "To Do", position: 0 },
  });

});

describe("Search API", () => {
  it("finds a task by key", async () => {
    const task = await prisma.task.create({
      data: {
        projectId: project1Id,
        boardId: board1Id,
        columnId: column1Id,
        number: 1,
        title: "Searchable task",
        reporterId: adminId,
        position: 0,
      },
    });

    // Get the project to know the key format
    const project = await prisma.project.findUnique({ where: { id: project1Id } });
    const expectedKey = `${project!.key}-1`;

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/search?q=${expectedKey}`, {
      method: "GET",
      headers,
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(data.tasks.some((t: any) => t.key === expectedKey)).toBe(true);

    await prisma.task.delete({ where: { id: task.id } });
  });

  it("finds a task by title (case-insensitive)", async () => {
    const task = await prisma.task.create({
      data: {
        projectId: project1Id,
        boardId: board1Id,
        columnId: column1Id,
        number: 2,
        title: "BugFix Implementation",
        reporterId: adminId,
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/search?q=bugfix`, {
      method: "GET",
      headers,
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.title === "BugFix Implementation")).toBe(true);

    await prisma.task.delete({ where: { id: task.id } });
  });

  it("finds a project by name", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(
      `http://localhost:3000/api/search?q=Search Test Project`,
      {
        method: "GET",
        headers,
      }
    );
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects.some((p: any) => p.name === "Search Test Project")).toBe(true);
  });

  it("finds a board by name", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/search?q=Search Board`, {
      method: "GET",
      headers,
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.boards)).toBe(true);
    expect(data.boards.some((b: any) => b.name === "Search Board")).toBe(true);
  });

  it("searches only in projects the user can see", async () => {
    // userId1 is not a member of project2, so they shouldn't see tasks from it
    const headers = new Headers();
    headers.set("x-user-id", userId1);
    const req = new NextRequest(`http://localhost:3000/api/search?q=Another`, {
      method: "GET",
      headers,
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    // userId1 is not a member of "Another Project", so boards should be empty
    expect(data.boards.length).toBe(0);
  });

  it("returns 400 for 1-character query", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/search?q=a`, {
      method: "GET",
      headers,
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns results with at most 8 tasks, projects, and boards each", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/search?q=Search`, {
      method: "GET",
      headers,
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.length).toBeLessThanOrEqual(8);
    expect(data.projects.length).toBeLessThanOrEqual(8);
    expect(data.boards.length).toBeLessThanOrEqual(8);
  });

  it("returns different groups in the response", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/search?q=search`, {
      method: "GET",
      headers,
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("tasks");
    expect(data).toHaveProperty("projects");
    expect(data).toHaveProperty("boards");
  });

  it("excludes tasks in columns the user cannot view from search results", async () => {
    // Create a restricted column
    const restrictedColumn = await prisma.boardColumn.create({
      data: { boardId: board1Id, name: "Restricted", position: 1 },
    });

    // Create a view rule that excludes "viewer" role
    await prisma.columnRule.create({
      data: {
        columnId: restrictedColumn.id,
        ruleType: "view",
        roleId: "developer", // Only developers can view
      },
    });

    // Create a task in the restricted column
    const restrictedTask = await prisma.task.create({
      data: {
        projectId: project1Id,
        boardId: board1Id,
        columnId: restrictedColumn.id,
        number: 100,
        title: "Hidden restricted task",
        reporterId: adminId,
        position: 0,
      },
    });

    // userId1 is a member but not a developer, so they shouldn't see this task
    const headers = new Headers();
    headers.set("x-user-id", userId1);
    const req = new NextRequest(`http://localhost:3000/api/search?q=Hidden`, {
      method: "GET",
      headers,
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // Task should not appear in search results
    expect(data.tasks.some((t: any) => t.title === "Hidden restricted task")).toBe(false);

    // Cleanup
    await prisma.task.delete({ where: { id: restrictedTask.id } });
    await prisma.columnRule.delete({
      where: { columnId_ruleType_roleId: { columnId: restrictedColumn.id, ruleType: "view", roleId: "developer" } },
    });
    await prisma.boardColumn.delete({ where: { id: restrictedColumn.id } });
  });

  it("excludes tasks on restricted boards the user cannot access from search results", async () => {
    // Create a restricted board
    const restrictedBoard = await prisma.board.create({
      data: {
        projectId: project1Id,
        name: "Restricted Board",
        position: 1,
        isOpen: false,
        createdById: adminId,
      },
    });

    const restrictedBoardColumn = await prisma.boardColumn.create({
      data: { boardId: restrictedBoard.id, name: "To Do", position: 0 },
    });

    // Only give adminId access to the restricted board
    await prisma.boardAccess.create({
      data: {
        boardId: restrictedBoard.id,
        userId: adminId,
      },
    });

    // Create a task in the restricted board
    const restrictedTask = await prisma.task.create({
      data: {
        projectId: project1Id,
        boardId: restrictedBoard.id,
        columnId: restrictedBoardColumn.id,
        number: 101,
        title: "Secret board task",
        reporterId: adminId,
        position: 0,
      },
    });

    // userId1 is a project member but not allowed on this board
    const headers = new Headers();
    headers.set("x-user-id", userId1);
    const req = new NextRequest(`http://localhost:3000/api/search?q=Secret`, {
      method: "GET",
      headers,
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // Task should not appear in search results
    expect(data.tasks.some((t: any) => t.title === "Secret board task")).toBe(false);

    // Cleanup
    await prisma.task.delete({ where: { id: restrictedTask.id } });
    await prisma.boardAccess.deleteMany({ where: { boardId: restrictedBoard.id } });
    await prisma.board.delete({ where: { id: restrictedBoard.id } });
  });

  afterAll(async () => {
    // Clean up test data
    if (project1Id) {
      await prisma.task.deleteMany({ where: { projectId: project1Id } });
      await prisma.task.deleteMany({ where: { projectId: project2Id } });
      await prisma.board.deleteMany({ where: { projectId: project1Id } });
      await prisma.board.deleteMany({ where: { projectId: project2Id } });
      await prisma.projectMember.deleteMany({ where: { projectId: project1Id } });
      await prisma.projectMember.deleteMany({ where: { projectId: project2Id } });
      await prisma.project.deleteMany({
        where: { id: { in: [project1Id, project2Id] } },
      });
    }
    await prisma.user.deleteMany({ where: { email: "search-test@example.com" } });
    await reseedDatabase();
    await cleanupNonSeededUsers();
  });
});
