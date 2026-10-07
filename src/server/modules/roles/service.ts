import "server-only";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { createSlug } from "@/server/lib/slug";
import { CreateRoleInput, UpdateRoleInput } from "./schema";

export class RoleService {
  static async enrichRolesWithDisplayNames(roleIds: string[]) {
    const roles = [];
    for (const roleId of roleIds) {
      const roleLabel = await prisma.roleLabel.findUnique({
        where: { roleId },
      });
      roles.push({
        id: roleId,
        displayName: roleLabel?.displayName || roleId,
      });
    }
    return roles;
  }

  static async createRole(input: CreateRoleInput) {
    const perms = getPerms();
    await setupPermissions();

    // Check if displayName is already used
    const existingLabel = await prisma.roleLabel.findUnique({
      where: { displayName: input.displayName },
    });
    if (existingLabel) {
      throw new Error("displayname-duplicate");
    }

    // Generate slug from displayName
    let slug = createSlug(input.displayName);

    // Check if slug is already taken and append number if needed
    let roleId = slug;
    let counter = 2;
    while (true) {
      const existingRole = await prisma.roleLabel.findUnique({
        where: { roleId },
      });
      if (!existingRole && !((await perms.getAllRoles()).includes(roleId))) {
        break;
      }
      roleId = `${slug}-${counter}`;
      counter++;
    }

    // Create the role in permly
    await perms.createRole(roleId);
    await perms.role(roleId).syncPermissions(input.permissionKeys);

    // Create the RoleLabel
    await prisma.roleLabel.create({
      data: {
        roleId,
        displayName: input.displayName,
        slug,
      },
    });

    return {
      id: roleId,
      displayName: input.displayName,
      permissionKeys: input.permissionKeys,
      userCount: 0,
    };
  }

  static async getRole(roleId: string) {
    const perms = getPerms();
    await setupPermissions();

    const permissions = await perms.role(roleId).getPermissions({ expand: true });

    const roleLabel = await prisma.roleLabel.findUnique({
      where: { roleId },
    });

    return {
      id: roleId,
      displayName: roleLabel?.displayName || roleId,
      permissionKeys: permissions,
      userCount: 0,
    };
  }

  static async listRoles() {
    const perms = getPerms();
    await setupPermissions();

    const allRoles = await perms.getAllRoles();
    const roles = [];

    for (const roleId of allRoles) {
      const permissions = await perms.role(roleId).getPermissions({ expand: true });

      const roleLabel = await prisma.roleLabel.findUnique({
        where: { roleId },
      });

      roles.push({
        id: roleId,
        displayName: roleLabel?.displayName || roleId,
        permissionKeys: permissions,
        userCount: 0,
      });
    }

    return roles;
  }

  static async updateRole(roleId: string, input: UpdateRoleInput) {
    const perms = getPerms();
    await setupPermissions();

    if (input.displayName) {
      // Check if new displayName is already used
      const existingLabel = await prisma.roleLabel.findUnique({
        where: { displayName: input.displayName },
      });
      if (existingLabel && existingLabel.roleId !== roleId) {
        throw new Error("displayname-duplicate");
      }

      // Update or create the RoleLabel
      const currentLabel = await prisma.roleLabel.findUnique({
        where: { roleId },
      });

      if (currentLabel) {
        await prisma.roleLabel.update({
          where: { roleId },
          data: { displayName: input.displayName },
        });
      } else {
        // If there's no label yet, create one
        const slug = createSlug(input.displayName);
        await prisma.roleLabel.create({
          data: {
            roleId,
            displayName: input.displayName,
            slug,
          },
        });
      }
    }

    if (input.permissionKeys) {
      await perms.role(roleId).syncPermissions(input.permissionKeys);
    }

    const permissions = await perms.role(roleId).getPermissions({ expand: true });

    const roleLabel = await prisma.roleLabel.findUnique({
      where: { roleId },
    });

    return {
      id: roleId,
      displayName: roleLabel?.displayName || roleId,
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
