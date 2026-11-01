import { motionAllowed } from './prefs';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

const COLORS = ['#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#ef4444'];

/** Pure so it can be tested: a fan of particles shooting up from the bottom centre. */
export function makeParticles(count: number, width: number, height: number, rng: () => number = Math.random): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (rng() - 0.5) * 1.4;
    const speed = 7 + rng() * 9;
    return {
      x: width / 2 + (rng() - 0.5) * 80,
      y: height * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + rng() * 5,
      color: COLORS[Math.floor(rng() * COLORS.length)],
      rot: rng() * Math.PI,
      vr: (rng() - 0.5) * 0.4,
    };
  });
}

/** True only when a settle action took every balance in the group to zero (and there were debts before). */
export function isDebtFree(netBalancesAfter: Record<string, number>, hadDebtBefore: boolean): boolean {
  const values = Object.values(netBalancesAfter);
  return hadDebtBefore && values.length > 0 && values.every((v) => v === 0);
}

let running = false;

/** Fire-and-forget. Does nothing with Fun mode off or when the OS asks for reduced motion. */
export function burst(size: 'small' | 'big' = 'small'): void {
  if (running || typeof document === 'undefined' || !motionAllowed()) return;
  running = true;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    running = false;
    return;
  }
  const particles = makeParticles(size === 'big' ? 110 : 40, canvas.width, canvas.height);
  const end = performance.now() + (size === 'big' ? 2800 : 1600);
  const frame = (now: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.6);
      ctx.restore();
    }
    if (now < end) requestAnimationFrame(frame);
    else {
      canvas.remove();
      running = false;
    }
  };
  requestAnimationFrame(frame);
}
