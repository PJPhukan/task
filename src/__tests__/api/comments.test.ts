import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCommentsRoute, POST as createCommentRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/comments/route";
import { PATCH as updateCommentRoute, DELETE as deleteCommentRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route";
import { POST as likeCommentRoute, DELETE as unlikeCommentRoute, GET as getLikesRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/comments/[commentId]/like/route";
import { prisma } from "@/server/lib/prisma";
import { reseedDatabase, cleanupNonSeededUsers } from "@/__tests__/__helpers__/seed";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let memberId: string;
let viewerId: string;
let projectId: string;
let taskId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ["admin@example.com", "member@example.com", "viewer@example.com"] } },
  });
  adminId = users.find((u) => u.email === "admin@example.com")!.id;
  memberId = users.find((u) => u.email === "member@example.com")!.id;
  viewerId = users.find((u) => u.email === "viewer@example.com")!.id;

  const project = await prisma.project.create({
    data: {
      name: "Comments Test Project",
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  await prisma.projectMember.createMany({
    data: [
      { projectId, userId: adminId },
      { projectId, userId: memberId },
      { projectId, userId: viewerId },
    ],
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: "Comments Board",
      position: 0,
      createdById: adminId,
    },
  });

  const column = await prisma.boardColumn.create({
    data: { boardId: board.id, name: "To Do", position: 0 },
  });

  const task = await prisma.task.create({
    data: {
      projectId,
      boardId: board.id,
      columnId: column.id,
      number: 1,
      title: "Test Task for Comments",
      reporterId: adminId,
      position: 0,
    },
  });
  taskId = task.id;
});

describe("Comments API", () => {
  it("POST /api/projects/:projectId/tasks/:taskId/comments creates comment", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: "This is a test comment" }),
    });
    const res = await createCommentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.comment.body).toBe("This is a test comment");
    expect(data.comment.authorId).toBe(memberId);
    expect(data.comment.author.name).toBeDefined();
  });

  it("GET /api/projects/:projectId/tasks/:taskId/comments returns paginated list", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, { method: "GET", headers });
    const res = await getCommentsRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.comments)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it("PATCH /api/projects/:projectId/tasks/:taskId/comments/:commentId only allows author to edit", async () => {
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Original comment" }),
    });
    const commentRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await commentRes.json();

    // Try to edit as different user
    const invalidHeaders = new Headers();
    invalidHeaders.set("x-user-id", viewerId);
    invalidHeaders.set("content-type", "application/json");
    const invalidReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "PATCH",
      headers: invalidHeaders,
      body: JSON.stringify({ body: "Edited by someone else" }),
    });
    const invalidRes = await updateCommentRoute(invalidReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(invalidRes.status).toBe(403);

    // Edit as author
    const validHeaders = new Headers();
    validHeaders.set("x-user-id", memberId);
    validHeaders.set("content-type", "application/json");
    const validReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "PATCH",
      headers: validHeaders,
      body: JSON.stringify({ body: "Edited comment" }),
    });
    const validRes = await updateCommentRoute(validReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(validRes.status).toBe(200);
    const updated = await validRes.json();
    expect(updated.comment.body).toBe("Edited comment");
    expect(updated.comment.editedAt).toBeDefined();
  });

  it("DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId author can delete own", async () => {
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Comment to delete" }),
    });
    const commentRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await commentRes.json();

    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", memberId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    const res = await deleteCommentRoute(deleteReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(res.status).toBe(200);

    const checkRes = await prisma.comment.findUnique({
      where: { id: comment.comment.id },
    });
    expect(checkRes).toBeNull();
  });

  it("GET comments returns 404 if task not found", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/nonexistent/comments`, { method: "GET", headers });
    const res = await getCommentsRoute(req, { params: Promise.resolve({ projectId, taskId: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("DELETE with comment.delete.any allows deleting someone else's comment", async () => {
    // Admin has comment.delete.any
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Comment to delete by admin" }),
    });
    const commentRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await commentRes.json();

    // Admin deletes member's comment
    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", adminId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    const deleteRes = await deleteCommentRoute(deleteReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(deleteRes.status).toBe(200);

    const checkRes = await prisma.comment.findUnique({
      where: { id: comment.comment.id },
    });
    expect(checkRes).toBeNull();
  });

  it("DELETE without comment.delete.any cannot delete someone else's comment", async () => {
    // Member does not have comment.delete.any
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", adminId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Admin comment" }),
    });
    const commentRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await commentRes.json();

    // Member tries to delete admin's comment
    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", memberId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    const deleteRes = await deleteCommentRoute(deleteReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(deleteRes.status).toBe(403);

    const checkRes = await prisma.comment.findUnique({
      where: { id: comment.comment.id },
    });
    expect(checkRes).not.toBeNull();
  });

  it("Member role can create, edit and delete their own comments", async () => {
    // Create comment
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Member comment" }),
    });
    const createRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    expect(createRes.status).toBe(201);
    const comment = await createRes.json();

    // Edit own comment
    const editHeaders = new Headers();
    editHeaders.set("x-user-id", memberId);
    editHeaders.set("content-type", "application/json");
    const editReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "PATCH",
      headers: editHeaders,
      body: JSON.stringify({ body: "Edited member comment" }),
    });
    const editRes = await updateCommentRoute(editReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(editRes.status).toBe(200);

    // Delete own comment
    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", memberId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    const deleteRes = await deleteCommentRoute(deleteReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(deleteRes.status).toBe(200);
  });

  it("reply to comment is returned nested under parent", async () => {
    // Create parent comment
    const parentHeaders = new Headers();
    parentHeaders.set("x-user-id", memberId);
    parentHeaders.set("content-type", "application/json");
    const parentReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: parentHeaders,
      body: JSON.stringify({ body: "Parent comment" }),
    });
    const parentRes = await createCommentRoute(parentReq, { params: Promise.resolve({ projectId, taskId }) });
    const parentComment = await parentRes.json();

    // Create reply
    const replyHeaders = new Headers();
    replyHeaders.set("x-user-id", adminId);
    replyHeaders.set("content-type", "application/json");
    const replyReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: replyHeaders,
      body: JSON.stringify({ body: "This is a reply", parentId: parentComment.comment.id }),
    });
    const replyRes = await createCommentRoute(replyReq, { params: Promise.resolve({ projectId, taskId }) });
    expect(replyRes.status).toBe(201);
    const reply = await replyRes.json();
    expect(reply.comment.parentId).toBe(parentComment.comment.id);

    // Get comments and verify reply is nested
    const getHeaders = new Headers();
    getHeaders.set("x-user-id", memberId);
    const getReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "GET",
      headers: getHeaders,
    });
    const getRes = await getCommentsRoute(getReq, { params: Promise.resolve({ projectId, taskId }) });
    const data = await getRes.json();
    const fetchedParent = data.comments.find((c: any) => c.id === parentComment.comment.id);
    expect(fetchedParent).toBeDefined();
    expect(fetchedParent.replies).toBeDefined();
    expect(fetchedParent.replies.length).toBe(1);
    expect(fetchedParent.replies[0].id).toBe(reply.comment.id);
  });

  it("reply to reply attaches to top-level comment", async () => {
    // Create top-level comment
    const topHeaders = new Headers();
    topHeaders.set("x-user-id", memberId);
    topHeaders.set("content-type", "application/json");
    const topReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: topHeaders,
      body: JSON.stringify({ body: "Top level" }),
    });
    const topRes = await createCommentRoute(topReq, { params: Promise.resolve({ projectId, taskId }) });
    const topComment = await topRes.json();

    // Create first reply
    const reply1Headers = new Headers();
    reply1Headers.set("x-user-id", adminId);
    reply1Headers.set("content-type", "application/json");
    const reply1Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: reply1Headers,
      body: JSON.stringify({ body: "First reply", parentId: topComment.comment.id }),
    });
    const reply1Res = await createCommentRoute(reply1Req, { params: Promise.resolve({ projectId, taskId }) });
    const reply1 = await reply1Res.json();

    // Create reply to reply (should attach to top-level)
    const reply2Headers = new Headers();
    reply2Headers.set("x-user-id", memberId);
    reply2Headers.set("content-type", "application/json");
    const reply2Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: reply2Headers,
      body: JSON.stringify({ body: "Reply to reply", parentId: reply1.comment.id }),
    });
    const reply2Res = await createCommentRoute(reply2Req, { params: Promise.resolve({ projectId, taskId }) });
    expect(reply2Res.status).toBe(201);
    const reply2 = await reply2Res.json();
    expect(reply2.comment).toBeDefined();
    expect(reply2.comment.parentId).toBe(topComment.comment.id);
  });

  it("parentId from another task is rejected", async () => {
    // Create second task
    const column = await prisma.boardColumn.findFirst({ where: { boardId: (await prisma.task.findUnique({ where: { id: taskId } }))!.boardId } });
    const task2 = await prisma.task.create({
      data: {
        projectId,
        boardId: (await prisma.task.findUnique({ where: { id: taskId } }))!.boardId,
        columnId: column!.id,
        number: 2,
        title: "Second task",
        reporterId: adminId,
        position: 1,
      },
    });

    // Create comment on task 1
    const comment1Headers = new Headers();
    comment1Headers.set("x-user-id", memberId);
    comment1Headers.set("content-type", "application/json");
    const comment1Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: comment1Headers,
      body: JSON.stringify({ body: "Comment on task 1" }),
    });
    const comment1Res = await createCommentRoute(comment1Req, { params: Promise.resolve({ projectId, taskId }) });
    const comment1 = await comment1Res.json();

    // Try to reply with parentId from task 1 on task 2
    const replyHeaders = new Headers();
    replyHeaders.set("x-user-id", adminId);
    replyHeaders.set("content-type", "application/json");
    const replyReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task2.id}/comments`, {
      method: "POST",
      headers: replyHeaders,
      body: JSON.stringify({ body: "Reply", parentId: comment1.comment.id }),
    });
    const replyRes = await createCommentRoute(replyReq, { params: Promise.resolve({ projectId, taskId: task2.id }) });
    expect(replyRes.status).toBe(400);

    await prisma.task.delete({ where: { id: task2.id } });
  });

  it("delete comment with replies keeps it as deleted with empty body", async () => {
    // Create parent comment
    const parentHeaders = new Headers();
    parentHeaders.set("x-user-id", memberId);
    parentHeaders.set("content-type", "application/json");
    const parentReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: parentHeaders,
      body: JSON.stringify({ body: "Parent to soft delete" }),
    });
    const parentRes = await createCommentRoute(parentReq, { params: Promise.resolve({ projectId, taskId }) });
    const parentComment = await parentRes.json();

    // Create reply
    const replyHeaders = new Headers();
    replyHeaders.set("x-user-id", adminId);
    replyHeaders.set("content-type", "application/json");
    const replyReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: replyHeaders,
      body: JSON.stringify({ body: "Reply that will remain", parentId: parentComment.comment.id }),
    });
    const replyRes = await createCommentRoute(replyReq, { params: Promise.resolve({ projectId, taskId }) });
    const reply = await replyRes.json();

    // Delete parent comment
    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", memberId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${parentComment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    const deleteRes = await deleteCommentRoute(deleteReq, { params: Promise.resolve({ projectId, taskId, commentId: parentComment.comment.id }) });
    expect(deleteRes.status).toBe(200);

    // Verify comment is soft-deleted
    const deletedComment = await prisma.comment.findUnique({
      where: { id: parentComment.comment.id },
      include: { replies: true },
    });
    expect(deletedComment).not.toBeNull();
    expect(deletedComment?.isDeleted).toBe(true);
    expect(deletedComment?.body).toBeNull();
    expect(deletedComment?.replies.length).toBe(1);
  });

  it("delete last reply of deleted parent removes parent", async () => {
    // Create parent comment
    const parentHeaders = new Headers();
    parentHeaders.set("x-user-id", memberId);
    parentHeaders.set("content-type", "application/json");
    const parentReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: parentHeaders,
      body: JSON.stringify({ body: "Parent for final deletion" }),
    });
    const parentRes = await createCommentRoute(parentReq, { params: Promise.resolve({ projectId, taskId }) });
    const parentComment = await parentRes.json();

    // Create single reply
    const replyHeaders = new Headers();
    replyHeaders.set("x-user-id", adminId);
    replyHeaders.set("content-type", "application/json");
    const replyReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: replyHeaders,
      body: JSON.stringify({ body: "Only reply", parentId: parentComment.comment.id }),
    });
    const replyRes = await createCommentRoute(replyReq, { params: Promise.resolve({ projectId, taskId }) });
    const reply = await replyRes.json();

    // Delete parent (soft delete since it has reply)
    const deleteParentHeaders = new Headers();
    deleteParentHeaders.set("x-user-id", memberId);
    const deleteParentReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${parentComment.comment.id}`, {
      method: "DELETE",
      headers: deleteParentHeaders,
    });
    await deleteCommentRoute(deleteParentReq, { params: Promise.resolve({ projectId, taskId, commentId: parentComment.comment.id }) });

    // Delete the reply (should trigger parent deletion)
    const deleteReplyHeaders = new Headers();
    deleteReplyHeaders.set("x-user-id", adminId);
    const deleteReplyReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${reply.comment.id}`, {
      method: "DELETE",
      headers: deleteReplyHeaders,
    });
    await deleteCommentRoute(deleteReplyReq, { params: Promise.resolve({ projectId, taskId, commentId: reply.comment.id }) });

    // Verify both are deleted
    const deletedParent = await prisma.comment.findUnique({ where: { id: parentComment.comment.id } });
    const deletedReply = await prisma.comment.findUnique({ where: { id: reply.comment.id } });
    expect(deletedParent).toBeNull();
    expect(deletedReply).toBeNull();
  });

  it("POST /like twice leaves one like", async () => {
    // Create comment
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Comment for likes" }),
    });
    const createRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await createRes.json();

    // Like comment first time
    const like1Headers = new Headers();
    like1Headers.set("x-user-id", adminId);
    const like1Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}/like`, {
      method: "POST",
      headers: like1Headers,
    });
    const like1Res = await likeCommentRoute(like1Req, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(like1Res.status).toBe(200);

    // Like comment second time (idempotent)
    const like2Headers = new Headers();
    like2Headers.set("x-user-id", adminId);
    const like2Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}/like`, {
      method: "POST",
      headers: like2Headers,
    });
    const like2Res = await likeCommentRoute(like2Req, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(like2Res.status).toBe(200);

    // Verify only one like exists
    const likeCount = await prisma.commentLike.count({ where: { commentId: comment.comment.id } });
    expect(likeCount).toBe(1);
  });

  it("likeCount and likedByMe are correct for two users", async () => {
    // Create comment
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Comment for like counting" }),
    });
    const createRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await createRes.json();

    // User 1 likes
    const like1Headers = new Headers();
    like1Headers.set("x-user-id", adminId);
    const like1Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}/like`, {
      method: "POST",
      headers: like1Headers,
    });
    await likeCommentRoute(like1Req, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });

    // User 2 likes
    const like2Headers = new Headers();
    like2Headers.set("x-user-id", viewerId);
    const like2Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}/like`, {
      method: "POST",
      headers: like2Headers,
    });
    await likeCommentRoute(like2Req, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });

    // Get comments as user 1 (should see likedByMe: true)
    const getHeaders1 = new Headers();
    getHeaders1.set("x-user-id", adminId);
    const getReq1 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "GET",
      headers: getHeaders1,
    });
    const getRes1 = await getCommentsRoute(getReq1, { params: Promise.resolve({ projectId, taskId }) });
    const data1 = await getRes1.json();
    const fetchedComment1 = data1.comments.find((c: any) => c.id === comment.comment.id);
    expect(fetchedComment1.likeCount).toBe(2);
    expect(fetchedComment1.likedByMe).toBe(true);

    // Get comments as user 2 (should see likedByMe: true)
    const getHeaders2 = new Headers();
    getHeaders2.set("x-user-id", viewerId);
    const getReq2 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "GET",
      headers: getHeaders2,
    });
    const getRes2 = await getCommentsRoute(getReq2, { params: Promise.resolve({ projectId, taskId }) });
    const data2 = await getRes2.json();
    const fetchedComment2 = data2.comments.find((c: any) => c.id === comment.comment.id);
    expect(fetchedComment2.likeCount).toBe(2);
    expect(fetchedComment2.likedByMe).toBe(true);

    // Get comments as user 3 who didn't like (should see likedByMe: false)
    const getHeaders3 = new Headers();
    getHeaders3.set("x-user-id", memberId);
    const getReq3 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "GET",
      headers: getHeaders3,
    });
    const getRes3 = await getCommentsRoute(getReq3, { params: Promise.resolve({ projectId, taskId }) });
    const data3 = await getRes3.json();
    const fetchedComment3 = data3.comments.find((c: any) => c.id === comment.comment.id);
    expect(fetchedComment3.likeCount).toBe(2);
    expect(fetchedComment3.likedByMe).toBe(false);
  });

  it("author is notified of like with no email, and not again after unlike/like", async () => {
    // Create comment
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Comment for notifications" }),
    });
    const createRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await createRes.json();

    // User likes
    const likeHeaders = new Headers();
    likeHeaders.set("x-user-id", adminId);
    const likeReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}/like`, {
      method: "POST",
      headers: likeHeaders,
    });
    await likeCommentRoute(likeReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });

    // Check notification exists with emailStatus SKIPPED
    const notifs = await prisma.notification.findMany({
      where: {
        recipientId: memberId,
        type: "comment.liked",
        commentId: comment.comment.id,
      },
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].emailStatus).toBe("SKIPPED");

    // Unlike
    const unlikeHeaders = new Headers();
    unlikeHeaders.set("x-user-id", adminId);
    const unlikeReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}/like`, {
      method: "DELETE",
      headers: unlikeHeaders,
    });
    await unlikeCommentRoute(unlikeReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });

    // Like again
    const like2Headers = new Headers();
    like2Headers.set("x-user-id", adminId);
    const like2Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}/like`, {
      method: "POST",
      headers: like2Headers,
    });
    await likeCommentRoute(like2Req, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });

    // Check notification count (should still be 1, not duplicated)
    const notifs2 = await prisma.notification.findMany({
      where: {
        recipientId: memberId,
        type: "comment.liked",
        commentId: comment.comment.id,
      },
    });
    expect(notifs2.length).toBe(1);
  });

  it("liking your own comment creates no notification", async () => {
    // Create comment
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Self-like comment" }),
    });
    const createRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await createRes.json();

    // Author likes own comment
    const likeHeaders = new Headers();
    likeHeaders.set("x-user-id", memberId);
    const likeReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}/like`, {
      method: "POST",
      headers: likeHeaders,
    });
    await likeCommentRoute(likeReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });

    // Check no notification created
    const notifs = await prisma.notification.findMany({
      where: {
        recipientId: memberId,
        type: "comment.liked",
        commentId: comment.comment.id,
      },
    });
    expect(notifs.length).toBe(0);
  });

  it("user cannot like deleted comment", async () => {
    // Create comment
    const createHeaders = new Headers();
    createHeaders.set("x-user-id", memberId);
    createHeaders.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: createHeaders,
      body: JSON.stringify({ body: "Deletable comment" }),
    });
    const createRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const comment = await createRes.json();

    // Delete comment
    const deleteHeaders = new Headers();
    deleteHeaders.set("x-user-id", memberId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}`, {
      method: "DELETE",
      headers: deleteHeaders,
    });
    await deleteCommentRoute(deleteReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });

    // Try to like
    const likeHeaders = new Headers();
    likeHeaders.set("x-user-id", adminId);
    const likeReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments/${comment.comment.id}/like`, {
      method: "POST",
      headers: likeHeaders,
    });
    const likeRes = await likeCommentRoute(likeReq, { params: Promise.resolve({ projectId, taskId, commentId: comment.comment.id }) });
    expect(likeRes.status).toBe(404);
  });

  afterAll(async () => {
    await reseedDatabase();
    await cleanupNonSeededUsers();
  });

});
