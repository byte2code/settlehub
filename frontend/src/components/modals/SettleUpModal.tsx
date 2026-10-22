import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Smartphone } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { centsToInput, formatMoney, getCurrency, parseAmountToCents } from '../../lib/money';
import { buildUpiLink } from '../../lib/upi';
import { useInvalidateGroup } from '../../hooks/queries';
import { useCurrentUser } from '../../hooks/useAuth';
import type { DebtRepayment, Group } from '../../types';
import { Modal } from '../ui/Modal';
import { ErrorNote } from '../ui/bits';
import { useToast } from '../ui/Toast';

interface Props {
  group: Group;
  /** Pre-fill from a suggested repayment */
  repayment?: DebtRepayment | null;
  onClose: () => void;
}

export default function SettleUpModal({ group, repayment, onClose }: Props) {
  const user = useCurrentUser();
  const toast = useToast();
  const invalidate = useInvalidateGroup();
  const others = group.members.filter((m) => m.userId !== user.id);
  const [payerId, setPayerId] = useState(repayment?.fromUserId ?? user.id);
  const [payeeId, setPayeeId] = useState(repayment?.toUserId ?? others[0]?.userId ?? '');
  const [amount, setAmount] = useState(repayment ? centsToInput(repayment.amountCents, group.currencyCode) : '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = parseAmountToCents(amount) || 0;
  const valid = cents > 0 && payerId !== payeeId && Boolean(payeeId);
  const payee = group.members.find((m) => m.userId === payeeId);
  const upiLink =
    group.currencyCode === 'INR' && payerId === user.id && payee?.upiId && cents > 0
      ? buildUpiLink({ upiId: payee.upiId, payeeName: payee.name, amountCents: cents, note: `SettleHub: ${group.name}` })
      : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await api.recordSettlement({ groupId: group.id, payerId, payeeId, amountCents: cents, note: note.trim() || undefined });
      await invalidate(group.id);
      toast.success(`Recorded ${formatMoney(cents, group.currencyCode)} payment`);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not record the payment'));
    } finally {
      setSaving(false);
    }
  };

  const select = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="flex-1">
      <label className="mb-1 block text-[10px] font-semibold uppercase text-subtle">{label}</label>
      <select aria-label={label} className="input px-2.5 py-1.5 text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
        {group.members.map((m) => (
          <option key={m.userId} value={m.userId}>{m.name}{m.userId === user.id ? ' (you)' : ''}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      icon={<CheckCircle2 className="h-5 w-5" />}
      title="Record a payment"
      subtitle="Log money that changed hands outside the app"
      footer={
        <button form="settle-form" type="submit" className="btn-primary w-full py-2.5 text-sm sm:w-auto" disabled={!valid || saving}>
          {saving ? 'Saving…' : 'Record payment'}
        </button>
      }
    >
      <form id="settle-form" onSubmit={submit} className="space-y-4">
        <ErrorNote message={error} />
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2 p-3">
          {select('Who paid', payerId, setPayerId)}
          <ArrowRight className="mb-2 h-4 w-4 shrink-0 text-brand-fg" />
          {select('Who received', payeeId, setPayeeId)}
        </div>
        <div>
          <label className="label" htmlFor="settle-amount">Amount ({group.currencyCode})</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-sm font-bold text-brand-fg">{getCurrency(group.currencyCode).symbol}</span>
            <input id="settle-amount" className="input pl-9 font-mono font-semibold" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="settle-note">Note (optional)</label>
          <input id="settle-note" className="input" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder="UPI ref, cash…" />
        </div>
        {upiLink && (
          <a href={upiLink} className="btn-secondary w-full py-2.5 text-sm">
            <Smartphone className="h-4 w-4 text-brand-fg" /> Pay {formatMoney(cents, 'INR')} to {payee?.name} via UPI
          </a>
        )}
        {upiLink && <p className="text-center text-[11px] text-subtle">Opens your UPI app. Come back and tap “Record payment” once it goes through.</p>}
      </form>
    </Modal>
  );
}
