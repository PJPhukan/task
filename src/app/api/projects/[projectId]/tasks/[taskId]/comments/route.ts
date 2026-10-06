import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { CommentService } from "@/server/modules/comments/service";
import { createCommentSchema } from "@/server/modules/comments/schema";
import { createRouteHandler } from "@/server/http/route";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";

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

  // Check column visibility
  const perms = getPerms();
  await setupPermissions();
  const userRoles = await perms.user(user.id).getRoles();
  const canViewColumn = await ColumnRulesService.canViewColumn(userRoles, task.columnId);

  if (!canViewColumn) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const result = await CommentService.getComments(projectId, taskId, page);

  return NextResponse.json({
    comments: result.comments,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
    },
  });
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

  const perms = getPerms();
  await setupPermissions();

  // Check column visibility
  const userRoles = await perms.user(user.id).getRoles();
  const canViewColumn = await ColumnRulesService.canViewColumn(userRoles, task.columnId);

  if (!canViewColumn) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  const hasPermission = await perms.user(user.id).can("comment.create");
  const isAdmin = await perms.user(user.id).hasRole("admin");
  if (!isAdmin && !hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const result = createCommentSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: result.error.issues } },
      { status: 400 }
    );
  }

  const comment = await CommentService.createComment(projectId, taskId, result.data, user.id);
  return NextResponse.json({ comment }, { status: 201 });
});

export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context);
}

export async function POST(req: NextRequest, context: any) {
  return postHandler(req, context);
}
