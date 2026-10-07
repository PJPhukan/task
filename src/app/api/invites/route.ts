import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { InviteService } from "@/server/modules/invites/service";
import { createInviteSchema, type CreateInviteInput } from "@/server/modules/invites/schema";
import { validateRequest } from "@/server/http/route";

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

  try {
    const invites = await InviteService.listInvites();
    return NextResponse.json({ invites });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "LIST_ERROR", message: error.message || "Failed to list invites" } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const validation = validateRequest<CreateInviteInput>(createInviteSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const invite = await InviteService.createInvite(validation.data, userResult.user.id);
    return NextResponse.json({ invite }, { status: 201 });
  } catch (error: any) {
    const message = error.message || "Failed to create invite";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json(
      { error: { code: "CREATION_ERROR", message } },
      { status }
    );
  }
}
