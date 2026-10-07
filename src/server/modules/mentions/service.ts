import "server-only";
import { prisma } from "@/server/lib/prisma";
import { parseMentions } from "./parser";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";

export interface MentionValidationError {
  error: { code: string; message: string; details?: string[] };
}

export class MentionService {
  static async validateAndSaveMentions(
    projectId: string,
    taskId: string,
    text: string,
    userId: string,
    commentId?: string
  ): Promise<MentionValidationError | { newMentionUserIds: string[]; hasAllMention: boolean }> {
    const mentions = parseMentions(text);

    if (mentions.length === 0) {
      return { newMentionUserIds: [], hasAllMention: false };
    }

    const perms = getPerms();
    await setupPermissions();

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { columnId: true } });
    if (!task) throw new Error("Task not found");

    const userRoles = await perms.user(userId).getRoles();
    const canViewColumn = await ColumnRulesService.canViewColumn(userRoles, task.columnId);
    if (!canViewColumn) throw new Error("Cannot view task column");

    const invalidIds: string[] = [];
    const validUserIds: string[] = [];
    let hasAllMention = false;

    for (const mention of mentions) {
      if (mention.type === "all") {
        const hasPermission = await perms.user(userId).can("mention.all");
        if (!hasPermission) {
          return { error: { code: "FORBIDDEN", message: "Permission denied for @all mention" } };
        }
        hasAllMention = true;
      } else if (mention.userId) {
        const mentionedUser = await prisma.user.findUnique({
          where: { id: mention.userId },
          select: { id: true, isActive: true, status: true },
        });

        if (!mentionedUser || !mentionedUser.isActive || mentionedUser.status !== "ACTIVE") {
          invalidIds.push(mention.userId);
          continue;
        }

        const isMember = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: mention.userId } },
        });
        if (!isMember) {
          invalidIds.push(mention.userId);
          continue;
        }

        const mentionedRoles = await perms.user(mention.userId).getRoles();
        const canViewTask = await ColumnRulesService.canViewColumn(mentionedRoles, task.columnId);
        if (!canViewTask) {
          invalidIds.push(mention.userId);
          continue;
        }

        validUserIds.push(mention.userId);
      }
    }

    if (invalidIds.length > 0) {
      return { error: { code: "VALIDATION_ERROR", message: "Invalid mentions", details: invalidIds } };
    }

    const oldMentions = await prisma.mention.findMany({
      where: commentId ? { commentId } : { taskId },
      select: { userId: true, isAll: true },
    });

    const oldUserIds = new Set(oldMentions.filter((m) => m.userId).map((m) => m.userId!));
    const newMentionUserIds = validUserIds.filter((id) => !oldUserIds.has(id));

    await prisma.mention.deleteMany({
      where: commentId ? { commentId } : { taskId },
    });

    if (validUserIds.length > 0) {
      await prisma.mention.createMany({
        data: validUserIds.map((userId) => ({
          taskId: commentId ? undefined : taskId,
          commentId,
          userId,
        })),
      });
    }

    if (hasAllMention) {
      await prisma.mention.create({
        data: {
          taskId: commentId ? undefined : taskId,
          commentId,
          isAll: true,
        },
      });
    }

    return { newMentionUserIds, hasAllMention };
  }

  static async getMentions(taskId?: string, commentId?: string) {
    if (!taskId && !commentId) throw new Error("Either taskId or commentId required");

    const mentions = await prisma.mention.findMany({
      where: taskId ? { taskId } : { commentId },
      include: {
        user: { select: { id: true, name: true, avatarPublicId: true } },
      },
    });

    const users = mentions.filter((m) => !m.isAll).map((m) => m.user).filter(Boolean);
    const mentionsAll = mentions.some((m) => m.isAll);

    return { users, mentionsAll };
  }

  static async getMentionableUsers(projectId: string, taskId: string, query?: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { columnId: true } });
    if (!task) throw new Error("Task not found");

    const perms = getPerms();
    await setupPermissions();

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });

    const users: Array<{ id: string; name: string; avatarPublicId: string | null }> = [];

    for (const member of members) {
      const user = await prisma.user.findUnique({
        where: { id: member.userId },
        select: { id: true, name: true, avatarPublicId: true, isActive: true, status: true },
      });

      if (!user || !user.isActive || user.status !== "ACTIVE") continue;

      const userRoles = await perms.user(user.id).getRoles();
      const canViewColumn = await ColumnRulesService.canViewColumn(userRoles, task.columnId);
      if (!canViewColumn) continue;

      if (query && !user.name.toLowerCase().includes(query.toLowerCase())) continue;

      users.push({ id: user.id, name: user.name, avatarPublicId: user.avatarPublicId });
    }

    return users;
  }
}
