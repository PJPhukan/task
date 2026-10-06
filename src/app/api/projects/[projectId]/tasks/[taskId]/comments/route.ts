import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { CommentService } from "@/server/modules/comments/service";
import { createCommentSchema } from "@/server/modules/comments/schema";

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

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        { status: 404 }
      );
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: { column: true },
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
  } catch (error) {
    console.error("GET /comments error:", error);
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

    const hasPermission = await perms.user(user.id).can("comment.create");
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
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: result.error.errors } },
        { status: 400 }
      );
    }

    const comment = await CommentService.createComment(projectId, taskId, result.data, user.id);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("POST /comments error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal server error" } },
      { status: 500 }
    );
  }
}
