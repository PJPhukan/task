import "server-only";
import { prisma } from "@/server/lib/prisma";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";
import { getPerms, setupPermissions } from "@/server/lib/permly";

interface CalendarTask {
  key: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  priority: string;
  project: string;
  board: string;
  column: string;
  assignee: { id: string; name: string } | null;
  isDone: boolean;
  overLimit: boolean;
}

export class CalendarService {
  static async getCalendarTasks(
    userId: string,
    from: Date,
    to: Date,
    projectId?: string,
    boardId?: string,
    assignedToMe?: boolean
  ): Promise<CalendarTask[]> {
    const perms = getPerms();
    await setupPermissions();
    const userRoles = await perms.user(userId).getRoles();

    // Build where clause
    const where: any = {
      startDate: { not: null },
      dueDate: { not: null },
      OR: [
        { startDate: null },
        { dueDate: null },
      ],
    };

    // Check if any column rules prevent viewing
    // Get all columns the user can view
    const viewableColumns = await prisma.boardColumn.findMany({
      where: {
        board: {
          project: projectId ? { id: projectId } : undefined,
          ...(boardId && { id: boardId }),
        },
      },
      include: { board: { include: { project: true } } },
    });

    const visibleColumnIds: string[] = [];
    for (const col of viewableColumns) {
      const canView = await ColumnRulesService.canViewColumn(userRoles, col.id);
      if (canView) {
        visibleColumnIds.push(col.id);
      }
    }

    if (visibleColumnIds.length === 0) {
      return [];
    }

    // Tasks with date overlap: (startDate <= to AND dueDate >= from)
    // OR tasks with only startDate: startDate >= from AND startDate <= to
    // OR tasks with only dueDate: dueDate >= from AND dueDate <= to
    const tasks = await prisma.task.findMany({
      where: {
        columnId: { in: visibleColumnIds },
        OR: [
          // Both dates present
          {
            AND: [
              { startDate: { lte: to } },
              { dueDate: { gte: from } },
              { startDate: { not: null } },
              { dueDate: { not: null } },
            ],
          },
          // Only startDate
          {
            AND: [
              { startDate: { gte: from, lte: to } },
              { startDate: { not: null } },
              { dueDate: null },
            ],
          },
          // Only dueDate
          {
            AND: [
              { dueDate: { gte: from, lte: to } },
              { dueDate: { not: null } },
              { startDate: null },
            ],
          },
        ],
        ...(assignedToMe && { assigneeId: userId }),
      },
      include: {
        project: { select: { name: true } },
        board: { select: { name: true } },
        column: { select: { name: true, isDone: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    return tasks.map((task) => ({
      key: `${task.project.name.split(" ").map((w) => w[0]).join("")}-${task.number}`,
      title: task.title,
      startDate: task.startDate ? task.startDate.toISOString().split("T")[0] : null,
      dueDate: task.dueDate ? task.dueDate.toISOString().split("T")[0] : null,
      priority: task.priority,
      project: task.project.name,
      board: task.board.name,
      column: task.column.name,
      assignee: task.assignee,
      isDone: task.column.isDone,
      overLimit: task.overLimit,
    }));
  }
}
