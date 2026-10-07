import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { AttachmentService } from "@/server/modules/attachments/service";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string; attachmentId: string }> }
) {
  try {
    const userId = req.headers.get("x-user-id") || undefined;
    const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

    const { projectId, taskId, attachmentId } = await params;

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

    await AttachmentService.deleteAttachment(projectId, taskId, attachmentId, user.id, canDeleteAny);
    return NextResponse.json({});
  } catch (error) {
    console.error("DELETE /attachments error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal server error" } },
      { status: 500 }
    );
  }
}
