export interface Candidate {
  id: string;
  name: string;
  /** How much this person has paid in the group so far, in cents. */
  paidCents: number;
}

export interface Odds {
  id: string;
  name: string;
  weight: number;
  /** Chance of being picked, 0-100. */
  percent: number;
}

/**
 * Whoever has paid least gets up to twice the chance of whoever has paid most.
 * Weights stay between 1 and 2, so nobody is ever excluded or guaranteed.
 */
export function oddsFor(candidates: Candidate[]): Odds[] {
  const max = Math.max(0, ...candidates.map((c) => c.paidCents));
  const weights = candidates.map((c) => (max === 0 ? 1 : 1 + (max - c.paidCents) / max));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return candidates.map((c, i) => ({ id: c.id, name: c.name, weight: weights[i], percent: Math.round((weights[i] / total) * 100) }));
}

/** Uniform integer in [0, max) from the OS random source, without modulo bias. */
export function secureRandomInt(max: number): number {
  if (max <= 1) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

/** Picks an index using the odds. `randomInt` is injectable so tests are deterministic. */
export function pickIndex(odds: Odds[], randomInt: (max: number) => number = secureRandomInt): number {
  const scaled = odds.map((o) => Math.max(1, Math.round(o.weight * 1000)));
  let roll = randomInt(scaled.reduce((a, b) => a + b, 0));
  for (let i = 0; i < scaled.length; i++) {
    if (roll < scaled[i]) return i;
    roll -= scaled[i];
  }
  return scaled.length - 1;
}
