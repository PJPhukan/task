import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { AttachmentService } from "@/server/modules/attachments/service";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string; attachmentId: string }> }
) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const { projectId, taskId, attachmentId } = params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
  });
  if (!task) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.taskId !== taskId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Attachment not found" } },
      { status: 404 }
    );
  }

  const perms = getPerms();
  await setupPermissions();

  const isUploader = attachment.uploadedById === user.id;
  const canDeleteAny = await perms.user(user.id).can("attachment.delete.any");

  if (!isUploader && !canDeleteAny) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You can only delete your own attachments" } },
      { status: 403 }
    );
  }

  try {
    await AttachmentService.deleteAttachment(projectId, taskId, attachmentId, user.id, canDeleteAny);
    return NextResponse.json({});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete attachment";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}
