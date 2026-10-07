import "server-only";
import { headers } from "next/headers";

let inRequestContext = false;

export async function runAfterResponse(fn: () => Promise<void>) {
  try {
    // Check if we're in a request context by trying to access headers
    await headers();
    inRequestContext = true;

    // In Next.js 14+, use unstable_after to run code after response
    const { unstable_after } = await import("next/server");
    unstable_after(() => {
      fn().catch((err) => console.error("Error in runAfterResponse:", err));
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
