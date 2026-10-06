import { z } from 'zod';

export const createColumnSchema = z.object({
  name: z.string().min(1, 'Column name required').max(100),
  color: z.string().optional(),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  isDone: z.boolean().optional(),
});

export const reorderColumnsSchema = z.object({
  columns: z.array(z.object({
    id: z.string(),
    position: z.number(),
  })),
});

export const deleteColumnSchema = z.object({
  targetColumnId: z.string().optional(),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;
export type DeleteColumnInput = z.infer<typeof deleteColumnSchema>;
