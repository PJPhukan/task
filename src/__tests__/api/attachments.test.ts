import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getAttachmentsRoute, POST as createAttachmentRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/attachments/route";
import { POST as getSignatureRoute } from "@/app/api/uploads/signature/route";
import { prisma } from "@/server/lib/prisma";
import { setFakeCloudinaryResource, clearFakeCloudinaryResources } from "@/server/lib/cloudinary";
import { reseedDatabase, cleanupNonSeededUsers } from "@/__tests__/__helpers__/seed";

function generateProjectKey(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let adminId: string;
let projectId: string;
let taskId: string;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });
  adminId = admin!.id;

  const project = await prisma.project.create({
    data: {
      name: "Attachments Test",
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  await prisma.projectMember.create({
    data: { projectId, userId: adminId },
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: "Board",
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
      title: "Task",
      reporterId: adminId,
      position: 0,
    },
  });
  taskId = task.id;
});

beforeEach(() => {
  clearFakeCloudinaryResources();
});

describe("Attachments API", () => {

  it("GET /api/projects/:projectId/tasks/:taskId/attachments returns empty list initially", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`, { method: "GET", headers });
    const res = await getAttachmentsRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.attachments)).toBe(true);
  });

  it("POST /api/uploads/signature returns 503 when Cloudinary not configured", async () => {
    // Since env is not configured in tests, should return 503
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/uploads/signature`, { method: "POST", headers, body: JSON.stringify({ projectId, kind: "attachment" }) });
    const res = await getSignatureRoute(req);
    expect(res.status).toBe(503);
  });

  it("POST /api/uploads/signature returns 404 for nonexistent project", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/uploads/signature`, { method: "POST", headers, body: JSON.stringify({ projectId: "cm000000000000000000000aaa", kind: "attachment" }) });
    const res = await getSignatureRoute(req);
    expect(res.status).toBe(404);
  });

  it("POST /api/projects/:projectId/tasks/:taskId/attachments returns 400 for missing resource", async () => {
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: "nonexistent", originalName: "test.jpg" }) });
    const res = await createAttachmentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(400);
  });

  it("Attachment over 5 MB is rejected", async () => {
    const largeFilePublicId = `projects/${projectId}/large-file`;
    setFakeCloudinaryResource(largeFilePublicId, {
      public_id: largeFilePublicId,
      resource_type: "image",
      format: "jpg",
      bytes: 6 * 1024 * 1024, // 6 MB
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: largeFilePublicId, originalName: "large-file.jpg" }) });
    const res = await createAttachmentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(400);
  });

  it("Attachment outside project folder is rejected", async () => {
    const wrongFolderPublicId = "other-project/file";
    setFakeCloudinaryResource(wrongFolderPublicId, {
      public_id: wrongFolderPublicId,
      resource_type: "image",
      format: "jpg",
      bytes: 100 * 1024, // 100 KB
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: wrongFolderPublicId, originalName: "file.jpg" }) });
    const res = await createAttachmentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(400);
  });


  afterAll(async () => {
    // Clean up test data
    if (projectId) {
      await prisma.task.deleteMany({ where: { projectId } });
      await prisma.board.deleteMany({ where: { projectId } });
      await prisma.projectMember.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } });
    }
    await reseedDatabase();
    await cleanupNonSeededUsers();
  });

});
