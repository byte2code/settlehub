import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRightLeft, Camera, CheckCircle, Coins, Percent, Receipt, Sparkles, Trash2, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { CATEGORIES } from '../../lib/categories';
import { fromDateInput, toDateInput } from '../../lib/dates';
import { errorMessage } from '../../lib/errors';
import { convertCents, fetchRate } from '../../lib/fx';
import { compressImage } from '../../lib/image';
import { SUPPORTED_CURRENCIES, centsToInput, formatMoney, getCurrency, parseAmountToCents, splitEvenly } from '../../lib/money';
import { parseQuickEntry } from '../../lib/quickEntry';
import { validateSplit } from '../../lib/split';
import { useInvalidateGroup } from '../../hooks/queries';
import { useCurrentUser } from '../../hooks/useAuth';
import type { Expense, ExpenseInput, Group, GroupMember, SplitMethod } from '../../types';
import { Modal } from '../ui/Modal';
import { ErrorNote } from '../ui/bits';
import { useToast } from '../ui/Toast';

interface Props {
  group: Group;
  expense?: Expense | null;
  onClose: () => void;
}

type ReceiptState = { kind: 'keep' } | { kind: 'none' } | { kind: 'new'; dataUrl: string };

function initialState(group: Group, userId: string, expense?: Expense | null) {
  const members = group.members;
  const byId = <T,>(fn: (m: GroupMember) => T) => Object.fromEntries(members.map((m) => [m.userId, fn(m)]));
  if (!expense) {
    return {
      description: '',
      amount: '',
      category: 'OTHER',
      date: toDateInput(),
      notes: '',
      method: 'EQUAL' as SplitMethod,
      multiPayer: false,
      payerId: userId,
      payerAmounts: byId(() => ''),
      selected: byId(() => true),
      exactAmounts: byId(() => ''),
      percentages: byId(() => (100 / Math.max(members.length, 1)).toFixed(2)),
      inputCurrency: group.currencyCode,
      originalAmount: '',
    };
  }
  const paid = (id: string) => expense.payers.find((p) => p.userId === id)?.paidCents ?? 0;
  const owed = (id: string) => expense.splits.find((s) => s.userId === id)?.owedCents;
  return {
    description: expense.description,
    amount: centsToInput(expense.costCents, group.currencyCode),
    category: expense.category || 'OTHER',
    date: toDateInput(expense.date),
    notes: expense.notes ?? '',
    method: (expense.creationMethod === 'PAYMENT' ? 'EQUAL' : expense.creationMethod) as SplitMethod,
    multiPayer: expense.payers.length > 1,
    payerId: expense.payers[0]?.userId ?? userId,
    payerAmounts: byId((m) => (paid(m.userId) ? centsToInput(paid(m.userId), group.currencyCode) : '')),
    selected: byId((m) => owed(m.userId) !== undefined),
    exactAmounts: byId((m) => (owed(m.userId) !== undefined ? centsToInput(owed(m.userId)!, group.currencyCode) : '')),
    percentages: byId((m) => (owed(m.userId) !== undefined ? ((owed(m.userId)! / expense.costCents) * 100).toFixed(2) : '0')),
    inputCurrency: expense.originalCurrency ?? group.currencyCode,
    originalAmount: expense.originalAmountCents ? centsToInput(expense.originalAmountCents, expense.originalCurrency ?? '') : '',
  };
}

export default function ExpenseFormModal({ group, expense, onClose }: Props) {
  const user = useCurrentUser();
  const toast = useToast();
  const invalidate = useInvalidateGroup();
  const editing = Boolean(expense);
  const currency = group.currencyCode;

  const [form, setForm] = useState(() => initialState(group, user.id, expense));
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const [quickText, setQuickText] = useState('');
  const [rate, setRate] = useState<string>(() =>
    expense?.originalAmountCents ? (expense.costCents / expense.originalAmountCents).toFixed(4) : '',
  );
  const [rateStatus, setRateStatus] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState>(expense?.hasReceipt ? { kind: 'keep' } : { kind: 'none' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const foreign = form.inputCurrency !== currency;
  const originalCents = parseAmountToCents(form.originalAmount);
  const totalCents = foreign
    ? Number(rate) > 0 && originalCents > 0
      ? convertCents(originalCents, Number(rate))
      : 0
    : parseAmountToCents(form.amount) || 0;

  const validation = useMemo(
    () =>
      validateSplit({
        totalCents,
        currency,
        method: form.method,
        multiPayer: form.multiPayer,
        payerAmounts: form.payerAmounts,
        selected: form.selected,
        exactAmounts: form.exactAmounts,
        percentages: form.percentages,
      }),
    [totalCents, currency, form],
  );
  const canSave = validation.valid && form.description.trim().length > 0;

  const applyQuickEntry = () => {
    const parsed = parseQuickEntry(quickText, group.members);
    setForm((f) => ({
      ...f,
      description: parsed.description ?? f.description,
      amount: parsed.amount ?? f.amount,
      category: parsed.category ?? f.category,
      payerId: parsed.payerId ?? f.payerId,
      multiPayer: parsed.payerId ? false : f.multiPayer,
      inputCurrency: parsed.amount ? currency : f.inputCurrency,
    }));
    toast.info('Filled in — check and save');
  };

  const changeInputCurrency = async (code: string) => {
    set('inputCurrency', code);
    if (code === currency) return;
    if (!form.originalAmount && form.amount) set('originalAmount', form.amount);
    setRateStatus('Fetching today’s rate…');
    try {
      const r = await fetchRate(code, currency);
      setRate(r.toFixed(4));
      setRateStatus(`ECB reference rate · 1 ${code} = ${r.toFixed(4)} ${currency}`);
    } catch {
      setRateStatus('Could not fetch a rate — enter it manually');
    }
  };

  const onReceiptFile = async (file?: File) => {
    if (!file) return;
    try {
      setReceipt({ kind: 'new', dataUrl: await compressImage(file) });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const cents = (v: string) => parseAmountToCents(v) || 0;
    const ids = group.members.map((m) => m.userId);
    const payload: ExpenseInput = {
      description: form.description.trim(),
      costCents: totalCents,
      date: fromDateInput(form.date),
      category: form.category,
      creationMethod: form.method,
      notes: form.notes.trim() || null,
      originalCurrency: foreign ? form.inputCurrency : null,
      originalAmountCents: foreign ? originalCents : null,
      payers: form.multiPayer
        ? ids.map((id) => ({ userId: id, paidCents: cents(form.payerAmounts[id]) })).filter((p) => p.paidCents > 0)
        : [{ userId: form.payerId, paidCents: totalCents }],
      splits:
        form.method === 'EQUAL'
          ? ids.filter((id) => form.selected[id]).map((userId) => ({ userId }))
          : form.method === 'EXACT'
            ? ids.map((id) => ({ userId: id, owedCents: cents(form.exactAmounts[id]) })).filter((s) => s.owedCents > 0)
            : ids.map((id) => ({ userId: id, percentage: Number(form.percentages[id]) || 0 })).filter((s) => s.percentage > 0),
      receiptUrl: receipt.kind === 'new' ? receipt.dataUrl : receipt.kind === 'none' ? (editing ? '' : null) : undefined,
    };

    try {
      if (expense) await api.updateExpense(expense.id, payload);
      else await api.createExpense(group.id, payload);
      await invalidate(group.id);
      toast.success(editing ? 'Expense updated' : 'Expense added');
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the expense'));
    } finally {
      setSaving(false);
    }
  };

  const groupSymbol = getCurrency(currency).symbol;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<Receipt className="h-5 w-5" />}
      title={editing ? 'Edit expense' : 'Add expense'}
      subtitle={group.name}
      footer={
        <>
          <span className={`mr-auto flex items-center gap-1.5 text-xs ${validation.valid ? 'text-pos' : 'text-amber-600 dark:text-amber-400'}`}>
            {validation.valid ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {validation.message}
          </span>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="expense-form" className="btn-primary" disabled={!canSave || saving}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} className="space-y-4">
        <ErrorNote message={error} />

        {!editing && (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3">
            <label htmlFor="quick" className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-brand-fg">
              <Sparkles className="h-3.5 w-3.5" /> Quick entry
            </label>
            <div className="flex gap-2">
              <input
                id="quick"
                className="input text-xs"
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyQuickEntry();
                  }
                }}
                placeholder="e.g. Dinner at Brittos 1.5k paid by Alice"
              />
              <button type="button" className="btn-secondary shrink-0" onClick={applyQuickEntry} disabled={!quickText.trim()}>Fill</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div className="sm:col-span-3">
            <label className="label" htmlFor="desc">Description</label>
            <input id="desc" className="input" required maxLength={140} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Dinner, hotel, fuel…" />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <label className="label mb-0" htmlFor="amount">Amount</label>
              <select
                aria-label="Currency paid in"
                className="rounded-md border border-line bg-surface-2 px-1 py-0.5 font-mono text-[11px] text-brand-fg"
                value={form.inputCurrency}
                onChange={(e) => void changeInputCurrency(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>
            <input
              id="amount"
              className="input font-mono font-semibold"
              inputMode="decimal"
              required
              value={foreign ? form.originalAmount : form.amount}
              onChange={(e) => set(foreign ? 'originalAmount' : 'amount', e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {foreign && (
          <div className="space-y-2 rounded-2xl border border-sky-500/25 bg-sky-500/5 p-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-sky-600 dark:text-sky-300">
              <ArrowRightLeft className="h-3.5 w-3.5" /> Converted to the group currency ({currency})
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted">1 {form.inputCurrency} =</span>
              <input aria-label="Exchange rate" className="input w-28 py-1 font-mono text-xs" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              <span className="text-muted">{currency}</span>
              <span className="ml-auto font-mono font-bold text-fg">{totalCents > 0 ? formatMoney(totalCents, currency) : '—'}</span>
            </div>
            {rateStatus && <p className="text-[11px] text-subtle">{rateStatus}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="date">Date</label>
            <input id="date" type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </div>
          <div>
            <span className="label">Category</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={form.category === c.code}
                  title={c.label}
                  onClick={() => set('category', c.code)}
                  className={`rounded-lg border px-2 py-1 text-sm transition-all ${form.category === c.code ? 'border-emerald-500/50 bg-emerald-500/15' : 'border-line bg-surface-2 opacity-70 hover:opacity-100'}`}
                >
                  <span aria-hidden>{c.icon}</span>
                  <span className="sr-only">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <PayerSection group={group} form={form} set={set} symbol={groupSymbol} />
        <SplitSection group={group} form={form} set={set} totalCents={totalCents} symbol={groupSymbol} />

        <div>
          <label className="label" htmlFor="notes">Notes (optional)</label>
          <textarea id="notes" className="input min-h-16" maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Bill number, who ordered what…" />
        </div>

        <div className="rounded-2xl border border-line bg-surface-2 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-fg">
            <span className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-brand-fg" /> Receipt photo</span>
            {receipt.kind !== 'none' && (
              <button type="button" className="flex items-center gap-1 text-[11px] text-neg" onClick={() => setReceipt({ kind: 'none' })}>
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
          {receipt.kind === 'new' ? (
            <img src={receipt.dataUrl} alt="Receipt preview" className="mx-auto max-h-40 rounded-xl" />
          ) : receipt.kind === 'keep' ? (
            <p className="text-xs text-muted">A receipt is attached. Choose a new photo to replace it.</p>
          ) : null}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Receipt photo"
            className="mt-2 block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-fg"
            onChange={(e) => void onReceiptFile(e.target.files?.[0])}
          />
        </div>
      </form>
    </Modal>
  );
}

type FormState = ReturnType<typeof initialState>;
type Setter = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function AmountInput({ label, value, onChange, symbol, suffix }: { label: string; value: string; onChange: (v: string) => void; symbol?: string; suffix?: string }) {
  return (
    <div className="relative w-28 shrink-0">
      {symbol && <span className="absolute left-2.5 top-1.5 text-xs font-bold text-subtle">{symbol}</span>}
      <input
        aria-label={label}
        inputMode="decimal"
        className={`input py-1 font-mono text-xs ${symbol ? 'pl-7' : ''} ${suffix ? 'pr-6 text-right' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={suffix ? '0' : '0.00'}
      />
      {suffix && <span className="absolute right-2 top-1.5 text-xs font-bold text-subtle">{suffix}</span>}
    </div>
  );
}

function PayerSection({ group, form, set, symbol }: { group: Group; form: FormState; set: Setter; symbol: string }) {
  const user = useCurrentUser();
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-fg">Paid by</span>
        <button type="button" className="text-[11px] font-medium text-brand-fg" onClick={() => set('multiPayer', !form.multiPayer)}>
          {form.multiPayer ? 'One person paid' : 'Several people paid?'}
        </button>
      </div>
      {form.multiPayer ? (
        <div className="space-y-2">
          {group.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-fg">{m.name}</span>
              <AmountInput label={`${m.name} paid`} symbol={symbol} value={form.payerAmounts[m.userId] ?? ''} onChange={(v) => set('payerAmounts', { ...form.payerAmounts, [m.userId]: v })} />
            </div>
          ))}
        </div>
      ) : (
        <select aria-label="Who paid" className="input text-xs" value={form.payerId} onChange={(e) => set('payerId', e.target.value)}>
          {group.members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.name}{m.userId === user.id ? ' (you)' : ''}</option>
          ))}
        </select>
      )}
    </div>
  );
}

const METHODS: { id: SplitMethod; label: string; icon: typeof Users }[] = [
  { id: 'EQUAL', label: 'Equally', icon: Users },
  { id: 'EXACT', label: 'Amounts', icon: Coins },
  { id: 'PERCENT', label: '%', icon: Percent },
];

function SplitSection({ group, form, set, totalCents, symbol }: { group: Group; form: FormState; set: Setter; totalCents: number; symbol: string }) {
  const selectedIds = group.members.filter((m) => form.selected[m.userId]).map((m) => m.userId);
  const shares = splitEvenly(totalCents, selectedIds.length);

  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-fg">Split</span>
        <div className="segmented p-0.5">
          {METHODS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={form.method === id} className="px-2 py-1 text-[11px]" onClick={() => set('method', id)}>
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>
      </div>

      {form.method === 'EQUAL' && (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {group.members.map((m) => {
            const checked = Boolean(form.selected[m.userId]);
            const share = checked ? shares[selectedIds.indexOf(m.userId)] : 0;
            return (
              <label key={m.userId} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-xs ${checked ? 'border-emerald-500/30 bg-emerald-500/10 text-fg' : 'border-line text-subtle'}`}>
                <input type="checkbox" className="accent-emerald-500" checked={checked} onChange={(e) => set('selected', { ...form.selected, [m.userId]: e.target.checked })} />
                <span className="flex-1 truncate">{m.name}</span>
                {checked && totalCents > 0 && <span className="font-mono text-[11px] text-muted">{formatMoney(share, group.currencyCode)}</span>}
              </label>
            );
          })}
        </div>
      )}

      {form.method === 'EXACT' && (
        <div className="space-y-2">
          {group.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-fg">{m.name}</span>
              <AmountInput label={`${m.name} owes`} symbol={symbol} value={form.exactAmounts[m.userId] ?? ''} onChange={(v) => set('exactAmounts', { ...form.exactAmounts, [m.userId]: v })} />
            </div>
          ))}
        </div>
      )}

      {form.method === 'PERCENT' && (
        <div className="space-y-2">
          {group.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-fg">{m.name}</span>
              <AmountInput label={`${m.name} percentage`} suffix="%" value={form.percentages[m.userId] ?? ''} onChange={(v) => set('percentages', { ...form.percentages, [m.userId]: v })} />
            </div>
          ))}
        </div>
      )}
      {form.method !== 'EQUAL' && form.inputCurrency !== group.currencyCode && (
        <p className="mt-2 text-[11px] text-subtle">Shares are entered in {group.currencyCode}.</p>
      )}
    </div>
  );
}
