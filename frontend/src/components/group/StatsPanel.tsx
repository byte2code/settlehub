import { PieChart, TrendingUp } from 'lucide-react';
import { CATEGORIES } from '../../lib/categories';
import { formatMoney } from '../../lib/money';
import type { Expense, Group } from '../../types';

function Bar({ label, value, total, currency, color }: { label: string; value: number; total: number; currency: string; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-xs">
        <span className="truncate font-medium text-fg">{label}</span>
        <span className="font-mono text-muted">{formatMoney(value, currency)} · {pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StatsPanel({ group, expenses }: { group: Group; expenses: Expense[] }) {
  const total = group.totalSpendCents;
  const byCategory: Record<string, number> = {};
  const paidBy: Record<string, number> = {};
  const shareOf: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.costCents;
    for (const p of e.payers) paidBy[p.userId] = (paidBy[p.userId] || 0) + p.paidCents;
    for (const s of e.splits) shareOf[s.userId] = (shareOf[s.userId] || 0) + s.owedCents;
  }
  const days = expenses.length ? new Set(expenses.map((e) => e.date.slice(0, 10))).size : 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="card space-y-3 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
          <PieChart className="h-4 w-4 text-brand-fg" /> By category
        </h3>
        {CATEGORIES.filter((c) => byCategory[c.code]).map((c) => (
          <Bar key={c.code} label={`${c.icon} ${c.label}`} value={byCategory[c.code]} total={total} currency={group.currencyCode} color={c.bar} />
        ))}
        {total === 0 && <p className="text-xs text-muted">Nothing spent yet.</p>}
      </section>

      <section className="card space-y-3 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
          <TrendingUp className="h-4 w-4 text-brand-fg" /> Paid vs. share
        </h3>
        {group.members.map((m) => (
          <div key={m.userId} className="space-y-1">
            <Bar label={m.name} value={paidBy[m.userId] || 0} total={total} currency={group.currencyCode} color="bg-emerald-500" />
            <p className="text-[11px] text-subtle">Their share: {formatMoney(shareOf[m.userId] || 0, group.currencyCode)}</p>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <Metric label="Total" value={formatMoney(total, group.currencyCode)} />
          <Metric label="Per person" value={formatMoney(group.members.length ? Math.round(total / group.members.length) : 0, group.currencyCode)} />
          <Metric label="Per day" value={formatMoney(days ? Math.round(total / days) : 0, group.currencyCode)} />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-2">
      <span className="block text-[10px] text-subtle">{label}</span>
      <span className="block truncate font-mono text-xs font-bold text-fg">{value}</span>
    </div>
  );
}
