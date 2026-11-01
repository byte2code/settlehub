import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRightLeft, Camera, CheckCircle, Coins, Mic, MicOff, Percent, Receipt, Sparkles, Trash2, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { CATEGORIES } from '../../lib/categories';
import { fromDateInput, toDateInput } from '../../lib/dates';
import { errorMessage } from '../../lib/errors';
import { convertCents, fetchRate } from '../../lib/fx';
import { compressImage } from '../../lib/image';
import { SUPPORTED_CURRENCIES, centsToInput, formatMoney, getCurrency, parseAmountToCents, splitEvenly } from '../../lib/money';
import { parseQuickEntry } from '../../lib/quickEntry';
import { evalAmount, isExpression } from '../../lib/calc';
import { copy } from '../../lib/copy';
import { haptic } from '../../lib/haptics';
import { useSpeech, type SpeechError } from '../../hooks/useSpeech';
import { enqueue, isOfflineError } from '../../lib/outbox';
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
  /** Preselects who paid (e.g. the winner of "Who pays tonight?"). */
  initialPayerId?: string;
  onClose: () => void;
}

type ReceiptState = { kind: 'keep' } | { kind: 'none' } | { kind: 'new'; dataUrl: string };

function initialState(group: Group, userId: string, expense?: Expense | null, initialPayerId?: string) {
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
      payerId: initialPayerId && group.members.some((m) => m.userId === initialPayerId) ? initialPayerId : userId,
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

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** "500+250" or "1.5k" become their total; anything else is left as typed. */
function resolveAmount(text: string): string {
  if (!isExpression(text)) return text;
  const n = evalAmount(text);
  return n === null ? text : String(n);
}

export default function ExpenseFormModal({ group, expense, initialPayerId, onClose }: Props) {
  const user = useCurrentUser();
  const toast = useToast();
  const invalidate = useInvalidateGroup();
  const editing = Boolean(expense);
  const currency = group.currencyCode;

  const [form, setForm] = useState(() => initialState(group, user.id, expense, initialPayerId));
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const [quickText, setQuickText] = useState('');
  const [rate, setRate] = useState<string>(() =>
    expense?.originalAmountCents ? (expense.costCents / expense.originalAmountCents).toFixed(4) : '',
  );
  const [rateStatus, setRateStatus] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState>(expense?.hasReceipt ? { kind: 'keep' } : { kind: 'none' });
  // One id per form: a retry or a later sync of the same expense can never create a duplicate
  const [clientId] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(/\./g, '')));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const foreign = form.inputCurrency !== currency;
  const originalCents = parseAmountToCents(resolveAmount(form.originalAmount));
  const totalCents = foreign
    ? Number(rate) > 0 && originalCents > 0
      ? convertCents(originalCents, Number(rate))
      : 0
    : parseAmountToCents(resolveAmount(form.amount)) || 0;

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

  const applyQuickEntry = (text: string = quickText) => {
    const parsed = parseQuickEntry(text, group.members);
    setForm((f) => ({
      ...f,
      description: parsed.description ?? f.description,
      amount: parsed.amount ?? f.amount,
      category: parsed.category ?? f.category,
      payerId: parsed.payerId ?? f.payerId,
      multiPayer: parsed.payerId ? false : f.multiPayer,
      inputCurrency: parsed.amount ? currency : f.inputCurrency,
    }));
    if (parsed.ambiguousPayer) toast.info(`Which ${parsed.ambiguousPayer}? Pick who paid below.`);
    else if (Number(parsed.amount) > 1_000_000) toast.info('That is a big amount, so please double-check it.');
    else toast.info('Filled in — check and save');
  };

  const speech = useSpeech(
    (text) => {
      setQuickText(text);
      applyQuickEntry(text);
    },
    (e: SpeechError) =>
      toast.error(
        e === 'denied' ? 'Microphone access is blocked. Allow it in your browser settings, or type instead.'
        : e === 'no-speech' ? 'Didn’t catch that. Try again a bit closer to the mic.'
        : e === 'unavailable' ? 'Voice needs an internet connection. You can type instead.'
        : 'Voice entry didn’t work this time. You can type instead.',
      ),
  );

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
      date: fromDateInput(form.date || toDateInput()),
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
      ...(editing || !isUuid(clientId) ? {} : { clientId }),
    };

    try {
      if (expense) await api.updateExpense(expense.id, payload);
      else await api.createExpense(group.id, payload);
      await invalidate(group.id);
      toast.success(editing ? 'Expense updated' : copy('toast.expenseAdded'));
      void haptic('success');
      onClose();
    } catch (err) {
      if (!editing && isOfflineError(err) && isUuid(clientId)) {
        const stored = enqueue({ clientId, userId: user.id, groupId: group.id, groupName: group.name, payload, queuedAt: new Date().toISOString() });
        if (stored) {
          toast.info('You’re offline. Saved on this device. It will sync when you’re back.');
          onClose();
          return;
        }
        setError('You’re offline and this device has no room left to hold it. Try again when you’re connected.');
      } else {
        setError(errorMessage(err, 'Could not save the expense'));
      }
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
              {speech.supported && (
                <button
                  type="button"
                  className={`btn-secondary shrink-0 ${speech.listening ? 'border-rose-500 text-neg' : ''}`}
                  onClick={speech.listening ? speech.stop : speech.start}
                  aria-label={speech.listening ? 'Stop listening' : 'Speak the expense'}
                  aria-pressed={speech.listening}
                  title="Say it, like “Dinner fifteen hundred paid by Rohan”"
                >
                  {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <button type="button" className="btn-secondary shrink-0" onClick={() => applyQuickEntry()} disabled={!quickText.trim()}>Fill</button>
            </div>
            {speech.listening && <p className="mt-1 text-[11px] text-brand-fg" role="status">Listening… {speech.interim}</p>}
            {speech.supported && !speech.listening && <p className="mt-1 text-[10px] text-subtle">Voice uses your browser’s speech service (Chrome sends audio to Google).</p>}
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
              onBlur={() => {
                const key = foreign ? 'originalAmount' : 'amount';
                const resolved = resolveAmount(foreign ? form.originalAmount : form.amount);
                if (resolved !== (foreign ? form.originalAmount : form.amount)) set(key, resolved);
              }}
              placeholder="0.00 or 500+250"
            />
            {(() => {
              const typed = foreign ? form.originalAmount : form.amount;
              const total = isExpression(typed) ? evalAmount(typed) : null;
              return total !== null ? <p className="mt-1 font-mono text-[11px] text-brand-fg">= {total}</p> : null;
            })()}
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

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
          {receipt.kind === 'new' ? (
            <img src={receipt.dataUrl} alt="Receipt preview" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-brand-fg"><Camera className="h-5 w-5" /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-fg">Receipt photo</p>
            <p className="truncate text-[11px] text-muted">
              {receipt.kind === 'new' ? 'Photo added' : receipt.kind === 'keep' ? 'A receipt is attached' : 'Optional: snap the bill so everyone can check it'}
            </p>
          </div>
          <label className="btn-secondary shrink-0 cursor-pointer text-xs focus-within:ring-2">
            {receipt.kind === 'none' ? 'Add photo' : 'Replace'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Receipt photo"
              className="sr-only"
              onChange={(e) => void onReceiptFile(e.target.files?.[0])}
            />
          </label>
          {receipt.kind !== 'none' && (
            <button type="button" className="btn-ghost p-2 text-neg" onClick={() => setReceipt({ kind: 'none' })} aria-label="Remove receipt photo">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
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

        <PayerSection group={group} form={form} set={set} symbol={groupSymbol} />
        <SplitSection group={group} form={form} set={set} totalCents={totalCents} symbol={groupSymbol} />

        <details className="group rounded-2xl border border-line bg-surface-2 p-3" open={editing && Boolean(form.notes)}>
          <summary className="cursor-pointer text-xs font-semibold text-fg">More details <span className="font-normal text-muted">(date, notes)</span></summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label" htmlFor="date">Date</label>
              <input id="date" type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="notes">Notes (optional)</label>
              <textarea id="notes" className="input min-h-16" maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Bill number, who ordered what…" />
            </div>
          </div>
        </details>
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
