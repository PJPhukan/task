import "server-only";
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
    result.error.errors.forEach((err) => {
      const path = err.path.join(".");
      errors[path] = err.message;
    });
    return { success: false, error: errors };
  }
  return { success: true, data: result.data };
}
