import { Target } from 'lucide-react';
import { formatMoney } from '../../lib/money';
import { budgetStatus } from '../../lib/groups';
import type { Group } from '../../types';

export function BudgetBar({ group }: { group: Group }) {
  const status = budgetStatus(group);
  if (!status) return null;
  const { budget, pct, over } = status;
  const bar = over ? 'from-amber-500 to-rose-500' : pct > 80 ? 'from-teal-400 to-amber-400' : 'from-emerald-500 to-teal-400';
  return (
    <div className="card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-2 font-semibold text-fg">
          <Target className={`h-4 w-4 ${over ? 'text-neg' : 'text-brand-fg'}`} /> Budget
          <span className={`chip ${over ? 'border-rose-500/30 bg-rose-500/10 text-neg' : 'border-emerald-500/30 bg-emerald-500/10 text-pos'}`}>
            {over ? `${formatMoney(group.totalSpendCents - budget, group.currencyCode)} over` : `${100 - pct}% left`}
          </span>
        </span>
        <span className="font-mono text-muted">
          <strong className="text-fg">{formatMoney(group.totalSpendCents, group.currencyCode)}</strong> of {formatMoney(budget, group.currencyCode)} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(pct, 100)} aria-label="Budget used">
        <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}
