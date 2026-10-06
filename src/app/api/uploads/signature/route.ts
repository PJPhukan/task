import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { prisma } from "@/server/lib/prisma";
import { generateUploadSignature, isCloudinaryConfigured } from "@/server/lib/cloudinary";
import { uploadSignatureSchema } from "@/server/modules/attachments/schema";

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "File upload is not configured" } },
      { status: 503 }
    );
  }

  const body = await req.json();
  const result = uploadSignatureSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: result.error.errors } },
      { status: 400 }
    );
  }

  const { projectId, kind } = result.data;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  const perms = getPerms();
  await setupPermissions();

  const isAdmin = await perms.user(user.id).hasRole("admin");
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });

  if (!isAdmin && !isMember) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not a project member" } },
      { status: 403 }
    );
  }

  const folder = kind === "attachment" ? `projects/${projectId}` : "avatars";
  const signature = await generateUploadSignature(folder, kind);

  if (!signature) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "File upload is not configured" } },
      { status: 503 }
    );
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  return NextResponse.json({
    signature: signature.signature,
    timestamp: signature.timestamp,
    apiKey: signature.apiKey,
    cloudName,
    folder,
  });
}
