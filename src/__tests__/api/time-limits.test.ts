import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PATCH as updateColumnRoute } from "@/app/api/projects/[projectId]/columns/[columnId]/route";
import { POST as checkTimeLimitsRoute } from "@/app/api/jobs/check-time-limits/route";
import { GET as getBoardRoute } from "@/app/api/projects/[projectId]/boards/[boardId]/route";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let userId1: string;
let projectId: string;
let boardId: string;
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
      name: "User 1",
      email: `user1-${Date.now()}@example.com`,
      isActive: true,
      status: "ACTIVE",
    },
  });
  userId1 = user1.id;

  // Assign role
  const perms = getPerms();
  await setupPermissions();
  await perms.user(userId1).assignRole("developer");

  // Create project
  const project = await prisma.project.create({
    data: {
      name: "Time Limits Test Project",
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

  // Create board
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
  await prisma.boardColumn.create({
    data: {
      boardId,
      name: "To Do",
      position: 0,
    },
  });

  const inProgressCol = await prisma.boardColumn.create({
    data: {
      boardId,
      name: "In Progress",
      position: 1,
    },
  });
  inProgressColumnId = inProgressCol.id;

  const doneCol = await prisma.boardColumn.create({
    data: {
      boardId,
      name: "Done",
      position: 2,
      isDone: true,
    },
  });
  doneColumnId = doneCol.id;
});

describe("Time Limits API", () => {
  it("Setting time limit on done column is rejected", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/columns/${doneColumnId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Done",
        timeLimitHours: 24,
      }),
    });

    const response = await updateColumnRoute(req, { params: Promise.resolve({ projectId, columnId: doneColumnId }) });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
  });

  it("waitingSeconds and overLimit are calculated correctly in task responses", async () => {
    // Set a 1-hour time limit on In Progress column
    await prisma.boardColumn.update({
      where: { id: inProgressColumnId },
      data: { timeLimitHours: 1 },
    });

    // Create task in In Progress
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Create task that entered 30 minutes ago (under limit)
    const task1 = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: inProgressColumnId,
        number: 2001,
        title: "Under limit",
        reporterId: adminId,
        assigneeId: userId1,
        position: 0,
      },
    });

    await prisma.taskStageEntry.create({
      data: {
        taskId: task1.id,
        columnId: inProgressColumnId,
        enteredById: adminId,
        assigneeAtEntry: userId1,
        enteredAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
      },
    });

    // Create task that entered 2 hours ago (over limit)
    const task2 = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: inProgressColumnId,
        number: 2002,
        title: "Over limit",
        reporterId: adminId,
        assigneeId: userId1,
        position: 1,
      },
    });

    await prisma.taskStageEntry.create({
      data: {
        taskId: task2.id,
        columnId: inProgressColumnId,
        enteredById: adminId,
        assigneeAtEntry: userId1,
        enteredAt: twoHoursAgo,
      },
    });

    // Get board to check waitingSeconds and overLimit
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, {
      method: "GET",
      headers,
    });
    const response = await getBoardRoute(req, { params: Promise.resolve({ projectId, boardId }) });
    expect(response.status).toBe(200);
    const data = await response.json();

    // Find the tasks
    const allTasks = data.board.columns.flatMap((c: any) => c.tasks);
    const underLimitTask = allTasks.find((t: any) => t.id === task1.id);
    const overLimitTask = allTasks.find((t: any) => t.id === task2.id);

    // Check under limit task
    expect(underLimitTask).toBeDefined();
    expect(underLimitTask.waitingSeconds).toBeGreaterThan(1700); // ~1800 seconds (30 min)
    expect(underLimitTask.waitingSeconds).toBeLessThan(1900);
    expect(underLimitTask.overLimit).toBe(false);

    // Check over limit task
    expect(overLimitTask).toBeDefined();
    expect(overLimitTask.waitingSeconds).toBeGreaterThan(7100); // ~7200 seconds (2 hours)
    expect(overLimitTask.overLimit).toBe(true);
  });

  it("checkTimeLimits returns 401 without secret", async () => {
    const headers = new Headers();
    const req = new NextRequest("http://localhost:3000/api/jobs/check-time-limits", {
      method: "POST",
      headers,
    });

    const response = await checkTimeLimitsRoute(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("checkTimeLimits returns 401 with wrong secret", async () => {
    const headers = new Headers();
    headers.set("authorization", "Bearer wrong-secret");
    const req = new NextRequest("http://localhost:3000/api/jobs/check-time-limits", {
      method: "POST",
      headers,
    });

    const response = await checkTimeLimitsRoute(req);
    expect(response.status).toBe(401);
  });

  it("checkTimeLimits returns 200 with correct secret", async () => {
    // Set CRON_SECRET for this test
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-cron-secret-123";

    try {
      const headers = new Headers();
      headers.set("authorization", "Bearer test-cron-secret-123");
      const req = new NextRequest("http://localhost:3000/api/jobs/check-time-limits", {
        method: "POST",
        headers,
      });

      const response = await checkTimeLimitsRoute(req);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(typeof data.notifiedCount).toBe("number");
    } finally {
      if (originalSecret) {
        process.env.CRON_SECRET = originalSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }
  });

  it("checkTimeLimits notifies right people once and not again on second run", async () => {
    // Set CRON_SECRET for this test
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-cron-secret-456";
    const cronSecret = "test-cron-secret-456";

    try {

    // Create a new project for this test to isolate it
    const project = await prisma.project.create({
      data: {
        name: "Time Limits Notification Test",
        key: generateProjectKey(),
      },
    });

    // Add members
    await prisma.projectMember.create({ data: { projectId: project.id, userId: adminId } });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: userId1 } });

    // Create board
    const board = await prisma.board.create({
      data: {
        projectId: project.id,
        name: "Test Board",
        position: 0,
        createdById: adminId,
      },
    });

    // Create column with 1-hour limit
    const column = await prisma.boardColumn.create({
      data: {
        boardId: board.id,
        name: "Review",
        position: 0,
        timeLimitHours: 1,
      },
    });

    // Create task that's over the limit
    const twoHoursAgo = new Date(new Date().getTime() - 2 * 60 * 60 * 1000);
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        boardId: board.id,
        columnId: column.id,
        number: 3001,
        title: "Over limit task",
        reporterId: adminId,
        assigneeId: userId1,
        position: 0,
      },
    });

    // Create stage entry with old timestamp
    await prisma.taskStageEntry.create({
      data: {
        taskId: task.id,
        columnId: column.id,
        enteredById: adminId,
        assigneeAtEntry: userId1,
        enteredAt: twoHoursAgo,
      },
    });

    // Clear any existing notifications
    await prisma.notification.deleteMany({
      where: { taskId: task.id, type: "task.over_limit" },
    });

    // First run of checkTimeLimits
    let headers = new Headers();
    headers.set("authorization", `Bearer ${cronSecret}`);
    let req = new NextRequest("http://localhost:3000/api/jobs/check-time-limits", {
      method: "POST",
      headers,
    });

    let response = await checkTimeLimitsRoute(req);
    expect(response.status).toBe(200);

    // Check that notification was created
    let notification = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        type: "task.over_limit",
      },
    });
    expect(notification).toBeDefined();

    // Clear notifications again
    await prisma.notification.deleteMany({
      where: { taskId: task.id, type: "task.over_limit" },
    });

    // Second run should not create new notification (stage entry is marked as notified)
    headers = new Headers();
    headers.set("authorization", `Bearer ${cronSecret}`);
    req = new NextRequest("http://localhost:3000/api/jobs/check-time-limits", {
      method: "POST",
      headers,
    });

    response = await checkTimeLimitsRoute(req);
    expect(response.status).toBe(200);

    // Should not create new notification
    const notificationsAfterSecondRun = await prisma.notification.findMany({
      where: {
        taskId: task.id,
        type: "task.over_limit",
      },
    });
    expect(notificationsAfterSecondRun.length).toBe(0);
    } finally {
      if (originalSecret) {
        process.env.CRON_SECRET = originalSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }
  });

  it("Task under limit does not trigger over_limit notification", async () => {
    // Set CRON_SECRET for this test
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-cron-secret-789";
    const cronSecret = "test-cron-secret-789";

    try {

    // Create project
    const project = await prisma.project.create({
      data: {
        name: "Under Limit Test",
        key: generateProjectKey(),
      },
    });

    await prisma.projectMember.create({ data: { projectId: project.id, userId: adminId } });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: userId1 } });

    // Create board
    const board = await prisma.board.create({
      data: {
        projectId: project.id,
        name: "Test Board",
        position: 0,
        createdById: adminId,
      },
    });

    // Create column with 2-hour limit
    const column = await prisma.boardColumn.create({
      data: {
        boardId: board.id,
        name: "Work",
        position: 0,
        timeLimitHours: 2,
      },
    });

    // Create task that entered 30 minutes ago (under limit)
    const thirtyMinutesAgo = new Date(new Date().getTime() - 30 * 60 * 1000);
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        boardId: board.id,
        columnId: column.id,
        number: 4001,
        title: "Under limit task",
        reporterId: adminId,
        assigneeId: userId1,
        position: 0,
      },
    });

    await prisma.taskStageEntry.create({
      data: {
        taskId: task.id,
        columnId: column.id,
        enteredById: adminId,
        assigneeAtEntry: userId1,
        enteredAt: thirtyMinutesAgo,
      },
    });

    // Run checkTimeLimits
    const headers = new Headers();
    headers.set("authorization", `Bearer ${cronSecret}`);
    const req = new NextRequest("http://localhost:3000/api/jobs/check-time-limits", {
      method: "POST",
      headers,
    });

    const response = await checkTimeLimitsRoute(req);
    expect(response.status).toBe(200);

    // Should not create notification for under-limit task
    const notification = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        type: "task.over_limit",
      },
    });
    expect(notification).toBeNull();
    } finally {
      if (originalSecret) {
        process.env.CRON_SECRET = originalSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }
  });

  afterAll(async () => {
    // Cleanup - no need as tests run on isolated database
  });
});
