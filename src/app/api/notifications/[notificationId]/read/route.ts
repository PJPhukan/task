import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { NotificationService } from "@/server/modules/notifications/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const { notificationId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const result = await NotificationService.markAsRead(notificationId, user.id);

  if (result.count === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Notification not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
