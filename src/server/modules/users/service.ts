import "server-only";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { CreateUserInput, UpdateUserInput, UpdateUserRolesInput } from "./schema";

export class UserService {
  static async createUser(input: CreateUserInput) {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        isActive: true,
      },
    });

    if (input.roleIds && input.roleIds.length > 0) {
      const perms = getPerms();
      await setupPermissions();

      for (const roleId of input.roleIds) {
        await perms.user(user.id).assignRole(roleId);
      }
    }

    const perms = getPerms();
    const roles = await perms.user(user.id).getRoles();
    const permissions = await perms.user(user.id).getPermissions({ expand: true });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      roles,
      permissions,
    };
  }

  static async updateUser(userId: string, input: UpdateUserInput) {
    if (input.isActive === false) {
      await this.ensureRoleManageGuard(userId);
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const perms = getPerms();
    await setupPermissions();
    const roles = await perms.user(user.id).getRoles();
    const permissions = await perms.user(user.id).getPermissions({ expand: true });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      roles,
      permissions,
    };
  }

  static async updateUserRoles(userId: string, input: UpdateUserRolesInput) {
    const perms = getPerms();
    await setupPermissions();

    const currentUserHasManage = await perms.user(userId).can("role.manage");
    if (currentUserHasManage) {
      await this.ensureRoleManageGuard(userId);
    }

    // Get current roles
    const currentRoles = await perms.user(userId).getRoles();

    // Remove all current roles
    for (const roleId of currentRoles) {
      await perms.user(userId).removeRole(roleId);
    }

    // Assign new roles
    for (const roleId of input.roleIds) {
      await perms.user(userId).assignRole(roleId);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (!user) throw new Error("User not found");

    const newRoles = await perms.user(userId).getRoles();
    const permissions = await perms.user(userId).getPermissions({ expand: true });

    return {
      ...user,
      roles: newRoles,
      permissions,
    };
  }

  static async listUsersWithRoles() {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, isActive: true },
    });

    const perms = getPerms();
    await setupPermissions();

    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const roles = await perms.user(user.id).getRoles();
        const permissions = await perms.user(user.id).getPermissions({ expand: true });
        return {
          ...user,
          roles,
          permissions,
        };
      })
    );

    return usersWithRoles;
  }

  static async hasUserManagePermission(userId: string): Promise<boolean> {
    const perms = getPerms();
    await setupPermissions();
    return perms.user(userId).can("user.manage");
  }

  static async promoteFirstUserToAdmin(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailVerified: true, status: true },
    });

    if (!user) throw new Error("User not found");
    if (!user.emailVerified) throw new Error("Email must be verified");

    const otherUsers = await prisma.user.count({
      where: {
        NOT: { id: userId },
      },
    });

    if (otherUsers > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { status: "PENDING" },
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" },
    });

    const perms = getPerms();
    await setupPermissions();
    await perms.user(userId).assignRole("admin");
  }

  static async ensureRoleManageGuard(userId: string) {
    const perms = getPerms();
    await setupPermissions();

    const userHasManage = await perms.user(userId).can("role.manage");
    if (!userHasManage) {
      return; // User doesn't have role.manage, so no guard needed
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
