import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { CalendarService } from "@/server/modules/calendar/service";
import { getCalendarSchema } from "@/server/modules/calendar/schema";

const MAX_DAYS = 62;

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  try {
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const projectId = searchParams.get("projectId") || undefined;
    const boardId = searchParams.get("boardId") || undefined;
    const assignedToMe = searchParams.get("assignedToMe") || undefined;

    // Validate input
    const result = getCalendarSchema.safeParse({
      from,
      to,
      projectId,
      boardId,
      assignedToMe,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: result.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const fromDate = new Date(result.data.from);
    const toDate = new Date(result.data.to);

    // Check date range
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > MAX_DAYS) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: `Date range cannot exceed ${MAX_DAYS} days`,
          },
        },
        { status: 400 }
      );
    }

    const tasks = await CalendarService.getCalendarTasks(
      user.id,
      fromDate,
      toDate,
      result.data.projectId,
      result.data.boardId,
      result.data.assignedToMe === "true"
    );

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("GET /api/calendar error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
