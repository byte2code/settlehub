import { Repeat, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/dates';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import type { Group } from '../../types';

/** Repeating expenses of this group (rent, subscriptions). Hidden when there are none. */
export function RecurringPanel({ group }: { group: Group }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const key = ['group', group.id, 'recurring'];
  const { data } = useQuery({ queryKey: key, queryFn: () => api.recurring(group.id) });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRecurring(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!data || data.length === 0) return null;

  return (
    <section className="card p-3" aria-label="Repeating expenses">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-fg"><Repeat className="h-3.5 w-3.5 text-brand-fg" /> Repeating</h3>
      <ul className="space-y-1.5">
        {data.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-fg">
              {r.description} · <span className="font-mono">{r.costFormatted}</span> {r.frequency === 'WEEKLY' ? 'weekly' : 'monthly'}
              <span className="block text-[11px] text-muted">{r.active ? `Next: ${formatDate(r.nextRunDate)}` : r.pausedReason ?? 'Paused'}</span>
            </span>
            <button
              type="button"
              className="btn-ghost p-1.5 hover:text-neg"
              aria-label={`Stop repeating ${r.description}`}
              onClick={async () => {
                if (await confirm({ title: 'Stop repeating?', message: `“${r.description}” won't be added again. Past expenses stay.`, confirmLabel: 'Stop repeating', danger: true })) remove.mutate(r.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
