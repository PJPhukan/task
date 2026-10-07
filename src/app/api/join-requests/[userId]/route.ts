import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { JoinRequestService } from "@/server/modules/join-requests/service";
import { validateRequest } from "@/server/http/route";
import { approveJoinRequestSchema, rejectJoinRequestSchema } from "@/server/modules/join-requests/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
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

  // Determine which action based on URL
  const pathname = req.nextUrl.pathname;

  if (pathname.includes("/approve")) {
    const body = await req.json();
    const validation = validateRequest(approveJoinRequestSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
        { status: 400 }
      );
    }

    try {
      await JoinRequestService.approveUser(params.userId, validation.data as any);
      return NextResponse.json({ message: "User approved" });
    } catch (error: any) {
      return NextResponse.json(
        { error: { code: "ERROR", message: error.message || "Failed to approve user" } },
        { status: 400 }
      );
    }
  }

  if (pathname.includes("/reject")) {
    const body = await req.json().catch(() => ({}));
    const validation = validateRequest(rejectJoinRequestSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
        { status: 400 }
      );
    }

    try {
      await JoinRequestService.rejectUser(params.userId, validation.data as any);
      return NextResponse.json({ message: "User rejected" });
    } catch (error: any) {
      return NextResponse.json(
        { error: { code: "ERROR", message: error.message || "Failed to reject user" } },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: "Endpoint not found" } },
    { status: 404 }
  );
}
