import "server-only";
import { prisma } from "@/server/lib/prisma";

export class CommentLikeService {
  static async likeComment(projectId: string, commentId: string, userId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, isDeleted: true, authorId: true, taskId: true },
    });

    if (!comment) throw new Error("Comment not found");
    if (comment.isDeleted) throw new Error("Deleted comments cannot be liked");

    await prisma.commentLike.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: {},
      create: { commentId, userId },
    });

    // Notify comment author (skip email) only if not already notified for this comment
    if (comment.authorId && comment.authorId !== userId) {
      const existingNotification = await prisma.notification.findFirst({
        where: {
          recipientId: comment.authorId,
          type: "comment.liked",
          taskId: comment.taskId,
          commentId,
        },
      });

      if (!existingNotification) {
        await prisma.notification.create({
          data: {
            recipientId: comment.authorId,
            type: "comment.liked",
            actorId: userId,
            projectId,
            taskId: comment.taskId,
            commentId,
            payload: { commentId },
            emailStatus: "SKIPPED",
          },
        });
      }
    }
  }

  static async unlikeComment(commentId: string, userId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });

    if (!comment) throw new Error("Comment not found");

    await prisma.commentLike.deleteMany({
      where: { commentId, userId },
    });
  }

  static async getCommentLikes(commentId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });

    if (!comment) throw new Error("Comment not found");

    const likes = await prisma.commentLike.findMany({
      where: { commentId },
      include: {
        user: {
          select: { id: true, name: true, avatarPublicId: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return likes.map((like) => ({
      userId: like.user.id,
      name: like.user.name,
      avatarPublicId: like.user.avatarPublicId,
    }));
  }

  static async getCommentLikeCount(commentId: string): Promise<number> {
    return prisma.commentLike.count({
      where: { commentId },
    });
  }

  static async userLikedComment(commentId: string, userId: string): Promise<boolean> {
    const like = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    return !!like;
  }
}
