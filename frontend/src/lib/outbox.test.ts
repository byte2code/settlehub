import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_OUTBOX_ITEMS, enqueue, flushOutbox, isOfflineError, loadOutbox, resetOutboxCache, type OutboxItem } from './outbox';

const item = (n: number, userId = 'u1'): OutboxItem => ({
  clientId: `c${n}`,
  userId,
  groupId: 'g1',
  groupName: 'Goa',
  payload: { description: `Chai ${n}`, costCents: 4000, creationMethod: 'EQUAL', splits: [{ userId }] },
  queuedAt: new Date().toISOString(),
});
const apiError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

beforeEach(() => {
  localStorage.clear();
  resetOutboxCache();
});

describe('outbox', () => {
  it('queues once per client id and survives a reload', () => {
    expect(enqueue(item(1))).toBe(true);
    expect(enqueue(item(1))).toBe(true);
    expect(loadOutbox()).toHaveLength(1);
    resetOutboxCache();
    expect(loadOutbox()).toHaveLength(1);
  });

  it('refuses to grow without limit', () => {
    for (let i = 0; i < MAX_OUTBOX_ITEMS; i++) expect(enqueue(item(i))).toBe(true);
    expect(enqueue(item(999))).toBe(false);
  });

  it('sends oldest first with the client id and clears what succeeded', async () => {
    enqueue(item(1));
    enqueue(item(2));
    const send = vi.fn().mockResolvedValue({});
    const result = await flushOutbox('u1', send);
    expect(result).toEqual({ synced: 2, failed: 0, offline: false });
    expect(send.mock.calls.map((c) => c[1].clientId)).toEqual(['c1', 'c2']);
    expect(loadOutbox()).toHaveLength(0);
  });

  it('treats 409 as already saved, keeps items when offline, and flags rejected ones', async () => {
    enqueue(item(1));
    enqueue(item(2));
    enqueue(item(3));
    const send = vi.fn().mockRejectedValueOnce(apiError(409)).mockRejectedValueOnce(apiError(403)).mockRejectedValueOnce(apiError(0));
    const result = await flushOutbox('u1', send);
    expect(result).toEqual({ synced: 0, failed: 1, offline: true });
    const left = loadOutbox();
    expect(left.map((i) => i.clientId)).toEqual(['c2', 'c3']);
    expect(left[0].error).toBeTruthy();
    expect(left[1].error).toBeUndefined();
  });

  it("never sends another account's items", async () => {
    enqueue(item(1, 'someone-else'));
    const send = vi.fn();
    await flushOutbox('u1', send);
    expect(send).not.toHaveBeenCalled();
    expect(loadOutbox()).toHaveLength(1);
  });

  it('recognises network failures', () => {
    expect(isOfflineError(apiError(0))).toBe(true);
    expect(isOfflineError(apiError(400))).toBe(false);
    expect(isOfflineError(new Error('x'))).toBe(false);
  });
});
