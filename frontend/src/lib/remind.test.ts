import { describe, expect, it } from 'vitest';
import { buildWhatsAppReminder } from './remind';

describe('buildWhatsAppReminder', () => {
  it('pre-fills a polite message with name, amount and groups', () => {
    const url = buildWhatsAppReminder({ debtorName: 'Priya Sharma', amountCents: 50000, currency: 'INR', groupNames: ['Goa Trip'] });
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('Hey Priya!');
    expect(text).toContain('Goa Trip');
    expect(text).toMatch(/500/);
  });
});
