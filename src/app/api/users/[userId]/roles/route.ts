import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { UserService } from "@/server/modules/users/service";
import { updateUserRolesSchema } from "@/server/modules/users/schema";
import { validateRequest } from "@/server/http/route";

async function checkPermission(userId: string) {
  const perms = getPerms();
  await setupPermissions();
  return perms.user(userId).can("user.manage");
}

export async function PUT(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  const currentUserId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(currentUserId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const hasPermission = await checkPermission(user.id);
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = validateRequest(updateUserRolesSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const updatedUser = await UserService.updateUserRoles(userId, validation.data as any);
    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    console.error("User roles update error:", error);
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update user roles", details: error.toString() } },
      { status: 400 }
    );
  }
}
