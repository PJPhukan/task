import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { TaskService } from "@/server/modules/tasks/service";
import { updateTaskSchema } from "@/server/modules/tasks/schema";
import { validateRequest } from "@/server/http/route";
import { createMentionNotifications } from "@/server/modules/mentions/notifications";
import { sendNotificationEmailsAsync } from "@/server/modules/notifications/email-sender";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const { projectId, taskId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  try {
    const task = await TaskService.getTask(projectId, taskId, user.id);
    return NextResponse.json({ task });
  } catch (error: any) {
    if (error.message === "Cannot access column") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const { projectId, taskId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("task.update");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = validateRequest(updateTaskSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const task = await TaskService.updateTask(projectId, taskId, validation.data as any, user.id);

    // Handle mention notifications if description was updated with mentions
    if (validation.data.description !== undefined) {
      const { newMentionUserIds, hasAllMention } = task;
      if (newMentionUserIds?.length || hasAllMention) {
        await createMentionNotifications(projectId, taskId, undefined, user.id, newMentionUserIds || [], hasAllMention || false);
        await sendNotificationEmailsAsync(projectId);
      }
    }

    // Remove mention metadata from response
    const { newMentionUserIds: _, hasAllMention: __, ...taskResponse } = task;
    return NextResponse.json({ task: taskResponse });
  } catch (error: any) {
    try {
      const parsedError = JSON.parse(error.message);
      if (parsedError.code === "VALIDATION_ERROR" || parsedError.code === "FORBIDDEN") {
        return NextResponse.json(
          { error: parsedError },
          { status: parsedError.code === "FORBIDDEN" ? 403 : 400 }
        );
      }
    } catch {
      /* ignore parsing errors */
    }
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update task" } },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const { projectId, taskId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  try {
    await TaskService.deleteTask(projectId, taskId, user.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Permission denied") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Permission denied" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "DELETE_ERROR", message: error.message || "Failed to delete task" } },
      { status: 400 }
    );
  }
}
