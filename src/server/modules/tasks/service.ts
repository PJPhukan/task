import "server-only";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { CreateTaskInput, UpdateTaskInput, MoveTaskInput } from "./schema";
import { ActivityService } from "@/server/modules/activity/service";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";

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

    // Record activity
    await ActivityService.recordActivity(projectId, "task.created", userId, task.id, {
      title: task.title,
      columnId: input.columnId,
    });

    return {
      ...task,
      key: `${updatedProject.key}-${task.number}`,
      canMove: false,
    };
  }

  static async getTask(projectId: string, taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
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

    return {
      ...task,
      key: `${(await prisma.project.findUnique({ where: { id: projectId }, select: { key: true } }))?.key}-${task.number}`,
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

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
    });

    // Record activities
    if (Object.keys(oldValues).length > 0) {
      await ActivityService.recordActivity(projectId, "task.updated", userId, taskId, {
        changes: oldValues,
      });
    }

    if (input.assigneeId !== undefined && input.assigneeId !== task.assigneeId) {
      await ActivityService.recordActivity(projectId, "task.assigned", userId, taskId, {
        oldAssigneeId: task.assigneeId,
        newAssigneeId: input.assigneeId,
      });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    return {
      ...updated,
      key: `${project?.key}-${updated.number}`,
      canMove: false,
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

    await prisma.task.delete({
      where: { id: taskId },
    });

    await ActivityService.recordActivity(projectId, "task.deleted", userId, taskId, {
      title: task.title,
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

    // Check move permission
    const perms = getPerms();
    await setupPermissions();
    const userRoles = await perms.user(userId).getRoles();

    const canMoveFrom = await ColumnRulesService.canMoveFromColumn(userRoles, task.columnId);
    if (!canMoveFrom) throw new Error("Cannot move from this column");

    const canViewTarget = await ColumnRulesService.canViewColumn(userRoles, input.columnId);
    if (!canViewTarget) throw new Error("Cannot access target column");

    // Update task and handle stage entries
    const updated = await prisma.$transaction(async (tx) => {
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

        // Open new stage entry
        await (tx as any).taskStageEntry.create({
          data: {
            taskId,
            columnId: input.columnId,
            enteredById: userId,
            assigneeAtEntry: task.assigneeId,
          },
        });
      }

      // Update task position and column
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          columnId: input.columnId,
          position: input.index,
          completedAt: targetColumn.isDone ? new Date() : null,
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
      await ActivityService.recordActivity(projectId, "task.moved", userId, taskId, {
        fromColumnId: task.columnId,
        toColumnId: input.columnId,
      });
    }

    return updated;
  }
}
