import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { CommentService } from "@/server/modules/comments/service";
import { updateCommentSchema } from "@/server/modules/comments/schema";
import { createMentionNotifications } from "@/server/modules/mentions/notifications";
import { sendNotificationEmailsAsync } from "@/server/modules/notifications/email-sender";

async function patchHandler(req: NextRequest, context: any) {
  try {
    const { params } = context as { params: Promise<{ projectId: string; taskId: string; commentId: string }> };

    const userId = req.headers.get("x-user-id") || undefined;
    const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

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
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: result.error.issues } },
        { status: 400 }
      );
    }

    const response = await CommentService.updateComment(projectId, taskId, commentId, result.data, user.id);
    const { newMentionUserIds, hasAllMention, ...updated } = response;

    // Notify newly mentioned users
    if (newMentionUserIds?.length || hasAllMention) {
      await createMentionNotifications(projectId, taskId, commentId, user.id, newMentionUserIds || [], hasAllMention || false);
      await sendNotificationEmailsAsync(projectId);
    }

    return NextResponse.json({ comment: updated });
  } catch (error: any) {
    try {
      const parsedError = JSON.parse(error.message);
      if (parsedError.code === "VALIDATION_ERROR" || parsedError.code === "FORBIDDEN") {
        return NextResponse.json(
          { error: parsedError },
          { status: parsedError.code === "FORBIDDEN" ? 403 : 400 }
        );
      }
    } catch {}
    console.error("PATCH /comments error:", error);
    if (error instanceof Error) console.error(error.stack);
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: NextRequest, context: any) {
  try {
    const { params } = context as { params: Promise<{ projectId: string; taskId: string; commentId: string }> };

    const userId = req.headers.get("x-user-id") || undefined;
    const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

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
  } catch (error) {
    console.error("DELETE /comments error:", error);
    if (error instanceof Error) console.error(error.stack);
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export { patchHandler as PATCH, deleteHandler as DELETE };
