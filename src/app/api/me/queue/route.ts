import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { TaskListService } from "@/server/modules/tasks/list-service";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  try {
    const url = new URL(req.url);
    const assignedOnly = url.searchParams.get("assignedOnly") === "true";

    // Get tasks in user's queue (includes tasks with MOVE rules for their roles + assigned to them in columns with no MOVE rule)
    const tasks = await TaskListService.getMyQueueTasks(user.id, assignedOnly);

    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "QUEUE_ERROR", message: error.message || "Failed to get queue" } },
      { status: 400 }
    );
  }
}
