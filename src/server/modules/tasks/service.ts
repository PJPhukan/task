import "server-only";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { CreateTaskInput, UpdateTaskInput, MoveTaskInput } from "./schema";
import { ActivityService } from "@/server/modules/activity/service";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";
import { MentionService } from "@/server/modules/mentions/service";
import { sendNotificationEmailsAsync } from "@/server/modules/notifications/email-sender";
import { deleteResource } from "@/server/lib/cloudinary";

export class TaskService {
  static async createTask(projectId: string, input: CreateTaskInput, userId: string) {
    // Verify board exists and belongs to project
    const board = await prisma.board.findFirst({
      where: { id: input.boardId, projectId },
    });
    if (!board) throw new Error("Board not found");

    // Verify column exists and belongs to board
    const column = await prisma.boardColumn.findFirst({
      where: { id: input.columnId, boardId: input.boardId },
    });
    if (!column) throw new Error("Column not found");

    // Verify assignee if provided
    if (input.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: input.assigneeId },
      });
      if (!assignee || !assignee.isActive) throw new Error("Assignee not found or inactive");

      const isMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: input.assigneeId } },
      });
      if (!isMember) throw new Error("Assignee is not a project member");
    }

    // Get next task number
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true, key: true },
    });

    // Create task with stage entry in transaction
    const task = await prisma.$transaction(async (tx) => {
      const newTask = await tx.task.create({
        data: {
          projectId,
          boardId: input.boardId,
          columnId: input.columnId,
          number: updatedProject.taskCounter,
          title: input.title,
          description: input.description,
          priority: input.priority,
          startDate: input.startDate ? new Date(input.startDate) : null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          assigneeId: input.assigneeId,
          reporterId: userId,
          position: 0,
        },
      });

      // Create initial stage entry
      await (tx as any).taskStageEntry.create({
        data: {
          taskId: newTask.id,
          columnId: input.columnId,
          enteredById: userId,
          assigneeAtEntry: input.assigneeId,
        },
      });

      return newTask;
    });

    let newMentionUserIds: string[] = [];
    let hasAllMention = false;

    if (input.description) {
      const mentionResult = await MentionService.validateAndSaveMentions(projectId, task.id, input.description, userId);
      if ("error" in mentionResult) {
        await prisma.task.delete({ where: { id: task.id } });
        throw new Error(JSON.stringify(mentionResult.error));
      }
      newMentionUserIds = mentionResult.newMentionUserIds;
      hasAllMention = mentionResult.hasAllMention;
    }

    // Record activity
    await ActivityService.recordActivity(projectId, "task.created", userId, task.id, {
      title: task.title,
      columnId: input.columnId,
    });

    return {
      ...task,
      bounceCount: task.bounceCount ?? 0,
      key: `${updatedProject.key}-${task.number}`,
      labels: [],
      canMove: false,
      newMentionUserIds,
      hasAllMention,
    };
  }

  static async getTask(projectId: string, taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
        labels: { include: { label: true } },
        mentions: {
          include: {
            user: { select: { id: true, name: true, avatarPublicId: true } },
          },
        },
      },
    });

    if (!task) throw new Error("Task not found");

    // Check if user can view the column
    const perms = getPerms();
    await setupPermissions();
    const userRoles = await perms.user(userId).getRoles();
    const canViewColumn = await ColumnRulesService.canViewColumn(userRoles, task.columnId);

    if (!canViewColumn) throw new Error("Cannot access column");

    const canMove = await ColumnRulesService.canMoveFromColumn(userRoles, task.columnId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    const mentions = task.mentions.filter((m) => !m.isAll).map((m) => m.user).filter(Boolean);
    const mentionsAll = task.mentions.some((m) => m.isAll);

    return {
      ...task,
      key: `${project?.key}-${task.number}`,
      labels: task.labels.map((tl) => ({
        id: tl.label.id,
        name: tl.label.name,
        color: tl.label.color,
      })),
      mentions: mentions.length > 0 ? mentions : undefined,
      mentionsAll: mentionsAll ? true : undefined,
      canMove,
    };
  }

  static async updateTask(
    projectId: string,
    taskId: string,
    input: UpdateTaskInput,
    userId: string
  ) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) throw new Error("Task not found");

    // Verify assignee if provided
    if (input.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: input.assigneeId },
      });
      if (!assignee || !assignee.isActive) throw new Error("Assignee not found or inactive");

      const isMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: input.assigneeId } },
      });
      if (!isMember) throw new Error("Assignee is not a project member");
    }

    const updateData: any = {};
    const oldValues: any = {};

    if (input.title !== undefined) {
      oldValues.title = task.title;
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      oldValues.description = task.description;
      updateData.description = input.description;
    }
    if (input.priority !== undefined) {
      oldValues.priority = task.priority;
      updateData.priority = input.priority;
    }
    if (input.startDate !== undefined) {
      oldValues.startDate = task.startDate;
      updateData.startDate = input.startDate ? new Date(input.startDate) : null;
    }
    if (input.dueDate !== undefined) {
      oldValues.dueDate = task.dueDate;
      updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }
    if (input.assigneeId !== undefined) {
      oldValues.assigneeId = task.assigneeId;
      updateData.assigneeId = input.assigneeId;
    }

    let newMentionUserIds: string[] = [];
    let hasAllMention = false;

    if (input.description !== undefined) {
      const mentionResult = await MentionService.validateAndSaveMentions(projectId, taskId, input.description, userId);
      if ("error" in mentionResult) {
        throw new Error(JSON.stringify(mentionResult.error));
      }
      newMentionUserIds = mentionResult.newMentionUserIds;
      hasAllMention = mentionResult.hasAllMention;
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
        labels: { include: { label: true } },
      },
    });

    // Record activities
    if (Object.keys(oldValues).length > 0) {
      const dueDateChanged = input.dueDate !== undefined && oldValues.dueDate !== updateData.dueDate;
      await ActivityService.recordActivity(projectId, "task.updated", userId, taskId, {
        changes: oldValues,
        dueDateChanged,
      });
    }

    if (input.assigneeId !== undefined && input.assigneeId !== task.assigneeId) {
      await ActivityService.recordActivity(projectId, "task.assigned", userId, taskId, {
        prevAssigneeId: task.assigneeId,
      });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    return {
      ...updated,
      key: `${project?.key}-${updated.number}`,
      labels: updated.labels.map((tl) => ({
        id: tl.label.id,
        name: tl.label.name,
        color: tl.label.color,
      })),
      canMove: false,
      newMentionUserIds,
      hasAllMention,
    };
  }

  static async deleteTask(projectId: string, taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) throw new Error("Task not found");

    // Check permission: task.delete or (task.delete.own and user is reporter)
    const perms = getPerms();
    await setupPermissions();
    const hasDeleteAny = await perms.user(userId).can("task.delete");
    const hasDeleteOwn = await perms.user(userId).can("task.delete.own");

    if (!hasDeleteAny && !(hasDeleteOwn && task.reporterId === userId)) {
      throw new Error("Permission denied");
    }

    // Delete all attachments from Cloudinary
    const attachments = await prisma.attachment.findMany({
      where: { taskId },
    });
    for (const attachment of attachments) {
      await deleteResource(attachment.publicId);
    }

    await ActivityService.recordActivity(projectId, "task.deleted", userId, taskId, {
      title: task.title,
    });

    await prisma.task.delete({
      where: { id: taskId },
    });
  }

  static async moveTask(
    projectId: string,
    taskId: string,
    input: MoveTaskInput,
    userId: string
  ) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) throw new Error("Task not found");

    // Verify target column exists and belongs to same board
    const targetColumn = await prisma.boardColumn.findFirst({
      where: { id: input.columnId, boardId: task.boardId },
    });
    if (!targetColumn) throw new Error("Target column not found");

    // Get source column
    const sourceColumn = await prisma.boardColumn.findUnique({
      where: { id: task.columnId },
    });
    if (!sourceColumn) throw new Error("Source column not found");

    // Check if this is a backward move
    const isBackwardMove = targetColumn.position < sourceColumn.position;
    if (isBackwardMove && !input.reason) {
      const error = { code: "VALIDATION_ERROR", message: "Reason required for moving task backward", details: ["reason"] };
      throw new Error(JSON.stringify(error));
    }

    // Check move permission
    const perms = getPerms();
    await setupPermissions();
    const userRoles = await perms.user(userId).getRoles();

    const canMoveFrom = await ColumnRulesService.canMoveFromColumn(userRoles, task.columnId);
    if (!canMoveFrom) throw new Error("Cannot move from this column");

    const canViewTarget = await ColumnRulesService.canViewColumn(userRoles, input.columnId);
    if (!canViewTarget) throw new Error("Cannot access target column");

    // Update task and handle stage entries
    await prisma.$transaction(async (tx) => {
      // If moving to a different column, close current stage entry and open new one
      if (task.columnId !== input.columnId) {
        // Close current stage entry
        await (tx as any).taskStageEntry.updateMany({
          where: { taskId, leftAt: null },
          data: {
            leftAt: new Date(),
            leftById: userId,
            durationSeconds: Math.floor(
              (new Date().getTime() - new Date().getTime()) / 1000
            ),
          },
        });

        // Open new stage entry with send back info
        await (tx as any).taskStageEntry.create({
          data: {
            taskId,
            columnId: input.columnId,
            enteredById: userId,
            assigneeAtEntry: task.assigneeId,
            isSendBack: isBackwardMove,
            sendBackReason: isBackwardMove ? input.reason : null,
          },
        });
      }

      // Update task position, column, and bounceCount if backward move
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          columnId: input.columnId,
          position: input.index,
          completedAt: targetColumn.isDone ? new Date() : null,
          bounceCount: isBackwardMove ? { increment: 1 } : undefined,
        },
      });

      // Reorder tasks in both columns
      if (task.columnId !== input.columnId) {
        // Decrease positions in source column
        await tx.task.updateMany({
          where: {
            columnId: task.columnId,
            position: { gt: task.position },
          },
          data: {
            position: { decrement: 1 },
          },
        });

        // Increase positions in target column
        await tx.task.updateMany({
          where: {
            columnId: input.columnId,
            position: { gte: input.index },
            id: { not: taskId },
          },
          data: {
            position: { increment: 1 },
          },
        });
      } else {
        // Same column reorder
        if (input.index > task.position) {
          await tx.task.updateMany({
            where: {
              columnId: task.columnId,
              position: { gt: task.position, lte: input.index },
            },
            data: {
              position: { decrement: 1 },
            },
          });
        } else if (input.index < task.position) {
          await tx.task.updateMany({
            where: {
              columnId: task.columnId,
              position: { lt: task.position, gte: input.index },
            },
            data: {
              position: { increment: 1 },
            },
          });
        }
      }

      return updatedTask;
    });

    // Record activity only if moved to different column
    if (task.columnId !== input.columnId) {
      const columnRules = await ColumnRulesService.getColumnRules(input.columnId);

      await ActivityService.recordActivity(projectId, "task.moved", userId, taskId, {
        fromColumnId: task.columnId,
        toColumnId: input.columnId,
        columnIsDone: targetColumn.isDone || false,
        moveRoleIds: columnRules.moveRoleIds,
        isSendBack: isBackwardMove,
        sendBackReason: isBackwardMove ? input.reason : undefined,
      });
    }

    // Create task.sent_back notification if this was a backward move
    if (isBackwardMove && task.assigneeId) {
      const recipientIds = new Set<string>();

      // Always notify the assignee
      if (task.assigneeId !== userId) {
        recipientIds.add(task.assigneeId);
      }

      // Find who moved it forward out of the target column
      const targetStageEntry = await prisma.taskStageEntry.findFirst({
        where: {
          taskId,
          columnId: input.columnId,
          leftAt: { not: null },
        },
        orderBy: { leftAt: "desc" },
      });

      if (targetStageEntry?.leftById && targetStageEntry.leftById !== userId) {
        recipientIds.add(targetStageEntry.leftById);
      }

      // Create notifications for each recipient
      for (const recipientId of recipientIds) {
        await prisma.notification.create({
          data: {
            recipientId,
            type: "task.sent_back",
            actorId: userId,
            projectId,
            taskId,
            metadata: { reason: input.reason },
            emailStatus: "PENDING",
          },
        });
      }

      // Send emails asynchronously
      try {
        await sendNotificationEmailsAsync(projectId);
      } catch (e) {
        console.error("Error sending task.sent_back emails:", e);
      }
    }

    // Get the updated task with related data
    const taskWithRelations = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
        labels: { include: { label: true } },
      },
    });

    if (!taskWithRelations) {
      throw new Error("Task not found after move");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    return {
      ...taskWithRelations,
      bounceCount: taskWithRelations.bounceCount ?? 0,
      key: `${project?.key}-${taskWithRelations.number}`,
      labels: taskWithRelations.labels.map((tl) => ({
        id: tl.label.id,
        name: tl.label.name,
        color: tl.label.color,
      })),
      canMove: false,
    };
  }
}
