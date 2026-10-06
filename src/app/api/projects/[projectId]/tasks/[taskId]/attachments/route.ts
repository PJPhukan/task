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
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const { projectId, taskId } = params;

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

  const perms = getPerms();
  await setupPermissions();

  const isAdmin = await perms.user(user.id).hasRole("admin");
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });

  if (!isAdmin && !isMember) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not a project member" } },
      { status: 403 }
    );
  }

  const canView = await perms.user(user.id).can("task.read");
  if (!isAdmin && !canView) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const attachments = await AttachmentService.getAttachments(projectId, taskId);
  return NextResponse.json({ attachments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const { projectId, taskId } = params;

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

  const perms = getPerms();
  await setupPermissions();

  const isAdmin = await perms.user(user.id).hasRole("admin");
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });

  if (!isAdmin && !isMember) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not a project member" } },
      { status: 403 }
    );
  }

  const hasPermission = await perms.user(user.id).can("attachment.upload");
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

  try {
    const attachment = await AttachmentService.createAttachment(projectId, taskId, result.data, user.id);
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save attachment";
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message } },
      { status: 400 }
    );
  }
}
