/** Must match the server's allow-list (EngagementService.ALLOWED_EMOJI). */
export const REACTION_EMOJI = ['🍕', '🔥', '😭', '😂', '👍', '❤️', '🤯', '💸'] as const;
export const MAX_COMMENT_CHARS = 200;

/** Length in characters people see (code points), matching the server's rule. */
export function commentLength(text: string): number {
  return [...text.replace(/\s+/g, ' ').trim()].length;
}
