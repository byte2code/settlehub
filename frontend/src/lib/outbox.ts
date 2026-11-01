import { useSyncExternalStore } from 'react';
import type { ExpenseInput } from '../types';

/**
 * Expenses added while offline wait here (this device only) and are sent when the connection is back.
 * Each carries a client id, so a retry can never create a duplicate on the server.
 */
export interface OutboxItem {
  clientId: string;
  userId: string;
  groupId: string;
  groupName: string;
  payload: ExpenseInput;
  queuedAt: string;
  /** Set when the server rejected it (e.g. you were removed from the group); kept so you can see why. */
  error?: string;
}

const KEY = 'settlehub_outbox';
export const MAX_OUTBOX_ITEMS = 25;
const listeners = new Set<() => void>();
let snapshot: OutboxItem[] | null = null;

function read(): OutboxItem[] {
  if (snapshot) return snapshot;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    snapshot = Array.isArray(parsed) ? parsed : [];
  } catch {
    snapshot = [];
  }
  return snapshot!;
}

/** Returns false when the browser refused to store it (private mode, storage full). */
function write(items: OutboxItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    return false;
  }
  snapshot = items;
  listeners.forEach((l) => l());
  return true;
}

export const loadOutbox = read;

export function enqueue(item: OutboxItem): boolean {
  const items = read();
  if (items.some((i) => i.clientId === item.clientId)) return true;
  if (items.length >= MAX_OUTBOX_ITEMS) return false;
  return write([...items, item]);
}

export function removeFromOutbox(clientId: string) {
  write(read().filter((i) => i.clientId !== clientId));
}

export function markFailed(clientId: string, error: string) {
  write(read().map((i) => (i.clientId === clientId ? { ...i, error } : i)));
}

export function useOutbox(userId: string | undefined): OutboxItem[] {
  const all = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    read,
  );
  return userId ? all.filter((i) => i.userId === userId) : [];
}

export function isOfflineError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: number }).status === 0;
}

export interface FlushResult {
  synced: number;
  failed: number;
  offline: boolean;
}

/** Sends waiting items one by one, oldest first. Stops at the first network problem and keeps everything unsent. */
export async function flushOutbox(
  userId: string,
  send: (groupId: string, payload: ExpenseInput) => Promise<unknown>,
): Promise<FlushResult> {
  const result: FlushResult = { synced: 0, failed: 0, offline: false };
  for (const item of read().filter((i) => i.userId === userId && !i.error)) {
    try {
      await send(item.groupId, { ...item.payload, clientId: item.clientId });
      removeFromOutbox(item.clientId);
      result.synced++;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        removeFromOutbox(item.clientId); // the server already has it
      } else if (status === 0 || status === undefined || status >= 500 || status === 429) {
        result.offline = true;
        break;
      } else {
        markFailed(item.clientId, (err as Error).message || 'The server rejected this expense');
        result.failed++;
      }
    }
  }
  return result;
}

/** Test helper: forget the cached copy so the next read hits storage again. */
export function resetOutboxCache() {
  snapshot = null;
}
