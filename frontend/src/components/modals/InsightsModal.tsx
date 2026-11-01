import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { getCategory } from '../../lib/categories';
import { formatMoney } from '../../lib/money';
import { Modal } from '../ui/Modal';
import { ErrorNote, PageSpinner } from '../ui/bits';

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

/** Your own share of spending, by month and category. Each currency is shown on its own. */
export default function InsightsModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['insights', 6], queryFn: () => api.insights(6) });
  const [picked, setPicked] = useState<string | null>(null);
  const current = data?.currencies.find((c) => c.currency === picked) ?? data?.currencies[0];

  const max = Math.max(1, ...(current?.months.map((m) => m.totalCents) ?? [0]));
  const categoryTotals = new Map<string, number>();
  current?.months.forEach((m) => Object.entries(m.byCategory).forEach(([k, v]) => categoryTotals.set(k, (categoryTotals.get(k) ?? 0) + v)));
  const categories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Modal open onClose={onClose} icon={<BarChart3 className="h-5 w-5" />} title="Your spending" subtitle="Your share of each expense, last 6 months" size="sm">
      {isLoading ? <PageSpinner /> : (
        <div className="space-y-4">
          <ErrorNote message={error ? errorMessage(error) : null} />
          {data && data.currencies.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing to show yet. Add some expenses and come back.</p>}
          {data && data.currencies.length > 1 && (
            <div className="segmented w-full" role="tablist">
              {data.currencies.map((c) => (
                <button key={c.currency} role="tab" aria-selected={current?.currency === c.currency} onClick={() => setPicked(c.currency)} className="flex-1">{c.currency}</button>
              ))}
            </div>
          )}
          {current && (
            <>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl border border-line bg-surface-2 p-3"><p className="text-[10px] font-semibold uppercase text-subtle">Total</p><p className="font-mono text-lg font-black text-fg">{formatMoney(current.totalCents, current.currency)}</p></div>
                <div className="rounded-2xl border border-line bg-surface-2 p-3"><p className="text-[10px] font-semibold uppercase text-subtle">Per month</p><p className="font-mono text-lg font-black text-fg">{formatMoney(current.averagePerMonthCents, current.currency)}</p></div>
              </div>
              <div className="flex h-32 items-end gap-2" role="img" aria-label="Spending per month">
                {current.months.map((m) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t-md bg-emerald-500" style={{ height: `${Math.max(2, (m.totalCents / max) * 100)}%` }} title={`${monthLabel(m.month)}: ${formatMoney(m.totalCents, current.currency)}`} />
                    <span className="text-[10px] text-subtle">{monthLabel(m.month)}</span>
                  </div>
                ))}
              </div>
              <ul className="space-y-1.5">
                {categories.map(([code, cents]) => {
                  const cat = getCategory(code);
                  return (
                    <li key={code} className="text-xs">
                      <div className="flex justify-between text-muted"><span>{cat.icon} {cat.label}</span><span className="font-mono text-fg">{formatMoney(cents, current.currency)}</span></div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className={`h-full ${cat.bar}`} style={{ width: `${(cents / (categories[0][1] || 1)) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
