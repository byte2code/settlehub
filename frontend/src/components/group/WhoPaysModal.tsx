import { useMemo, useState } from 'react';
import { Dice5 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/bits';
import { motionAllowed } from '../../lib/prefs';
import { haptic } from '../../lib/haptics';
import { burst } from '../../lib/confetti';
import { oddsFor, pickIndex } from '../../lib/whoPays';
import type { Expense, Group } from '../../types';

interface Props {
  group: Group;
  expenses: Expense[];
  onClose: () => void;
  /** Lets the winner be prefilled as the payer of a new expense. */
  onAddExpense: (payerId: string) => void;
}

/** Just for fun: nothing is saved. Whoever has paid least here is a bit more likely to be picked. */
export default function WhoPaysModal({ group, expenses, onClose, onAddExpense }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(group.members.map((m) => m.userId)));
  const [winner, setWinner] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const paid = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      if (e.isPayment) continue;
      for (const p of e.payers) totals.set(p.userId, (totals.get(p.userId) ?? 0) + p.paidCents);
    }
    return totals;
  }, [expenses]);

  const candidates = group.members
    .filter((m) => selected.has(m.userId))
    .map((m) => ({ id: m.userId, name: m.name, paidCents: paid.get(m.userId) ?? 0 }));
  const odds = oddsFor(candidates);
  const coin = candidates.length === 2;

  const toggle = (id: string) => {
    setWinner(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const spin = async () => {
    if (candidates.length < 2 || spinning) return;
    const chosen = candidates[pickIndex(odds)].id;
    setWinner(null);
    if (motionAllowed()) {
      setSpinning(true);
      // the highlight hops between names and slows down before landing on the pick
      const steps = 14 + candidates.findIndex((c) => c.id === chosen);
      for (let i = 0; i < steps; i++) {
        setHighlight(candidates[i % candidates.length].id);
        void haptic('tap');
        await new Promise((r) => setTimeout(r, 60 + i * 14));
      }
      setHighlight(chosen);
      setSpinning(false);
    }
    setWinner(chosen);
    void haptic('success');
    burst('small');
  };

  const winnerName = group.members.find((m) => m.userId === winner)?.name;

  return (
    <Modal open onClose={onClose} icon={<Dice5 className="h-5 w-5" />} title="Who pays tonight?" subtitle="Just for fun. Nothing is saved." size="sm">
      <div className="space-y-4">
        <ul className="space-y-1.5">
          {group.members.map((m) => {
            const on = selected.has(m.userId);
            const odd = odds.find((o) => o.id === m.userId);
            const active = highlight === m.userId;
            return (
              <li key={m.userId}>
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-sm transition-colors ${active ? 'border-emerald-500 bg-emerald-500/15' : on ? 'border-line bg-surface-2' : 'border-line opacity-50'}`}>
                  <input type="checkbox" className="h-4 w-4" checked={on} onChange={() => toggle(m.userId)} disabled={spinning} />
                  <Avatar name={m.name} size="sm" />
                  <span className="flex-1 truncate text-fg">{m.name}</span>
                  {on && odd && <span className="font-mono text-xs text-muted">{odd.percent}%</span>}
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-subtle">Whoever has paid least in this group is up to twice as likely to be picked. Untick anyone who isn’t here.</p>

        {winner && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center" role="status">
            <div className="text-3xl">{coin ? '🪙' : '🎉'}</div>
            <p className="mt-1 text-lg font-extrabold text-fg">{winnerName} pays tonight!</p>
            <button type="button" className="btn-secondary mt-3" onClick={() => { onClose(); onAddExpense(winner); }}>
              Add this bill with {winnerName?.split(' ')[0]} as payer
            </button>
          </div>
        )}

        <button type="button" className="btn-primary w-full" onClick={() => void spin()} disabled={candidates.length < 2 || spinning}>
          {candidates.length < 2 ? 'Pick at least two people' : spinning ? 'Spinning…' : winner ? 'Go again' : coin ? 'Flip the coin 🪙' : 'Spin 🎲'}
        </button>
      </div>
    </Modal>
  );
}
