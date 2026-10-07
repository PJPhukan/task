import { z } from 'zod';
import { permissionCatalog } from '@/server/permissions/catalog';

const permissionKeys = Object.keys(permissionCatalog) as Array<keyof typeof permissionCatalog>;

export const createRoleSchema = z.object({
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(40, 'Display name must be 40 characters or less'),
  permissionKeys: z.array(
    z.enum(permissionKeys as [string, ...string[]])
  ).refine(
    (keys) => keys.length === new Set(keys).size,
    'Duplicate permission keys are not allowed'
  ),
});

export const updateRoleSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
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
