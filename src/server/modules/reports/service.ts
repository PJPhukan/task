import "server-only";
import { prisma } from "@/server/lib/prisma";
import { getPerms } from "@/server/lib/permly";
import type {
  MeReportQuery,
  UserReportQuery,
  OverviewReportQuery,
  StageTimesReportQuery,
  MeReportResponse,
  UserReportResponse,
  OverviewReportResponse,
  StageTimesReportResponse,
  OverdueTask,
  ChartDataPoint,
  ChartDataSeries,
} from "./schema";

export class ReportService {
  static async getMeReport(userId: string, query: MeReportQuery): Promise<MeReportResponse> {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    toDate.setHours(23, 59, 59, 999);

    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: userId,
        project: {
          archivedAt: null,
        },
      },
      include: {
        column: { include: { board: true } },
        stageHistory: { include: { column: true } },
      },
    });

    const visibleTasks = tasks;

    const tasksReportedByMe = await prisma.task.findMany({
      where: {
        reporterId: userId,
        createdAt: { gte: fromDate, lte: toDate },
      },
    });

    const commentsCount = await prisma.comment.count({
      where: {
        authorId: userId,
        createdAt: { gte: fromDate, lte: toDate },
      },
    });

    const assigned = {
      open: visibleTasks.filter((t) => !t.completedAt).length,
      overdue: visibleTasks.filter((t) => !t.completedAt && t.dueDate && new Date(t.dueDate) < new Date()).length,
      completed: visibleTasks.filter((t) => t.completedAt && new Date(t.completedAt) <= toDate).length,
    };

    const completedTasks = this.calculateOnTimeVsLate(visibleTasks.filter((t) => t.completedAt), fromDate, toDate);
    const averageTimePerColumn = this.calculateAverageTimePerColumn(visibleTasks, userId);
    const averageTimeOverall = this.calculateAverageTimeOverall(visibleTasks, userId);
    const completedPerWeek = this.calculateCompletedPerWeek(visibleTasks, fromDate, toDate);

    return {
      assigned,
      reportedByMe: { total: tasksReportedByMe.length },
      commentedByMe: { total: commentsCount },
      completedTasks,
      averageTimePerColumn,
      averageTimeOverall,
      completedPerWeek,
    };
  }

  static async getUserReport(viewerId: string, targetUserId: string, query: UserReportQuery): Promise<UserReportResponse> {
    const perms = getPerms();

    if (viewerId !== targetUserId && !perms.user(viewerId).can("report.view.all")) {
      throw new Error("Permission denied");
    }

    return this.getMeReport(targetUserId, query);
  }

  static async getOverviewReport(
    userId: string,
    { boardId, from, to }: OverviewReportQuery
  ): Promise<OverviewReportResponse> {
    const perms = getPerms();

    if (!perms.user(userId).can("report.view.all")) {
      throw new Error("Permission denied");
    }

    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: { columns: true, tasks: { include: { column: true } } },
    });

    if (!board) {
      throw new Error("Board not found");
    }

    const tasksPerColumn = board.columns.map((col) => ({
      label: col.name,
      value: board.tasks.filter((t) => t.columnId === col.id).length,
    }));

    const completedPerWeek = this.calculateCompletedPerWeek(board.tasks, fromDate, toDate);
    const onTimeVsLate = this.calculateOnTimeVsLate(
      board.tasks.filter((t) => t.completedAt),
      fromDate,
      toDate
    );

    const overdueList = this.calculateOverdueList(board.tasks);
    const workloadPerPerson = this.calculateWorkloadPerPerson(board.tasks);

    return {
      tasksPerColumn,
      completedPerWeek,
      onTimeVsLate,
      overdueList,
      workloadPerPerson,
    };
  }

  static async getStageTimesReport(
    userId: string,
    { boardId }: StageTimesReportQuery
  ): Promise<StageTimesReportResponse> {
    const perms = getPerms();

    if (!perms.user(userId).can("report.view.all")) {
      throw new Error("Permission denied");
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: true,
        tasks: { include: { stageHistory: { include: { enteredBy: true, column: true } } } },
      },
    });

    if (!board) {
      throw new Error("Board not found");
    }

    const averageTimePerColumn = this.calculateAverageTimePerColumnAcrossUsers(board.tasks, board.columns);
    const longestTimePerColumn = this.calculateLongestTimePerColumn(board.tasks, board.columns);
    const averageTimePerPersonPerColumn = this.calculateAverageTimePerPersonPerColumn(board.tasks, board.columns);

    return {
      averageTimePerColumn,
      longestTimePerColumn,
      averageTimePerPersonPerColumn,
    };
  }

  private static calculateOnTimeVsLate(tasks: any[], fromDate: Date, toDate: Date): ChartDataPoint[] {
    let onTime = 0;
    let late = 0;
    let noDueDate = 0;

    for (const task of tasks) {
      const completedDate = task.completedAt ? new Date(task.completedAt) : null;
      if (!completedDate || completedDate < fromDate || completedDate > toDate) continue;

      if (!task.dueDate) {
        noDueDate++;
      } else {
        const dueDate = new Date(task.dueDate);
        if (completedDate <= dueDate) {
          onTime++;
        } else {
          late++;
        }
      }
    }

    return [
      { label: "On Time", value: onTime },
      { label: "Late", value: late },
      { label: "No Due Date", value: noDueDate },
    ];
  }

  private static calculateAverageTimePerColumn(tasks: any[], userId: string): ChartDataPoint[] {
    const columnTimes: Record<string, number[]> = {};

    for (const task of tasks) {
      for (const entry of task.stageHistory) {
        if (entry.leftById === userId && entry.durationSeconds) {
          const columnName = entry.column.name;
          if (!columnTimes[columnName]) {
            columnTimes[columnName] = [];
          }
          columnTimes[columnName].push(entry.durationSeconds);
        }
      }
    }

    return Object.entries(columnTimes).map(([name, durations]) => ({
      label: name,
      value: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 3600) : 0,
    }));
  }

  private static calculateAverageTimeOverall(tasks: any[], userId: string): number {
    let totalDuration = 0;
    let count = 0;

    for (const task of tasks) {
      for (const entry of task.stageHistory) {
        if (entry.leftById === userId && entry.durationSeconds) {
          totalDuration += entry.durationSeconds;
          count++;
        }
      }
    }

    return count > 0 ? Math.round(totalDuration / count / 3600) : 0;
  }

  private static calculateCompletedPerWeek(tasks: any[], fromDate: Date, toDate: Date): ChartDataPoint[] {
    const weekCounts: Record<string, number> = {};

    for (const task of tasks) {
      if (!task.completedAt) continue;
      const completedDate = new Date(task.completedAt);
      if (completedDate < fromDate || completedDate > toDate) continue;

      const weekStart = new Date(completedDate);
      weekStart.setDate(completedDate.getDate() - completedDate.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];

      weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;
    }

    return Object.entries(weekCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({
        label: week,
        value: count,
      }));
  }

  private static calculateOverdueList(tasks: any[]): OverdueTask[] {
    const now = new Date();
    return tasks
      .filter((t) => t.dueDate && new Date(t.dueDate) < now && !t.column.isDone)
      .map((t) => ({
        taskKey: `TASK-${t.number}`,
        taskTitle: t.title,
        assignee: t.assignee?.name || null,
        daysOverdue: Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  private static calculateWorkloadPerPerson(tasks: any[]): ChartDataSeries[] {
    const personWorkload: Record<string, { open: number; overdue: number; completed: number; avgTime: number }> = {};

    for (const task of tasks) {
      const assigneeName = task.assignee?.name || "Unassigned";
      if (!personWorkload[assigneeName]) {
        personWorkload[assigneeName] = { open: 0, overdue: 0, completed: 0, avgTime: 0 };
      }

      if (task.completedAt) {
        personWorkload[assigneeName].completed++;
      } else {
        personWorkload[assigneeName].open++;
        if (task.dueDate && new Date(task.dueDate) < new Date()) {
          personWorkload[assigneeName].overdue++;
        }
      }
    }

    return Object.entries(personWorkload).map(([name, data]) => ({
      label: name,
      series: [
        { label: "Open", value: data.open },
        { label: "Overdue", value: data.overdue },
        { label: "Completed", value: data.completed },
      ],
    }));
  }

  private static calculateAverageTimePerColumnAcrossUsers(tasks: any[], columns: any[]): ChartDataPoint[] {
    const columnTimes: Record<string, number[]> = {};

    for (const task of tasks) {
      for (const entry of task.stageHistory) {
        if (entry.durationSeconds) {
          const columnName = entry.column.name;
          if (!columnTimes[columnName]) {
            columnTimes[columnName] = [];
          }
          columnTimes[columnName].push(entry.durationSeconds);
        }
      }
    }

    return columns.map((col) => ({
      label: col.name,
      value: columnTimes[col.name]
        ? Math.round(columnTimes[col.name].reduce((a, b) => a + b, 0) / columnTimes[col.name].length / 3600)
        : 0,
    }));
  }

  private static calculateLongestTimePerColumn(tasks: any[], columns: any[]): ChartDataPoint[] {
    const columnTimes: Record<string, number> = {};

    for (const task of tasks) {
      for (const entry of task.stageHistory) {
        if (entry.durationSeconds) {
          const columnName = entry.column.name;
          columnTimes[columnName] = Math.max(columnTimes[columnName] || 0, entry.durationSeconds);
        }
      }
    }

    return columns.map((col) => ({
      label: col.name,
      value: columnTimes[col.name] ? Math.round(columnTimes[col.name] / 3600) : 0,
    }));
  }

  private static calculateAverageTimePerPersonPerColumn(tasks: any[], columns: any[]): ChartDataSeries[] {
    const personColumnTimes: Record<string, Record<string, number[]>> = {};

    for (const task of tasks) {
      for (const entry of task.stageHistory) {
        if (entry.enteredBy && entry.durationSeconds) {
          const personName = entry.enteredBy.name;
          if (!personColumnTimes[personName]) {
            personColumnTimes[personName] = {};
          }
          const columnName = entry.column.name;
          if (!personColumnTimes[personName][columnName]) {
            personColumnTimes[personName][columnName] = [];
          }
          personColumnTimes[personName][columnName].push(entry.durationSeconds);
        }
      }
    }

    return Object.entries(personColumnTimes).map(([personName, columnTimes]) => ({
      label: personName,
      series: columns.map((col) => ({
        label: col.name,
        value: columnTimes[col.name]
          ? Math.round(columnTimes[col.name].reduce((a, b) => a + b, 0) / columnTimes[col.name].length / 3600)
          : 0,
      })),
    }));
  }
}
