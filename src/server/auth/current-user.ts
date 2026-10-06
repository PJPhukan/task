import "server-only";
import { prisma } from "../lib/prisma";
import { getEnv } from "../config/env";
import { NextRequest } from "next/server";
import { auth } from "./better-auth";

export async function getCurrentUser(userId?: string, req?: NextRequest) {
  const env = getEnv();

  if (env.AUTH_MODE === "session") {
    if (!req) {
      return null;
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || !session.user) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    return user;
  }

  if (env.AUTH_MODE === "dev") {
    if (!userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      throw new Error("User is inactive");
    }

    return user;
  }

  return null;
}
