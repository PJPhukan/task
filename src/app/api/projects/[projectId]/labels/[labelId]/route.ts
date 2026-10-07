import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { LabelService } from "@/server/modules/labels/service";
import { updateLabelSchema, type UpdateLabelInput } from "@/server/modules/labels/schema";
import { validateRequest } from "@/server/http/route";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; labelId: string }> }
) {
  const { projectId, labelId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("label.manage");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  const body = await req.json();
  const validation = validateRequest(updateLabelSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const label = await prisma.label.findFirst({
      where: { id: labelId, projectId },
    });
    if (!label) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Label not found" } },
        { status: 404 }
      );
    }

    const data = validation.data as UpdateLabelInput;
    const updated = await LabelService.updateLabel(
      projectId,
      labelId,
      data.name,
      data.color
    );
    return NextResponse.json({ label: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message || "Failed to update label" } },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; labelId: string }> }
) {
  const { projectId, labelId } = await params;
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  const perms = getPerms();
  await setupPermissions();

  const hasPermission = await perms.user(user.id).can("label.manage");
  if (!hasPermission) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission denied" } },
      { status: 403 }
    );
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  try {
    const label = await prisma.label.findFirst({
      where: { id: labelId, projectId },
    });
    if (!label) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Label not found" } },
        { status: 404 }
      );
    }

    await LabelService.deleteLabel(projectId, labelId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "DELETE_ERROR", message: error.message || "Failed to delete label" } },
      { status: 400 }
    );
  }
}
