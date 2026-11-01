import { CheckCircle2, Clock, History, Undo2 } from 'lucide-react';
import { formatDate } from '../../lib/dates';
import { useCurrentUser } from '../../hooks/useAuth';
import type { Group, Settlement } from '../../types';
import { EmptyState } from '../ui/bits';

export function SettlementList({ group, settlements, onUndo, onConfirm, onReject }: {
  group: Group;
  settlements: Settlement[];
  onUndo: (s: Settlement) => void;
  onConfirm: (s: Settlement) => void;
  onReject: (s: Settlement) => void;
}) {
  const user = useCurrentUser();
  if (settlements.length === 0) {
    return (
      <EmptyState icon={<History className="h-6 w-6" />} title="No payments recorded">
        When someone pays someone back, tap “Settle” on a balance to record it here.
      </EmptyState>
    );
  }
  return (
    <ul className="space-y-2">
      {settlements.map((s) => {
        const canUndo = group.myRole === 'ADMIN' || s.payerId === user.id || s.payeeId === user.id;
        const pending = s.status === 'PENDING';
        const iAmPayee = s.payeeId === user.id;
        return (
          <li key={s.id} className="card flex items-center gap-3 p-3.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${pending ? 'border-amber-500/30 bg-amber-500/10 text-amber-600' : 'border-emerald-500/25 bg-emerald-500/10 text-pos'}`}>
              {pending ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-fg">
                {s.payerId === user.id ? 'You' : s.payerName} paid {s.payeeId === user.id ? 'you' : s.payeeName}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted">
                {formatDate(s.date, true)}
                {s.note && <> · {s.note}</>}
              </div>
              {pending && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    {iAmPayee ? 'Did you get this?' : s.payerId === user.id ? `Waiting for ${s.payeeName.split(' ')[0]} to confirm` : 'Awaiting confirmation'}
                  </span>
                  {iAmPayee && (
                    <>
                      <button type="button" className="font-semibold text-brand-fg hover:underline" onClick={() => onConfirm(s)}>Yes, confirm</button>
                      <button type="button" className="font-semibold text-neg hover:underline" onClick={() => onReject(s)}>Didn’t get it</button>
                    </>
                  )}
                </div>
              )}
            </div>
            <span className="font-mono text-sm font-bold text-pos">{s.amountFormatted}</span>
            {canUndo && (
              <button className="btn-ghost p-1.5" title="Undo payment" aria-label="Undo payment" onClick={() => onUndo(s)}>
                <Undo2 className="h-4 w-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
