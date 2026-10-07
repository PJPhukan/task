import "server-only";

export function createSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
