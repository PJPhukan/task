import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithStatus } from "@/server/auth/current-user";
import { SearchService } from "@/server/modules/search/service";
import { searchSchema } from "@/server/modules/search/schema";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || undefined;
  const userResult = await getCurrentUserWithStatus(userId, req);

  if (!userResult.ok) {
    return userResult.response;
  }

  const user = userResult.user;

  try {
    const q = req.nextUrl.searchParams.get("q") || "";

    // Validate input
    const result = searchSchema.safeParse({ q });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Search query must be at least 2 characters",
            details: result.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const searchResults = await SearchService.search(user.id, result.data.q);

    return NextResponse.json(searchResults);
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
