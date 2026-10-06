import "server-only";
import { NextResponse } from "next/server";
import { getEnv } from "@/server/config/env";
import { prisma } from "@/server/lib/prisma";

export async function GET() {
  const env = getEnv();

  if (env.AUTH_MODE !== "dev") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Not found" } },
      { status: 404 }
    );
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
    },
  });

  return NextResponse.json({ users });
}
