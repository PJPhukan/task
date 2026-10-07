import "server-only";
import { prisma } from "@/server/lib/prisma";
import { getMailer } from "@/server/lib/mailer";
import { runAfterResponse } from "@/server/lib/run-after-response";
import { createNotificationEmailTemplate } from "./email-templates";

export async function sendNotificationEmailsAsync(projectId: string) {
  await runAfterResponse(async () => {
    try {
      await sendPendingNotificationEmails(projectId);
    } catch (error) {
      console.error("Error sending notification emails:", error);
    }
  });
}

async function sendPendingNotificationEmails(projectId: string) {
  const notifications = await prisma.notification.findMany({
    where: {
      projectId,
      emailStatus: "PENDING",
    },
    include: {
      recipient: { select: { email: true } },
      actor: { select: { name: true } },
      task: { select: { number: true, title: true, projectId: true, boardId: true, columnId: true } },
    },
    take: 100,
  });

  const mailer = getMailer();

  for (const notification of notifications) {
    if (!notification.recipient.email || !notification.task) {
      // Mark as skipped if no email or task
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailStatus: "SKIPPED" },
      });
      continue;
    }

    // Check if recipient has email enabled
    const settings = await prisma.notificationSetting.findUnique({
      where: { userId: notification.recipientId },
    });

    if (!settings || !settings.emailEnabled) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailStatus: "SKIPPED" },
      });
      continue;
    }

    try {
      const taskUrl = `/projects/${notification.task.projectId}/boards/${notification.task.boardId}`;
      const template = createNotificationEmailTemplate(
        notification.type,
        { name: notification.actor.name },
        { number: notification.task.number, title: notification.task.title },
        taskUrl
      );

      await mailer.send({
        to: notification.recipient.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailStatus: "SENT" },
      });
    } catch (error) {
      console.error(`Failed to send email for notification ${notification.id}:`, error);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailStatus: "FAILED" },
      });
    }
  }
}
