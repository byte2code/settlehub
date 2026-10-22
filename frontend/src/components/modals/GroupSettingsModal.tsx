import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, LogOut, Settings, Shield, Trash2, UserMinus } from 'lucide-react';
import { api, type GroupUpdate } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { GROUP_TYPES } from '../../lib/groups';
import { SUPPORTED_CURRENCIES, centsToInput, parseAmountToCents } from '../../lib/money';
import { keys, useInvalidateGroup } from '../../hooks/queries';
import { useCurrentUser } from '../../hooks/useAuth';
import type { Group, GroupMember } from '../../types';
import { Modal } from '../ui/Modal';
import { Avatar, Balance, ErrorNote } from '../ui/bits';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

export default function GroupSettingsModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const user = useCurrentUser();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateGroup();
  const isAdmin = group.myRole === 'ADMIN';

  const [name, setName] = useState(group.name);
  const [groupType, setGroupType] = useState(group.groupType);
  const [budget, setBudget] = useState(group.budgetCents ? centsToInput(group.budgetCents, group.currencyCode) : '');
  const [simplify, setSimplify] = useState(group.simplifyByDefault);
  const [currencyCode, setCurrencyCode] = useState(group.currencyCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const budgetCents = parseAmountToCents(budget);
    const update: GroupUpdate = {
      name: name.trim(),
      groupType,
      simplifyByDefault: simplify,
      budgetCents: budgetCents > 0 ? budgetCents : 0,
    };
    if (currencyCode !== group.currencyCode) update.currencyCode = currencyCode;
    try {
      await api.updateGroup(group.id, update);
      await invalidate(group.id);
      toast.success('Group updated');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const memberAction = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      await invalidate(group.id);
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const removeMember = async (m: GroupMember) => {
    if (!(await confirm({ title: `Remove ${m.name}?`, message: 'They lose access to this group. Their past expenses stay.', confirmLabel: 'Remove', danger: true }))) return;
    await memberAction(() => api.removeMember(group.id, m.userId), `${m.name} removed`);
  };

  const leave = async () => {
    if (!(await confirm({ title: 'Leave this group?', message: 'You can only leave once your balance is settled.', confirmLabel: 'Leave', danger: true }))) return;
    try {
      await api.leaveGroup(group.id);
      queryClient.removeQueries({ queryKey: ['group', group.id] });
      await queryClient.invalidateQueries({ queryKey: keys.groups });
      toast.success(`You left ${group.name}`);
      navigate('/');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete group permanently?',
      message: `All expenses, settlements and history of “${group.name}” will be deleted for everyone. This cannot be undone.`,
      confirmLabel: 'Delete group',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteGroup(group.id);
      queryClient.removeQueries({ queryKey: ['group', group.id] });
      await queryClient.invalidateQueries({ queryKey: keys.groups });
      toast.success('Group deleted');
      navigate('/');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" icon={<Settings className="h-5 w-5" />} title="Group settings" subtitle={group.name}>
      <div className="space-y-6">
        <form onSubmit={save} className="space-y-3">
          <ErrorNote message={error} />
          <div>
            <label className="label" htmlFor="s-name">Name</label>
            <input id="s-name" className="input" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="s-type">Type</label>
              <select id="s-type" className="input" value={groupType} onChange={(e) => setGroupType(e.target.value as Group['groupType'])}>
                {GROUP_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-budget">Budget</label>
              <input id="s-budget" className="input font-mono" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="None" />
            </div>
            <div>
              <label className="label" htmlFor="s-currency">Currency</label>
              <select id="s-currency" className="input" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} disabled={!isAdmin || group.totalSpendCents > 0}>
                {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          </div>
          {group.totalSpendCents > 0 && <p className="text-[11px] text-subtle">The currency is locked once expenses exist.</p>}
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 p-3 text-xs">
            <span className="font-semibold text-fg">Simplify debts</span>
            <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={simplify} onChange={(e) => setSimplify(e.target.checked)} />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </form>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-fg">Members ({group.members.length})</h3>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {group.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 p-3">
                <Avatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-fg">
                    <span className="truncate">{m.name}{m.userId === user.id ? ' (you)' : ''}</span>
                    {m.role === 'ADMIN' && <Crown className="h-3.5 w-3.5 text-amber-500" aria-label="Admin" />}
                    {m.placeholder && <span className="chip border-line text-subtle">invited</span>}
                  </div>
                  <div className="truncate text-[11px] text-subtle">{m.email}</div>
                </div>
                <Balance cents={m.netBalanceCents} currency={group.currencyCode} className="text-xs" />
                {isAdmin && m.userId !== user.id && (
                  <div className="flex gap-1">
                    <button
                      className="btn-ghost p-1.5"
                      title={m.role === 'ADMIN' ? 'Remove admin rights' : 'Make admin'}
                      aria-label={m.role === 'ADMIN' ? `Remove admin rights from ${m.name}` : `Make ${m.name} an admin`}
                      onClick={() => memberAction(() => api.setMemberRole(group.id, m.userId, m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'), 'Role updated')}
                    >
                      <Shield className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost p-1.5 hover:text-neg" title="Remove" aria-label={`Remove ${m.name}`} onClick={() => removeMember(m)}>
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <button className="btn-secondary w-full" onClick={leave}><LogOut className="h-4 w-4" /> Leave group</button>
          {isAdmin && <button className="btn-danger w-full" onClick={remove}><Trash2 className="h-4 w-4" /> Delete group</button>}
        </section>
      </div>
    </Modal>
  );
}
