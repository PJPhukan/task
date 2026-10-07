import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";
import { RoleService } from "@/server/modules/roles/service";
import { columnRulesSchema } from "@/server/modules/columns/rules-schema";
import { validateRequest } from "@/server/http/route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; columnId: string }> }
) {
  const { projectId, columnId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("column.manage");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  // Verify column exists
  const column = await prisma.boardColumn.findUnique({
    where: { id: columnId },
    select: { boardId: true, id: true },
  });

  if (!column) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Column not found" } },
      { status: 404 }
    );
  }

  // Verify board belongs to project
  const board = await prisma.board.findFirst({
    where: { id: column.boardId, projectId },
  });

  if (!board) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Board not found" } },
      { status: 404 }
    );
  }

  try {
    const rules = await ColumnRulesService.getColumnRules(columnId);
    const viewRoles = await RoleService.enrichRolesWithDisplayNames(rules.viewRoleIds);
    const moveRoles = await RoleService.enrichRolesWithDisplayNames(rules.moveRoleIds);

    return NextResponse.json({
      viewRoles,
      moveRoles,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "RETRIEVAL_ERROR", message: error.message || "Failed to retrieve column rules" } },
      { status: 400 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; columnId: string }> }
) {
  const { projectId, columnId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("column.manage");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  // Verify column exists
  const column = await prisma.boardColumn.findUnique({
    where: { id: columnId },
    select: { boardId: true, id: true },
  });

  if (!column) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Column not found" } },
      { status: 404 }
    );
  }

  // Verify board belongs to project
  const board = await prisma.board.findFirst({
    where: { id: column.boardId, projectId },
  });

  if (!board) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Board not found" } },
      { status: 404 }
    );
  }

  const body = await req.json();
  const validation = validateRequest(columnRulesSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    await ColumnRulesService.setColumnRules(columnId, validation.data as any);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update column rules" } },
      { status: 400 }
    );
  }
}
