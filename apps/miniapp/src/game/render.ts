// Canvas renderer for «Эльфы Avera». Brand palette only; all shapes drawn in code.
import type { GameState, Target } from './engine';

export const TARGETS: Target[] = ['dlya-neyo', 'detyam', 'vzroslym'];
const C = { night: '#0F0E0C', hazel: '#39271D', almond: '#644E40', beige: '#B6906B', sand: '#E3D9CF', linen: '#F3ECE4', gold: '#CFA884', white: '#FFFFFF', warn: '#F3C9A8' };
const BOX_COLORS: Record<Target, { box: string; ribbon: string }> = {
  'dlya-neyo': { box: C.linen, ribbon: C.beige },
  detyam: { box: C.sand, ribbon: C.almond },
  vzroslym: { box: C.beige, ribbon: C.hazel },
};

export interface Fx { kind: 'fly' | 'float' | 'shake'; target: Target; t0: number; dur: number; text?: string; color?: string; golden?: boolean; cat?: Target }
export interface Scene { w: number; h: number; labels: Record<Target, string>; logo: HTMLImageElement | null; flakes: { x: number; y: number; r: number; s: number }[]; fx: Fx[] }

export function houseX(w: number, t: Target) { return w * (t === 'dlya-neyo' ? 1 / 6 : t === 'detyam' ? 1 / 2 : 5 / 6); }
const houseY = (h: number) => h * 0.9;
const boxPos = (s: Scene) => ({ x: s.w / 2, y: s.h * 0.45 });

export function makeScene(w: number, h: number, labels: Record<Target, string>, logo: HTMLImageElement | null): Scene {
  return { w, h, labels, logo, fx: [], flakes: Array.from({ length: 50 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.8, s: 12 + Math.random() * 30 })) };
}

function arch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // pointed arch: base at y (bottom), top at y - h
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h * 0.55);
  ctx.quadraticCurveTo(x - w / 2, y - h * 0.92, x, y - h);
  ctx.quadraticCurveTo(x + w / 2, y - h * 0.92, x + w / 2, y - h * 0.55);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
}

function drawGiftBox(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, cat: Target, golden: boolean, alpha = 1) {
  const col = golden ? { box: C.gold, ribbon: C.hazel } : BOX_COLORS[cat];
  ctx.save(); ctx.globalAlpha = alpha;
  const w = size, h = size * 0.78;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + h / 2 + 6, w * 0.5, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col.box; ctx.fillRect(x - w / 2, y - h / 2 + 8, w, h - 8);
  ctx.fillStyle = shade(col.box, -12); ctx.fillRect(x - w / 2 - 4, y - h / 2, w + 8, 12);
  ctx.fillStyle = col.ribbon; ctx.fillRect(x - 5, y - h / 2, 10, h);
  ctx.strokeStyle = col.ribbon; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(x - 11, y - h / 2 - 7, 11, 6, -0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + 11, y - h / 2 - 7, 11, 6, 0.5, 0, Math.PI * 2); ctx.stroke();
  if (golden) {
    ctx.fillStyle = C.white;
    for (const [dx, dy, r] of [[-w * 0.6, -h * 0.4, 3], [w * 0.62, -h * 0.1, 2.5], [-w * 0.45, h * 0.45, 2]]) star(ctx, x + dx, y + dy, r);
  }
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x, y - r * 2.5); ctx.lineTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 2.5, y); ctx.lineTo(x + r * 0.6, y + r * 0.6);
  ctx.lineTo(x, y + r * 2.5); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.lineTo(x - r * 2.5, y); ctx.lineTo(x - r * 0.6, y - r * 0.6); ctx.closePath(); ctx.fill();
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawElf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lean: number, t: number) {
  const bob = Math.sin(t / 180) * 1.5;
  ctx.save(); ctx.translate(x, y + bob); ctx.rotate(lean * 0.25); ctx.scale(s, s);
  ctx.fillStyle = C.almond; ctx.fillRect(-9, 18, 6, 14); ctx.fillRect(3, 18, 6, 14);
  ctx.fillStyle = C.night; ctx.beginPath(); ctx.ellipse(-7, 33, 7, 3.5, 0, 0, Math.PI * 2); ctx.ellipse(7, 33, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.hazel; ctx.beginPath(); ctx.moveTo(-15, 20); ctx.lineTo(-11, -6); ctx.lineTo(11, -6); ctx.lineTo(15, 20); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-15, 20); ctx.lineTo(15, 20); ctx.stroke();
  ctx.fillStyle = C.beige; ctx.fillRect(-12, 6, 24, 4);
  ctx.fillStyle = C.sand; ctx.beginPath(); ctx.arc(0, -15, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-9, -17); ctx.lineTo(-17, -22); ctx.lineTo(-9, -12); ctx.fill(); ctx.beginPath(); ctx.moveTo(9, -17); ctx.lineTo(17, -22); ctx.lineTo(9, -12); ctx.fill();
  ctx.fillStyle = C.night; ctx.beginPath(); ctx.arc(-3.5, -15, 1.4, 0, Math.PI * 2); ctx.arc(3.5, -15, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.almond; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -12, 3.5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = C.beige; ctx.beginPath(); ctx.moveTo(-11, -20); ctx.quadraticCurveTo(-2, -48, 16, -40); ctx.lineTo(11, -21); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(17, -40, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.linen; ctx.fillRect(-12, -23, 24, 4);
  ctx.restore();
}

function drawShowroom(ctx: CanvasRenderingContext2D, s: Scene, t: number) {
  const w = Math.min(s.w * 0.7, 320), h = s.h * 0.2, x = s.w / 2, top = s.h * 0.06;
  ctx.fillStyle = C.hazel; ctx.fillRect(x - w / 2, top, w, h);
  ctx.fillStyle = shade(C.hazel, -10); ctx.fillRect(x - w / 2 - 6, top - 6, w + 12, 8);
  // sign band with real logo
  ctx.fillStyle = C.night; ctx.fillRect(x - w / 2 + 10, top + 8, w - 20, h * 0.26);
  if (s.logo?.complete && s.logo.naturalWidth) {
    const lh = h * 0.16, lw = lh * (s.logo.naturalWidth / s.logo.naturalHeight);
    ctx.save(); ctx.shadowColor = C.gold; ctx.shadowBlur = 10; ctx.drawImage(s.logo, x - lw / 2, top + 8 + (h * 0.26 - lh) / 2, lw, lh); ctx.restore();
  }
  // door + windows with warm glow
  const glow = 0.75 + Math.sin(t / 600) * 0.08;
  const g = ctx.createLinearGradient(0, top + h * 0.35, 0, top + h);
  g.addColorStop(0, `rgba(207,168,132,${glow})`); g.addColorStop(1, 'rgba(182,144,107,0.55)');
  ctx.fillStyle = g; arch(ctx, x, top + h, h * 0.42, h * 0.6); ctx.fill();
  for (const dx of [-w * 0.32, w * 0.32]) { arch(ctx, x + dx, top + h * 0.88, h * 0.26, h * 0.44); ctx.fill(); }
  // conveyor line
  ctx.strokeStyle = 'rgba(207,168,132,0.25)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, top + h); ctx.lineTo(x, s.h * 0.4); ctx.stroke(); ctx.setLineDash([]);
}

function drawHouse(ctx: CanvasRenderingContext2D, s: Scene, target: Target, t: number, shakeAmt: number) {
  const x = houseX(s.w, target) + shakeAmt, base = houseY(s.h), w = Math.min(s.w * 0.27, 120), h = s.h * 0.11;
  ctx.fillStyle = C.almond; ctx.fillRect(x - w / 2, base - h, w, h);
  ctx.fillStyle = C.hazel; ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, base - h + 2); ctx.lineTo(x, base - h - h * 0.75); ctx.lineTo(x + w / 2 + 8, base - h + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.sand; ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, base - h + 2); ctx.lineTo(x, base - h - h * 0.75); ctx.lineTo(x + w / 2 + 8, base - h + 2);
  ctx.lineTo(x + w / 2, base - h + 6); ctx.lineTo(x, base - h - h * 0.6); ctx.lineTo(x - w / 2, base - h + 6); ctx.closePath(); ctx.fill();
  const glow = 0.7 + Math.sin(t / 500 + x) * 0.1;
  ctx.fillStyle = `rgba(207,168,132,${glow})`; arch(ctx, x, base, w * 0.26, h * 0.7); ctx.fill();
  ctx.fillRect(x - w * 0.38, base - h * 0.75, w * 0.16, h * 0.28); ctx.fillRect(x + w * 0.22, base - h * 0.75, w * 0.16, h * 0.28);
  ctx.fillStyle = C.sand; ctx.font = `700 ${Math.max(9, Math.min(11, s.w / 36))}px Bounded, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(s.labels[target].toUpperCase(), x, base + 8);
}

export function render(ctx: CanvasRenderingContext2D, s: Scene, st: GameState, now: number, dt: number, hint: boolean) {
  const { w, h } = s;
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, C.night); bg.addColorStop(1, '#1E1510');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const halo = ctx.createRadialGradient(w / 2, h * 0.12, 10, w / 2, h * 0.12, w * 0.7);
  halo.addColorStop(0, 'rgba(182,144,107,0.25)'); halo.addColorStop(1, 'rgba(182,144,107,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
  // garland
  for (let i = 0; i < 14; i++) {
    const gx = (i + 0.5) * (w / 14), gy = 10 + Math.sin(i * 0.9) * 4;
    ctx.fillStyle = i % 2 ? C.gold : C.beige; ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(now / 700 + i));
    ctx.beginPath(); ctx.arc(gx, gy, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawShowroom(ctx, s, now);
  // ground snow
  ctx.fillStyle = 'rgba(227,217,207,0.08)'; ctx.fillRect(0, houseY(h), w, h - houseY(h));

  const shakeOf = (tg: Target) => s.fx.filter((f) => f.kind === 'shake' && f.target === tg).reduce((a, f) => a + Math.sin((now - f.t0) / 25) * 5 * (1 - (now - f.t0) / f.dur), 0);
  for (const tg of TARGETS) drawHouse(ctx, s, tg, now, shakeOf(tg));

  const bp = boxPos(s);
  const flying = s.fx.find((f) => f.kind === 'fly');
  let lean = 0;
  if (flying) lean = flying.target === 'dlya-neyo' ? -1 : flying.target === 'vzroslym' ? 1 : 0;
  drawElf(ctx, w / 2, h * 0.62, Math.min(1.4, w / 300), lean * (1 - Math.min(1, (now - (flying?.t0 ?? 0)) / 300)), now);

  if (st.current) {
    const c = st.current;
    const appear = Math.min(1, (c.maxTtlMs - c.ttlMs) / 160);
    drawGiftBox(ctx, bp.x, bp.y - (1 - appear) * 40, Math.min(84, w * 0.22), c.category, c.golden, appear);
    ctx.fillStyle = c.golden ? C.gold : C.white; ctx.font = `700 ${Math.min(15, w / 26)}px Bounded, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(c.name.toUpperCase(), bp.x, bp.y - Math.min(84, w * 0.22) * 0.62);
    const bw = Math.min(120, w * 0.32), frac = Math.max(0, c.ttlMs / c.maxTtlMs);
    ctx.fillStyle = 'rgba(227,217,207,0.15)'; ctx.fillRect(bp.x - bw / 2, bp.y + Math.min(84, w * 0.22) * 0.55, bw, 3);
    ctx.fillStyle = frac < 0.3 ? C.warn : C.beige; ctx.fillRect(bp.x - bw / 2, bp.y + Math.min(84, w * 0.22) * 0.55, bw * frac, 3);
  }

  for (const f of s.fx) {
    const k = Math.min(1, (now - f.t0) / f.dur);
    if (f.kind === 'fly') {
      const hx = houseX(w, f.target), hy = houseY(h) - h * 0.08;
      const x = bp.x + (hx - bp.x) * k, y = bp.y + (hy - bp.y) * k - Math.sin(k * Math.PI) * 50;
      drawGiftBox(ctx, x, y, Math.min(84, w * 0.22) * (1 - k * 0.55), f.cat ?? f.target, !!f.golden, 1 - k * 0.3);
    } else if (f.kind === 'float' && f.text) {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color ?? C.gold; ctx.font = `700 ${Math.min(20, w / 18)}px Bounded, Arial`; ctx.textAlign = 'center';
      ctx.fillText(f.text, houseX(w, f.target), houseY(h) - h * 0.2 - k * 40); ctx.globalAlpha = 1;
    }
  }
  s.fx = s.fx.filter((f) => now - f.t0 < f.dur);

  // snow
  ctx.fillStyle = C.sand;
  for (const fl of s.flakes) {
    fl.y += (fl.s * dt) / 1000; fl.x += Math.sin((now / 1000 + fl.r) * 1.3) * 0.2;
    if (fl.y > h) { fl.y = -4; fl.x = Math.random() * w; }
    ctx.globalAlpha = 0.25 + fl.r / 5; ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (hint) {
    ctx.fillStyle = 'rgba(15,14,12,0.55)'; ctx.fillRect(0, h * 0.68, w, h * 0.08);
    ctx.fillStyle = C.sand; ctx.font = `500 ${Math.min(13, w / 30)}px Bounded, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('←   ↑   →', w / 2, h * 0.72);
  }
}
