import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { prisma } from "@/server/lib/prisma";
import { getResourceInfo, deleteResource, buildImageUrl } from "@/server/lib/cloudinary";
import { z } from "zod";

const updateAvatarSchema = z.object({
  publicId: z.string().min(1),
});

export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id") || undefined;
    const user = await getCurrentUser(userId);

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "User not found" } },
        { status: 401 }
      );
    }

  const body = await req.json();
  const result = updateAvatarSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: result.error.issues } },
      { status: 400 }
    );
  }

  const { publicId } = result.data;

  const resource = await getResourceInfo(publicId);
  if (!resource) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Avatar not found in storage" } },
      { status: 400 }
    );
  }

  const allowedFormats = ["jpg", "jpeg", "png", "webp", "gif"];
  if (!allowedFormats.includes(resource.format.toLowerCase())) {
    await deleteResource(publicId);
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Format not allowed" } },
      { status: 400 }
    );
  }

  const maxSize = 5 * 1024 * 1024;
  if (resource.bytes > maxSize) {
    await deleteResource(publicId);
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Avatar exceeds 5 MB limit" } },
      { status: 400 }
    );
  }

  if (!resource.public_id.startsWith("avatars/")) {
    await deleteResource(publicId);
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Avatar not in correct folder" } },
      { status: 400 }
    );
  }

  const oldAvatar = user.avatarPublicId;
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { avatarPublicId: publicId },
  });

  if (oldAvatar) {
    await deleteResource(oldAvatar);
  }

  const avatarUrl = buildImageUrl(updatedUser.avatarPublicId || "", 200);

  return NextResponse.json({
    user: {
      ...updatedUser,
      avatarUrl,
    },
  });
  } catch (error) {
    console.error("PUT /avatar error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal server error" } },
      { status: 500 }
    );
  }
}
