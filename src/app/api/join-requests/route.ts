import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { JoinRequestService } from "@/server/modules/join-requests/service";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(userResult.user.id).can("user.manage");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const joinRequests = await JoinRequestService.listPendingUsers();
  return NextResponse.json({ joinRequests });
}
