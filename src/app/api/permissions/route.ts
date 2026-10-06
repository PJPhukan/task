import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getCatalogGrouped } from "@/server/permissions/catalog";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  const permissions = getCatalogGrouped();

  return NextResponse.json({ permissions });
}
