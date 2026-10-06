import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  key: z
    .string()
    .min(2, 'Key must be 2-5 characters')
    .max(5, 'Key must be 2-5 characters')
    .regex(/^[A-Z]+$/, 'Key must be uppercase letters only'),
  description: z.string().max(1000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  archived: z.boolean().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
