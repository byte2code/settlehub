/** Builds a UPI deep link (opens GPay/PhonePe/Paytm/BHIM). Only meaningful for INR. An amount of 0 leaves it for the payer to enter. */
export function buildUpiLink(params: { upiId: string; payeeName: string; amountCents: number; note?: string }): string {
  const query = new URLSearchParams({ pa: params.upiId, pn: params.payeeName });
  if (params.amountCents > 0) query.set('am', (params.amountCents / 100).toFixed(2));
  query.set('cu', 'INR');
  if (params.note) query.set('tn', params.note.slice(0, 50));
  return `upi://pay?${query.toString()}`;
}
