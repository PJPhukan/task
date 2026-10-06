import "server-only";
import { prisma } from "../lib/prisma";
import { getEnv } from "../config/env";

export async function getCurrentUser(userId?: string) {
  const env = getEnv();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  if (!user.isActive && env.AUTH_MODE === "dev") {
    throw new Error("User is inactive");
  }

  return user;
}
