import "server-only";
import { prisma } from "@/server/lib/prisma";
import { buildImageUrl } from "@/server/lib/cloudinary";

export class ActivityFeedService {
  static async getTaskActivity(projectId: string, taskId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: {
          projectId,
          taskId,
        },
        include: {
          actor: {
            select: { id: true, name: true, avatarPublicId: true, email: true },
          },
          task: {
            select: { id: true, number: true, title: true, columnId: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.activityLog.count({
        where: {
          projectId,
          taskId,
        },
      }),
    ]);

    const activities = logs.map((log) => ({
      id: log.id,
      action: log.action,
      actor: log.actor
        ? {
            ...log.actor,
            avatarUrl: log.actor.avatarPublicId ? buildImageUrl(log.actor.avatarPublicId, 32) : null,
          }
        : null,
      task: log.task,
      meta: log.meta,
      createdAt: log.createdAt,
    }));

    return {
      activities,
      total,
      page,
      pageSize,
      hasMore: skip + pageSize < total,
    };
  }

  static async getProjectActivity(projectId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { projectId },
        include: {
          actor: {
            select: { id: true, name: true, avatarPublicId: true, email: true },
          },
          task: {
            select: { id: true, number: true, title: true, columnId: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.activityLog.count({
        where: { projectId },
      }),
    ]);

    const activities = logs.map((log) => ({
      id: log.id,
      action: log.action,
      actor: log.actor
        ? {
            ...log.actor,
            avatarUrl: log.actor.avatarPublicId ? buildImageUrl(log.actor.avatarPublicId, 32) : null,
          }
        : null,
      task: log.task,
      meta: log.meta,
      createdAt: log.createdAt,
    }));

    return {
      activities,
      total,
      page,
      pageSize,
      hasMore: skip + pageSize < total,
    };
  }
}
