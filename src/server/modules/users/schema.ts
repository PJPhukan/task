import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(1, 'User name is required').max(255),
  email: z.string().email('Invalid email address'),
  roleIds: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Invalid email address').optional(),
  isActive: z.boolean().optional(),
});

export const updateUserRolesSchema = z.object({
  roleIds: z.array(z.string()),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
