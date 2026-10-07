import { z } from "zod";

export const getCalendarSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  projectId: z.string().optional(),
  boardId: z.string().optional(),
  assignedToMe: z.enum(["true", "false"]).optional(),
});
