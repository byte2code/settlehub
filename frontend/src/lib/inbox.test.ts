import { describe, expect, it } from 'vitest';
import { bucketOf, matchesFilter } from './inbox';
import type { AppNotification } from '../types';

const now = new Date(2026, 10, 10, 15, 0);
const at = (daysAgo: number, hour = 9) => new Date(2026, 10, 10 - daysAgo, hour).toISOString();

describe('inbox helpers', () => {
  it('buckets by calendar day', () => {
    expect(bucketOf(at(0, 1), now)).toBe('Today');
    expect(bucketOf(at(1, 23), now)).toBe('Yesterday');
    expect(bucketOf(at(3), now)).toBe('This week');
    expect(bucketOf(at(9), now)).toBe('Older');
  });

  it('filters by type and read state', () => {
    const n = (type: string, read: boolean) => ({ type, read }) as AppNotification;
    expect(matchesFilter(n('EXPENSE_CREATED', false), 'expenses')).toBe(true);
    expect(matchesFilter(n('SETTLEMENT_RECORDED', false), 'expenses')).toBe(false);
    expect(matchesFilter(n('SETTLEMENT_RECORDED', true), 'settlements')).toBe(true);
    expect(matchesFilter(n('EXPENSE_CREATED', true), 'unread')).toBe(false);
  });
});
