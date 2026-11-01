import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv4 } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv4', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('produces valid v4 ids', () => {
    expect(uuidv4()).toMatch(V4);
  });
  it('still produces valid, distinct ids when crypto.randomUUID is missing (old WebViews)', () => {
    const real = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array<ArrayBuffer>) => real(a) } as unknown as Crypto);
    const a = uuidv4();
    const b = uuidv4();
    expect(a).toMatch(V4);
    expect(a).not.toBe(b);
  });
});
