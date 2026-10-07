import "server-only";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ColumnRulesService } from "../columns/rules-service";

export type NotificationType =
  | "task.created"
  | "task.assigned"
  | "task.unassigned"
  | "comment.added"
  | "comment.edited"
  | "due_date_changed"
  | "task.moved"
  | "task.sent_back";

export class NotificationService {
  static async recordActivityAndNotify(
    projectId: string,
    action: string,
    actorId: string,
    taskId?: string,
    metadata?: any
  ) {
    // Determine notification type and send notifications
    if (taskId) {
      await this.notifyForTaskAction(projectId, action, actorId, taskId, metadata);
    }
  }

  private static async notifyForTaskAction(
    projectId: string,
    action: string,
    actorId: string,
    taskId: string,
    metadata?: any
  ) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        column: {
          select: { isDone: true },
        },
        comments: {
          select: { authorId: true },
          distinct: ["authorId"],
        },
      },
    });

    if (!task) return;

    const recipients = new Set<string>();
    let notificationType: NotificationType | null = null;
    let emailOnly = false;

    // Determine recipients based on action
    switch (action) {
      case "task.created":
        if (task.assigneeId && task.assigneeId !== actorId) {
          recipients.add(task.assigneeId);
          notificationType = "task.created";
        }
        break;

      case "task.assigned": {
        const prevAssigneeId = metadata?.prevAssigneeId;
        if (task.assigneeId && task.assigneeId !== actorId) {
          recipients.add(task.assigneeId);
          notificationType = "task.assigned";
        }
        if (prevAssigneeId && prevAssigneeId !== actorId) {
          // Send "unassigned" notification to previous assignee
          await this.createNotification(
            prevAssigneeId,
            "task.unassigned",
            actorId,
            projectId,
            taskId,
            null,
            { taskKey: task.number, taskTitle: task.title }
          );
        }
        break;
      }

      case "comment.created":
        // Notify assignee, reporter, and previous commenters
        if (task.assigneeId && task.assigneeId !== actorId) {
          recipients.add(task.assigneeId);
        }
        if (task.reporterId && task.reporterId !== actorId) {
          recipients.add(task.reporterId);
        }
        for (const comment of task.comments) {
          if (comment.authorId && comment.authorId !== actorId) {
            recipients.add(comment.authorId);
          }
        }
        notificationType = "comment.added";
        // Pass commentId to notifications
        for (const recipientId of recipients) {
          await this.createNotification(
            recipientId,
            notificationType,
            actorId,
            projectId,
            taskId,
            metadata?.commentId || null,
            { taskKey: task.number, taskTitle: task.title, commentId: metadata?.commentId }
          );
        }
        return;

      case "comment.updated":
        // Same people as created, but in-app only
        if (task.assigneeId && task.assigneeId !== actorId) {
          recipients.add(task.assigneeId);
        }
        if (task.reporterId && task.reporterId !== actorId) {
          recipients.add(task.reporterId);
        }
        for (const comment of task.comments) {
          if (comment.authorId && comment.authorId !== actorId) {
            recipients.add(comment.authorId);
          }
        }
        notificationType = "comment.edited";
        emailOnly = true; // In-app only
        // Pass commentId to notifications with SKIPPED email status
        for (const recipientId of recipients) {
          await this.createNotification(
            recipientId,
            notificationType,
            actorId,
            projectId,
            taskId,
            metadata?.commentId || null,
            { taskKey: task.number, taskTitle: task.title, commentId: metadata?.commentId },
            "SKIPPED"
          );
        }
        return;

      case "task.updated":
        // Check if due date changed
        if (metadata?.dueDateChanged) {
          if (task.assigneeId && task.assigneeId !== actorId) {
            recipients.add(task.assigneeId);
          }
          if (task.reporterId && task.reporterId !== actorId) {
            recipients.add(task.reporterId);
          }
          notificationType = "due_date_changed";
        }
        break;

      case "task.moved":
        // Notify assignee and reporter when moved to done
        if (metadata?.columnIsDone) {
          if (task.assigneeId && task.assigneeId !== actorId) {
            recipients.add(task.assigneeId);
          }
          if (task.reporterId && task.reporterId !== actorId) {
            recipients.add(task.reporterId);
          }
          notificationType = "task.moved";
        }
        // Also handle MOVE rules
        else if (metadata?.moveRoleIds && metadata.moveRoleIds.length > 0) {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
              members: {
                include: {
                  user: { select: { id: true, isActive: true, status: true } },
                },
              },
            },
          });

          if (project) {
            const perms = getPerms();
            await setupPermissions();

            for (const member of project.members) {
              if (member.user.id === actorId || !member.user.isActive || member.user.status !== "ACTIVE") {
                continue;
              }

              const userRoles = await perms.user(member.user.id).getRoles();
              const hasRole = (metadata.moveRoleIds || []).some((roleId: string) =>
                userRoles.includes(roleId)
              );

              if (hasRole) {
                // Check if user can view the column
                const canView = await ColumnRulesService.canViewColumn(userRoles, task.columnId);
                if (canView) {
                  recipients.add(member.user.id);
                }
              }
            }
            notificationType = "task.moved";
          }
        }
        break;
    }

    if (!notificationType) return;

    // Create notifications for each recipient
    for (const recipientId of recipients) {
      await this.createNotification(
        recipientId,
        notificationType,
        actorId,
        projectId,
        taskId,
        null,
        { taskKey: task.number, taskTitle: task.title },
        emailOnly ? "SKIPPED" : "PENDING"
      );
    }
  }

  private static async createNotification(
    recipientId: string,
    type: NotificationType,
    actorId: string,
    projectId: string,
    taskId: string,
    commentId: string | null,
    payload: any,
    initialEmailStatus?: string
  ) {
    // Check if recipient is active
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { isActive: true, status: true },
    });

    if (!recipient || !recipient.isActive || recipient.status !== "ACTIVE") {
      return;
    }

    return prisma.notification.create({
      data: {
        recipientId,
        type,
        actorId,
        projectId,
        taskId,
        commentId,
        payload,
        emailStatus: initialEmailStatus || "PENDING",
      },
    });
  }

  static async getNotifications(userId: string, unreadOnly: boolean = false, limit: number = 20, offset: number = 0) {
    const where: any = { recipientId: userId };
    if (unreadOnly) {
      where.readAt = null;
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        actor: {
          select: { id: true, name: true, avatarPublicId: true },
        },
        task: {
          select: { id: true, projectId: true, boardId: true, columnId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return notifications;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        recipientId: userId,
        readAt: null,
      },
    });
  }

  static async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientId: userId,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        recipientId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  static async getNotificationSettings(userId: string) {
    let settings = await prisma.notificationSetting.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.notificationSetting.create({
        data: {
          userId,
          emailEnabled: true,
        },
      });
    }

    return settings;
  }

  static async updateNotificationSettings(userId: string, emailEnabled: boolean) {
    const settings = await prisma.notificationSetting.findUnique({
      where: { userId },
    });

    if (!settings) {
      return prisma.notificationSetting.create({
        data: {
          userId,
          emailEnabled,
        },
      });
    }

    return prisma.notificationSetting.update({
      where: { userId },
      data: { emailEnabled },
    });
  }
}
