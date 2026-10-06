import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { ActivityFeedService } from "@/server/modules/activity/feed-service";

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

  const canView = await perms.user(user.id).can("task.read");
  if (!isAdmin && !canView) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const result = await ActivityFeedService.getTaskActivity(projectId, taskId, page);

  return NextResponse.json({
    activities: result.activities,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
    },
  });
}
