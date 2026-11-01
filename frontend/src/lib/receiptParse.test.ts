import { describe, expect, it } from 'vitest';
import { parseReceipt, toCents } from './receiptParse';

const now = new Date('2026-11-02T10:00:00Z');

describe('parseReceipt', () => {
  it('finds the grand total, not the subtotal or tax, and the merchant and date', () => {
    const text = `BRITTOS CAFE
GSTIN 29ABCDE1234F1Z5
Tel 0832 2277331
Date: 14/10/2026
Fish thali           450.00
Prawn curry          620.00
Subtotal           1,070.00
CGST 2.5%             26.75
SGST 2.5%             26.75
Grand Total        1,123.50
Cash                2,000.00`;
    const r = parseReceipt(text, now);
    expect(r.amounts[0].cents).toBe(112350);
    expect(r.amounts.map((a) => a.cents)).not.toContain(107000);
    expect(r.date).toBe('2026-10-14');
    expect(r.merchant).toBe('Brittos Cafe');
  });

  it('reads Rs / ₹ formats and a total whose figure is on the next line', () => {
    expect(parseReceipt('Total Amount\nRs. 2,499.00', now).amounts[0].cents).toBe(249900);
    expect(parseReceipt('TOTAL ₹ 850', now).amounts[0].cents).toBe(85000);
    expect(parseReceipt('Net Payable: 1250', now).amounts[0].cents).toBe(125000);
  });

  it('offers nothing when there is no total line (a guess is worse than no answer)', () => {
    expect(parseReceipt('Chai 20\nSamosa 30\nThank you!', now).amounts).toEqual([]);
    expect(parseReceipt('', now)).toEqual({ amounts: [], date: undefined, merchant: undefined });
  });

  it('parses common date shapes and rejects impossible or future ones', () => {
    expect(parseReceipt('5 Oct 2026\nTotal 10', now).date).toBe('2026-10-05');
    expect(parseReceipt('2026-10-03\nTotal 10', now).date).toBe('2026-10-03');
    expect(parseReceipt('31/02/2026\nTotal 10', now).date).toBeUndefined();
    expect(parseReceipt('12/12/2030\nTotal 10', now).date).toBeUndefined();
  });

  it('ignores lines that are not a total even if they say something similar', () => {
    expect(parseReceipt('Total savings 120.00\nChange 50.00', now).amounts).toEqual([]);
  });

  it('keeps up to three distinct candidates, strongest first', () => {
    const r = parseReceipt('Total 500\nTotal 520\nGrand Total 540', now);
    expect(r.amounts.map((a) => a.cents)).toEqual([54000, 52000, 50000]);
  });
});

describe('toCents', () => {
  it('handles grouping and decimals', () => {
    expect(toCents('1,250', '50')).toBe(125050);
    expect(toCents('99')).toBe(9900);
    expect(toCents('0')).toBeNull();
    expect(toCents('12345678901')).toBeNull();
  });
});
