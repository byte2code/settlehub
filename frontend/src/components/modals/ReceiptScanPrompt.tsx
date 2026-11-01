import { useEffect, useState } from 'react';
import { ScanLine, X } from 'lucide-react';
import { readReceipt } from '../../lib/ocr';
import { parseReceipt, type ReceiptSuggestions } from '../../lib/receiptParse';
import { formatMoney } from '../../lib/money';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { haptic } from '../../lib/haptics';

export interface ScanApply {
  /** cents in the group's currency */
  amountCents?: number;
  description?: string;
  date?: string;
}

interface Props {
  file: Blob | null;
  currency: string;
  /** What is already typed, so we never overwrite it without asking. */
  current: { description: string; amount: string };
  onApply: (fields: ScanApply) => void;
  onRetake: () => void;
}

type Phase = { kind: 'idle' } | { kind: 'reading'; progress: number } | { kind: 'found'; s: ReceiptSuggestions } | { kind: 'none'; reason: 'unreadable' | 'unavailable' };

/** After a photo is attached: read it on the device, then ASK before filling anything in. Never saves by itself. */
export function ReceiptScanPrompt({ file, currency, current, onApply, onRetake }: Props) {
  const { scanReceipts } = usePrefs();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [pick, setPick] = useState({ amount: 0, useAmount: true, useDescription: true, useDate: true });

  useEffect(() => {
    setDismissed(false);
    if (!file || !scanReceipts) {
      setPhase({ kind: 'idle' });
      return;
    }
    setPhase({ kind: 'reading', progress: 0 });
    const handle = readReceipt(file, (progress) => setPhase((p) => (p.kind === 'reading' ? { kind: 'reading', progress } : p)));
    let alive = true;
    handle.result
      .then((text) => {
        if (!alive) return;
        const s = parseReceipt(text);
        if (s.amounts.length === 0 && !s.date && !s.merchant) setPhase({ kind: 'none', reason: 'unreadable' });
        else {
          setPick({ amount: 0, useAmount: !current.amount, useDescription: !current.description.trim(), useDate: true });
          setPhase({ kind: 'found', s });
        }
        void haptic('tap');
      })
      .catch(() => alive && setPhase({ kind: 'none', reason: 'unavailable' }));
    return () => {
      alive = false;
      handle.cancel();
    };
    // `current` is read once when the scan finishes; re-scanning on every keystroke would be wrong
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, scanReceipts]);

  if (!scanReceipts || dismissed || phase.kind === 'idle') return null;

  const box = 'rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs';
  if (phase.kind === 'reading') {
    return (
      <div className={box} role="status" aria-live="polite">
        <div className="flex items-center gap-2 font-semibold text-fg"><ScanLine className="h-4 w-4 animate-pulse text-sky-500" /> Reading your receipt…</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.max(5, phase.progress * 100)}%` }} /></div>
        <p className="mt-1 text-[11px] text-muted">Done on your device. The photo isn’t uploaded for this. You can keep filling in the form.</p>
      </div>
    );
  }
  if (phase.kind === 'none') {
    return (
      <div className={box} role="status">
        <p className="font-semibold text-fg">{phase.reason === 'unavailable' ? 'Receipt reading isn’t available right now.' : 'Couldn’t read this receipt.'}</p>
        <p className="mt-0.5 text-muted">The photo is still attached. You can retake it, or just fill in the details yourself.</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={onRetake}>Retake photo</button>
          <button type="button" className="btn-ghost text-xs" onClick={() => setDismissed(true)}>Fill manually</button>
        </div>
      </div>
    );
  }

  const { s } = phase;
  const nothingChecked = !(pick.useAmount && s.amounts.length) && !(pick.useDescription && s.merchant) && !(pick.useDate && s.date);
  return (
    <div className={box} role="group" aria-label="Details found on the receipt">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-fg">We found these details. Fill them in?</p>
        <button type="button" className="btn-ghost -mr-1 -mt-1 p-1" aria-label="Dismiss" onClick={() => setDismissed(true)}><X className="h-3.5 w-3.5" /></button>
      </div>
      <ul className="mt-2 space-y-2">
        {s.amounts.length > 0 ? (
          <li>
            <label className="flex items-center gap-2 font-medium text-fg">
              <input type="checkbox" checked={pick.useAmount} onChange={(e) => setPick({ ...pick, useAmount: e.target.checked })} /> Amount{current.amount && <span className="font-normal text-subtle"> (replaces what you typed)</span>}
            </label>
            <div className="ml-6 mt-1 flex flex-wrap gap-1.5">
              {s.amounts.map((a, i) => (
                <button key={a.cents} type="button" aria-pressed={pick.amount === i} title={a.label}
                  onClick={() => setPick({ ...pick, amount: i, useAmount: true })}
                  className={`rounded-lg border px-2 py-1 font-mono ${pick.amount === i ? 'border-emerald-500 bg-emerald-500/15 text-fg' : 'border-line text-muted'}`}>
                  {formatMoney(a.cents, currency)}
                </button>
              ))}
            </div>
          </li>
        ) : (
          <li className="text-muted">Amount: couldn’t find a clear total, so please type it.</li>
        )}
        {s.merchant && (
          <li>
            <label className="flex items-center gap-2 font-medium text-fg">
              <input type="checkbox" checked={pick.useDescription} onChange={(e) => setPick({ ...pick, useDescription: e.target.checked })} /> Description: <span className="font-normal">{s.merchant}</span>
              {current.description.trim() && <span className="font-normal text-subtle">(replaces “{current.description.trim().slice(0, 16)}”)</span>}
            </label>
          </li>
        )}
        {s.date && (
          <li>
            <label className="flex items-center gap-2 font-medium text-fg">
              <input type="checkbox" checked={pick.useDate} onChange={(e) => setPick({ ...pick, useDate: e.target.checked })} /> Date: <span className="font-normal">{s.date}</span>
            </label>
          </li>
        )}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary text-xs" disabled={nothingChecked}
          onClick={() => {
            onApply({
              amountCents: pick.useAmount && s.amounts.length ? s.amounts[pick.amount].cents : undefined,
              description: pick.useDescription ? s.merchant : undefined,
              date: pick.useDate ? s.date : undefined,
            });
            setDismissed(true);
          }}>Use these</button>
        <button type="button" className="btn-ghost text-xs" onClick={() => setDismissed(true)}>No thanks</button>
        <button type="button" className="ml-auto text-[11px] text-subtle underline" onClick={() => { setPrefs({ scanReceipts: false }); setDismissed(true); }}>Don’t ask again</button>
      </div>
    </div>
  );
}
