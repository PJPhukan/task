import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { MentionService } from "@/server/modules/mentions/service";
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

  const query = req.nextUrl.searchParams.get("q") || undefined;
  const users = await MentionService.getMentionableUsers(projectId, taskId, query);
  const canMentionAll = await perms.user(user.id).can("mention.all");

  return NextResponse.json({
    users,
    canMentionAll,
  });
});

export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context);
}
