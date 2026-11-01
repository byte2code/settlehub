import type { Group } from '../types';

/** The existing two-person group with this email, if any, so "split with a friend" never creates duplicates. */
export function findFriendGroup(groups: Group[], myId: string, email: string): Group | undefined {
  const wanted = email.trim().toLowerCase();
  return groups.find(
    (g) =>
      !g.archived &&
      g.members.length === 2 &&
      g.members.some((m) => m.userId === myId) &&
      g.members.some((m) => m.userId !== myId && m.email.toLowerCase() === wanted),
  );
}

/** "rohan.k@gmail.com" -> "Rohan K" */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const words = local.replace(/[._+-]+/g, ' ').replace(/\d+/g, '').trim().split(/\s+/).filter(Boolean);
  return words.length ? words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ') : 'Friend';
}
