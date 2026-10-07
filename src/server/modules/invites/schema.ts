import { z } from 'zod';

export const createInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  roleIds: z.array(z.string()).min(1, 'At least one role is required'),
  projectIds: z.array(z.string()).optional(),
  boardIds: z.array(z.string()).optional(),
});

export const acceptInviteQuerySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().min(1, 'Name is required').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const resendInviteSchema = z.object({});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteQueryInput = z.infer<typeof acceptInviteQuerySchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type ResendInviteInput = z.infer<typeof resendInviteSchema>;
