import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { CommentLikeService } from "@/server/modules/comments/like-service";
import { createRouteHandler } from "@/server/http/route";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";

const postHandler = createRouteHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string; commentId: string }> }
) => {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const { projectId, taskId, commentId } = await params;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
  });
  if (!task) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  const perms = getPerms();
  await setupPermissions();

  // Check column visibility
  const userRoles = await perms.user(user.id).getRoles();
  const canViewColumn = await ColumnRulesService.canViewColumn(userRoles, task.columnId);

  if (!canViewColumn) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  try {
    await CommentLikeService.likeComment(projectId, commentId, user.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    if (error.message === "Comment not found" || error.message === "Deleted comments cannot be liked") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );
    }
    throw error;
  }
});

const deleteHandler = createRouteHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string; commentId: string }> }
) => {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const { projectId, taskId, commentId } = await params;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
  });
  if (!task) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  const perms = getPerms();
  await setupPermissions();

  // Check column visibility
  const userRoles = await perms.user(user.id).getRoles();
  const canViewColumn = await ColumnRulesService.canViewColumn(userRoles, task.columnId);

  if (!canViewColumn) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  try {
    await CommentLikeService.unlikeComment(commentId, user.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    if (error.message === "Comment not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );
    }
    throw error;
  }
});

const getHandler = createRouteHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string; commentId: string }> }
) => {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const { projectId, taskId, commentId } = await params;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
  });
  if (!task) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  const perms = getPerms();
  await setupPermissions();

  // Check column visibility
  const userRoles = await perms.user(user.id).getRoles();
  const canViewColumn = await ColumnRulesService.canViewColumn(userRoles, task.columnId);

  if (!canViewColumn) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  try {
    const likes = await CommentLikeService.getCommentLikes(commentId);
    return NextResponse.json({ likes }, { status: 200 });
  } catch (error: any) {
    if (error.message === "Comment not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );
    }
    throw error;
  }
});

export async function POST(req: NextRequest, context: any) {
  return postHandler(req, context);
}

export async function DELETE(req: NextRequest, context: any) {
  return deleteHandler(req, context);
}

export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context);
}
