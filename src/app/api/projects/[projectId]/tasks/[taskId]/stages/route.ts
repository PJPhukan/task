import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { prisma } from "@/server/lib/prisma";
import { StageService } from "@/server/modules/tasks/stage-service";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";
import { getPerms, setupPermissions } from "@/server/lib/permly";

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

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  try {
    // Get task to verify it exists
    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task not found" } },
        { status: 404 }
      );
    }

    // Check if user can view the task's column
    const perms = getPerms();
    await setupPermissions();
    const userRoles = await perms.user(user.id).getRoles();
    const canViewColumn = await ColumnRulesService.canViewColumn(userRoles, task.columnId);

    if (!canViewColumn) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cannot access column" } },
        { status: 403 }
      );
    }

    const stages = await StageService.getTaskStages(projectId, taskId);
    return NextResponse.json({ stages });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "LIST_ERROR", message: error.message || "Failed to get stage history" } },
      { status: 400 }
    );
  }
}
