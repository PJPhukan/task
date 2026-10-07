import "server-only";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { BoardAccessService } from "@/server/modules/boards/access-service";

export class ProfileService {
  static async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarPublicId: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const perms = getPerms();
    await setupPermissions();

    const roles = await perms.user(userId).getRoles();
    const permissions = await perms.user(userId).getPermissions({ expand: true });

    // Get user's projects
    const projectMembers = await prisma.projectMember.findMany({
      where: { userId },
      select: {
        projectId: true,
        project: {
          select: { id: true, name: true, key: true },
        },
      },
    });

    const projects = projectMembers.map(pm => pm.project);

    // Get user's accessible boards for each project
    const userRoles = await perms.user(userId).getRoles();
    const boardsData: any[] = [];

    // Fetch all boards for all projects at once
    const allBoards = await prisma.board.findMany({
      where: { projectId: { in: projects.map(p => p.id) } },
      select: { id: true, name: true, projectId: true, isOpen: true },
    });

    // Batch fetch all board access for this user at once
    const boardAccesses = await (prisma as any).boardAccess.findMany({
      where: {
        boardId: { in: allBoards.map(b => b.id) },
        OR: [
          { userId },
          { roleId: { in: userRoles } },
        ],
      },
    });

    const accessibleBoardIds = new Set(boardAccesses.map((a: any) => a.boardId));

    // Filter boards by access
    for (const board of allBoards) {
      const canAccess = (board as any).isOpen || accessibleBoardIds.has(board.id);
      if (canAccess) {
        boardsData.push({
          id: board.id,
          name: board.name,
          projectId: board.projectId,
        });
      }
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarPublicId: user.avatarPublicId,
      isActive: user.isActive,
      roles,
      permissions,
      projects,
      boards: boardsData,
    };
  }

  static async updateOwnProfile(userId: string, updates: { name?: string }) {
    if (!updates.name) {
      throw new Error("No updates provided");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: updates.name },
      select: {
        id: true,
        name: true,
        email: true,
        avatarPublicId: true,
        isActive: true,
      },
    });

    const perms = getPerms();
    await setupPermissions();

    const roles = await perms.user(user.id).getRoles();
    const permissions = await perms.user(user.id).getPermissions({ expand: true });

    return {
      ...user,
      roles,
      permissions,
    };
  }
}
