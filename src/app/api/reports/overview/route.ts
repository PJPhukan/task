import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ReportService } from "@/server/modules/reports/service";
import { overviewReportQuerySchema, type OverviewReportQuery } from "@/server/modules/reports/schema";
import { validateRequest } from "@/server/http/route";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const perms = getPerms();
  await setupPermissions();
  const hasPermission = await perms.user(userResult.user.id).can("report.view.all");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const query = {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    projectId: url.searchParams.get("projectId") || "",
    boardId: url.searchParams.get("boardId") || "",
  };

  const validation = validateRequest<OverviewReportQuery>(overviewReportQuerySchema, query);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const report = await ReportService.getOverviewReport(userResult.user.id, validation.data);
    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("Report error:", error);
    const status = error.message === "Board not found" ? 404 : 400;
    return NextResponse.json(
      { error: { code: "REPORT_ERROR", message: error.message || "Failed to generate report" } },
      { status }
    );
  }
}
