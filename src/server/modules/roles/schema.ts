import { z } from 'zod';
import { permissionCatalog } from '@/server/permissions/catalog';

const permissionKeys = Object.keys(permissionCatalog) as Array<keyof typeof permissionCatalog>;

export const createRoleSchema = z.object({
  name: z.string()
    .min(1, 'Role name is required')
    .max(255)
    .regex(/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/, 'Role name must use letters, numbers, "_" and "-", separated by dots (e.g. "posts.edit")'),
  permissionKeys: z.array(
    z.enum(permissionKeys as [string, ...string[]])
  ).refine(
    (keys) => keys.length === new Set(keys).size,
    'Duplicate permission keys are not allowed'
  ),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  permissionKeys: z
    .array(
      z.enum(permissionKeys as [string, ...string[]])
    )
    .optional(),
});

export const deleteRoleSchema = z.object({
  reassignToRoleId: z.string().optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;
