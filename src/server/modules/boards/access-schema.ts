import { z } from 'zod';

export const boardAccessSchema = z.object({
  isOpen: z.boolean(),
  allowedUserIds: z.array(z.string()).optional().default([]),
  allowedRoleIds: z.array(z.string()).optional().default([]),
});

export type BoardAccessInput = z.infer<typeof boardAccessSchema>;
