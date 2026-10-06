import { z } from 'zod';
import { permissionCatalog } from '@/server/permissions/catalog';

const permissionKeys = Object.keys(permissionCatalog) as Array<keyof typeof permissionCatalog>;

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(255),
  permissionKeys: z.array(
    z.enum(permissionKeys as [string, ...string[]], {
      errorMap: () => ({ message: 'Invalid permission key' }),
    })
  ).refine(
    (keys) => keys.length === new Set(keys).size,
    'Duplicate permission keys are not allowed'
  ),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  permissionKeys: z
    .array(
      z.enum(permissionKeys as [string, ...string[]], {
        errorMap: () => ({ message: 'Invalid permission key' }),
      })
    )
    .optional(),
});

export const deleteRoleSchema = z.object({
  reassignToRoleId: z.string().optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;
