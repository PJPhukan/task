import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const createTaskSchema = z.object({
  boardId: z.string().min(1, 'Board ID required'),
  columnId: z.string().min(1, 'Column ID required'),
  title: z.string().min(1, 'Title required').max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  startDate: dateString.optional(),
  dueDate: dateString.optional(),
  assigneeId: z.string().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.dueDate) {
      return new Date(data.dueDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: 'Due date cannot be earlier than start date', path: ['dueDate'] }
);

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate: dateString.optional(),
  dueDate: dateString.optional(),
  assigneeId: z.string().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.dueDate) {
      return new Date(data.dueDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: 'Due date cannot be earlier than start date', path: ['dueDate'] }
);

export const moveTaskSchema = z.object({
  columnId: z.string().min(1, 'Column ID required'),
  index: z.number().int().min(0),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
