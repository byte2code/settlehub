/**
 * Tiny, safe calculator for the amount field: "500+250", "1.5k", "2*300", "(100+50)/3".
 * Recursive descent, no eval. Returns null for anything that isn't a clean expression.
 */
export function evalAmount(input: string): number | null {
  const src = input.replace(/[,\s₹$€£]/g, '').replace(/[xX×]/g, '*').replace(/÷/g, '/');
  if (!src) return null;
  let i = 0;

  const peek = () => src[i];
  const number = (): number | null => {
    const m = /^\d*\.?\d+(?:[kK])?|^\d+\.(?:[kK])?/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    const raw = m[0];
    const value = parseFloat(raw);
    return /[kK]$/.test(raw) ? value * 1000 : value;
  };
  const factor = (): number | null => {
    if (peek() === '(') {
      i++;
      const v = expr();
      if (v === null || peek() !== ')') return null;
      i++;
      return v;
    }
    if (peek() === '-') {
      i++;
      const v = factor();
      return v === null ? null : -v;
    }
    return number();
  };
  const term = (): number | null => {
    let left = factor();
    while (left !== null && (peek() === '*' || peek() === '/')) {
      const op = src[i++];
      const right = factor();
      if (right === null || (op === '/' && right === 0)) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  };
  function expr(): number | null {
    let left = term();
    while (left !== null && (peek() === '+' || peek() === '-')) {
      const op = src[i++];
      const right = term();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = expr();
  if (result === null || i !== src.length || !Number.isFinite(result) || result < 0) return null;
  return Math.round(result * 100) / 100;
}

/** True when the text is more than a plain number, so the UI should show what it adds up to. */
export function isExpression(input: string): boolean {
  return /[+\-*/xX×÷()kK]/.test(input.trim().replace(/^-/, ''));
}
