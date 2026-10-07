import "server-only";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";

export interface TaskListFilters {
  boardId?: string;
  columnId?: string;
  assigneeId?: string;
  reporterId?: string;
  priority?: string;
  labelId?: string;
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
  completed?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "dueDate" | "priority";
  sortOrder?: "asc" | "desc";
}

const searchMatchesTask = (task: any, query: string): boolean => {
  const lowerQuery = query.toLowerCase();
  const titleMatch = task.title.toLowerCase().includes(lowerQuery);
  const keyMatch = task.key?.toLowerCase().includes(lowerQuery);
  return titleMatch || keyMatch;
};

export class TaskListService {
  static async listProjectTasks(
    projectId: string,
    filters: TaskListFilters,
    userId: string
  ) {
    // Get user roles for visibility checks
    const perms = getPerms();
    await setupPermissions();
    const userRoles = await perms.user(userId).getRoles();

    // Get all viewable columns for this user
    const columns = await prisma.boardColumn.findMany({
      where: { board: { projectId } },
    });

    const viewableColumnIds: string[] = [];
    for (const column of columns) {
      const canView = await ColumnRulesService.canViewColumn(userRoles, column.id);
      if (canView) {
        viewableColumnIds.push(column.id);
      }
    }

    // Build query
    const where: any = {
      projectId,
      columnId: { in: viewableColumnIds },
    };

    if (filters.boardId) {
      where.boardId = filters.boardId;
    }
    if (filters.columnId) {
      where.columnId = filters.columnId;
    }
    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }
    if (filters.reporterId) {
      where.reporterId = filters.reporterId;
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.labelId) {
      where.labels = { some: { labelId: filters.labelId } };
    }

    if (filters.dueFrom) {
      where.dueDate = { gte: new Date(`${filters.dueFrom}T00:00:00Z`) };
    }
    if (filters.dueTo) {
      if (where.dueDate) {
        where.dueDate.lte = new Date(`${filters.dueTo}T23:59:59Z`);
      } else {
        where.dueDate = { lte: new Date(`${filters.dueTo}T23:59:59Z`) };
      }
    }

    if (filters.overdue) {
      const today = new Date();
      where.dueDate = { lt: today };
      where.completedAt = null;
      // Exclude tasks in done columns
      where.column = { isDone: false };
    }

    if (filters.completed) {
      where.completedAt = { not: null };
    }

    // Get tasks with labels and stage entry
    const allTasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
        labels: { include: { label: true } },
        column: true,
        board: true,
        project: true,
        stageHistory: {
          where: { leftAt: null },
          take: 1,
        },
      },
      orderBy: this.getOrderBy(filters.sortBy, filters.sortOrder),
    });

    // Get project for key generation
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    // Map tasks with key and filter by search if needed
    const mappedTasks = allTasks.map((task) => ({
      ...task,
      key: `${project?.key}-${task.number}`,
    }));

    let filteredTasks = mappedTasks;
    if (filters.search) {
      filteredTasks = mappedTasks.filter((task) =>
        searchMatchesTask(task, filters.search!)
      );
    }

    // Pagination
    const pageSize = Math.min(filters.pageSize || 20, 100);
    const page = Math.max(filters.page || 1, 1);
    const skip = (page - 1) * pageSize;
    const paginatedTasks = filteredTasks.slice(skip, skip + pageSize);

    return {
      tasks: paginatedTasks.map((t) => this.formatTask(t)),
      total: filteredTasks.length,
      page,
      pageSize,
      totalPages: Math.ceil(filteredTasks.length / pageSize),
    };
  }

  static async listMyTasks(
    userId: string,
    filters: Partial<{
      open?: boolean;
      overdue?: boolean;
      completed?: boolean;
    }>
  ) {
    // Get user roles for visibility checks
    const perms = getPerms();
    await setupPermissions();
    const userRoles = await perms.user(userId).getRoles();

    // Get all viewable columns
    const columns = await prisma.boardColumn.findMany({});
    const viewableColumnIds: string[] = [];
    for (const column of columns) {
      const canView = await ColumnRulesService.canViewColumn(userRoles, column.id);
      if (canView) {
        viewableColumnIds.push(column.id);
      }
    }

    const where: any = {
      assigneeId: userId,
      columnId: { in: viewableColumnIds },
    };

    if (filters.open) {
      where.completedAt = null;
    }
    if (filters.completed) {
      where.completedAt = { not: null };
    }
    if (filters.overdue) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.dueDate = { lt: today };
      where.completedAt = null;
      where.column = { isDone: false };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
        labels: { include: { label: true } },
        column: true,
        board: true,
        project: true,
        stageHistory: {
          where: { leftAt: null },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return tasks.map((t) => this.formatTask(t));
  }

  private static getOrderBy(
    sortBy?: string,
    sortOrder?: string
  ): Record<string, "asc" | "desc"> {
    const order = (sortOrder === "desc" ? "desc" : "asc") as "asc" | "desc";
    switch (sortBy) {
      case "dueDate":
        return { dueDate: order };
      case "priority":
        return {
          priority: order === "asc" ? "asc" : "desc",
          createdAt: "asc",
        };
      case "createdAt":
      default:
        return { createdAt: order };
    }
  }

  private static formatTask(task: any) {
    // Calculate waiting time and over-limit status
    let waitingSeconds = 0;
    let overLimit = false;

    if (task.stageHistory && task.stageHistory.length > 0) {
      const currentEntry = task.stageHistory[0];
      waitingSeconds = Math.floor((new Date().getTime() - new Date(currentEntry.enteredAt).getTime()) / 1000);

      if (task.column?.timeLimitHours) {
        const limitSeconds = task.column.timeLimitHours * 3600;
        overLimit = waitingSeconds > limitSeconds;
      }
    }

    return {
      id: task.id,
      key: task.key,
      projectId: task.projectId,
      boardId: task.boardId,
      columnId: task.columnId,
      number: task.number,
      title: task.title,
      description: task.description,
      priority: task.priority,
      startDate: task.startDate,
      dueDate: task.dueDate,
      assigneeId: task.assigneeId,
      assignee: task.assignee,
      reporterId: task.reporterId,
      reporter: task.reporter,
      completedAt: task.completedAt,
      bounceCount: task.bounceCount,
      waitingSeconds,
      overLimit,
      labels: task.labels.map((tl: any) => ({
        id: tl.label.id,
        name: tl.label.name,
        color: tl.label.color,
      })),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
