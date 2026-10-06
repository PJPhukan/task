import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ProfileService } from "@/server/modules/users/profile-service";
import { z } from "zod";
import { validateRequest } from "@/server/http/route";

const patchMeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

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

export async function PATCH(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const body = await req.json();
  const validation = validateRequest(patchMeSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const updated = await ProfileService.updateOwnProfile(user.id, validation.data as any);
    return NextResponse.json({ user: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update profile" } },
      { status: 400 }
    );
  }
}
