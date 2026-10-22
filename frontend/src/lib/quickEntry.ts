/**
 * Offline "quick entry" parser: turns "Dinner at Brittos 1.5k paid by Alice" into form fields.
 * Pure function, no network, no AI cost.
 */
export interface QuickEntryResult {
  amount?: string;
  description?: string;
  category?: string;
  payerId?: string;
}

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ['FOOD', /\b(food|dinner|lunch|breakfast|brunch|pizza|burger|meal|cafe|coffee|tea|beer|drinks?|wine|restaurant|zomato|swiggy|snacks?|bar|pub|groceries|grocery)\b/],
  ['TRANSPORT', /\b(cab|taxi|uber|ola|rapido|auto|flight|train|bus|metro|petrol|diesel|fuel|gas|scooter|bike|toll|parking|ferry|transport)\b/],
  ['STAY', /\b(hotel|villa|resort|airbnb|stay|hostel|room|lodge|homestay|booking|rent)\b/],
  ['ENTERTAINMENT', /\b(party|club|clubbing|tickets?|movie|concert|cruise|scuba|entry|fun|gaming|trek|trekking|museum)\b/],
  ['SHOPPING', /\b(shopping|mall|clothes|dress|souvenirs?|gifts?|market|store|mart|supermarket)\b/],
  ['UTILITIES', /\b(electricity|wifi|internet|water|bill|bills|recharge|maintenance|utilities)\b/],
];

const FILLER = /\b(paid|by|split|equal|equally|for|with|inr|rs|at|on)\b/gi;

export function parseQuickEntry(input: string, members: { userId: string; name: string }[]): QuickEntryResult {
  let text = input.trim();
  if (!text) return {};
  const result: QuickEntryResult = {};

  const amountMatch = text.match(/(?:₹|\$|€|£|rs\.?\s*|inr\s*)?(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?\s*(k)?\b/i);
  if (amountMatch) {
    let value = Number(amountMatch[1].replace(/,/g, '') + (amountMatch[2] ? `.${amountMatch[2]}` : ''));
    if (amountMatch[3]) value *= 1000;
    if (value > 0) {
      result.amount = String(Number(value.toFixed(2)));
      text = text.replace(amountMatch[0], ' ');
    }
  }

  const lower = text.toLowerCase();
  for (const [code, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(lower)) {
      result.category = code;
      break;
    }
  }

  for (const member of members) {
    const firstName = member.name.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!firstName) continue;
    const pattern = new RegExp(`(?:paid\\s+by|by|from)?\\s*\\b${firstName}\\b(?:\\s+paid)?`, 'i');
    if (pattern.test(text)) {
      result.payerId = member.userId;
      text = text.replace(pattern, ' ');
      break;
    }
  }

  const description = text.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (description) {
    result.description = description.charAt(0).toUpperCase() + description.slice(1);
  }
  return result;
}
