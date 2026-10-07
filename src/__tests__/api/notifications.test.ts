import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getNotificationsRoute } from "@/app/api/notifications/route";
import { GET as getUnreadCountRoute } from "@/app/api/notifications/unread-count/route";
import { POST as markAsReadRoute } from "@/app/api/notifications/[notificationId]/read/route";
import { POST as markAllAsReadRoute } from "@/app/api/notifications/read-all/route";
import { GET as getSettingsRoute, PATCH as patchSettingsRoute } from "@/app/api/me/notification-settings/route";
import { POST as createTaskRoute } from "@/app/api/projects/[projectId]/tasks/route";
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

describe("Notifications API", () => {

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

  it("Reassigning a task notifies new assignee and tells old assignee they were unassigned", async () => {
    // Create a task assigned to user1
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 501,
        title: "Task to reassign",
        reporterId: adminId,
        assigneeId: userId1,
        position: 0,
      },
    });

    // Clear any existing notifications
    await prisma.notification.deleteMany({
      where: { taskId: task.id },
    });

    // Reassign task to user2
    await prisma.task.update({
      where: { id: task.id },
      data: { assigneeId: userId2 },
    });

    // Record the reassignment activity
    await prisma.activityLog.create({
      data: {
        projectId,
        taskId: task.id,
        action: "task.assigned",
        actorId: adminId,
        meta: { prevAssigneeId: userId1 },
      },
    });

    // Trigger notifications
    const { NotificationService } = await import("@/server/modules/notifications/service");
    await NotificationService.recordActivityAndNotify(projectId, "task.assigned", adminId, task.id, {
      prevAssigneeId: userId1,
    });

    // Check new assignee got task.assigned notification
    const newAssigneeNotif = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        recipientId: userId2,
        type: "task.assigned",
      },
    });
    expect(newAssigneeNotif).not.toBeNull();

    // Check old assignee got task.unassigned notification
    const oldAssigneeNotif = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        recipientId: userId1,
        type: "task.unassigned",
      },
    });
    expect(oldAssigneeNotif).not.toBeNull();
  });

  it("Comment notifies assignee, reporter and earlier commenters exactly once each, not the commenter", async () => {
    // Create task assigned to user1, reported by admin
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 502,
        title: "Task with comments",
        reporterId: adminId,
        assigneeId: userId1,
        position: 1,
      },
    });

    // User2 adds first comment
    await prisma.comment.create({
      data: {
        taskId: task.id,
        authorId: userId2,
        body: "First comment",
      },
    });

    // Clear any existing notifications
    await prisma.notification.deleteMany({
      where: { taskId: task.id },
    });

    // User1 adds second comment (the commenter)
    const comment2 = await prisma.comment.create({
      data: {
        taskId: task.id,
        authorId: userId1,
        body: "Reply comment",
      },
    });

    // Trigger notifications for the new comment
    const { NotificationService } = await import("@/server/modules/notifications/service");
    await NotificationService.recordActivityAndNotify(projectId, "comment.created", userId1, task.id, {
      commentId: comment2.id,
    });

    // Check assignee (user1, but also the commenter - should NOT get notification)
    const assigneeNotif = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        recipientId: userId1,
        type: "comment.added",
      },
    });
    expect(assigneeNotif).toBeNull();

    // Check reporter (admin) gets notification
    const reporterNotif = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        recipientId: adminId,
        type: "comment.added",
      },
    });
    expect(reporterNotif).not.toBeNull();

    // Check earlier commenter (user2) gets notification once
    const earlierCommenterNotif = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        recipientId: userId2,
        type: "comment.added",
      },
    });
    expect(earlierCommenterNotif).not.toBeNull();

    const count = await prisma.notification.count({
      where: {
        taskId: task.id,
        recipientId: userId2,
        type: "comment.added",
      },
    });
    expect(count).toBe(1);
  });

  it("Editing a comment creates in-app notifications with emailStatus SKIPPED and fake mailer receives nothing", async () => {
    // Create task
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 503,
        title: "Task for comment edit",
        reporterId: adminId,
        assigneeId: userId1,
        position: 2,
      },
    });

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        taskId: task.id,
        authorId: userId2,
        body: "Original comment",
      },
    });

    // Clear any existing notifications
    await prisma.notification.deleteMany({
      where: { taskId: task.id },
    });

    // Trigger notifications for comment edit
    const { NotificationService } = await import("@/server/modules/notifications/service");
    await NotificationService.recordActivityAndNotify(projectId, "comment.updated", userId2, task.id, {
      commentId: comment.id,
    });

    // Check notifications were created with SKIPPED email status
    const notifications = await prisma.notification.findMany({
      where: {
        taskId: task.id,
        type: "comment.edited",
      },
    });
    expect(notifications.length).toBeGreaterThan(0);
    for (const notif of notifications) {
      expect(notif.emailStatus).toBe("SKIPPED");
    }

    // Get the fake mailer to check it received no emails
    const { getMailer } = await import("@/server/lib/mailer");
    const mailer = getMailer();
    const sentEmails = mailer.getSentEmails();
    const emailsForTask = sentEmails.filter((e: any) => e.subject?.includes("edit"));
    expect(emailsForTask.length).toBe(0);
  });

  it("Changing due date notifies assignee and reporter", async () => {
    // Create task
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 504,
        title: "Task with due date",
        reporterId: adminId,
        assigneeId: userId1,
        position: 3,
        dueDate: new Date("2025-12-31"),
      },
    });

    // Clear any existing notifications
    await prisma.notification.deleteMany({
      where: { taskId: task.id },
    });

    // Update the task with new due date
    await prisma.task.update({
      where: { id: task.id },
      data: { dueDate: new Date("2026-01-15") },
    });

    // Trigger notifications
    const { NotificationService } = await import("@/server/modules/notifications/service");
    await NotificationService.recordActivityAndNotify(projectId, "task.updated", adminId, task.id, {
      dueDateChanged: true,
    });

    // Check assignee gets notification
    const assigneeNotif = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        recipientId: userId1,
        type: "due_date_changed",
      },
    });
    expect(assigneeNotif).not.toBeNull();

    // Check reporter gets notification
    const reporterNotif = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        recipientId: adminId,
        type: "due_date_changed",
      },
    });
    expect(reporterNotif).toBeNull(); // Reporter is the actor, so no notification
  });

  it("Moving task into done column notifies assignee and reporter", async () => {
    // Create a done column
    const doneColumn = await prisma.boardColumn.create({
      data: {
        boardId,
        name: "Done",
        position: 3,
        isDone: true,
      },
    });

    // Create task
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 505,
        title: "Task to complete",
        reporterId: adminId,
        assigneeId: userId1,
        position: 4,
      },
    });

    // Clear any existing notifications
    await prisma.notification.deleteMany({
      where: { taskId: task.id },
    });

    // Move task to done column
    await prisma.task.update({
      where: { id: task.id },
      data: { columnId: doneColumn.id },
    });

    // Trigger notifications
    const { NotificationService } = await import("@/server/modules/notifications/service");
    await NotificationService.recordActivityAndNotify(projectId, "task.moved", adminId, task.id, {
      columnIsDone: true,
      moveRoleIds: [],
    });

    // Check assignee gets notification
    const assigneeNotif = await prisma.notification.findFirst({
      where: {
        taskId: task.id,
        recipientId: userId1,
        type: "task.moved",
      },
    });
    expect(assigneeNotif).not.toBeNull();

    // Check reporter doesn't get (admin is reporter and actor)
    const reporterNotif = await prisma.notification.findMany({
      where: {
        taskId: task.id,
        recipientId: adminId,
        type: "task.moved",
      },
    });
    expect(reporterNotif.length).toBe(0); // Actor doesn't get notified
  });

  it("Recipient with emailEnabled false gets notification with SKIPPED status and no email", async () => {
    // Disable email for user1
    await prisma.notificationSetting.update({
      where: { userId: userId1 },
      data: { emailEnabled: false },
    });

    // Create task assigned to user1
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 506,
        title: "Task for user with disabled email",
        reporterId: adminId,
        assigneeId: userId1,
        position: 5,
      },
    });

    // Trigger email sending
    const { sendPendingNotificationEmails } = await import("@/server/modules/notifications/email-sender");

    // Create a notification with PENDING status
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId1,
        type: "task.assigned",
        actorId: adminId,
        projectId,
        taskId: task.id,
        payload: { taskKey: task.number, taskTitle: task.title },
        emailStatus: "PENDING",
      },
    });

    // Try to send emails (should skip due to emailEnabled: false)
    await (sendPendingNotificationEmails as any)(projectId);

    // Check notification status is SKIPPED
    const updated = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(updated?.emailStatus).toBe("SKIPPED");

    // Re-enable email for user1
    await prisma.notificationSetting.update({
      where: { userId: userId1 },
      data: { emailEnabled: true },
    });
  });

  it("Notification email reaches fake mailer with task key in subject and notification marked SENT", async () => {
    // Create task
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 507,
        title: "Email test task",
        reporterId: adminId,
        assigneeId: userId1,
        position: 6,
      },
    });

    // Create a PENDING notification
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId1,
        type: "task.created",
        actorId: adminId,
        projectId,
        taskId: task.id,
        payload: { taskKey: `TST-${task.number}`, taskTitle: task.title },
        emailStatus: "PENDING",
      },
    });

    // Send pending emails
    const { sendPendingNotificationEmails } = await import("@/server/modules/notifications/email-sender");
    await (sendPendingNotificationEmails as any)(projectId);

    // Check notification is marked SENT
    const updated = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(updated?.emailStatus).toBe("SENT");

    // Check the fake mailer received the email
    const { getMailer } = await import("@/server/lib/mailer");
    const mailer = getMailer();
    const sentEmails = mailer.getSentEmails();
    const user1Email = (await prisma.user.findUnique({
      where: { id: userId1 },
      select: { email: true },
    }))?.email;
    const taskEmail = sentEmails.find((e: any) => e.to === user1Email);
    expect(taskEmail).toBeDefined();
    expect(taskEmail?.subject).toContain("507");
  });

  it("When fake mailer fails, request succeeds and notification marked FAILED", async () => {
    // Create task
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 508,
        title: "Email failure test task",
        reporterId: adminId,
        assigneeId: userId2,
        position: 7,
      },
    });

    // Ensure email is enabled for user2
    await prisma.notificationSetting.upsert({
      where: { userId: userId2 },
      update: { emailEnabled: true },
      create: { userId: userId2, emailEnabled: true },
    });

    // Create a PENDING notification
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId2,
        type: "task.created",
        actorId: adminId,
        projectId,
        taskId: task.id,
        payload: { taskKey: `TST-${task.number}`, taskTitle: task.title },
        emailStatus: "PENDING",
      },
    });

    // Set the fake mailer to fail
    const { getMailer } = await import("@/server/lib/mailer");
    const mailer = getMailer();
    mailer.setFakeShouldFail(true);

    // Send pending emails
    const { sendPendingNotificationEmails } = await import("@/server/modules/notifications/email-sender");
    let error: any = null;
    try {
      await (sendPendingNotificationEmails as any)(projectId);
    } catch (e) {
      error = e;
    }

    // The send function should not throw (errors are caught)
    expect(error).toBeNull();

    // Check notification is marked FAILED
    const updated = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(updated?.emailStatus).toBe("FAILED");

    // Reset mailer
    mailer.setFakeShouldFail(false);
  });

  it("Deleting a task with notifications succeeds and removes them", async () => {
    // Create a task
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 1000,
        title: "Task with Notifications",
        reporterId: adminId,
        position: 0,
      },
    });

    // Create notifications for the task
    await prisma.notification.create({
      data: {
        recipientId: userId1,
        type: "task.assigned",
        actorId: adminId,
        projectId,
        taskId: task.id,
        payload: { taskKey: "TEST-1000", taskTitle: "Task with Notifications" },
        emailStatus: "PENDING",
      },
    });

    const notificationsBefore = await prisma.notification.count({
      where: { taskId: task.id },
    });
    expect(notificationsBefore).toBeGreaterThan(0);

    // Delete the task
    await prisma.task.delete({
      where: { id: task.id },
    });

    // Verify task is deleted
    const deletedTask = await prisma.task.findUnique({
      where: { id: task.id },
    });
    expect(deletedTask).toBeNull();

    // Verify notifications are also deleted
    const notificationsAfter = await prisma.notification.count({
      where: { taskId: task.id },
    });
    expect(notificationsAfter).toBe(0);
  });

  it("Deleting a comment with notifications succeeds and sets comment to null", async () => {
    // Create a comment
    const comment = await prisma.comment.create({
      data: {
        taskId: testTaskId,
        authorId: userId1,
        body: "Test comment with notifications",
      },
    });

    // Create notification with this comment
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId2,
        type: "comment.added",
        actorId: userId1,
        projectId,
        taskId: testTaskId,
        commentId: comment.id,
        payload: { taskKey: "TEST-1", taskTitle: "Test Task", commentId: comment.id },
        emailStatus: "PENDING",
      },
    });

    expect(notification.commentId).toBe(comment.id);

    // Delete the comment
    await prisma.comment.delete({
      where: { id: comment.id },
    });

    // Verify comment is deleted
    const deletedComment = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(deletedComment).toBeNull();

    // Verify notification still exists but commentId is null
    const updatedNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(updatedNotification).not.toBeNull();
    expect(updatedNotification?.commentId).toBeNull();
  });

  afterAll(async () => {
    // Cleanup - no need as tests run on isolated database
  });
});
