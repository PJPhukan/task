import "server-only";
import { auth } from "@/server/auth/better-auth";
import { NextRequest } from "next/server";
import { UserService } from "@/server/modules/users/service";
import { prisma } from "@/server/lib/prisma";

export async function GET(request: NextRequest) {
  const response = await auth.handler(request);

  // After email verification, promote first user to admin
  if (request.nextUrl.pathname.includes("/verify-email")) {
    if (response.status === 302 || response.status === 200) {
      // Try to get the verified user from the URL
      const token = request.nextUrl.searchParams.get("token");
      if (token) {
        // Find the verification record and get the associated user
        // The token is stored in the 'value' field of the Verification model
        const verification = await prisma.verification.findFirst({
          where: { value: token },
          include: { user: true },
        });

        if (verification && verification.user) {
          await UserService.promoteFirstUserToAdmin(verification.user.id);
        }
      }
    }
  }

  return response;
}

export async function POST(request: NextRequest) {
  return auth.handler(request);
}
