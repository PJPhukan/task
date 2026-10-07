import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { BoardAccessService } from "@/server/modules/boards/access-service";
import { RoleService } from "@/server/modules/roles/service";
import { boardAccessSchema } from "@/server/modules/boards/access-schema";
import { validateRequest } from "@/server/http/route";

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

  const hasPermission = await perms.user(user.id).can("board.update");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

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

  try {
    const access = await BoardAccessService.getBoardAccessLists(boardId);
    const enrichedRoles = await RoleService.enrichRolesWithDisplayNames(access.allowedRoleIds);

    return NextResponse.json({
      isOpen: (board as any).isOpen,
      allowedUserIds: access.allowedUserIds,
      allowedRoles: enrichedRoles,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "RETRIEVAL_ERROR", message: error.message || "Failed to retrieve board access" } },
      { status: 400 }
    );
  }
}

export async function PUT(
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

  const hasPermission = await perms.user(user.id).can("board.update");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

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

  const body = await req.json();
  const validation = validateRequest(boardAccessSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    await BoardAccessService.setBoardAccess(boardId, validation.data as any);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update board access" } },
      { status: 400 }
    );
  }
}
