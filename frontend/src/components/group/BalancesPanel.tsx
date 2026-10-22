import { CheckCircle2, Shuffle } from 'lucide-react';
import type { DebtRepayment, Group, GroupBalanceSummary } from '../../types';
import { useCurrentUser } from '../../hooks/useAuth';
import { Avatar, Balance } from '../ui/bits';

interface Props {
  group: Group;
  balances?: GroupBalanceSummary;
  simplify: boolean;
  onToggleSimplify: (value: boolean) => void;
  onSettle: (debt: DebtRepayment) => void;
}

export function BalancesPanel({ group, balances, simplify, onToggleSimplify, onSettle }: Props) {
  const user = useCurrentUser();
  const debts = (simplify ? balances?.simplifiedDebts : balances?.originalDebts) ?? [];
  const saved = balances?.savedTransactionsCount ?? 0;

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="balances-heading">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 id="balances-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg">
            Balances
            {simplify && saved > 0 && <span className="chip border-emerald-500/30 bg-emerald-500/10 text-pos">{saved} fewer payments</span>}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{simplify ? 'Fewest payments to settle everyone' : 'Who owes whom, directly'}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 self-start rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg sm:self-auto">
          <Shuffle className={`h-3.5 w-3.5 ${simplify ? 'text-brand-fg' : 'text-subtle'}`} />
          Simplify
          <input type="checkbox" role="switch" className="h-4 w-4 accent-emerald-500" checked={simplify} onChange={(e) => onToggleSimplify(e.target.checked)} />
        </label>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3">
        {group.members.map((m) => (
          <div key={m.userId} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2.5">
            <Avatar name={m.name} size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">{m.userId === user.id ? 'You' : m.name}</span>
            <Balance cents={m.netBalanceCents} currency={group.currencyCode} className="text-xs" />
          </div>
        ))}
      </div>

      {debts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-6 text-center">
          <CheckCircle2 className="mx-auto mb-1.5 h-7 w-7 text-pos" />
          <p className="text-xs font-medium text-fg">All settled up</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {debts.map((d) => {
            const mine = d.fromUserId === user.id || d.toUserId === user.id;
            return (
              <li key={`${d.fromUserId}-${d.toUserId}`} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${mine ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-line bg-surface-2'}`}>
                <div className="min-w-0 text-xs">
                  <span className="font-semibold text-neg">{d.fromUserId === user.id ? 'You' : d.fromUserName}</span>
                  <span className="mx-1.5 text-subtle">{d.fromUserId === user.id ? 'owe' : 'owes'}</span>
                  <span className="font-semibold text-pos">{d.toUserId === user.id ? 'you' : d.toUserName}</span>
                  <div className="mt-0.5 font-mono text-sm font-bold text-fg">{d.amountFormatted}</div>
                </div>
                <button className="btn-secondary shrink-0 px-2.5 py-1 text-[11px]" onClick={() => onSettle(d)}>Settle</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
