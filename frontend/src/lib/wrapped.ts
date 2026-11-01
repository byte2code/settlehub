import { formatMoney } from './money';
import type { Badge, Group, User } from '../types';

export interface WrappedStats {
  name: string;
  groups: number;
  people: number;
  spentByCurrency: Record<string, number>;
  badges: Badge[];
}

export function computeWrapped(user: User, groups: Group[], badges: Badge[]): WrappedStats {
  const active = groups.filter((g) => !g.archived);
  const people = new Set<string>();
  const spent: Record<string, number> = {};
  for (const g of active) {
    for (const m of g.members) if (m.userId !== user.id) people.add(m.userId);
    spent[g.currencyCode] = (spent[g.currencyCode] ?? 0) + g.totalSpendCents;
  }
  return { name: user.firstName, groups: active.length, people: people.size, spentByCurrency: spent, badges: badges.filter((b) => b.earned) };
}

/** Draws the shareable card (1080×1350) onto a canvas. */
export function drawWrapped(canvas: HTMLCanvasElement, s: WrappedStats): void {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return;

  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#047857');
  bg.addColorStop(1, '#0f766e');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,0.08)';
  c.beginPath();
  c.arc(W - 120, 180, 320, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = '#fff';
  c.font = '600 40px system-ui, sans-serif';
  c.fillText('SettleHub Wrapped', 80, 120);
  c.font = '800 96px system-ui, sans-serif';
  c.fillText(`${s.name}’s`, 80, 280);
  c.fillText('splits', 80, 390);

  const stat = (label: string, value: string, y: number) => {
    c.font = '500 34px system-ui, sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fillText(label, 80, y);
    c.font = '800 72px system-ui, sans-serif';
    c.fillStyle = '#fff';
    c.fillText(value, 80, y + 80);
  };
  stat('Groups', String(s.groups), 520);
  stat('People you split with', String(s.people), 690);
  const spent = Object.entries(s.spentByCurrency).map(([code, cents]) => formatMoney(cents, code)).join(' · ') || '—';
  stat('Tracked together', spent.length > 22 ? spent.slice(0, 21) + '…' : spent, 860);

  c.font = '500 34px system-ui, sans-serif';
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.fillText('Badges', 80, 1050);
  c.font = '700 44px system-ui, sans-serif';
  c.fillStyle = '#fff';
  const line = s.badges.length ? s.badges.map((b) => `${b.emoji} ${b.name}`).join('   ') : 'Settle up to earn your first one';
  c.fillText(line.length > 38 ? s.badges.map((b) => b.emoji).join(' ') : line, 80, 1115);

  c.font = '500 30px system-ui, sans-serif';
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillText('Split bills, not friendships · settlehub', 80, H - 70);
}
