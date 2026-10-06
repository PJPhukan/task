import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";

export interface RouteContext {
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export interface RouteHandlerOptions {
  permission?: string;
  requireUser?: boolean;
}

export function validateRequest<T>(
  schema: ZodSchema,
  data: unknown
): { success: true; data: T } | { success: false; error: Record<string, string> } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors: Record<string, string> = {};
    result.error.issues.forEach((err: any) => {
      const path = err.path.join(".");
      errors[path] = err.message;
    });
    return { success: false, error: errors };
  }
  return { success: true, data: result.data as T };
}

export type RouteHandler = (_req: NextRequest, _context: any) => Promise<NextResponse>;

export function createRouteHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error("Unhandled route error:", error);
      if (error instanceof Error) {
        console.error("Stack:", error.stack);
      }
      return NextResponse.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } },
        { status: 500 }
      );
    }
  };
}
