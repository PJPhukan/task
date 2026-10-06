import "server-only";
import { prisma } from "@/server/lib/prisma";
import { CreateCommentInput, UpdateCommentInput } from "./schema";
import { ActivityService } from "@/server/modules/activity/service";

export class CommentService {
  static async createComment(
    projectId: string,
    taskId: string,
    input: CreateCommentInput,
    userId: string
  ) {
    const comment = await prisma.comment.create({
      data: {
        taskId,
        authorId: userId,
        body: input.body,
      },
      include: {
        author: {
          select: { id: true, name: true, avatarPublicId: true, email: true },
        },
      },
    });

    await ActivityService.recordActivity(projectId, "comment.created", userId, taskId, {
      commentId: comment.id,
    });

    return comment;
  }

  static async getComments(projectId: string, taskId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { taskId },
        include: {
          author: {
            select: { id: true, name: true, avatarPublicId: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.comment.count({ where: { taskId } }),
    ]);

    return {
      comments,
      total,
      page,
      pageSize,
      hasMore: skip + pageSize < total,
    };
  }

  static async updateComment(
    projectId: string,
    taskId: string,
    commentId: string,
    input: UpdateCommentInput,
    userId: string
  ) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new Error("Comment not found");
    if (comment.authorId !== userId) throw new Error("Only the author can edit this comment");

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        body: input.body,
        editedAt: new Date(),
      },
      include: {
        author: {
          select: { id: true, name: true, avatarPublicId: true, email: true },
        },
      },
    });

    await ActivityService.recordActivity(projectId, "comment.updated", userId, taskId, {
      commentId,
    });

    return updated;
  }

  static async deleteComment(
    projectId: string,
    taskId: string,
    commentId: string,
    userId: string,
    canDeleteAny: boolean
  ) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new Error("Comment not found");

    const isAuthor = comment.authorId === userId;
    if (!isAuthor && !canDeleteAny) {
      throw new Error("You can only delete your own comments");
    }

    await prisma.comment.delete({ where: { id: commentId } });

    await ActivityService.recordActivity(projectId, "comment.deleted", userId, taskId, {
      commentId,
    });
  }
}
