import { getPrefs, usePrefs } from './prefs';

/**
 * [plain, fun] wording. Only friendly, low-stakes moments live here: never errors,
 * payments that failed, or anything about losing data.
 */
const COPY = {
  'dash.settled': ['You’re all settled up.', 'You’re all settled up. Go treat yourself 🎉'],
  'dash.noGroups': ['No groups yet', 'No groups yet. Your wallet is suspiciously calm 😌'],
  'dash.noGroupsBody': ['Create a group for a trip, your flat or a night out — or join one with a code.', 'Start one for a trip, your flat or a night out. Or join with a code and be the fun one.'],
  'dash.nothingArchived': ['Nothing archived', 'Nothing archived. Your past adventures are still out there 🧳'],
  'expenses.none': ['No expenses yet', 'No expenses yet. Somebody has to buy the first chai ☕'],
  'expenses.noneBody': ['Add what you spent and SettleHub works out who owes whom.', 'Add what you spent and SettleHub does the awkward maths for you.'],
  'balances.settled': ['All settled up', 'All settled up. Everyone owes everyone nothing 🥳'],
  'inbox.none': ['Nothing here', 'Crickets… 🦗'],
  'stats.none': ['Nothing spent yet.', 'Nothing spent yet. Your money is on holiday 🏝️'],
  'drawer.noneOwe': ['You don’t owe anyone right now.', 'You owe nobody. Living the dream ✨'],
  'drawer.noneOwed': ['Nobody owes you right now.', 'Nobody owes you. Your friends are suspiciously honest 😇'],
  'wake.text': ['The free server is waking up (usually 30-60 s). Hang tight…', 'The free server is having a long nap 😴 Waking it up (usually 30-60 s)…'],
  'toast.settled': ['Recorded {amount} payment', 'Recorded {amount} payment 🎉'],
  'toast.expenseAdded': ['Expense added', 'Expense added 🧾'],
} as const;

export type CopyKey = keyof typeof COPY;

export function pick(key: CopyKey, fun: boolean): string {
  return COPY[key][fun ? 1 : 0];
}

export function copy(key: CopyKey, vars?: Record<string, string>): string {
  let text = pick(key, getPrefs().fun);
  for (const [k, v] of Object.entries(vars ?? {})) text = text.replace(`{${k}}`, v);
  return text;
}

/** Re-renders when Fun mode changes. */
export function useCopy() {
  const { fun } = usePrefs();
  return (key: CopyKey, vars?: Record<string, string>) => {
    let text = pick(key, fun);
    for (const [k, v] of Object.entries(vars ?? {})) text = text.replace(`{${k}}`, v);
    return text;
  };
}

export const COPY_KEYS = Object.keys(COPY) as CopyKey[];
