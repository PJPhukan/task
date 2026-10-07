import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ReportService } from "@/server/modules/reports/service";
import { exportReportQuerySchema } from "@/server/modules/reports/schema";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { exportToExcel, exportToPdf } from "./export-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || undefined;
    const userResult = await getCurrentUserWithStatus(userId, request);

    if (!userResult.ok) {
      return userResult.response;
    }

    const currentUser = userResult.user;

    const searchParams = request.nextUrl.searchParams;
    const queryData = {
      report: searchParams.get("report"),
      format: searchParams.get("format"),
      userId: searchParams.get("userId") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      projectId: searchParams.get("projectId") || undefined,
      boardId: searchParams.get("boardId") || undefined,
    };

    const query = exportReportQuerySchema.parse(queryData);

    let reportData: any;
    let reportTitle = "";
    let dateRange = "";

    const from = query.from === null ? undefined : query.from;
    const to = query.to === null ? undefined : query.to;

    if (from && to) {
      dateRange = ` (${from} to ${to})`;
    }

    if (query.report === "me") {
      reportTitle = `My Report${dateRange}`;
      reportData = await ReportService.getMeReport(currentUser.id, {
        from: from || "",
        to: to || "",
        projectId: query.projectId === null ? undefined : query.projectId,
        boardId: query.boardId === null ? undefined : query.boardId,
      });
    } else if (query.report === "user") {
      const targetUserId = query.userId || currentUser.id;
      reportTitle = `User Report${dateRange}`;
      reportData = await ReportService.getUserReport(currentUser.id, targetUserId, {
        from: from || "",
        to: to || "",
        projectId: query.projectId === null ? undefined : query.projectId,
        boardId: query.boardId === null ? undefined : query.boardId,
      });
    } else if (query.report === "overview") {
      const projectId = query.projectId === null ? undefined : query.projectId;
      const boardId = query.boardId === null ? undefined : query.boardId;
      if (!projectId || !boardId) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "projectId and boardId are required for overview report" } },
          { status: 400 }
        );
      }
      reportTitle = `Board Overview Report${dateRange}`;
      reportData = await ReportService.getOverviewReport(currentUser.id, {
        from: from ?? undefined,
        to: to ?? undefined,
        projectId: projectId as string,
        boardId: boardId as string,
      } as any);
    } else if (query.report === "stage-times") {
      const projectId = query.projectId === null ? undefined : query.projectId;
      const boardId = query.boardId === null ? undefined : query.boardId;
      if (!projectId || !boardId) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "projectId and boardId are required for stage-times report" } },
          { status: 400 }
        );
      }
      reportTitle = `Stage Times Report${dateRange}`;
      reportData = await ReportService.getStageTimesReport(currentUser.id, {
        projectId: projectId as string,
        boardId: boardId as string,
      } as any);
    } else {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid report type" } },
        { status: 400 }
      );
    }

    const fileName = `${query.report}-${query.from || "all"}-to-${query.to || "all"}`.replace(/:/g, "-");

    if (query.format === "xlsx") {
      const buffer = await exportToExcel(reportTitle, reportData, query.report, {
        from: query.from,
        to: query.to,
      });
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
        },
      });
    } else if (query.format === "pdf") {
      const buffer = await exportToPdf(reportTitle, reportData, query.report, {
        from: query.from,
        to: query.to,
      });
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
        },
      });
    } else {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid format" } },
        { status: 400 }
      );
    }
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("Permission denied")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Permission denied" } },
        { status: 403 }
      );
    }
    console.error("Export error:", error);
    return NextResponse.json(
      { error: { code: "EXPORT_ERROR", message: error.message || "Failed to export report" } },
      { status: 400 }
    );
  }
}
