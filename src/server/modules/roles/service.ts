import "server-only";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { CreateRoleInput, UpdateRoleInput } from "./schema";

export class RoleService {
  static async createRole(input: CreateRoleInput) {
    const existing = await prisma.role.findUnique({
      where: { name: input.name },
    });

    if (existing) {
      throw new Error("duplicate");
    }

    const role = await prisma.role.create({
      data: {
        name: input.name,
        permissionKeys: input.permissionKeys,
      },
    });

    return {
      id: role.id,
      name: role.name,
      permissionKeys: role.permissionKeys,
      userCount: role.userCount,
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

    const builtInRoles = ["admin", "manager", "member", "viewer"];
    const roles = [];

    for (const roleId of builtInRoles) {
      const permissions = await perms.role(roleId).getPermissions({ expand: true });

      roles.push({
        id: roleId,
        name: roleId.charAt(0).toUpperCase() + roleId.slice(1),
        permissionKeys: permissions,
        userCount: 0,
      });
    }

    const customRoles = await prisma.role.findMany();
    for (const role of customRoles) {
      roles.push({
        id: role.id,
        name: role.name,
        permissionKeys: role.permissionKeys,
        userCount: role.userCount,
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

    const admin = await prisma.user.findFirst({
      where: {
        email: "admin@example.com",
        isActive: true,
      },
    });

    if (!admin) return;

    if (affectedRoleId === "admin") {
      const hasManage = await perms.user(admin.id).can("role.manage");
      if (!hasManage) {
        throw new Error("Cannot remove role.manage permission from the last admin");
      }
    }
  }
}
