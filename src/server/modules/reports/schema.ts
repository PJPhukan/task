import { z } from 'zod';

export const reportDateRangeSchema = z.object({
  from: z.string().date().optional().default(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }),
  to: z.string().date().optional().default(() => {
    return new Date().toISOString().split('T')[0];
  }),
  projectId: z.string().optional(),
  boardId: z.string().optional(),
});

export const meReportQuerySchema = reportDateRangeSchema;
export const userReportQuerySchema = reportDateRangeSchema;
export const overviewReportQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  projectId: z.string().min(1, 'Project ID is required'),
  boardId: z.string().min(1, 'Board ID is required'),
});
export const stageTimesReportQuerySchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  boardId: z.string().min(1, 'Board ID is required'),
});

export const exportReportQuerySchema = z.object({
  report: z.enum(['me', 'user', 'overview', 'stage-times']),
  format: z.enum(['xlsx', 'pdf']),
  userId: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  projectId: z.string().optional(),
  boardId: z.string().optional(),
});

export type ReportDateRange = z.infer<typeof reportDateRangeSchema>;
export type MeReportQuery = z.infer<typeof meReportQuerySchema>;
export type UserReportQuery = z.infer<typeof userReportQuerySchema>;
export type OverviewReportQuery = z.infer<typeof overviewReportQuerySchema>;
export type StageTimesReportQuery = z.infer<typeof stageTimesReportQuerySchema>;
export type ExportReportQuery = z.infer<typeof exportReportQuerySchema>;

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartDataSeries {
  label: string;
  series: ChartDataPoint[];
}

export interface MeReportResponse {
  assigned: {
    open: number;
    overdue: number;
    completed: number;
  };
  reportedByMe: {
    total: number;
  };
  commentedByMe: {
    total: number;
  };
  completedTasks: ChartDataPoint[];
  averageTimePerColumn: ChartDataPoint[];
  averageTimeOverall: number;
  completedPerWeek: ChartDataPoint[];
}

export interface UserReportResponse extends MeReportResponse {}

export interface OverdueTask {
  taskKey: string;
  taskTitle: string;
  assignee: string | null;
  daysOverdue: number;
}

export interface OverviewReportResponse {
  tasksPerColumn: ChartDataPoint[];
  completedPerWeek: ChartDataPoint[];
  onTimeVsLate: ChartDataPoint[];
  overdueList: OverdueTask[];
  workloadPerPerson: ChartDataSeries[];
}

export interface StageTimesReportResponse {
  averageTimePerColumn: ChartDataPoint[];
  longestTimePerColumn: ChartDataPoint[];
  averageTimePerPersonPerColumn: ChartDataSeries[];
}
