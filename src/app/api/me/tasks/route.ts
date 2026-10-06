import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { TaskListService } from "@/server/modules/tasks/list-service";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const filters = {
    open: searchParams.get("open") === "true",
    overdue: searchParams.get("overdue") === "true",
    completed: searchParams.get("completed") === "true",
  };

  try {
    const tasks = await TaskListService.listMyTasks(user.id, filters);
    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "LIST_ERROR", message: error.message || "Failed to list tasks" } },
      { status: 400 }
    );
  }
}
