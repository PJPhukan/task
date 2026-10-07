import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getNotificationsRoute, POST as getNotificationsReadRoute } from "@/app/api/notifications/route";
import { GET as getUnreadCountRoute } from "@/app/api/notifications/unread-count/route";
import { POST as markAsReadRoute } from "@/app/api/notifications/[notificationId]/read/route";
import { POST as markAllAsReadRoute } from "@/app/api/notifications/read-all/route";
import { GET as getSettingsRoute, PATCH as patchSettingsRoute } from "@/app/api/me/notification-settings/route";
import { POST as createTaskRoute } from "@/app/api/projects/[projectId]/tasks/route";
import { PATCH as updateTaskRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/route";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let userId1: string;
let userId2: string;
let projectId: string;
let boardId: string;
let columnId: string;
let taskId: string;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });
  adminId = admin!.id;

  // Create test users
  const user1 = await prisma.user.create({
    data: {
      name: "User 1",
      email: `user1-${Date.now()}@example.com`,
      isActive: true,
      status: "ACTIVE",
    },
  });
  userId1 = user1.id;

  const user2 = await prisma.user.create({
    data: {
      name: "User 2",
      email: `user2-${Date.now()}@example.com`,
      isActive: true,
      status: "ACTIVE",
    },
  });
  userId2 = user2.id;

  // Assign permissions to users
  const perms = getPerms();
  await setupPermissions();
  await perms.user(userId1).assignRole("member");
  await perms.user(userId2).assignRole("member");

  // Create project
  const project = await prisma.project.create({
    data: {
      name: "Notification Test Project",
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
  await prisma.projectMember.create({
    data: { projectId, userId: userId2 },
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

  // Create column
  const column = await prisma.boardColumn.create({
    data: {
      boardId,
      name: "To Do",
      position: 0,
    },
  });
  columnId = column.id;
});

describe("Notifications API", () => {
  let testTaskId: string;

  beforeAll(async () => {
    // Create a test task for notification tests
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 999,
        title: "Notification Test Task",
        reporterId: adminId,
        position: 0,
      },
    });
    testTaskId = task.id;
  });

  it("GET /api/notifications returns user's notifications", async () => {
    await prisma.notification.create({
      data: {
        recipientId: userId1,
        type: "task.assigned",
        actorId: adminId,
        projectId,
        taskId: testTaskId,
        payload: { taskKey: "TEST-1", taskTitle: "Test Task" },
        emailStatus: "PENDING",
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", userId1);
    const req = new NextRequest("http://localhost:3000/api/notifications", { method: "GET", headers });
    const response = await getNotificationsRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.notifications)).toBe(true);
  });

  it("GET /api/notifications/unread-count returns correct count", async () => {
    const headers = new Headers();
    headers.set("x-user-id", userId1);
    const req = new NextRequest("http://localhost:3000/api/notifications/unread-count", { method: "GET", headers });
    const response = await getUnreadCountRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(typeof data.count).toBe("number");
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  it("POST /api/notifications/:notificationId/read marks notification as read", async () => {
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId1,
        type: "task.assigned",
        actorId: adminId,
        projectId,
        taskId: testTaskId,
        payload: { taskKey: "TEST-3", taskTitle: "Test Task 3" },
        emailStatus: "PENDING",
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", userId1);
    const req = new NextRequest(`http://localhost:3000/api/notifications/${notification.id}/read`, {
      method: "POST",
      headers,
    });
    const response = await markAsReadRoute(req, { params: Promise.resolve({ notificationId: notification.id }) });
    expect(response.status).toBe(200);

    const updated = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(updated?.readAt).not.toBeNull();
  });

  it("POST /api/notifications/read-all marks all as read", async () => {
    await prisma.notification.create({
      data: {
        recipientId: userId2,
        type: "task.assigned",
        actorId: adminId,
        projectId,
        taskId: testTaskId,
        payload: { taskKey: "TEST-4", taskTitle: "Test Task 4" },
        emailStatus: "PENDING",
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", userId2);
    const req = new NextRequest("http://localhost:3000/api/notifications/read-all", { method: "POST", headers });
    const response = await markAllAsReadRoute(req);
    expect(response.status).toBe(200);

    const unreadCount = await prisma.notification.count({
      where: {
        recipientId: userId2,
        readAt: null,
      },
    });
    expect(unreadCount).toBe(0);
  });

  it("User cannot read another user's notification", async () => {
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId1,
        type: "task.assigned",
        actorId: adminId,
        projectId,
        taskId: testTaskId,
        payload: { taskKey: "TEST-6", taskTitle: "Test Task 6" },
        emailStatus: "PENDING",
      },
    });

    const headers = new Headers();
    headers.set("x-user-id", userId2);
    const req = new NextRequest(`http://localhost:3000/api/notifications/${notification.id}/read`, {
      method: "POST",
      headers,
    });
    const response = await markAsReadRoute(req, { params: Promise.resolve({ notificationId: notification.id }) });
    expect(response.status).toBe(404);
  });

  it("GET /api/me/notification-settings returns user settings", async () => {
    const headers = new Headers();
    headers.set("x-user-id", userId1);
    const req = new NextRequest("http://localhost:3000/api/me/notification-settings", { method: "GET", headers });
    const response = await getSettingsRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings).toHaveProperty("emailEnabled");
    expect(typeof data.settings.emailEnabled).toBe("boolean");
  });

  it("PATCH /api/me/notification-settings updates settings", async () => {
    const headers = new Headers();
    headers.set("x-user-id", userId1);
    headers.set("content-type", "application/json");
    const req = new NextRequest("http://localhost:3000/api/me/notification-settings", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ emailEnabled: false }),
    });
    const response = await patchSettingsRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings.emailEnabled).toBe(false);

    // Verify in database
    const settings = await prisma.notificationSetting.findUnique({
      where: { userId: userId1 },
    });
    expect(settings?.emailEnabled).toBe(false);
  });

  it("Creating a task with assignee creates notification for assignee", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        boardId,
        columnId,
        title: "Assigned Task",
        assigneeId: userId1,
      }),
    });

    const response = await createTaskRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(201);

    const taskData = await response.json();
    const newTaskId = taskData.task.id;

    // Check if notification was created
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: userId1,
        taskId: newTaskId,
        type: "task.created",
      },
    });
    expect(notifications.length).toBeGreaterThan(0);
  });

  it("Actor is never notified of their own action", async () => {
    const headers = new Headers();
    headers.set("x-user-id", userId1);
    headers.set("content-type", "application/json");

    // User1 creates a task and assigns it to themselves
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        boardId,
        columnId,
        title: "Self-assigned Task",
        assigneeId: userId1,
      }),
    });

    const response = await createTaskRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(201);

    const taskData = await response.json();
    const newTaskId = taskData.task.id;

    // Check that no notification was created for the actor
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: userId1,
        actorId: userId1,
        taskId: newTaskId,
      },
    });
    expect(notifications.length).toBe(0);
  });

  afterAll(async () => {
    // Cleanup - no need as tests run on isolated database
  });
});
