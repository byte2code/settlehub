/**
 * Turns raw OCR text from a receipt into suggestions. Deliberately conservative: it only offers an amount when it
 * sits on a "total"-style line, because a wrong guess is worse than asking the person to type it.
 */
export interface AmountCandidate {
  cents: number;
  /** The line it came from, for display. */
  label: string;
}

export interface ReceiptSuggestions {
  amounts: AmountCandidate[];
  /** yyyy-mm-dd */
  date?: string;
  merchant?: string;
}

const TOTAL_WORDS = /\b(grand\s*total|net\s*(?:payable|amount)|amount\s*(?:payable|due)|total\s*(?:amount|payable|due)|balance\s*due|bill\s*amount|total)\b/i;
const NOT_TOTAL = /\b(sub\s*-?\s*total|tax|gst|cgst|sgst|igst|vat|service\s*charge|discount|change|cash|tendered|round(?:ing|\s*off)?|qty|quantity|items?|sav(?:ed|ings?)|points)\b/i;
const AMOUNT = /(?:₹|rs\.?|inr|\$|€|£)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)(?:[.,](\d{2}))?(?!\d)/gi;

/** "1,250.00" -> 125000, "1250" -> 125000, "12,50" -> 1250. Returns null for nonsense. */
export function toCents(whole: string, fraction?: string): number | null {
  const digits = whole.replace(/,/g, '');
  if (!/^\d+$/.test(digits) || digits.length > 9) return null;
  const cents = Number(digits) * 100 + (fraction ? Number(fraction) : 0);
  return cents > 0 ? cents : null;
}

function amountsIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(AMOUNT)) {
    // a bare 4-digit number between 1990 and 2100 in a line with date separators is a year, not money
    if (!m[2] && /^(19|20)\d{2}$/.test(m[1]) && /[/-]/.test(line)) continue;
    const cents = toCents(m[1], m[2]);
    if (cents !== null) out.push(cents);
  }
  return out;
}

export function parseReceipt(text: string, now: Date = new Date()): ReceiptSuggestions {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const scored = new Map<number, { score: number; label: string }>();

  lines.forEach((line, i) => {
    if (!TOTAL_WORDS.test(line) || NOT_TOTAL.test(line)) return;
    let values = amountsIn(line);
    if (values.length === 0 && lines[i + 1] && !NOT_TOTAL.test(lines[i + 1])) values = amountsIn(lines[i + 1]); // label on one line, figure on the next
    if (values.length === 0) return;
    const value = values[values.length - 1]; // the figure is normally last on the line
    const strong = /\b(grand\s*total|net\s*(?:payable|amount)|amount\s*(?:payable|due)|total\s*payable|balance\s*due)\b/i.test(line);
    const score = (strong ? 10 : 5) + i / Math.max(lines.length, 1); // later lines win ties: totals sit near the bottom
    const existing = scored.get(value);
    if (!existing || existing.score < score) scored.set(value, { score, label: line.slice(0, 40) });
  });

  const amounts = [...scored.entries()]
    .sort((a, b) => b[1].score - a[1].score || b[0] - a[0])
    .slice(0, 3)
    .map(([cents, v]) => ({ cents, label: v.label }));

  return { amounts, date: findDate(lines, now), merchant: findMerchant(lines) };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function iso(y: number, m: number, d: number, now: Date): string | undefined {
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(Date.UTC(year, m - 1, d));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  if (date.getTime() > now.getTime() + 2 * 86_400_000 || year < 2000) return undefined;
  return date.toISOString().slice(0, 10);
}

function findDate(lines: string[], now: Date): string | undefined {
  for (const line of lines) {
    let m = line.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) {
      const r = iso(Number(m[1]), Number(m[2]), Number(m[3]), now);
      if (r) return r;
    }
    m = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
    if (m) {
      // Day first (India). If that can't be a month, try month first.
      const r = iso(Number(m[3]), Number(m[2]), Number(m[1]), now) ?? iso(Number(m[3]), Number(m[1]), Number(m[2]), now);
      if (r) return r;
    }
    m = line.match(/\b(\d{1,2})\s*[-\s]?\s*([A-Za-z]{3})[a-z]*[-,\s]*(\d{2,4})\b/);
    if (m) {
      const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
      if (month > 0) {
        const r = iso(Number(m[3]), month, Number(m[1]), now);
        if (r) return r;
      }
    }
  }
  return undefined;
}

const NOT_A_NAME = /\b(invoice|bill|receipt|tax|gst|gstin|tel|phone|ph|mob|www|http|cashier|table|order|date|time|no\.?)\b|@|\d{5,}/i;

function findMerchant(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 5)) {
    const letters = line.replace(/[^A-Za-z]/g, '');
    if (letters.length < 3 || NOT_A_NAME.test(line) || letters.length < line.replace(/\s/g, '').length * 0.6) continue;
    const cleaned = line.replace(/[^A-Za-z0-9&'.\- ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    return cleaned.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return undefined;
}
