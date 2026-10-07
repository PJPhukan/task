import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ProjectService } from "@/server/modules/projects/service";
import { updateProjectSchema } from "@/server/modules/projects/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const project = await ProjectService.getProject(projectId);
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  // Check personal project access
  if ((project as any).isPersonal && (project as any).ownerId !== user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not a project member" } },
      { status: 403 }
    );
  }

  // Check regular project membership
  if (!(project as any).isPersonal) {
    const isMember = await ProjectService.isMember(projectId, user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not a project member" } },
        { status: 403 }
      );
    }
  }

  return NextResponse.json({ project });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("project.update");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  // Check if project is personal
  const project = await ProjectService.getProject(projectId);
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  if ((project as any).isPersonal) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Cannot modify personal project" } },
      { status: 400 }
    );
  }

  const body = await req.json();
  const result = updateProjectSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: result.error.issues } },
      { status: 400 }
    );
  }

  const updatedProject = await ProjectService.updateProject(projectId, result.data);
  return NextResponse.json({ project: updatedProject });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("project.delete");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  // Check if project is personal
  const project = await ProjectService.getProject(projectId);
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  if ((project as any).isPersonal) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Cannot delete personal project" } },
      { status: 400 }
    );
  }

  await ProjectService.deleteOrArchiveProject(projectId);
  return NextResponse.json({ success: true });
}
