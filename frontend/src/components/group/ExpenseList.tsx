import { useMemo, useState } from 'react';
import { CreditCard, Paperclip, Pencil, Search, StickyNote, Trash2 } from 'lucide-react';
import { CATEGORIES, getCategory } from '../../lib/categories';
import { formatDate } from '../../lib/dates';
import { useCurrentUser } from '../../hooks/useAuth';
import type { Expense } from '../../types';
import { EmptyState } from '../ui/bits';

interface Props {
  expenses: Expense[];
  currency: string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onViewReceipt: (expense: Expense) => void;
  onAdd: () => void;
}

export function ExpenseList({ expenses, onEdit, onDelete, onViewReceipt, onAdd }: Props) {
  const user = useCurrentUser();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of expenses) c[e.category] = (c[e.category] || 0) + 1;
    return c;
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter(
      (e) =>
        (category === 'ALL' || e.category === category) &&
        (!q ||
          e.description.toLowerCase().includes(q) ||
          (e.notes ?? '').toLowerCase().includes(q) ||
          e.payers.some((p) => p.userName.toLowerCase().includes(q))),
    );
  }, [expenses, query, category]);

  if (expenses.length === 0) {
    return (
      <EmptyState icon={<CreditCard className="h-6 w-6" />} title="No expenses yet" action={<button className="btn-primary" onClick={onAdd}>Add the first expense</button>}>
        Add what you spent and SettleHub works out who owes whom.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-line bg-surface-2 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
          <input type="search" aria-label="Search expenses" className="input pl-9 text-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search description, notes or payer" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          <FilterPill active={category === 'ALL'} onClick={() => setCategory('ALL')}>All ({expenses.length})</FilterPill>
          {CATEGORIES.filter((c) => counts[c.code]).map((c) => (
            <FilterPill key={c.code} active={category === c.code} onClick={() => setCategory(c.code)}>
              {c.icon} {c.label} ({counts[c.code]})
            </FilterPill>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted">No expenses match your filters.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => {
            const cat = getCategory(e.category);
            const myShare = e.splits.find((s) => s.userId === user.id)?.owedCents ?? 0;
            const iPaid = e.payers.find((p) => p.userId === user.id)?.paidCents ?? 0;
            const net = iPaid - myShare;
            return (
              <li key={e.id} className="card flex items-center gap-3 p-3 sm:p-4">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-3 text-lg">{cat.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-fg">{e.description}</span>
                    <span className={`chip ${cat.tone}`}>{cat.label}</span>
                    {e.hasReceipt && (
                      <button className="chip border-emerald-500/30 bg-emerald-500/10 text-pos" onClick={() => onViewReceipt(e)}>
                        <Paperclip className="h-3 w-3" /> Receipt
                      </button>
                    )}
                    {e.notes && <StickyNote className="h-3.5 w-3.5 text-subtle" aria-label="Has notes" />}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {formatDate(e.date)} · paid by {e.payers.map((p) => (p.userId === user.id ? 'you' : p.userName)).join(', ')}
                    {e.originalFormatted && <> · {e.originalFormatted}</>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-bold text-fg">{e.costFormatted}</div>
                  <div className={`text-[11px] ${net > 0 ? 'text-pos' : net < 0 ? 'text-neg' : 'text-subtle'}`}>
                    {net > 0 ? 'you lent' : net < 0 ? 'you borrowed' : myShare || iPaid ? 'even' : 'not involved'}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
                  <button className="btn-ghost p-1.5" onClick={() => onEdit(e)} aria-label={`Edit ${e.description}`} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost p-1.5 hover:text-neg" onClick={() => onDelete(e)} aria-label={`Delete ${e.description}`} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg px-2.5 py-1 font-medium transition-all ${active ? 'bg-emerald-500 text-white' : 'border border-line bg-surface text-muted hover:text-fg'}`}
    >
      {children}
    </button>
  );
}
