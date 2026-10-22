export interface Category {
  code: string;
  label: string;
  icon: string;
  /** Tailwind classes for the badge */
  tone: string;
  /** Bar colour in stats */
  bar: string;
}

export const CATEGORIES: Category[] = [
  { code: 'FOOD', label: 'Food & drinks', icon: '🍕', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/25', bar: 'bg-amber-500' },
  { code: 'TRANSPORT', label: 'Transport', icon: '🚗', tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/25', bar: 'bg-sky-500' },
  { code: 'STAY', label: 'Stay', icon: '🏨', tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/25', bar: 'bg-violet-500' },
  { code: 'ENTERTAINMENT', label: 'Fun', icon: '🎉', tone: 'bg-pink-500/10 text-pink-600 dark:text-pink-300 border-pink-500/25', bar: 'bg-pink-500' },
  { code: 'SHOPPING', label: 'Shopping', icon: '🛒', tone: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25', bar: 'bg-cyan-500' },
  { code: 'UTILITIES', label: 'Bills', icon: '💡', tone: 'bg-lime-500/10 text-lime-700 dark:text-lime-300 border-lime-500/25', bar: 'bg-lime-500' },
  { code: 'OTHER', label: 'Other', icon: '📦', tone: 'bg-slate-500/10 text-muted border-line', bar: 'bg-slate-400' },
];

export function getCategory(code?: string | null): Category {
  return CATEGORIES.find((c) => c.code === (code || 'OTHER').toUpperCase()) || CATEGORIES[CATEGORIES.length - 1];
}
