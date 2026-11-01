/**
 * Cash chimes synthesised with the Web Audio API, so they cost 0 KB and work offline.
 * Browsers only allow audio after a user gesture; failures are ignored.
 */
export type ChimeId = 'none' | 'cha-ching' | 'coin' | 'bell';

export const CHIMES: { id: ChimeId; label: string; emoji: string }[] = [
  { id: 'cha-ching', label: 'Cha-Ching', emoji: '💰' },
  { id: 'coin', label: '8-Bit Coin', emoji: '🪙' },
  { id: 'bell', label: 'Zen Bell', emoji: '🔔' },
  { id: 'none', label: 'Silent', emoji: '🔇' },
];

let ctx: AudioContext | null = null;

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, peak: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

export function playChime(id: string | null | undefined): void {
  if (!id || id === 'none' || typeof window === 'undefined') return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    const c = ctx;
    if (c.state === 'suspended') void c.resume();
    const t = c.currentTime + 0.02;
    if (id === 'cha-ching') {
      // two quick bright strikes, each with an inharmonic overtone for the metallic "coin" ring
      for (const [i, f] of [1318.5, 1760].entries()) {
        tone(c, f, t + i * 0.11, 0.5, 'triangle', 0.25);
        tone(c, f * 2.41, t + i * 0.11, 0.25, 'sine', 0.08);
      }
    } else if (id === 'coin') {
      tone(c, 987.8, t, 0.09, 'square', 0.12);
      tone(c, 1318.5, t + 0.09, 0.45, 'square', 0.12);
    } else if (id === 'bell') {
      tone(c, 880, t, 1.6, 'sine', 0.3);
      tone(c, 880 * 2.76, t, 0.8, 'sine', 0.06);
    }
  } catch {
    // audio is a nicety, never an error
  }
}
