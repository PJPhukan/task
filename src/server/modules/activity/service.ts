import "server-only";
import { prisma } from "@/server/lib/prisma";
import { NotificationService } from "../notifications/service";
import { sendNotificationEmailsAsync } from "../notifications/email-sender";

export type ActivityAction =
  | "task.created"
  | "task.updated"
  | "task.assigned"
  | "task.moved"
  | "task.deleted"
  | "label.created"
  | "label.updated"
  | "label.deleted"
  | "comment.created"
  | "comment.updated"
  | "comment.deleted"
  | "attachment.added"
  | "attachment.removed";

export interface ActivityMetadata {
  [key: string]: any;
}

export class ActivityService {
  static async recordActivity(
    projectId: string,
    action: ActivityAction,
    actorId: string,
    taskId?: string,
    metadata?: ActivityMetadata
  ) {
    const activity = await prisma.activityLog.create({
      data: {
        projectId,
        action,
        actorId,
        taskId,
        meta: metadata || {},
      },
    });

    // Trigger notifications for task-related actions
    if (taskId && this.isTaskAction(action)) {
      await NotificationService.recordActivityAndNotify(
        projectId,
        action,
        actorId,
        taskId,
        metadata
      );

      // Send emails asynchronously after response
      sendNotificationEmailsAsync(projectId);
    }

    return activity;
  }

  private static isTaskAction(action: string): boolean {
    return [
      "task.created",
      "task.updated",
      "task.assigned",
      "task.moved",
      "comment.created",
      "comment.updated",
    ].includes(action);
  }
}
