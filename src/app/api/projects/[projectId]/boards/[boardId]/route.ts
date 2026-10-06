import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { updateBoardSchema } from "@/server/modules/boards/schema";

async function checkProjectMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; boardId: string }> }
) {
  const { projectId, boardId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const isMember = await checkProjectMembership(projectId, user.id);
  if (!isMember) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not a project member" } },
      { status: 403 }
    );
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!board) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Board not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ board });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; boardId: string }> }
) {
  const { projectId, boardId } = await params;
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

  const body = await req.json();
  const result = updateBoardSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  const board = await prisma.board.update({
    where: { id: boardId },
    data: {
      ...(result.data.name && { name: result.data.name }),
      ...(result.data.description !== undefined && {
        description: result.data.description,
      }),
    },
    include: {
      columns: { orderBy: { position: "asc" } },
    },
  });

  return NextResponse.json({ board });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; boardId: string }> }
) {
  const { projectId, boardId } = await params;
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

  const hasPermission = await perms.user(user.id).can("board.delete");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  await prisma.board.delete({
    where: { id: boardId },
  });

  return NextResponse.json({ success: true });
}
