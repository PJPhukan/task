import "server-only";
import { prisma } from "@/server/lib/prisma";
import { CreateCommentInput, UpdateCommentInput } from "./schema";
import { ActivityService } from "@/server/modules/activity/service";
import { MentionService } from "@/server/modules/mentions/service";

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

    const mentionResult = await MentionService.validateAndSaveMentions(projectId, taskId, input.body, userId, comment.id);
    if ("error" in mentionResult) {
      await prisma.comment.delete({ where: { id: comment.id } });
      throw new Error(JSON.stringify(mentionResult.error));
    }

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
        const recipient = await prisma.user.findUnique({
          where: { id: parent.authorId },
          select: { isActive: true, status: true },
        });

        if (recipient && recipient.isActive && recipient.status === "ACTIVE") {
          await prisma.notification.create({
            data: {
              recipientId: parent.authorId,
              type: "comment.reply",
              actorId: userId,
              projectId,
              taskId,
              commentId: comment.id,
              payload: { commentId: comment.id, parentCommentId: parentId },
            },
          });
        }
      }
    }

    return { ...comment, newMentionUserIds: mentionResult.newMentionUserIds, hasAllMention: mentionResult.hasAllMention };
  }

  static async getComments(projectId: string, taskId: string, page: number = 1, pageSize: number = 20, userId?: string) {
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
        likes: {
          select: { userId: true },
        },
        mentions: {
          include: {
            user: { select: { id: true, name: true, avatarPublicId: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: pageSize,
    });

    const total = await prisma.comment.count({ where: { taskId, parentId: null } });

    const formattedComments = await Promise.all(topLevelComments.map(async (c) => {
      const likeCount = c.likes.length;
      const likedByMe = userId ? c.likes.some((l) => l.userId === userId) : false;
      const mentions = c.mentions.filter((m) => !m.isAll).map((m) => m.user).filter(Boolean);
      const mentionsAll = c.mentions.some((m) => m.isAll);

      const formattedReplies = await Promise.all(
        c.replies.map(async (reply) => {
          const replyLikeCount = (await prisma.commentLike.count({ where: { commentId: reply.id } }));
          const replyLikedByMe = userId ? !!(await prisma.commentLike.findUnique({ where: { commentId_userId: { commentId: reply.id, userId } } })) : false;
          const replyMentions = await prisma.mention.findMany({
            where: { commentId: reply.id },
            include: { user: { select: { id: true, name: true, avatarPublicId: true } } },
          });
          return {
            ...reply,
            likeCount: replyLikeCount,
            likedByMe: replyLikedByMe,
            mentions: replyMentions.filter((m) => !m.isAll).map((m) => m.user).filter(Boolean),
            mentionsAll: replyMentions.some((m) => m.isAll),
          };
        })
      );

      return {
        ...c,
        likes: undefined,
        likeCount,
        likedByMe,
        mentions: mentions.length > 0 ? mentions : undefined,
        mentionsAll: mentionsAll ? true : undefined,
        deleted: c.isDeleted ? true : undefined,
        replies: formattedReplies,
      };
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

    const mentionResult = await MentionService.validateAndSaveMentions(projectId, taskId, input.body, userId, commentId);
    if ("error" in mentionResult) {
      throw new Error(JSON.stringify(mentionResult.error));
    }

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

    return { ...updated, newMentionUserIds: mentionResult.newMentionUserIds, hasAllMention: mentionResult.hasAllMention };
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
      // Soft delete: keep comment with cleared body and delete mentions
      await prisma.mention.deleteMany({ where: { commentId } });
      await prisma.comment.update({
        where: { id: commentId },
        data: { body: null, isDeleted: true },
      });
    } else {
      // Hard delete if no replies (mentions deleted via CASCADE)
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
