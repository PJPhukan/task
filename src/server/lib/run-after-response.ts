import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";

export async function runAfterResponse(fn: () => Promise<void>) {
  try {
    // Check if we're in a request context by trying to access headers
    await headers();

    // In Next.js 16+, use the after API to run code after response
    after(async () => {
      try {
        await fn();
      } catch (err) {
        console.error("Error in runAfterResponse:", err);
      }
    });
  } catch {
    // No request context (e.g., in tests), run immediately
    try {
      await fn();
    } catch (err) {
      console.error("Error in runAfterResponse:", err);
    }
  }
}
