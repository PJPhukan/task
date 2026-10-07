import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { TaskService } from "@/server/modules/tasks/service";
import { moveTaskSchema } from "@/server/modules/tasks/schema";
import { validateRequest } from "@/server/http/route";

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

  const hasPermission = await perms.user(user.id).can("task.move");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = validateRequest(moveTaskSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const task = await TaskService.moveTask(projectId, taskId, validation.data as any, user.id);
    return NextResponse.json({ task });
  } catch (error: any) {
    if (error.message === "Cannot move from this column") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cannot move task from this column" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "MOVE_ERROR", message: error.message || "Failed to move task" } },
      { status: 400 }
    );
  }
}
