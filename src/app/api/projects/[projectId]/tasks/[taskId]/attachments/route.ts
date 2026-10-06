import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { AttachmentService } from "@/server/modules/attachments/service";
import { createAttachmentSchema } from "@/server/modules/attachments/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  try {
    const userId = req.headers.get("x-user-id") || undefined;
    const user = await getCurrentUser(userId);

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "User not found" } },
        { status: 401 }
      );
    }

    const { projectId, taskId } = await params;

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task not found" } },
        { status: 404 }
      );
    }

    const attachments = await AttachmentService.getAttachments(projectId, taskId);
    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("GET /attachments error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  try {
    const userId = req.headers.get("x-user-id") || undefined;
    const user = await getCurrentUser(userId);

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "User not found" } },
        { status: 401 }
      );
    }

    const { projectId, taskId } = await params;

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task not found" } },
        { status: 404 }
      );
    }

    const perms = getPerms();
    await setupPermissions();

    const hasPermission = await perms.user(user.id).can("attachment.upload");
    const isAdmin = await perms.user(user.id).hasRole("admin");
    if (!isAdmin && !hasPermission) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Permission denied" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = createAttachmentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: result.error.errors } },
        { status: 400 }
      );
    }

    const attachment = await AttachmentService.createAttachment(projectId, taskId, result.data, user.id);
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("exceeds")) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }
    console.error("POST /attachments error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal server error" } },
      { status: 500 }
    );
  }
}
