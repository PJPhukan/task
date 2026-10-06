import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { BoardAccessService } from "@/server/modules/boards/access-service";
import { boardAccessSchema } from "@/server/modules/boards/access-schema";
import { validateRequest } from "@/server/http/route";

export async function PUT(
  req: NextRequest,
  { params }: { params: { projectId: string; boardId: string } }
) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

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
    where: { id: params.boardId, projectId: params.projectId },
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
    await BoardAccessService.setBoardAccess(params.boardId, validation.data);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update board access" } },
      { status: 400 }
    );
  }
}
