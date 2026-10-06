import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { ActivityFeedService } from "@/server/modules/activity/feed-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
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

    const { projectId } = await params;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
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
    const result = await ActivityFeedService.getProjectActivity(projectId, page);

    const filteredActivities = [];
    try {
      for (const activity of result.activities) {
        if (!activity.task) {
          filteredActivities.push(activity);
          continue;
        }

        const column = await prisma.boardColumn.findUnique({
          where: { id: activity.task.columnId },
          include: { rules: true },
        });

        if (!column) continue;

        if (column.rules.length === 0) {
          filteredActivities.push(activity);
          continue;
        }

        let canView = false;
        for (const rule of column.rules) {
          if (rule.ruleType === "view") {
            const hasRole = await perms.user(user.id).hasRole(rule.roleId);
            if (hasRole) {
              canView = true;
              break;
            }
          }
        }

        if (canView || isAdmin) {
          filteredActivities.push(activity);
        }
      }
    } catch (error) {
      console.error("Error filtering activities:", error);
    }

    return NextResponse.json({
      activities: filteredActivities,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("GET /activity error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal server error" } },
      { status: 500 }
    );
  }
}
