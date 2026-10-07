import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ProjectService } from "@/server/modules/projects/service";
import { createProjectSchema } from "@/server/modules/projects/schema";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;
  const perms = getPerms();
  await setupPermissions();

  const isAdmin = await perms.user(user.id).hasRole("admin");
  const projects = await ProjectService.listProjectsForUser(user.id, isAdmin);

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;
  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("project.create");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const result = createProjectSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: result.error.issues } },
      { status: 400 }
    );
  }

  const project = await ProjectService.createProject(result.data, user.id);
  return NextResponse.json({ project }, { status: 201 });
}
