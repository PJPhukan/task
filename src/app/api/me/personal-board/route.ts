import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { PersonalBoardService } from "@/server/modules/personal-board/service";

export async function GET(req: NextRequest) {
  const userResult = await getCurrentUser(req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

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
