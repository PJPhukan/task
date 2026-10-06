import "server-only";
import { prisma } from "@/server/lib/prisma";
import { CreateAttachmentInput } from "./schema";
import { ActivityService } from "@/server/modules/activity/service";
import { deleteResource, getResourceInfo, buildImageUrl } from "@/server/lib/cloudinary";

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp", "gif", "pdf"];

export class AttachmentService {
  static async createAttachment(
    projectId: string,
    taskId: string,
    input: CreateAttachmentInput,
    userId: string
  ) {
    const resource = await getResourceInfo(input.publicId);
    if (!resource) {
      throw new Error("Attachment not found in storage");
    }

    // Validate format
    if (!ALLOWED_FORMATS.includes(resource.format.toLowerCase())) {
      await deleteResource(input.publicId);
      throw new Error("Format not allowed");
    }

    // Validate size
    if (resource.bytes > MAX_ATTACHMENT_SIZE) {
      await deleteResource(input.publicId);
      throw new Error("Attachment exceeds 5 MB limit");
    }

    // Validate folder (should be under project folder)
    if (!resource.public_id.startsWith(`projects/${projectId}/`)) {
      await deleteResource(input.publicId);
      throw new Error("Attachment not found in project folder");
    }

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        uploadedById: userId,
        publicId: input.publicId,
        resourceType: resource.resource_type,
        format: resource.format,
        bytes: resource.bytes,
        width: resource.width,
        height: resource.height,
        originalName: input.originalName,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatarPublicId: true, email: true },
        },
      },
    });

    await ActivityService.recordActivity(projectId, "attachment.added", userId, taskId, {
      attachmentId: attachment.id,
      fileName: input.originalName,
    });

    return {
      ...attachment,
      thumbnailUrl: buildImageUrl(attachment.publicId, 200),
      fullUrl: buildImageUrl(attachment.publicId),
    };
  }

  static async getAttachments(projectId: string, taskId: string) {
    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatarPublicId: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return attachments.map((attachment) => ({
      ...attachment,
      thumbnailUrl: buildImageUrl(attachment.publicId, 200),
      fullUrl: buildImageUrl(attachment.publicId),
    }));
  }

  static async deleteAttachment(
    projectId: string,
    taskId: string,
    attachmentId: string,
    userId: string,
    canDeleteAny: boolean
  ) {
    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw new Error("Attachment not found");

    const isUploader = attachment.uploadedById === userId;
    if (!isUploader && !canDeleteAny) {
      throw new Error("You can only delete your own attachments");
    }

    await deleteResource(attachment.publicId);

    await prisma.attachment.delete({ where: { id: attachmentId } });

    await ActivityService.recordActivity(projectId, "attachment.removed", userId, taskId, {
      attachmentId,
      fileName: attachment.originalName,
    });
  }
}
