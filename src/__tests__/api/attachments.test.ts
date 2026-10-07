import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getAttachmentsRoute, POST as createAttachmentRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/attachments/route";
import { DELETE as deleteAttachmentRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/attachments/[attachmentId]/route";
import { DELETE as deleteTaskRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/route";
import { POST as getSignatureRoute } from "@/app/api/uploads/signature/route";
import { prisma } from "@/server/lib/prisma";
import { createFakeCloudinaryClient, setCloudinaryClient, getCloudinaryClient } from "@/server/lib/cloudinary";
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
  const fakeClient = createFakeCloudinaryClient();
  setCloudinaryClient(fakeClient);
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

  it("Attachment over 5 MB is rejected AND no longer exists in the fake", async () => {
    const largeFilePublicId = `projects/${projectId}/large-file`;
    const client = getCloudinaryClient();
    client.setFakeResource(largeFilePublicId, {
      public_id: largeFilePublicId,
      resource_type: "image",
      format: "jpg",
      bytes: 6 * 1024 * 1024, // 6 MB
    });

    // Verify file exists before request
    let storage = client.getFakeStorage();
    expect(storage[largeFilePublicId]).toBeDefined();

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: largeFilePublicId, originalName: "large-file.jpg" }) });
    const res = await createAttachmentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(400);

    // Verify file was deleted from the fake
    storage = client.getFakeStorage();
    expect(storage[largeFilePublicId]).toBeUndefined();
  });

  it("Attachment outside project folder is rejected AND removed", async () => {
    const wrongFolderPublicId = "other-project/file";
    const client = getCloudinaryClient();
    client.setFakeResource(wrongFolderPublicId, {
      public_id: wrongFolderPublicId,
      resource_type: "image",
      format: "jpg",
      bytes: 100 * 1024, // 100 KB
    });

    // Verify file exists before request
    let storage = client.getFakeStorage();
    expect(storage[wrongFolderPublicId]).toBeDefined();

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: wrongFolderPublicId, originalName: "file.jpg" }) });
    const res = await createAttachmentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(400);

    // Verify file was deleted from the fake
    storage = client.getFakeStorage();
    expect(storage[wrongFolderPublicId]).toBeUndefined();
  });


  it("Deleting an attachment removes it from the fake", async () => {
    const attachmentPublicId = `projects/${projectId}/attachment-1`;
    const client = getCloudinaryClient();
    client.setFakeResource(attachmentPublicId, {
      public_id: attachmentPublicId,
      resource_type: "image",
      format: "jpg",
      bytes: 100 * 1024, // 100 KB
    });

    // Create attachment
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: attachmentPublicId, originalName: "test.jpg" }) });
    const createRes = await createAttachmentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    expect(createRes.status).toBe(201);
    const createdAttachment = await createRes.json();
    const attachmentId = createdAttachment.attachment.id;

    // Verify file exists
    let storage = client.getFakeStorage();
    expect(storage[attachmentPublicId]).toBeDefined();

    // Delete attachment
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE", headers });
    const deleteRes = await deleteAttachmentRoute(deleteReq, { params: Promise.resolve({ projectId, taskId, attachmentId }) });
    expect(deleteRes.status).toBe(200);

    // Verify file was deleted
    storage = client.getFakeStorage();
    expect(storage[attachmentPublicId]).toBeUndefined();
  });

  it("Deleting a task removes all its attachments from the fake", async () => {
    const attachment1Id = `projects/${projectId}/attachment-2`;
    const attachment2Id = `projects/${projectId}/attachment-3`;
    const client = getCloudinaryClient();
    client.setFakeResource(attachment1Id, {
      public_id: attachment1Id,
      resource_type: "image",
      format: "jpg",
      bytes: 100 * 1024,
    });
    client.setFakeResource(attachment2Id, {
      public_id: attachment2Id,
      resource_type: "image",
      format: "png",
      bytes: 150 * 1024,
    });

    // Create a new task
    const board = await prisma.board.findFirst({ where: { projectId } });
    const column = await prisma.boardColumn.findFirst({ where: { boardId: board!.id } });
    const task = await prisma.task.create({
      data: {
        projectId,
        boardId: board!.id,
        columnId: column!.id,
        number: 999,
        title: "Task for deletion",
        reporterId: adminId,
        position: 0,
      },
    });

    // Create attachments
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    let req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: attachment1Id, originalName: "test1.jpg" }) });
    let res = await createAttachmentRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(res.status).toBe(201);

    req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: attachment2Id, originalName: "test2.png" }) });
    res = await createAttachmentRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(res.status).toBe(201);

    // Verify files exist
    let storage = client.getFakeStorage();
    expect(storage[attachment1Id]).toBeDefined();
    expect(storage[attachment2Id]).toBeDefined();

    // Delete task
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE", headers });
    const deleteRes = await deleteTaskRoute(deleteReq, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(deleteRes.status).toBe(200);

    // Verify files were deleted
    storage = client.getFakeStorage();
    expect(storage[attachment1Id]).toBeUndefined();
    expect(storage[attachment2Id]).toBeUndefined();
  });

  it("Adding an attachment writes the right activity row", async () => {
    const attachmentPublicId = `projects/${projectId}/activity-test`;
    const client = getCloudinaryClient();
    client.setFakeResource(attachmentPublicId, {
      public_id: attachmentPublicId,
      resource_type: "image",
      format: "jpg",
      bytes: 100 * 1024,
    });

    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: attachmentPublicId, originalName: "activity.jpg" }) });
    const res = await createAttachmentRoute(req, { params: Promise.resolve({ projectId, taskId }) });
    expect(res.status).toBe(201);

    // Check activity
    const activity = await prisma.activityLog.findFirst({
      where: { projectId, taskId, action: "attachment.added" },
      orderBy: { createdAt: "desc" },
    });
    expect(activity).toBeDefined();
    expect(activity?.meta).toMatchObject({ fileName: "activity.jpg" });
  });

  it("Removing an attachment writes the right activity row", async () => {
    const attachmentPublicId = `projects/${projectId}/remove-activity-test`;
    const client = getCloudinaryClient();
    client.setFakeResource(attachmentPublicId, {
      public_id: attachmentPublicId,
      resource_type: "image",
      format: "jpg",
      bytes: 100 * 1024,
    });

    // Create attachment
    const headers = new Headers();
    headers.set("x-user-id", adminId);
    headers.set("content-type", "application/json");
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments`, { method: "POST", headers, body: JSON.stringify({ publicId: attachmentPublicId, originalName: "remove-test.jpg" }) });
    const createRes = await createAttachmentRoute(createReq, { params: Promise.resolve({ projectId, taskId }) });
    expect(createRes.status).toBe(201);
    const createdAttachment = await createRes.json();
    const attachmentId = createdAttachment.attachment.id;

    // Delete attachment
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE", headers });
    const deleteRes = await deleteAttachmentRoute(deleteReq, { params: Promise.resolve({ projectId, taskId, attachmentId }) });
    expect(deleteRes.status).toBe(200);

    // Check activity
    const activity = await prisma.activityLog.findFirst({
      where: { projectId, taskId, action: "attachment.removed" },
      orderBy: { createdAt: "desc" },
    });
    expect(activity).toBeDefined();
    expect(activity?.meta).toMatchObject({ fileName: "remove-test.jpg" });
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
