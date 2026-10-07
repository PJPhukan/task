import "server-only";
import { prisma } from "../lib/prisma";
import { getEnv } from "../config/env";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./better-auth";

export type CurrentUserResult =
  | { ok: true; user: any }
  | { ok: false; response: Response };

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
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        return null;
      }

      return user;
    }

    // Fall back to session if no x-user-id header provided
    if (req) {
      const session = await auth.api.getSession({ headers: req.headers });
      if (session && session.user) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
        });
        return user;
      }
    }

    return null;
  }

  return null;
}

export async function getCurrentUserWithStatus(
  userId?: string,
  req?: NextRequest
): Promise<CurrentUserResult> {
  const user = await getCurrentUser(userId, req);

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "User not found" } },
        { status: 401 }
      ),
    };
  }

  // Check if user is inactive
  if (!user.isActive) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "User is inactive" } },
        { status: 401 }
      ),
    };
  }

  const status = (user as any).status || "ACTIVE";

  // Routes that allow non-ACTIVE users
  const allowedPathsForNonActive = [/^\/api\/me($|\?)/, /^\/api\/auth/];
  const pathname = req?.nextUrl.pathname || "";
  const allowNonActive = allowedPathsForNonActive.some((pattern) =>
    pattern.test(pathname)
  );

  if (status !== "ACTIVE" && !allowNonActive) {
    if (status === "PENDING") {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: {
              code: "ACCOUNT_PENDING",
              message: "Account verification pending",
            },
          },
          { status: 403 }
        ),
      };
    }

    if (status === "REJECTED") {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: {
              code: "ACCOUNT_REJECTED",
              message: "Account has been rejected",
            },
          },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: true, user };
}
