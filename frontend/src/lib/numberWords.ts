const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { thousand: 1_000, lakh: 100_000, lac: 100_000, lakhs: 100_000, crore: 10_000_000, crores: 10_000_000 };

const isNumberWord = (w: string) => w in UNITS || w in TENS || w === 'hundred' || w in SCALES;

/**
 * Turns spoken amounts into digits so the quick-entry parser can read them:
 * "fifteen hundred" -> 1500, "two thousand five hundred" -> 2500, "one lakh" -> 100000, "one point five" -> 1.5.
 * A phrase is only converted when it is 10 or more (or has a decimal), so "dinner for one" stays as typed.
 */
export function wordsToDigits(input: string): string {
  const tokens = input.split(/(\s+)/); // keep the whitespace so the text can be rebuilt
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const word = tokens[i].toLowerCase().replace(/[.,!?]$/, '');
    if (!isNumberWord(word) && word !== 'a') {
      out.push(tokens[i++]);
      continue;
    }
    // collect a run of number words (allowing "and" and a single space between them)
    let j = i;
    let end = i; // index just past the last number word, so trailing spaces aren't swallowed
    const phrase: string[] = [];
    while (j < tokens.length) {
      const w = tokens[j].toLowerCase().replace(/[.,!?]$/, '');
      if (/^\s+$/.test(tokens[j])) {
        j++;
        continue;
      }
      if (isNumberWord(w) || (w === 'point' && phrase.length > 0) || (phrase.includes('point') && w in UNITS) || (w === 'and' && phrase.length > 0 && next(tokens, j))) {
        phrase.push(w);
        j++;
        end = j;
      } else if (w === 'a' && phrase.length === 0 && isScaleNext(tokens, j)) {
        phrase.push('one');
        j++;
        end = j;
      } else break;
    }
    const value = phrase.length ? parsePhrase(phrase) : null;
    if (value !== null && (value >= 10 || phrase.includes('point'))) {
      out.push(String(value));
      i = end;
    } else {
      out.push(tokens[i++]);
    }
  }
  return out.join('');
}

function next(tokens: string[], at: number): boolean {
  for (let k = at + 1; k < tokens.length; k++) {
    if (/^\s+$/.test(tokens[k])) continue;
    return isNumberWord(tokens[k].toLowerCase().replace(/[.,!?]$/, ''));
  }
  return false;
}

function isScaleNext(tokens: string[], at: number): boolean {
  for (let k = at + 1; k < tokens.length; k++) {
    if (/^\s+$/.test(tokens[k])) continue;
    const w = tokens[k].toLowerCase();
    return w === 'hundred' || w in SCALES;
  }
  return false;
}

function parsePhrase(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let decimal = '';
  let inDecimal = false;
  for (const w of words) {
    if (w === 'and') continue;
    if (w === 'point') {
      inDecimal = true;
      continue;
    }
    if (inDecimal) {
      if (!(w in UNITS) || UNITS[w] > 9) return null;
      decimal += String(UNITS[w]);
    } else if (w in UNITS) current += UNITS[w];
    else if (w in TENS) current += TENS[w];
    else if (w === 'hundred') current = (current || 1) * 100;
    else if (w in SCALES) {
      total += (current || 1) * SCALES[w];
      current = 0;
    } else return null;
  }
  const whole = total + current;
  return decimal ? Number(`${whole}.${decimal}`) : whole;
}
