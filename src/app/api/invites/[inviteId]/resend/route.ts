import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { InviteService } from "@/server/modules/invites/service";

export async function POST(
  req: NextRequest,
  { params }: { params: { inviteId: string } }
) {
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

  try {
    const result = await InviteService.resendInvite(params.inviteId);
    return NextResponse.json({ invite: result });
  } catch (error: any) {
    const message = error.message || "Failed to resend invite";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json(
      { error: { code: "RESEND_ERROR", message } },
      { status }
    );
  }
}
