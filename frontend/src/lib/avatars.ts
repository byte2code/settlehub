/** Emoji avatars, stored by id on the user so the set can change without a migration. */
export const AVATARS: { id: string; emoji: string; label: string }[] = [
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'panda', emoji: '🐼', label: 'Panda' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'owl', emoji: '🦉', label: 'Owl' },
  { id: 'tiger', emoji: '🐯', label: 'Tiger' },
  { id: 'koala', emoji: '🐨', label: 'Koala' },
  { id: 'octopus', emoji: '🐙', label: 'Octopus' },
  { id: 'unicorn', emoji: '🦄', label: 'Unicorn' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'cactus', emoji: '🌵', label: 'Cactus' },
  { id: 'mango', emoji: '🥭', label: 'Mango' },
  { id: 'chai', emoji: '☕', label: 'Chai' },
];

export function avatarEmoji(id?: string | null): string | null {
  return AVATARS.find((a) => a.id === id)?.emoji ?? null;
}
