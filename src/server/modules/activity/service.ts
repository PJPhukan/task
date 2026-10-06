import "server-only";
import { prisma } from "@/server/lib/prisma";

export type ActivityAction =
  | "task.created"
  | "task.updated"
  | "task.assigned"
  | "task.moved"
  | "task.deleted";

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
