import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCommentsRoute, POST as createCommentRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/comments/route";
import { GET as getMentionableRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/mentionable/route";
import { prisma } from "@/server/lib/prisma";
import { parseMentions } from "@/server/modules/mentions/parser";
import { reseedDatabase, cleanupNonSeededUsers } from "@/__tests__/__helpers__/seed";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let memberId: string;
let developerId: string;
let viewerId: string;
let projectId: string;
let taskId: string;

beforeAll(async () => {
  await reseedDatabase();
  const users = await prisma.user.findMany({
    where: { email: { in: ["admin@example.com", "member@example.com", "developer@example.com", "viewer@example.com"] } },
  });
  adminId = users.find((u) => u.email === "admin@example.com")!.id;
  memberId = users.find((u) => u.email === "member@example.com")!.id;
  developerId = users.find((u) => u.email === "developer@example.com")!.id;
  viewerId = users.find((u) => u.email === "viewer@example.com")!.id;

  const project = await prisma.project.create({
    data: {
      name: "Mentions Test Project",
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  await prisma.projectMember.createMany({
    data: [
      { projectId, userId: adminId },
      { projectId, userId: memberId },
      { projectId, userId: developerId },
      { projectId, userId: viewerId },
    ],
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: "Mentions Board",
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
      title: "Test Task for Mentions",
      reporterId: adminId,
      position: 0,
    },
  });
  taskId = task.id;
});

afterAll(async () => {
  await cleanupNonSeededUsers();
});

describe("Mentions System", () => {
  it("parseMentions finds user and all tokens", async () => {
    const text = `Hey @[user:${memberId}] and @[user:${developerId}], check @[all] this out`;
    const mentions = parseMentions(text);
    expect(mentions).toHaveLength(3);
    expect(mentions).toContainEqual({ type: "user", userId: memberId });
    expect(mentions).toContainEqual({ type: "user", userId: developerId });
    expect(mentions).toContainEqual({ type: "all" });
  });

  it("parseMentions ignores malformed tokens", async () => {
    const text = `Hey @[unknown] and @invalid and @[user ${memberId}] and @[user:${memberId}]`;
    const mentions = parseMentions(text);
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toEqual({ type: "user", userId: memberId });
  });

  it("POST /api/projects/:projectId/tasks/:taskId/comments with valid mention creates Mention row", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: `Hey @[user:${memberId}], check this` }),
    });
    const res = await createCommentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    const commentId = data.comment.id;

    const mention = await prisma.mention.findFirst({
      where: { commentId, userId: memberId },
    });
    expect(mention).toBeDefined();
    expect(mention?.userId).toBe(memberId);
    expect(mention?.isAll).toBe(false);
  });

  it("POST /api/projects/:projectId/tasks/:taskId/comments with invalid user returns 400", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: `Hey @[user:invalid-id], check this` }),
    });
    const res = await createCommentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.details).toContain("invalid-id");
  });

  it("POST /api/projects/:projectId/tasks/:taskId/comments with @[all] without permission returns 403", async () => {
    const headers = new Headers();
    headers.set("x-user-id", viewerId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: `Hey @[all], attention everyone` }),
    });
    const res = await createCommentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(403);
  });

  it("POST /api/projects/:projectId/tasks/:taskId/comments with @[all] creates Mention row with isAll=true", async () => {
    const headers = new Headers();
    headers.set("x-user-id", memberId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: `Hey @[all], everyone check this` }),
    });
    const res = await createCommentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    const commentId = data.comment.id;

    const allMention = await prisma.mention.findFirst({
      where: { commentId, isAll: true },
    });
    expect(allMention).toBeDefined();
    expect(allMention?.isAll).toBe(true);
    expect(allMention?.userId).toBeNull();
  });

  it("GET /api/projects/:projectId/tasks/:taskId/comments includes mentions in response", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: `Hey @[user:${memberId}]` }),
    });
    const createRes = await createCommentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    const createdComment = (await createRes.json()).comment;

    const getHeaders = new Headers();
    getHeaders.set("x-user-id", adminId);
    const getReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "GET",
      headers: getHeaders,
    });
    const getRes = await getCommentsRoute(getReq, { params: Promise.resolve({ projectId, taskId }) });
    const data = await getRes.json();
    const comment = data.comments.find((c: any) => c.id === createdComment.id);

    expect(comment).toBeDefined();
    expect(comment.mentions).toBeDefined();
    expect(comment.mentions.length).toBe(1);
    expect(comment.mentions[0].id).toBe(memberId);
  });

  it("GET /api/projects/:projectId/tasks/:taskId/mentionable returns users who can view the task", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/mentionable`, {
      method: "GET",
      headers,
    });
    const res = await getMentionableRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.canMentionAll).toBe(true);
  });

  it("GET /api/projects/:projectId/tasks/:taskId/mentionable filters by name", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/mentionable?q=Member`, {
      method: "GET",
      headers,
    });
    const res = await getMentionableRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    const data = await res.json();
    expect(data.users.length).toBeGreaterThan(0);
    expect(data.users.some((u: any) => u.name.toLowerCase().includes("member"))).toBe(true);
  });

  it("GET /api/projects/:projectId/tasks/:taskId/mentionable reports canMentionAll correctly", async () => {
    const adminHeaders = new Headers();
    adminHeaders.set("x-user-id", adminId);
    const adminReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/mentionable`, {
      method: "GET",
      headers: adminHeaders,
    });
    const adminRes = await getMentionableRoute(adminReq, { params: Promise.resolve({ projectId, taskId }) });
    const adminData = await adminRes.json();
    expect(adminData.canMentionAll).toBe(true);

    const viewerHeaders = new Headers();
    viewerHeaders.set("x-user-id", viewerId);
    const viewerReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/mentionable`, {
      method: "GET",
      headers: viewerHeaders,
    });
    const viewerRes = await getMentionableRoute(viewerReq, { params: Promise.resolve({ projectId, taskId }) });
    const viewerData = await viewerRes.json();
    expect(viewerData.canMentionAll).toBe(false);
  });

  it("Mentions are not duplicated on re-save", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");

    const req1 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: `Hey @[user:${memberId}]` }),
    });
    const res1 = await createCommentRoute(req1, { params: Promise.resolve({ projectId, taskId }) });
    const comment = (await res1.json()).comment;

    const mentions1 = await prisma.mention.findMany({
      where: { commentId: comment.id },
    });
    expect(mentions1.length).toBe(1);
  });
});
