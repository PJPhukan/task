import "server-only";
import { prisma } from "@/server/lib/prisma";
import { ColumnRulesInput } from "./rules-schema";

export class ColumnRulesService {
  static async setColumnRules(columnId: string, input: ColumnRulesInput) {
    const column = await prisma.boardColumn.findUnique({
      where: { id: columnId },
      select: { id: true },
    });

    if (!column) {
      throw new Error("Column not found");
    }

    // Remove existing rules
    await prisma.columnRule.deleteMany({
      where: { columnId },
    });

    // Add new rules
    const rulesData = [];

    if (input.viewRoleIds) {
      for (const roleId of input.viewRoleIds) {
        rulesData.push({
          columnId,
          ruleType: "view",
          roleId,
        });
      }
    }

    if (input.moveRoleIds) {
      for (const roleId of input.moveRoleIds) {
        rulesData.push({
          columnId,
          ruleType: "move",
          roleId,
        });
      }
    }

    if (rulesData.length > 0) {
      await prisma.columnRule.createMany({
        data: rulesData,
        skipDuplicates: true,
      });
    }

    return { columnId };
  }

  static async getColumnRules(columnId: string) {
    const rules = await prisma.columnRule.findMany({
      where: { columnId },
    });

    const viewRoleIds = rules
      .filter(r => r.ruleType === "view")
      .map(r => r.roleId);

    const moveRoleIds = rules
      .filter(r => r.ruleType === "move")
      .map(r => r.roleId);

    return { viewRoleIds, moveRoleIds };
  }

  static async canViewColumn(userRoles: string[], columnId: string): Promise<boolean> {
    const rules = await prisma.columnRule.findMany({
      where: { columnId, ruleType: "view" },
    });

    // No view rules = everyone can view
    if (rules.length === 0) {
      return true;
    }

    // Check if user has any of the required roles
    return rules.some(r => userRoles.includes(r.roleId));
  }

  static async canMoveFromColumn(userRoles: string[], columnId: string): Promise<boolean> {
    const rules = await prisma.columnRule.findMany({
      where: { columnId, ruleType: "move" },
    });

    // No move rules = everyone can move
    if (rules.length === 0) {
      return true;
    }

    // Check if user has any of the required roles
    return rules.some(r => userRoles.includes(r.roleId));
  }

  static async deleteRoleRules(roleId: string) {
    await prisma.columnRule.deleteMany({
      where: { roleId },
    });
  }
}
