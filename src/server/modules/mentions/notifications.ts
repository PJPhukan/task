import "server-only";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";

export async function createMentionNotifications(
  projectId: string,
  taskId: string,
  commentId: string | undefined,
  actorId: string,
  newMentionUserIds: string[],
  hasAllMention: boolean
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { columnId: true },
  });
  if (!task) return;

  const perms = getPerms();
  await setupPermissions();

  // Create notifications for specifically mentioned users
  for (const userId of newMentionUserIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, status: true },
    });
    if (user && user.isActive && user.status === "ACTIVE" && userId !== actorId) {
      await prisma.notification.create({
        data: {
          recipientId: userId,
          type: "mention",
          actorId,
          projectId,
          taskId,
          commentId,
          payload: { taskId, commentId },
        },
      });
    }
  }

  // Create notifications for @all mentions
  if (hasAllMention) {
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });

    for (const member of projectMembers) {
      if (member.userId === actorId) continue;

      const user = await prisma.user.findUnique({
        where: { id: member.userId },
        select: { isActive: true, status: true },
      });
      if (!user || !user.isActive || user.status !== "ACTIVE") continue;

      const userRoles = await perms.user(member.userId).getRoles();
      const canViewTask = await ColumnRulesService.canViewColumn(userRoles, task.columnId);
      if (!canViewTask) continue;

      await prisma.notification.create({
        data: {
          recipientId: member.userId,
          type: "mention.all",
          actorId,
          projectId,
          taskId,
          commentId,
          payload: { taskId, commentId },
        },
      });
    }
  }
}
