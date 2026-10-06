import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { addMemberSchema } from "@/server/modules/members/schema";

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

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ members });
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

  const hasPermission = await perms.user(user.id).can("member.manage");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const result = addMemberSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId: result.data.userId,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Grant board access if boardIds provided
  if (result.data.boardIds && result.data.boardIds.length > 0) {
    const boardAccessData = result.data.boardIds.map((boardId) => ({
      boardId,
      userId: result.data.userId,
      roleId: null,
    }));

    await prisma.boardAccess.createMany({
      data: boardAccessData,
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ member }, { status: 201 });
}
