import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Users } from 'lucide-react';
import { GROUP_TYPES } from '../../lib/groups';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { SUPPORTED_CURRENCIES, parseAmountToCents } from '../../lib/money';
import { keys } from '../../hooks/queries';
import { useCurrentUser } from '../../hooks/useAuth';
import type { GroupType } from '../../types';
import { Modal } from '../ui/Modal';
import { ErrorNote } from '../ui/bits';


export default function CreateGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('trip');
  const [currencyCode, setCurrencyCode] = useState(user.currencyCode || 'INR');
  const [budget, setBudget] = useState('');
  const [simplify, setSimplify] = useState(true);
  const [emails, setEmails] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const budgetCents = parseAmountToCents(budget);
      const group = await api.createGroup({
        name: name.trim(),
        groupType,
        currencyCode,
        simplifyByDefault: simplify,
        budgetCents: budgetCents > 0 ? budgetCents : null,
        memberEmails: emails.map((m) => m.trim().toLowerCase()).filter(Boolean),
      });
      await queryClient.invalidateQueries({ queryKey: keys.groups });
      onClose();
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not create the group'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Users className="h-5 w-5" />}
      title="New group"
      subtitle="Trips, flatmates, couples — anything you split"
      size="lg"
      footer={
        <button form="create-group" type="submit" disabled={loading || !name.trim()} className="btn-primary w-full py-2.5 text-sm sm:w-auto">
          {loading ? 'Creating…' : 'Create group'}
        </button>
      }
    >
      <form id="create-group" onSubmit={submit} className="space-y-4">
        <ErrorNote message={error} />
        <div>
          <label className="label" htmlFor="g-name">Group name</label>
          <input id="g-name" className="input" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa Trip 2026, Flat 4B…" />
        </div>

        <div>
          <span className="label">Type</span>
          <div className="grid grid-cols-4 gap-2">
            {GROUP_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={groupType === id}
                onClick={() => setGroupType(id)}
                className={`flex flex-col items-center rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  groupType === id ? 'border-emerald-500/50 bg-emerald-500/15 text-brand-fg' : 'border-line bg-surface-2 text-muted hover:text-fg'
                }`}
              >
                <Icon className="mb-1 h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="g-currency">Currency</label>
            <select id="g-currency" className="input" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-subtle">All balances are kept in this currency. Foreign amounts are converted when added.</p>
          </div>
          <div>
            <label className="label" htmlFor="g-budget">Budget (optional)</label>
            <input id="g-budget" className="input font-mono" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="50000" />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label mb-0">Add people by email (optional)</span>
            <button type="button" className="text-xs font-medium text-brand-fg" onClick={() => setEmails([...emails, ''])}>
              <Plus className="inline h-3.5 w-3.5" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {emails.map((email, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="email"
                  className="input text-xs"
                  value={email}
                  aria-label={`Member email ${i + 1}`}
                  placeholder={`friend${i + 1}@example.com`}
                  onChange={(e) => setEmails(emails.map((v, j) => (j === i ? e.target.value : v)))}
                />
                {emails.length > 1 && (
                  <button type="button" className="btn-ghost p-2" aria-label="Remove" onClick={() => setEmails(emails.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-subtle">They can sign up later with the same email. Or share the invite link after creating.</p>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <span>
            <span className="block text-xs font-semibold text-fg">Simplify debts</span>
            <span className="block text-[11px] text-muted">Fewer, larger repayments instead of everyone paying everyone</span>
          </span>
          <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={simplify} onChange={(e) => setSimplify(e.target.checked)} />
        </label>
      </form>
    </Modal>
  );
}
