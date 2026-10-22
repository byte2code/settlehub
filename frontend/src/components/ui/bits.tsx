import type { ReactNode } from 'react';
import { formatMoney } from '../../lib/money';

export function Spinner({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-2 border-emerald-500 border-t-transparent ${className}`}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

const AVATAR_TONES = [
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-pink-500/15 text-pink-600 dark:text-pink-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
];

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const tone = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
  const dims = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${dims} ${tone}`}>
      {initials || '?'}
    </span>
  );
}

/** Coloured, signed balance: green when you are owed, red when you owe. */
export function Balance({ cents, currency, className = '' }: { cents: number; currency: string; className?: string }) {
  const tone = cents > 0 ? 'text-pos' : cents < 0 ? 'text-neg' : 'text-subtle';
  return (
    <span className={`font-mono font-bold tabular-nums ${tone} ${className}`}>
      {cents === 0 ? 'settled' : formatMoney(cents, currency, { signed: true })}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-line px-4 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-subtle">{icon}</div>
      <div>
        <h3 className="text-sm font-bold text-fg">{title}</h3>
        {children && <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-neg">
      {message}
    </div>
  );
}

