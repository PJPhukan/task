import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { ProfileService } from "@/server/modules/users/profile-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const currentUserId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(currentUserId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  try {
    const profile = await ProfileService.getUserProfile(userId);
    return NextResponse.json({ profile });
  } catch (error: any) {
    if (error.message === "User not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch profile" } },
      { status: 500 }
    );
  }
}
