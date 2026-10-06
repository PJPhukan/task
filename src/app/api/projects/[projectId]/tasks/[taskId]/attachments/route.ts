import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { prisma } from "@/server/lib/prisma";
import { AttachmentService } from "@/server/modules/attachments/service";
import { createAttachmentSchema } from "@/server/modules/attachments/schema";
import { createRouteHandler } from "@/server/http/route";

const getHandler = createRouteHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) => {
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
});

const postHandler = createRouteHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) => {
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
    throw error;
  }
});

export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context);
}

export async function POST(req: NextRequest, context: any) {
  return postHandler(req, context);
}
