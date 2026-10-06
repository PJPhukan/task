import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { RoleService } from "@/server/modules/roles/service";
import { createRoleSchema } from "@/server/modules/roles/schema";
import { validateRequest } from "@/server/http/route";
import { permissionCatalog } from "@/server/permissions/catalog";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  try {
    const roles = await RoleService.listRoles();
    return NextResponse.json({ roles });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list roles" } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

  const hasPermission = await perms.user(user.id).can("role.manage");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = validateRequest(createRoleSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const newRole = await RoleService.createRole(validation.data);
    return NextResponse.json({ role: newRole }, { status: 201 });
  } catch (error: any) {
    if (error.message.includes("duplicate")) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Role name already exists" } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: "CREATION_ERROR", message: error.message || "Failed to create role" } },
      { status: 400 }
    );
  }
}
