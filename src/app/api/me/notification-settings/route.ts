import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { NotificationService } from "@/server/modules/notifications/service";
import { patchNotificationSettingsSchema } from "@/server/modules/notifications/schema";
import { validateRequest } from "@/server/http/route";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;
  const settings = await NotificationService.getNotificationSettings(user.id);

  return NextResponse.json({
    settings: {
      emailEnabled: settings.emailEnabled,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const body = await req.json();
  const validation = validateRequest(patchNotificationSettingsSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  const settings = await NotificationService.updateNotificationSettings(user.id, (validation.data as any).emailEnabled);

  return NextResponse.json({
    settings: {
      emailEnabled: settings.emailEnabled,
    },
  });
}
