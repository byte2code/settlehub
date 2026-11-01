import { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { applyKey, amountToCents, type KeypadKey } from '../../lib/keypad';
import { buildUpiLink } from '../../lib/upi';

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

export default function UpiQrPanel({ upiId, payeeName, currency }: { upiId?: string | null; payeeName: string; currency: string }) {
  const [amount, setAmount] = useState('');
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const link = upiId ? buildUpiLink({ upiId, payeeName, amountCents: amountToCents(amount), note: 'SettleHub' }) : null;

  useEffect(() => {
    let cancelled = false;
    if (!link) return;
    void import('qrcode').then(async (QR) => {
      const url = await QR.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
      if (!cancelled) setDataUrl(url);
    });
    return () => { cancelled = true; };
  }, [link]);

  if (!upiId) {
    return <p className="rounded-2xl border border-line bg-surface-2 p-4 text-sm text-muted">Add your UPI ID on the Profile tab to generate a payment QR.</p>;
  }
  if (currency !== 'INR') {
    return <p className="rounded-2xl border border-line bg-surface-2 p-4 text-sm text-muted">UPI QR codes work for ₹ (INR) only. Change your default currency on the Profile tab to use this.</p>;
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs text-muted">Type an amount and let someone scan this from GPay, PhonePe or Paytm. Leave it empty to let them choose.</p>
      <div className="mx-auto flex h-60 w-60 items-center justify-center rounded-2xl border border-line bg-white p-2">
        {dataUrl ? <img src={dataUrl} alt={`UPI QR code for ${amount ? '₹' + amount : 'any amount'}`} className="h-full w-full" /> : null}
      </div>
      <div className="font-mono text-3xl font-black text-fg" aria-live="polite">₹{amount || '0'}</div>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => setAmount((a) => applyKey(a, k))} aria-label={k === 'back' ? 'Delete' : k} className="rounded-xl border border-line bg-surface-2 py-3 text-lg font-bold text-fg hover:border-line-strong active:scale-95">
            {k === 'back' ? <Delete className="mx-auto h-5 w-5" /> : k}
          </button>
        ))}
      </div>
      <p className="font-mono text-[11px] text-subtle">{upiId}</p>
    </div>
  );
}
