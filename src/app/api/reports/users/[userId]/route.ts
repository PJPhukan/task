import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ReportService } from "@/server/modules/reports/service";
import { userReportQuerySchema, type UserReportQuery } from "@/server/modules/reports/schema";
import { validateRequest } from "@/server/http/route";

export async function GET(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await context.params;
  const currentUserId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(currentUserId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const url = new URL(req.url);
  const query = {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    projectId: url.searchParams.get("projectId") || undefined,
    boardId: url.searchParams.get("boardId") || undefined,
  };

  const validation = validateRequest<UserReportQuery>(userReportQuerySchema, query);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  if (targetUserId !== userResult.user.id) {
    const perms = getPerms();
    await setupPermissions();
    const hasPermission = await perms.user(userResult.user.id).can("report.view.all");
    if (!hasPermission) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Permission denied" } },
        { status: 403 }
      );
    }
  }

  try {
    const report = await ReportService.getUserReport(userResult.user.id, targetUserId, validation.data);
    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("Report error:", error);
    const status = error.message === "Permission denied" ? 403 : 400;
    return NextResponse.json(
      { error: { code: "REPORT_ERROR", message: error.message || "Failed to generate report" } },
      { status }
    );
  }
}
