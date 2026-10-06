import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { CommentService } from "@/server/modules/comments/service";
import { updateCommentSchema } from "@/server/modules/comments/schema";
import { createRouteHandler } from "@/server/http/route";

const patchHandler = createRouteHandler(async (
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

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.taskId !== taskId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Comment not found" } },
      { status: 404 }
    );
  }

  if (comment.authorId !== user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the author can edit this comment" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const result = updateCommentSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: result.error.errors } },
      { status: 400 }
    );
  }

  const updated = await CommentService.updateComment(projectId, taskId, commentId, result.data, user.id);
  return NextResponse.json({ comment: updated });
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

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.taskId !== taskId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Comment not found" } },
      { status: 404 }
    );
  }

  const perms = getPerms();
  await setupPermissions();

  const isAuthor = comment.authorId === user.id;
  const canDeleteAny = await perms.user(user.id).can("comment.delete.any");

  if (!isAuthor && !canDeleteAny) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You can only delete your own comments" } },
      { status: 403 }
    );
  }

  await CommentService.deleteComment(projectId, taskId, commentId, user.id, canDeleteAny);
  return NextResponse.json({});
});

export async function PATCH(req: NextRequest, context: any) {
  return patchHandler(req, context);
}

export async function DELETE(req: NextRequest, context: any) {
  return deleteHandler(req, context);
}
