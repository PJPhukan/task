import "server-only";
import { headers } from "next/headers";

export async function runAfterResponse(fn: () => Promise<void>) {
  try {
    // Check if we're in a request context by trying to access headers
    await headers();

    // In Next.js 14+, try to use unstable_after to run code after response
    try {
      const nextServer = await import("next/server");
      const unstable_after = (nextServer as any).unstable_after;
      if (typeof unstable_after === "function") {
        unstable_after(() => {
          fn().catch((err) => console.error("Error in runAfterResponse:", err));
        });
      } else {
        // Fallback: use setImmediate if unstable_after is not available
        setImmediate(() => {
          fn().catch((err) => console.error("Error in runAfterResponse:", err));
        });
      }
    } catch {
      // Fallback: use setImmediate
      setImmediate(() => {
        fn().catch((err) => console.error("Error in runAfterResponse:", err));
      });
    }
  } catch {
    // No request context (e.g., in tests), run immediately
    try {
      await fn();
    } catch (err) {
      console.error("Error in runAfterResponse:", err);
    }
  }
}
