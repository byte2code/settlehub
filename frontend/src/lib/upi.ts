/** Builds a UPI deep link (opens GPay/PhonePe/Paytm/BHIM). Only meaningful for INR. */
export function buildUpiLink(params: { upiId: string; payeeName: string; amountCents: number; note?: string }): string {
  const query = new URLSearchParams({
    pa: params.upiId,
    pn: params.payeeName,
    am: (params.amountCents / 100).toFixed(2),
    cu: 'INR',
  });
  if (params.note) query.set('tn', params.note.slice(0, 50));
  return `upi://pay?${query.toString()}`;
}
