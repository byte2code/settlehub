import type { Award } from '../types';

/** Draws the shareable awards card (1080×1350). Emoji rendering depends on the device's fonts. */
export function drawAwards(canvas: HTMLCanvasElement, groupName: string, awards: Award[]): void {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return;
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#7c3aed');
  bg.addColorStop(1, '#db2777');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  c.fillStyle = '#fff';
  c.font = '600 38px system-ui, sans-serif';
  c.fillText('SettleHub Awards', 80, 110);
  c.font = '800 72px system-ui, sans-serif';
  const title = groupName.length > 20 ? groupName.slice(0, 19) + '…' : groupName;
  c.fillText(title, 80, 210);

  const rowH = Math.min(190, (H - 420) / Math.max(awards.length, 1));
  awards.forEach((a, i) => {
    const y = 300 + i * rowH;
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.beginPath();
    c.roundRect(60, y, W - 120, rowH - 20, 28);
    c.fill();
    c.fillStyle = '#fff';
    c.font = '700 70px system-ui, sans-serif';
    c.fillText(a.emoji, 90, y + 88);
    c.font = '700 42px system-ui, sans-serif';
    c.fillText(a.title, 200, y + 62);
    c.font = '500 36px system-ui, sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.9)';
    const winners = a.winners.join(' & ');
    c.fillText(winners.length > 26 ? winners.slice(0, 25) + '…' : winners, 200, y + 112);
  });
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.font = '500 30px system-ui, sans-serif';
  c.fillText('Just for fun. Split bills, not friendships.', 80, H - 60);
}
