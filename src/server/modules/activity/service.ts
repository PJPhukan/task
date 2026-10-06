import "server-only";
import { prisma } from "@/server/lib/prisma";

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
    return prisma.activityLog.create({
      data: {
        projectId,
        action,
        actorId,
        taskId,
        meta: metadata || {},
      },
    });
  }
}
