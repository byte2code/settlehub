import { formatMoney } from './money';

/** A friendly, polite WhatsApp reminder. Returns a wa.me link with the text pre-filled. */
export function buildWhatsAppReminder(params: { debtorName: string; amountCents: number; currency: string; groupNames: string[] }): string {
  const first = params.debtorName.split(/\s+/)[0] || 'there';
  const groups = params.groupNames.length ? ` for ${params.groupNames.join(', ')}` : '';
  const text = `Hey ${first}! 👋 Just a friendly reminder that you owe me ${formatMoney(params.amountCents, params.currency)}${groups} on SettleHub. No rush — whenever you get a chance. Thanks! 🙏`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
