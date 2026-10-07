import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import {
  createColumnSchema,
  reorderColumnsSchema,
} from "@/server/modules/columns/schema";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; boardId: string }> }
) {
  const { projectId, boardId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  // Verify board exists and belongs to project
  const board = await prisma.board.findFirst({
    where: { id: boardId, projectId },
  });

  if (!board) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Board not found" } },
      { status: 404 }
    );
  }

  // Get user roles for rule checking
  const userRoles = await perms.user(user.id).getRoles();
  const canManageColumns = await perms.user(user.id).can("column.manage");

  // Get all columns
  const allColumns = await prisma.boardColumn.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
  });

  // Filter columns based on view rules
  const visibleColumns = [];

  for (const column of allColumns) {
    const canView = canManageColumns || await ColumnRulesService.canViewColumn(userRoles, column.id);

    if (canView) {
      const canMove = canManageColumns || await ColumnRulesService.canMoveFromColumn(userRoles, column.id);
      visibleColumns.push({
        ...column,
        canMove,
      });
    }
  }

  return NextResponse.json({ columns: visibleColumns });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; boardId: string }> }
) {
  const { boardId } = await params;
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

  const body = await req.json();
  const result = createColumnSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  const lastColumn = await prisma.boardColumn.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
  });

  const column = await prisma.boardColumn.create({
    data: {
      boardId,
      name: result.data.name,
      color: result.data.color,
      position: (lastColumn?.position ?? -1) + 1,
    },
  });

  return NextResponse.json({ column }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; boardId: string }> }
) {
  void await params;
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

  const body = await req.json();
  const result = reorderColumnsSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    result.data.columns.map((col) =>
      prisma.boardColumn.update({
        where: { id: col.id },
        data: { position: col.position },
      })
    )
  );

  return NextResponse.json({ success: true });
}
