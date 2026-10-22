import { formatMoney, parseAmountToCents } from './money';
import type { SplitMethod } from '../types';

export interface SplitFormState {
  totalCents: number;
  currency: string;
  method: SplitMethod;
  multiPayer: boolean;
  payerAmounts: Record<string, string>;
  selected: Record<string, boolean>;
  exactAmounts: Record<string, string>;
  percentages: Record<string, string>;
}

export interface Validation {
  valid: boolean;
  message: string;
}

const sumCents = (values: Record<string, string>, include?: (id: string) => boolean) =>
  Object.entries(values).reduce((acc, [id, v]) => {
    if (include && !include(id)) return acc;
    const cents = parseAmountToCents(v);
    return acc + (Number.isNaN(cents) ? 0 : cents);
  }, 0);

/** Mirrors the server's rules so the form can explain problems before submitting. */
export function validateSplit(state: SplitFormState): Validation {
  const { totalCents, currency } = state;
  if (!(totalCents > 0)) return { valid: false, message: 'Enter an amount' };

  if (state.multiPayer) {
    const diff = totalCents - sumCents(state.payerAmounts);
    if (diff !== 0) {
      return {
        valid: false,
        message: diff > 0 ? `${formatMoney(diff, currency)} still to assign to payers` : `Payers exceed the total by ${formatMoney(-diff, currency)}`,
      };
    }
  }

  if (state.method === 'EQUAL') {
    const count = Object.values(state.selected).filter(Boolean).length;
    if (count === 0) return { valid: false, message: 'Pick at least one person to split with' };
    return { valid: true, message: `${formatMoney(Math.floor(totalCents / count), currency)} each for ${count} ${count === 1 ? 'person' : 'people'}` };
  }

  if (state.method === 'EXACT') {
    const diff = totalCents - sumCents(state.exactAmounts);
    if (diff === 0) return { valid: true, message: 'Amounts add up' };
    return {
      valid: false,
      message: diff > 0 ? `${formatMoney(diff, currency)} left to split` : `${formatMoney(-diff, currency)} over the total`,
    };
  }

  const pct = Object.values(state.percentages).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const diff = Math.round((100 - pct) * 100) / 100;
  if (Math.abs(diff) <= 0.05) return { valid: true, message: 'Percentages add up to 100%' };
  return { valid: false, message: diff > 0 ? `${diff.toFixed(2)}% left` : `${(-diff).toFixed(2)}% over 100%` };
}
