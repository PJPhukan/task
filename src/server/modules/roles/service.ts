import "server-only";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { CreateRoleInput, UpdateRoleInput } from "./schema";

export class RoleService {
  static async createRole(input: CreateRoleInput) {
    const perms = getPerms();
    await setupPermissions();

    // Check if role already exists
    const allRoles = await perms.getAllRoles();
    if (allRoles.includes(input.name)) {
      throw new Error("duplicate");
    }

    // Create the role in permly
    await perms.createRole(input.name);
    await perms.role(input.name).syncPermissions(input.permissionKeys);

    return {
      id: input.name,
      name: input.name,
      permissionKeys: input.permissionKeys,
      userCount: 0,
    };
  }

  static async getRole(roleId: string) {
    const perms = getPerms();
    await setupPermissions();

    const permissions = await perms.role(roleId).getPermissions({ expand: true });

    return {
      id: roleId,
      permissionKeys: permissions,
      userCount: 0,
    };
  }

  static async listRoles() {
    const perms = getPerms();
    await setupPermissions();

    const allRoles = await perms.getAllRoles();
    const builtInRoles = ["admin", "manager", "member", "viewer"];
    const roles = [];

    for (const roleId of allRoles) {
      const permissions = await perms.role(roleId).getPermissions({ expand: true });
      const displayName = builtInRoles.includes(roleId)
        ? roleId.charAt(0).toUpperCase() + roleId.slice(1)
        : roleId;

      roles.push({
        id: roleId,
        name: displayName,
        permissionKeys: permissions,
        userCount: 0,
      });
    }

    return roles;
  }

  static async updateRole(roleId: string, input: UpdateRoleInput) {
    const perms = getPerms();
    await setupPermissions();

    if (input.permissionKeys) {
      await perms.role(roleId).syncPermissions(input.permissionKeys);
    }

    const permissions = await perms.role(roleId).getPermissions({ expand: true });

    return {
      id: roleId,
      name: input.name || roleId,
      permissionKeys: permissions,
      userCount: 0,
    };
  }

  static async deleteRole(roleId: string, reassignToRoleId?: string) {
    const perms = getPerms();
    await setupPermissions();

    // Check if any users have this role by querying the database
    const result = await prisma.$queryRaw<Array<{ "userId": string }>>`
      SELECT "userId" FROM permly."UserRole" WHERE "roleId" = ${roleId}
    `;

    const userIds = result.map(r => r.userId);

    if (userIds.length > 0) {
      if (!reassignToRoleId) {
        throw new Error("Users are still assigned to this role");
      }

      for (const userId of userIds) {
        await perms.user(userId).removeRole(roleId);
        if (reassignToRoleId) {
          await perms.user(userId).assignRole(reassignToRoleId);
        }
      }
    }

    return { id: roleId };
  }

  static async hasRoleManagePermission(userId: string): Promise<boolean> {
    const perms = getPerms();
    await setupPermissions();
    return perms.user(userId).can("role.manage");
  }

  static async ensureRoleManageGuard(userId: string, affectedRoleId?: string) {
    const perms = getPerms();
    await setupPermissions();

    if (!affectedRoleId) return;

    const affectedRolePerms = await perms.role(affectedRoleId).getPermissions({ expand: true });
    const hasRoleManageInAffectedRole = affectedRolePerms.includes("role.manage");

    if (!hasRoleManageInAffectedRole) {
      return;
    }

    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let activeManagerCount = 0;
    for (const user of allUsers) {
      const hasManage = await perms.user(user.id).can("role.manage");
      if (hasManage) {
        activeManagerCount++;
      }
    }

    if (activeManagerCount <= 1) {
      throw new Error("Cannot modify: at least one active user must have role.manage");
    }
  }
}
