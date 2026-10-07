import "server-only";

export interface ParsedMention {
  type: "user" | "all";
  userId?: string;
}

export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const mentionRegex = /@\[(?:user:([a-z0-9\-]+)|all)\]/g;

  let match;
  const seen = new Set<string>();

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match[1]) {
      const userId = match[1];
      const key = `user:${userId}`;
      if (!seen.has(key)) {
        mentions.push({ type: "user", userId });
        seen.add(key);
      }
    } else {
      const key = "all";
      if (!seen.has(key)) {
        mentions.push({ type: "all" });
        seen.add(key);
      }
    }
  }

  return mentions;
}
