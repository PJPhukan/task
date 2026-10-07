import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { RoleService } from "@/server/modules/roles/service";
import { updateRoleSchema, deleteRoleSchema } from "@/server/modules/roles/schema";
import { validateRequest } from "@/server/http/route";

async function checkPermission(userId: string) {
  const perms = getPerms();
  await setupPermissions();
  return perms.user(userId).can("role.manage");
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await context.params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

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
  const validation = validateRequest(updateRoleSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    await RoleService.ensureRoleManageGuard(user.id, roleId);
    const role = await RoleService.updateRole(roleId, validation.data as any);
    return NextResponse.json({ role });
  } catch (error: any) {
    if (error.message === "displayname-duplicate") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Display name already exists" } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update role" } },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await context.params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

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

  const body = await req.json().catch(() => ({}));
  const validation = validateRequest(deleteRoleSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    await RoleService.ensureRoleManageGuard(user.id, roleId);
    const result = await RoleService.deleteRole(roleId, (validation.data as any).reassignToRoleId);
    return NextResponse.json({ result });
  } catch (error: any) {
    if (error.message && error.message.includes("Users are still assigned")) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Users are still assigned to this role" } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: "DELETE_ERROR", message: error.message || "Failed to delete role" } },
      { status: 400 }
    );
  }
}
