import { z } from 'zod';

export const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID required'),
  role: z.enum(['admin', 'manager', 'member', 'viewer']),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
