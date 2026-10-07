import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { LabelService } from "@/server/modules/labels/service";
import { updateTaskLabelsSchema, type UpdateTaskLabelsInput } from "@/server/modules/labels/schema";
import { validateRequest } from "@/server/http/route";

export async function PUT(
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

  const body = await req.json();
  const validation = validateRequest(updateTaskLabelsSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task not found" } },
        { status: 404 }
      );
    }

    const data = validation.data as UpdateTaskLabelsInput;
    const updated = await LabelService.updateTaskLabels(
      projectId,
      taskId,
      data.labelIds,
      user.id
    );

    // Format response with key
    const key = `${project.key}-${updated!.number}`;

    return NextResponse.json({
      task: {
        ...updated,
        key,
        labels: updated!.labels.map((tl) => ({
          id: tl.label.id,
          name: tl.label.name,
          color: tl.label.color,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update labels" } },
      { status: 400 }
    );
  }
}
