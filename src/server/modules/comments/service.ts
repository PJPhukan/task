import "server-only";
import { prisma } from "@/server/lib/prisma";
import { CreateCommentInput, UpdateCommentInput } from "./schema";
import { ActivityService } from "@/server/modules/activity/service";
import { NotificationService } from "@/server/modules/notifications/service";

export class CommentService {
  static async createComment(
    projectId: string,
    taskId: string,
    input: CreateCommentInput,
    userId: string
  ) {
    let parentId = input.parentId;

    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent) throw new Error("Parent comment not found");
      if (parent.taskId !== taskId) throw new Error("Parent comment must belong to the same task");

      // Replies are one level deep: if parent is a reply, attach to its parent instead
      if (parent.parentId) {
        parentId = parent.parentId;
      }
    }

    const comment = await prisma.comment.create({
      data: {
        taskId,
        authorId: userId,
        body: input.body,
        parentId,
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

    // Notify parent comment author if this is a reply
    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { authorId: true },
      });

      if (parent && parent.authorId && parent.authorId !== userId) {
        await NotificationService.createNotification(
          projectId,
          parent.authorId,
          "comment.reply",
          taskId,
          userId,
          { commentId: comment.id, parentCommentId: parentId }
        );
      }
    }

    return comment;
  }

  static async getComments(projectId: string, taskId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const topLevelComments = await prisma.comment.findMany({
      where: { taskId, parentId: null },
      include: {
        author: {
          select: { id: true, name: true, avatarPublicId: true, email: true },
        },
        replies: {
          where: { isDeleted: false },
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: { id: true, name: true, avatarPublicId: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: pageSize,
    });

    const total = await prisma.comment.count({ where: { taskId, parentId: null } });

    const formattedComments = topLevelComments.map((c) => ({
      ...c,
      deleted: c.isDeleted ? true : undefined,
    }));

    return {
      comments: formattedComments,
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
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { replies: true },
    });
    if (!comment) throw new Error("Comment not found");

    const isAuthor = comment.authorId === userId;
    if (!isAuthor && !canDeleteAny) {
      throw new Error("You can only delete your own comments");
    }

    if (comment.replies.length > 0) {
      // Soft delete: keep comment with cleared body
      await prisma.comment.update({
        where: { id: commentId },
        data: { body: null, isDeleted: true },
      });
    } else {
      // Hard delete if no replies
      await prisma.comment.delete({ where: { id: commentId } });

      // If this was a reply to a deleted parent, check if we should delete the parent
      if (comment.parentId) {
        const parent = await prisma.comment.findUnique({
          where: { id: comment.parentId },
          include: { replies: true },
        });

        if (parent && parent.isDeleted && parent.replies.length === 0) {
          await prisma.comment.delete({ where: { id: comment.parentId } });
        }
      }
    }

    await ActivityService.recordActivity(projectId, "comment.deleted", userId, taskId, {
      commentId,
    });
  }
}
