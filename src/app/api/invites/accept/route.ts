import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { InviteService } from "@/server/modules/invites/service";
import { acceptInviteQuerySchema, acceptInviteSchema } from "@/server/modules/invites/schema";
import { validateRequest } from "@/server/http/route";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const validation = validateRequest(acceptInviteQuerySchema, { token });
  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const result = await InviteService.validateToken(validation.data.token);
    if (!result) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Invalid or expired token" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      email: result.email,
      invitedBy: result.invitedBy,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "ERROR", message: error.message || "Failed to validate token" } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const validation = validateRequest(acceptInviteSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error } },
      { status: 400 }
    );
  }

  try {
    const user = await InviteService.acceptInvite(
      validation.data.token,
      validation.data.name,
      validation.data.password
    );

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    const message = error.message || "Failed to accept invite";
    let status = 400;

    if (message.includes("Invalid or expired token")) {
      status = 404;
    } else if (message.includes("no longer exist")) {
      status = 409;
    }

    return NextResponse.json(
      { error: { code: "ACCEPT_ERROR", message } },
      { status }
    );
  }
}
