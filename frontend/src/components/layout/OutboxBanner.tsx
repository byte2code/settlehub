import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { flushOutbox, removeFromOutbox, useOutbox } from '../../lib/outbox';
import { useCurrentUserOrNull } from '../../hooks/useAuth';
import { useToast } from '../ui/Toast';

/** Shows expenses waiting to sync, syncs them when the connection returns, and explains any the server refused. */
export function OutboxBanner() {
  const user = useCurrentUserOrNull();
  const items = useOutbox(user?.id);
  const qc = useQueryClient();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const sync = useCallback(async () => {
    if (!user || running.current) return;
    running.current = true;
    setSyncing(true);
    try {
      const result = await flushOutbox(user.id, api.createExpense);
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} offline expense${result.synced === 1 ? '' : 's'}`);
        void qc.invalidateQueries({ queryKey: ['groups'] });
        void qc.invalidateQueries({ queryKey: ['group'] });
      }
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, [user, qc, toast]);

  const waiting = items.some((i) => !i.error);
  useEffect(() => {
    if (!waiting) return;
    void sync();
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    const timer = setInterval(() => void sync(), 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [waiting, sync]);

  if (items.length === 0) return null;
  const pending = items.filter((i) => !i.error);
  const failed = items.filter((i) => i.error);

  return (
    <div className="space-y-1 border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs text-sky-700 dark:text-sky-200" role="status">
      {pending.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <CloudOff className="h-4 w-4 shrink-0" />
          <span>{pending.length} expense{pending.length === 1 ? '' : 's'} saved on this device, waiting to sync.</span>
          <button type="button" className="inline-flex items-center gap-1 font-semibold underline" disabled={syncing} onClick={() => void sync()}>
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} /> Sync now
          </button>
        </div>
      )}
      {failed.map((i) => (
        <div key={i.clientId} className="flex items-center justify-center gap-2 text-rose-700 dark:text-rose-300">
          <span className="truncate">“{i.payload.description}” in {i.groupName} couldn’t be added: {i.error}</span>
          <button type="button" className="inline-flex items-center gap-1 font-semibold underline" onClick={() => removeFromOutbox(i.clientId)}>
            <Trash2 className="h-3 w-3" /> Discard
          </button>
        </div>
      ))}
    </div>
  );
}
