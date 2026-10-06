import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { createBoardSchema } from "@/server/modules/boards/schema";

async function checkProjectMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
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

  const boards = await prisma.board.findMany({
    where: { projectId },
    include: {
      columns: { orderBy: { position: "asc" } },
    },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ boards });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
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

  const hasPermission = await perms.user(user.id).can("board.create");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const result = createBoardSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  const board = await prisma.board.create({
    data: {
      projectId,
      name: result.data.name,
      description: result.data.description,
      position: 0,
      createdById: user.id,
      columns: {
        create: [
          { name: "To Do", position: 0, isDone: false },
          { name: "In Progress", position: 1, isDone: false },
          { name: "Done", position: 2, isDone: true },
        ],
      },
    },
    include: {
      columns: { orderBy: { position: "asc" } },
    },
  });

  return NextResponse.json({ board }, { status: 201 });
}
