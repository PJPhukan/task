import "server-only";
import { prisma } from "@/server/lib/prisma";
import { BoardAccessInput } from "./access-schema";

export class BoardAccessService {
  static async setBoardAccess(boardId: string, input: BoardAccessInput) {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true },
    });

    if (!board) {
      throw new Error("Board not found");
    }

    // Update board isOpen flag
    await prisma.board.update({
      where: { id: boardId },
      data: { isOpen: input.isOpen },
    });

    // Remove all existing access entries if restricted
    if (!input.isOpen) {
      await prisma.boardAccess.deleteMany({
        where: { boardId },
      });

      // Add new access entries
      const accessData = [];

      if (input.allowedUserIds) {
        for (const userId of input.allowedUserIds) {
          accessData.push({
            boardId,
            userId,
            roleId: null,
          });
        }
      }

      if (input.allowedRoleIds) {
        for (const roleId of input.allowedRoleIds) {
          accessData.push({
            boardId,
            userId: null,
            roleId,
          });
        }
      }

      if (accessData.length > 0) {
        await prisma.boardAccess.createMany({
          data: accessData,
          skipDuplicates: true,
        });
      }
    } else {
      // Remove all access entries if board is open
      await prisma.boardAccess.deleteMany({
        where: { boardId },
      });
    }

    return { boardId, isOpen: input.isOpen };
  }

  static async canUserAccessBoard(userId: string, boardId: string, userRoles: string[]): Promise<boolean> {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { isOpen: true },
    });

    if (!board) {
      return false;
    }

    // Open boards are accessible to all
    if (board.isOpen) {
      return true;
    }

    // Restricted boards: check user and roles
    const access = await prisma.boardAccess.findFirst({
      where: {
        boardId,
        OR: [
          { userId },
          { roleId: { in: userRoles } },
        ],
      },
    });

    return !!access;
  }

  static async getBoardAccessLists(boardId: string) {
    const accesses = await prisma.boardAccess.findMany({
      where: { boardId },
    });

    const allowedUserIds = accesses
      .filter(a => a.userId)
      .map(a => a.userId!);

    const allowedRoleIds = accesses
      .filter(a => a.roleId)
      .map(a => a.roleId!);

    return { allowedUserIds, allowedRoleIds };
  }
}
