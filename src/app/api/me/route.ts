import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ProfileService } from "@/server/modules/users/profile-service";
import { buildImageUrl } from "@/server/lib/cloudinary";
import { z } from "zod";
import { validateRequest } from "@/server/http/route";

const patchMeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId, req);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const status = (user as any).status || "ACTIVE";

  if (status !== "ACTIVE") {
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        status,
      },
    });
  }

  const perms = getPerms();
  await setupPermissions();

  const roles = await perms.user(user.id).getRoles();
  const permissions = await perms.user(user.id).getPermissions({ expand: true });

  const avatarUrl = user.avatarPublicId ? buildImageUrl(user.avatarPublicId, 32) : null;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarPublicId: user.avatarPublicId,
      avatarUrl,
      isActive: user.isActive,
      status,
    },
    roles,
    permissions,
  });
}

export async function PATCH(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId, req);

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
    const avatarUrl = updated.avatarPublicId ? buildImageUrl(updated.avatarPublicId, 32) : null;
    return NextResponse.json({ user: { ...updated, avatarUrl } });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update profile" } },
      { status: 400 }
    );
  }
}
