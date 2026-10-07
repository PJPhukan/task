import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { ReportService } from "@/server/modules/reports/service";
import { meReportQuerySchema, type MeReportQuery } from "@/server/modules/reports/schema";
import { validateRequest } from "@/server/http/route";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

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

  const validation = validateRequest<MeReportQuery>(meReportQuerySchema, query);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const report = await ReportService.getMeReport(userResult.user.id, validation.data);
    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("Report error:", error);
    return NextResponse.json(
      { error: { code: "REPORT_ERROR", message: error.message || "Failed to generate report" } },
      { status: 400 }
    );
  }
}
