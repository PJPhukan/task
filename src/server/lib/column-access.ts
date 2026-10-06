import "server-only";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";

export async function canViewColumn(userRoles: string[], columnId: string): Promise<boolean> {
  return ColumnRulesService.canViewColumn(userRoles, columnId);
}

export async function canMoveFromColumn(userRoles: string[], columnId: string): Promise<boolean> {
  return ColumnRulesService.canMoveFromColumn(userRoles, columnId);
}
