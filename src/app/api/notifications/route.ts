import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { NotificationService } from "@/server/modules/notifications/service";
import { prisma } from "@/server/lib/prisma";
import { buildImageUrl } from "@/server/lib/cloudinary";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const searchParams = req.nextUrl.searchParams;
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const notifications = await NotificationService.getNotifications(user.id, unreadOnly, limit, offset);

  const formatted = notifications.map((n: any) => ({
    id: n.id,
    type: n.type,
    readAt: n.readAt,
    createdAt: n.createdAt,
    payload: n.payload,
    actor: {
      id: n.actor.id,
      name: n.actor.name,
      avatar: n.actor.avatarPublicId ? buildImageUrl(n.actor.avatarPublicId, 32) : null,
    },
    task: n.task
      ? {
          id: n.task.id,
          projectId: n.task.projectId,
          boardId: n.task.boardId,
          columnId: n.task.columnId,
        }
      : null,
  }));

  return NextResponse.json({ notifications: formatted });
}
