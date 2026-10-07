import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { PersonalBoardService } from "@/server/modules/personal-board/service";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const user = await getCurrentUser(userId, req);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  try {
    const result = await PersonalBoardService.getOrCreatePersonalBoard(user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "RETRIEVAL_ERROR", message: error.message || "Failed to get or create personal board" } },
      { status: 400 }
    );
  }
}
