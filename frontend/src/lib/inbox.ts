import type { AppNotification } from '../types';

export type Filter = 'all' | 'unread' | 'expenses' | 'settlements';

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'expenses', label: '💸 Expenses' },
  { id: 'settlements', label: '🤝 Settlements' },
];

export const BUCKETS = ['Today', 'Yesterday', 'This week', 'Older'] as const;
export type Bucket = (typeof BUCKETS)[number];

export function formatTimeAgo(isoString: string, now = Date.now()): string {
  const diffSec = Math.floor((now - new Date(isoString).getTime()) / 1000);
  if (Number.isNaN(diffSec)) return '';
  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Calendar-day bucket in the viewer's timezone. */
export function bucketOf(iso: string, now = new Date()): Bucket {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  return 'Older';
}

export function matchesFilter(n: AppNotification, f: Filter): boolean {
  if (f === 'unread') return !n.read;
  if (f === 'expenses') return n.type.startsWith('EXPENSE_');
  if (f === 'settlements') return n.type.startsWith('SETTLEMENT_');
  return true;
}

