import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import {
  updateColumnSchema,
  deleteColumnSchema,
} from "@/server/modules/columns/schema";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; columnId: string }> }
) {
  const { columnId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("column.manage");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const result = updateColumnSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  // Validate that time limit is not set on done columns
  const currentColumn = await prisma.boardColumn.findUnique({
    where: { id: columnId },
  });

  if (!currentColumn) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Column not found" } },
      { status: 404 }
    );
  }

  const isDone = result.data.isDone !== undefined ? result.data.isDone : currentColumn.isDone;
  if (isDone && result.data.timeLimitHours !== undefined) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Done columns cannot have time limits" } },
      { status: 400 }
    );
  }

  const column = await prisma.boardColumn.update({
    where: { id: columnId },
    data: {
      ...(result.data.name && { name: result.data.name }),
      ...(result.data.color !== undefined && { color: result.data.color }),
      ...(result.data.isDone !== undefined && { isDone: result.data.isDone }),
      ...(result.data.timeLimitHours !== undefined && { timeLimitHours: result.data.timeLimitHours }),
    },
  });

  return NextResponse.json({ column });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; columnId: string }> }
) {
  const { columnId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("column.manage");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const result = deleteColumnSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  const taskCount = await prisma.task.count({
    where: { columnId },
  });

  if (taskCount > 0 && !result.data.targetColumnId) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "Cannot delete column with tasks without specifying targetColumnId",
        },
      },
      { status: 409 }
    );
  }

  if (result.data.targetColumnId && taskCount > 0) {
    await prisma.task.updateMany({
      where: { columnId },
      data: { columnId: result.data.targetColumnId },
    });
  }

  await prisma.boardColumn.delete({
    where: { id: columnId },
  });

  return NextResponse.json({ success: true });
}
