import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "./current-user";

export type AccountStatusResult =
  | { authorized: true; user: any }
  | { authorized: false; response: Response };

export async function checkAccountStatus(userId?: string, req?: NextRequest): Promise<AccountStatusResult> {
  const user = await getCurrentUser(userId, req);

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "User not found" } },
        { status: 401 }
      ),
    };
  }

  const status = (user as any).status || "ACTIVE";

  if (status === "PENDING") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: { code: "ACCOUNT_PENDING", message: "Account verification pending" } },
        { status: 403 }
      ),
    };
  }

  if (status === "REJECTED") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: { code: "ACCOUNT_REJECTED", message: "Account has been rejected" } },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}
