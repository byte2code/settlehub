import { Capacitor } from '@capacitor/core';
import { Compass, Heart, Home, MoreHorizontal } from 'lucide-react';
import type { Group, GroupType } from '../types';

export const GROUP_TYPES: { id: GroupType; label: string; icon: typeof Compass }[] = [
  { id: 'trip', label: 'Trip', icon: Compass },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'couple', label: 'Couple', icon: Heart },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

export function groupTypeIcon(type: string) {
  return (GROUP_TYPES.find((t) => t.id === type) ?? GROUP_TYPES[3]).icon;
}

/**
 * Shareable join link. Inside the Android app the page origin is https://localhost, which is
 * useless to others, so the public web URL (VITE_PUBLIC_WEB_URL) is used there; without one
 * only the code is shared.
 */
export function inviteLink(code: string): string | null {
  const base = import.meta.env.VITE_PUBLIC_WEB_URL || (Capacitor.isNativePlatform() ? '' : window.location.origin);
  return base ? `${base.replace(/\/+$/, '')}/join/${code}` : null;
}

export function budgetStatus(group: Pick<Group, 'budgetCents' | 'totalSpendCents'>) {
  const budget = group.budgetCents ?? 0;
  if (budget <= 0) return null;
  const ratio = group.totalSpendCents / budget;
  return { budget, ratio, pct: Math.round(ratio * 100), over: ratio > 1 };
}
