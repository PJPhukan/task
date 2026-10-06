import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const perms = getPerms();
  await setupPermissions();

  const roles = await perms.user(user.id).getRoles();
  const permissions = await perms.user(user.id).getPermissions({ expand: true });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarPublicId: user.avatarPublicId,
      isActive: user.isActive,
    },
    roles,
    permissions,
  });
}
