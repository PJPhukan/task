import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { TaskService } from "@/server/modules/tasks/service";
import { TaskListService } from "@/server/modules/tasks/list-service";
import { createTaskSchema } from "@/server/modules/tasks/schema";
import { validateRequest } from "@/server/http/route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
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

  const searchParams = req.nextUrl.searchParams;
  const filters = {
    boardId: searchParams.get("boardId") || undefined,
    columnId: searchParams.get("columnId") || undefined,
    assigneeId: searchParams.get("assigneeId") || undefined,
    reporterId: searchParams.get("reporterId") || undefined,
    priority: searchParams.get("priority") || undefined,
    labelId: searchParams.get("labelId") || undefined,
    dueFrom: searchParams.get("dueFrom") || undefined,
    dueTo: searchParams.get("dueTo") || undefined,
    overdue: searchParams.get("overdue") === "true",
    completed: searchParams.get("completed") === "true",
    search: searchParams.get("search") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    pageSize: parseInt(searchParams.get("pageSize") || "20"),
    sortBy: (searchParams.get("sortBy") || "createdAt") as
      | "createdAt"
      | "dueDate"
      | "priority",
    sortOrder: (searchParams.get("sortOrder") || "desc") as "asc" | "desc",
  };

  try {
    const result = await TaskListService.listProjectTasks(projectId, filters, user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "LIST_ERROR", message: error.message || "Failed to list tasks" } },
      { status: 400 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("task.create");
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
  const validation = validateRequest(createTaskSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const task = await TaskService.createTask(projectId, validation.data as any, user.id);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "CREATION_ERROR", message: error.message || "Failed to create task" } },
      { status: 400 }
    );
  }
}
