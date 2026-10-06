import { z } from 'zod';

export const columnRulesSchema = z.object({
  viewRoleIds: z.array(z.string()).optional().default([]),
  moveRoleIds: z.array(z.string()).optional().default([]),
});

export type ColumnRulesInput = z.infer<typeof columnRulesSchema>;
