import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getQueueRoute } from "@/app/api/me/queue/route";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let qaUserId: string;
let devUserId: string;
let projectId: string;
let boardId: string;
let toDoColumnId: string;
let inProgressColumnId: string;
let qaColumnId: string;
let doneColumnId: string;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });
  adminId = admin!.id;

  // Create test users
  const qaUser = await prisma.user.create({
    data: {
      name: "QA User",
      email: `qa-${Date.now()}@example.com`,
      isActive: true,
      status: "ACTIVE",
    },
  });
  qaUserId = qaUser.id;

  const devUser = await prisma.user.create({
    data: {
      name: "Developer User",
      email: `dev-${Date.now()}@example.com`,
      isActive: true,
      status: "ACTIVE",
    },
  });
  devUserId = devUser.id;

  // Assign roles
  const perms = getPerms();
  await setupPermissions();
  await perms.user(qaUserId).assignRole("qa");
  await perms.user(devUserId).assignRole("developer");

  // Create project
  const project = await prisma.project.create({
    data: {
      name: "Queue Test Project",
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  // Add members
  await prisma.projectMember.create({
    data: { projectId, userId: adminId },
  });
  await prisma.projectMember.create({
    data: { projectId, userId: qaUserId },
  });
  await prisma.projectMember.create({
    data: { projectId, userId: devUserId },
  });

  // Create board with columns
  const board = await prisma.board.create({
    data: {
      projectId,
      name: "Test Board",
      position: 0,
      createdById: adminId,
    },
  });
  boardId = board.id;

  // Create columns
  const toDoCol = await prisma.boardColumn.create({
    data: {
      boardId,
      name: "To Do",
      position: 0,
    },
  });
  toDoColumnId = toDoCol.id;

  const inProgressCol = await prisma.boardColumn.create({
    data: {
      boardId,
      name: "In Progress",
      position: 1,
    },
  });
  inProgressColumnId = inProgressCol.id;

  const qaCol = await prisma.boardColumn.create({
    data: {
      boardId,
      name: "QA Review",
      position: 2,
    },
  });
  qaColumnId = qaCol.id;

  const doneCol = await prisma.boardColumn.create({
    data: {
      boardId,
      name: "Done",
      position: 3,
      isDone: true,
    },
  });
  doneColumnId = doneCol.id;
});

describe("My Queue API", () => {
  it("QA user sees unassigned task in QA column (column owned by QA role via MOVE rule)", async () => {
    // Set QA Review column MOVE rule to QA role (using role name as roleId)
    await prisma.columnRule.deleteMany({ where: { columnId: qaColumnId } });
    await (prisma as any).columnRule.create({
      data: {
        columnId: qaColumnId,
        ruleType: "move",
        roleId: "qa",
      },
    });

    // Create unassigned task in QA column
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: qaColumnId,
        number: 1001,
        title: "Unassigned QA task",
        reporterId: adminId,
        position: 0,
      },
    });

    // Create stage entry
    await prisma.taskStageEntry.create({
      data: {
        taskId: task.id,
        columnId: qaColumnId,
        enteredById: adminId,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", qaUserId);
    const req = new NextRequest("http://localhost:3000/api/me/queue", { method: "GET", headers });
    const response = await getQueueRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    const taskInQueue = data.tasks.find((t: any) => t.id === task.id);
    expect(taskInQueue).toBeDefined();
    expect(taskInQueue?.queueReason).toBe("move_rule");
  });

  it("Developer user does NOT see unassigned task in QA column", async () => {
    // QA column MOVE rule is still set to QA role
    const headers = new Headers();
    headers.set("x-user-id", devUserId);
    const req = new NextRequest("http://localhost:3000/api/me/queue", { method: "GET", headers });
    const response = await getQueueRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    // Should not contain any tasks from QA column (with MOVE rule)
    const qaTask = data.tasks.find((t: any) => t.columnId === qaColumnId);
    expect(qaTask).toBeUndefined();
  });

  it("Task assigned to me in column with no MOVE rule appears in queue", async () => {
    // To Do column has no MOVE rule
    await prisma.columnRule.deleteMany({ where: { columnId: toDoColumnId } });

    // Create task assigned to dev user in To Do
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 1002,
        title: "Assigned to dev in To Do",
        reporterId: adminId,
        assigneeId: devUserId,
        position: 0,
      },
    });

    // Create stage entry
    await prisma.taskStageEntry.create({
      data: {
        taskId: task.id,
        columnId: toDoColumnId,
        enteredById: adminId,
        assigneeAtEntry: devUserId,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", devUserId);
    const req = new NextRequest("http://localhost:3000/api/me/queue", { method: "GET", headers });
    const response = await getQueueRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    const taskInQueue = data.tasks.find((t: any) => t.id === task.id);
    expect(taskInQueue).toBeDefined();
    expect(taskInQueue?.queueReason).toBe("assigned_to_me");
  });

  it("Done columns are excluded from queue", async () => {
    // Create task in Done column
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: doneColumnId,
        number: 1003,
        title: "Completed task",
        reporterId: adminId,
        assigneeId: devUserId,
        position: 0,
        completedAt: new Date(),
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", devUserId);
    const req = new NextRequest("http://localhost:3000/api/me/queue", { method: "GET", headers });
    const response = await getQueueRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    // Done column task should not appear
    const doneTask = data.tasks.find((t: any) => t.id === task.id);
    expect(doneTask).toBeUndefined();
  });

  it("Queue tasks are sorted by waitingSeconds, longest first", async () => {
    // Create task 1 (create it now)
    const task1 = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 1004,
        title: "Recent task",
        reporterId: adminId,
        assigneeId: devUserId,
        position: 0,
      },
    });

    // Create stage entry for task 1
    await prisma.taskStageEntry.create({
      data: {
        taskId: task1.id,
        columnId: toDoColumnId,
        enteredById: adminId,
        assigneeAtEntry: devUserId,
        enteredAt: new Date(),
      },
    });

    // Create task 2 (with older entry time)
    const task2 = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 1005,
        title: "Old task",
        reporterId: adminId,
        assigneeId: devUserId,
        position: 1,
      },
    });

    // Create stage entry for task 2 with past timestamp
    const pastTime = new Date();
    pastTime.setHours(pastTime.getHours() - 1);
    await prisma.taskStageEntry.create({
      data: {
        taskId: task2.id,
        columnId: toDoColumnId,
        enteredById: adminId,
        assigneeAtEntry: devUserId,
        enteredAt: pastTime,
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", devUserId);
    const req = new NextRequest("http://localhost:3000/api/me/queue", { method: "GET", headers });
    const response = await getQueueRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    // Find the two tasks
    const task2Index = data.tasks.findIndex((t: any) => t.id === task2.id);
    const task1Index = data.tasks.findIndex((t: any) => t.id === task1.id);

    // task2 (older, more waiting time) should come first
    expect(task2Index).toBeLessThan(task1Index);
  });

  it("assignedOnly filter returns only tasks assigned to me", async () => {
    // Create unassigned task in column with no MOVE rule
    const unassignedTask = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 1006,
        title: "Unassigned task",
        reporterId: adminId,
        position: 0,
      },
    });

    await prisma.taskStageEntry.create({
      data: {
        taskId: unassignedTask.id,
        columnId: toDoColumnId,
        enteredById: adminId,
      },
    });

    // Create assigned task
    const assignedTask = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: toDoColumnId,
        number: 1007,
        title: "Assigned to dev",
        reporterId: adminId,
        assigneeId: devUserId,
        position: 1,
      },
    });

    await prisma.taskStageEntry.create({
      data: {
        taskId: assignedTask.id,
        columnId: toDoColumnId,
        enteredById: adminId,
        assigneeAtEntry: devUserId,
      },
    });

    // Without filter
    let headers = new Headers();
    headers.set("x-user-id", devUserId);
    let req = new NextRequest("http://localhost:3000/api/me/queue", { method: "GET", headers });
    let response = await getQueueRoute(req);
    let data = await response.json();
    const allTasksCount = data.tasks.length;

    // With assignedOnly filter
    headers = new Headers();
    headers.set("x-user-id", devUserId);
    req = new NextRequest("http://localhost:3000/api/me/queue?assignedOnly=true", { method: "GET", headers });
    response = await getQueueRoute(req);
    data = await response.json();
    const assignedOnlyCount = data.tasks.length;

    // assignedOnly should have fewer tasks
    expect(assignedOnlyCount).toBeLessThan(allTasksCount);
    expect(data.tasks.every((t: any) => t.assigneeId === devUserId)).toBe(true);
  });

  afterAll(async () => {
    // Cleanup - no need as tests run on isolated database
  });
});
