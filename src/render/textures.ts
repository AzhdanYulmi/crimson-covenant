import { Texture } from 'pixi.js';
import { Sym, SYMBOL_COUNT } from '../math/config';

/** All art is drawn procedurally with Canvas2D, then uploaded as Pixi textures. */

export const SYMBOL_PX = 240; // texture size; sprites are scaled down to the cell
export const DISPLAY_FONT = 'Cinzel, "Times New Roman", serif';
export const UI_FONT = 'Oswald, "Arial Narrow", sans-serif';

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Deterministic noise so the art is identical on every load. */
function seeded(seed: number) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
}

function glow<T>(ctx: Ctx, color: string, blur: number, draw: () => T): T {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  const r = draw();
  ctx.restore();
  return r;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function banner(ctx: Ctx, text: string, y: number, fill: string, stroke: string) {
  ctx.save();
  ctx.font = `900 44px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#120205';
  ctx.strokeText(text, 120, y);
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, 120, y);
  const g = ctx.createLinearGradient(0, y - 22, 0, y + 22);
  g.addColorStop(0, '#fff3c4');
  g.addColorStop(0.5, fill);
  g.addColorStop(1, '#6b3a07');
  ctx.fillStyle = g;
  glow(ctx, stroke, 14, () => ctx.fillText(text, 120, y));
  ctx.restore();
}

// ---------- low symbols: carved rune stones ----------

const RUNES: { stone: [string, string, string]; glow: string; glyph: [number, number][][] }[] = [
  { // ash
    stone: ['#8d8f96', '#4a4c55', '#1c1d22'], glow: '#9fd4ff',
    glyph: [[[0, -0.62], [0, 0.62]], [[0, 0.02], [-0.46, -0.5]], [[0, 0.02], [0.46, -0.5]]],
  },
  { // bone
    stone: ['#e8dcc0', '#9c8a66', '#3b3122'], glow: '#ffb347',
    glyph: [[[0, -0.62], [0.42, -0.16], [0, 0.3], [-0.42, -0.16], [0, -0.62]], [[0, 0.3], [0.42, 0.66]], [[0, 0.3], [-0.42, 0.66]]],
  },
  { // rust
    stone: ['#c06a3a', '#6e3216', '#240e05'], glow: '#ff4b2b',
    glyph: [[[-0.25, -0.64], [-0.25, 0.64]], [[-0.25, -0.34], [0.34, 0], [-0.25, 0.34]]],
  },
  { // moss
    stone: ['#6f8f55', '#344a28', '#0f170b'], glow: '#9dff6a',
    glyph: [[[-0.44, -0.52], [-0.44, 0.52], [0.44, -0.52], [0.44, 0.52], [-0.44, -0.52]]],
  },
];

function drawRune(ctx: Ctx, idx: number) {
  const rune = RUNES[idx];
  const rnd = seeded(idx * 977 + 13);
  const cx = 120, cy = 122;
  const pts: [number, number][] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
    const r = 84 + rnd() * 14;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.96]);
  }
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const p = pts[0], q = pts[1];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    ctx.closePath();
  };
  // drop shadow
  ctx.save();
  ctx.translate(4, 8);
  path();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.filter = 'blur(6px)';
  ctx.fill();
  ctx.restore();
  // stone body
  const g = ctx.createRadialGradient(cx - 30, cy - 36, 10, cx, cy, 110);
  g.addColorStop(0, rune.stone[0]);
  g.addColorStop(0.55, rune.stone[1]);
  g.addColorStop(1, rune.stone[2]);
  path();
  ctx.fillStyle = g;
  ctx.fill();
  // speckle texture
  ctx.save();
  path();
  ctx.clip();
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.arc(30 + rnd() * 180, 30 + rnd() * 180, 1 + rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    let x = 40 + rnd() * 160, y = 40 + rnd() * 160;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) ctx.lineTo((x += (rnd() - 0.5) * 40), (y += (rnd() - 0.5) * 40));
    ctx.stroke();
  }
  ctx.restore();
  path();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.stroke();
  // carved glyph: dark groove + glowing core
  const glyph = () => {
    ctx.beginPath();
    for (const line of rune.glyph) {
      line.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * 70, cy + y * 70) : ctx.moveTo(cx + x * 70, cy + y * 70)));
    }
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  glyph();
  ctx.lineWidth = 20;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.stroke();
  glow(ctx, rune.glow, 24, () => {
    glyph();
    ctx.lineWidth = 9;
    ctx.strokeStyle = rune.glow;
    ctx.stroke();
  });
  glyph();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}

// ---------- high symbols ----------

function plate(ctx: Ctx, rim: string, inner: string) {
  ctx.save();
  roundRect(ctx, 14, 14, 212, 212, 30);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.filter = 'blur(5px)';
  ctx.fill();
  ctx.restore();
  roundRect(ctx, 16, 12, 208, 208, 28);
  const g = ctx.createRadialGradient(120, 100, 10, 120, 120, 150);
  g.addColorStop(0, inner);
  g.addColorStop(1, '#070204');
  ctx.fillStyle = g;
  ctx.fill();
  glow(ctx, rim, 14, () => {
    roundRect(ctx, 16, 12, 208, 208, 28);
    ctx.lineWidth = 5;
    ctx.strokeStyle = rim;
    ctx.stroke();
  });
  roundRect(ctx, 24, 20, 192, 192, 22);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
}

function drawCandle(ctx: Ctx) {
  plate(ctx, '#e8892a', '#3b1606');
  // halo
  const halo = ctx.createRadialGradient(120, 72, 4, 120, 72, 90);
  halo.addColorStop(0, 'rgba(255,190,90,0.65)');
  halo.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(20, 0, 200, 200);
  // holder dish
  ctx.beginPath();
  ctx.ellipse(120, 196, 64, 14, 0, 0, Math.PI * 2);
  const dish = ctx.createLinearGradient(56, 0, 184, 0);
  dish.addColorStop(0, '#3d2a0c');
  dish.addColorStop(0.4, '#c9973e');
  dish.addColorStop(1, '#3d2a0c');
  ctx.fillStyle = dish;
  ctx.fill();
  // body
  const body = ctx.createLinearGradient(90, 0, 150, 0);
  body.addColorStop(0, '#000');
  body.addColorStop(0.3, '#3b3540');
  body.addColorStop(0.55, '#121014');
  body.addColorStop(1, '#000');
  ctx.fillStyle = body;
  roundRect(ctx, 92, 100, 56, 96, 6);
  ctx.fill();
  // wax drips
  ctx.beginPath();
  ctx.ellipse(120, 102, 28, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2a2530';
  ctx.fill();
  ctx.fillStyle = '#1d1a21';
  for (const [x, len] of [[98, 34], [112, 18], [134, 46], [144, 22]] as const) {
    roundRect(ctx, x - 4, 100, 9, len, 4.5);
    ctx.fill();
  }
  // wick
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(120, 98);
  ctx.quadraticCurveTo(122, 90, 119, 84);
  ctx.stroke();
  // flame
  const flame = () => {
    ctx.beginPath();
    ctx.moveTo(120, 22);
    ctx.bezierCurveTo(142, 50, 140, 80, 120, 88);
    ctx.bezierCurveTo(100, 80, 98, 50, 120, 22);
  };
  glow(ctx, '#ffae42', 40, () => {
    flame();
    const f = ctx.createRadialGradient(120, 72, 2, 120, 62, 40);
    f.addColorStop(0, '#ffffff');
    f.addColorStop(0.3, '#fff1a8');
    f.addColorStop(0.7, '#ff9a1f');
    f.addColorStop(1, '#c2300a');
    ctx.fillStyle = f;
    ctx.fill();
  });
  ctx.beginPath();
  ctx.ellipse(120, 74, 6, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(80,140,255,0.55)';
  ctx.fill();
}

function drawDagger(ctx: Ctx) {
  plate(ctx, '#8fb3d9', '#101a2c');
  ctx.save();
  ctx.translate(120, 118);
  ctx.rotate(-Math.PI / 4);
  ctx.translate(-120, -120);
  // blade
  glow(ctx, 'rgba(160,200,255,0.8)', 16, () => {
    ctx.beginPath();
    ctx.moveTo(120, 14);
    ctx.lineTo(140, 52);
    ctx.lineTo(136, 146);
    ctx.lineTo(104, 146);
    ctx.lineTo(100, 52);
    ctx.closePath();
    const b = ctx.createLinearGradient(100, 0, 140, 0);
    b.addColorStop(0, '#5b6675');
    b.addColorStop(0.45, '#f4f8ff');
    b.addColorStop(0.55, '#aab4c3');
    b.addColorStop(1, '#39414c');
    ctx.fillStyle = b;
    ctx.fill();
  });
  ctx.strokeStyle = 'rgba(40,50,60,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(120, 40);
  ctx.lineTo(120, 140);
  ctx.stroke();
  // blood on the tip
  ctx.fillStyle = '#9c0612';
  ctx.beginPath();
  ctx.moveTo(120, 14);
  ctx.lineTo(136, 46);
  ctx.quadraticCurveTo(128, 60, 124, 52);
  ctx.quadraticCurveTo(118, 70, 112, 50);
  ctx.quadraticCurveTo(106, 58, 103, 46);
  ctx.closePath();
  ctx.fill();
  // crossguard
  const gold = ctx.createLinearGradient(0, 142, 0, 162);
  gold.addColorStop(0, '#ffe08a');
  gold.addColorStop(0.5, '#b07a1e');
  gold.addColorStop(1, '#5a3a0c');
  ctx.fillStyle = gold;
  roundRect(ctx, 66, 144, 108, 16, 8);
  ctx.fill();
  for (const x of [66, 174]) {
    ctx.beginPath();
    ctx.arc(x, 146, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  // grip
  ctx.fillStyle = '#2a1209';
  roundRect(ctx, 107, 160, 26, 50, 6);
  ctx.fill();
  ctx.strokeStyle = '#6b3a1c';
  ctx.lineWidth = 3;
  for (let y = 166; y < 208; y += 8) {
    ctx.beginPath();
    ctx.moveTo(107, y);
    ctx.lineTo(133, y + 5);
    ctx.stroke();
  }
  // pommel + gem
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(120, 216, 14, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, '#ff2040', 12, () => {
    ctx.fillStyle = '#e0102c';
    ctx.beginPath();
    ctx.arc(120, 216, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawChalice(ctx: Ctx) {
  plate(ctx, '#f2c14e', '#2e1a05');
  const gold = ctx.createLinearGradient(56, 0, 184, 0);
  gold.addColorStop(0, '#4a2f08');
  gold.addColorStop(0.3, '#f6d27a');
  gold.addColorStop(0.5, '#fff4c8');
  gold.addColorStop(0.7, '#b8801f');
  gold.addColorStop(1, '#3a2406');
  // base
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.ellipse(120, 196, 52, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(108, 190);
  ctx.lineTo(112, 136);
  ctx.lineTo(128, 136);
  ctx.lineTo(132, 190);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(120, 150, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // bowl
  glow(ctx, 'rgba(255,200,90,0.6)', 18, () => {
    ctx.beginPath();
    ctx.moveTo(58, 62);
    ctx.bezierCurveTo(58, 120, 90, 140, 120, 140);
    ctx.bezierCurveTo(150, 140, 182, 120, 182, 62);
    ctx.closePath();
    ctx.fillStyle = gold;
    ctx.fill();
  });
  // rim + blood surface
  ctx.beginPath();
  ctx.ellipse(120, 62, 62, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(120, 63, 54, 10, 0, 0, Math.PI * 2);
  const blood = ctx.createRadialGradient(110, 60, 2, 120, 63, 54);
  blood.addColorStop(0, '#ff3346');
  blood.addColorStop(0.5, '#8d0010');
  blood.addColorStop(1, '#3d0006');
  ctx.fillStyle = blood;
  ctx.fill();
  // drips down the bowl
  ctx.fillStyle = '#9a0412';
  for (const [x, len] of [[74, 30], [92, 50], [150, 38], [168, 22]] as const) {
    ctx.beginPath();
    ctx.moveTo(x - 6, 66);
    ctx.lineTo(x + 6, 66);
    ctx.lineTo(x + 4, 66 + len);
    ctx.arc(x, 66 + len, 5, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  // gem
  glow(ctx, '#ff2040', 14, () => {
    ctx.beginPath();
    ctx.moveTo(120, 92);
    ctx.lineTo(134, 108);
    ctx.lineTo(120, 124);
    ctx.lineTo(106, 108);
    ctx.closePath();
    ctx.fillStyle = '#d1102a';
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(120, 96);
  ctx.lineTo(127, 106);
  ctx.lineTo(120, 106);
  ctx.closePath();
  ctx.fill();
}

function drawCultist(ctx: Ctx) {
  plate(ctx, '#ff2b3a', '#3a0309');
  // hood
  const hood = ctx.createLinearGradient(0, 20, 0, 220);
  hood.addColorStop(0, '#a3101f');
  hood.addColorStop(0.6, '#5a0610');
  hood.addColorStop(1, '#1c0105');
  ctx.beginPath();
  ctx.moveTo(120, 18);
  ctx.bezierCurveTo(176, 30, 198, 110, 214, 218);
  ctx.lineTo(26, 218);
  ctx.bezierCurveTo(42, 110, 64, 30, 120, 18);
  ctx.closePath();
  ctx.fillStyle = hood;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  for (const x of [70, 170]) {
    ctx.beginPath();
    ctx.moveTo(120, 30);
    ctx.quadraticCurveTo(x, 120, x + (x < 120 ? -20 : 20), 214);
    ctx.stroke();
  }
  // face hollow
  ctx.beginPath();
  ctx.ellipse(120, 118, 54, 66, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#050003';
  ctx.fill();
  // mask
  const mask = ctx.createRadialGradient(108, 96, 6, 120, 120, 70);
  mask.addColorStop(0, '#fffaf0');
  mask.addColorStop(0.6, '#cfc3ac');
  mask.addColorStop(1, '#5e5546');
  ctx.beginPath();
  ctx.moveTo(120, 66);
  ctx.bezierCurveTo(160, 66, 162, 120, 150, 150);
  ctx.bezierCurveTo(140, 176, 100, 176, 90, 150);
  ctx.bezierCurveTo(78, 120, 80, 66, 120, 66);
  ctx.closePath();
  ctx.fillStyle = mask;
  ctx.fill();
  // eye slits
  for (const dir of [-1, 1]) {
    const ex = 120 + dir * 19;
    ctx.beginPath();
    ctx.moveTo(ex - 15, 108);
    ctx.quadraticCurveTo(ex, 96 - dir * 0, ex + 15, 108);
    ctx.quadraticCurveTo(ex, 116, ex - 15, 108);
    ctx.fillStyle = '#0a0002';
    ctx.fill();
    glow(ctx, '#ff1a1a', 18, () => {
      ctx.beginPath();
      ctx.arc(ex, 107, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3b2b';
      ctx.fill();
    });
  }
  // stitched mouth
  ctx.strokeStyle = '#2a1b12';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(104, 146);
  ctx.quadraticCurveTo(120, 152, 136, 146);
  ctx.stroke();
  for (let x = 106; x <= 134; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, 142);
    ctx.lineTo(x, 153);
    ctx.stroke();
  }
  // forehead sigil
  ctx.strokeStyle = '#8d0010';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(120, 84, 8, 0, Math.PI * 2);
  ctx.moveTo(120, 72);
  ctx.lineTo(120, 96);
  ctx.stroke();
}

function drawWild(ctx: Ctx) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(120, 104, 98, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.filter = 'blur(8px)';
  ctx.fill();
  ctx.restore();
  const bg = ctx.createRadialGradient(120, 104, 10, 120, 104, 96);
  bg.addColorStop(0, '#5a1260');
  bg.addColorStop(0.7, '#1e0624');
  bg.addColorStop(1, '#09020b');
  ctx.beginPath();
  ctx.arc(120, 104, 94, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  // rune ring
  glow(ctx, '#ff4dd2', 12, () => {
    ctx.strokeStyle = '#e66bff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(120, 104, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(120, 104, 74, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r1 = 76, r2 = i % 3 === 0 ? 87 : 82;
      ctx.beginPath();
      ctx.moveTo(120 + Math.cos(a) * r1, 104 + Math.sin(a) * r1);
      ctx.lineTo(120 + Math.cos(a) * r2, 104 + Math.sin(a) * r2);
      ctx.stroke();
    }
  });
  // triangle
  ctx.strokeStyle = 'rgba(255,200,120,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const x = 120 + Math.cos(a) * 70, y = 104 + Math.sin(a) * 70;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  // eye
  const eye = () => {
    ctx.beginPath();
    ctx.moveTo(52, 108);
    ctx.quadraticCurveTo(120, 40, 188, 108);
    ctx.quadraticCurveTo(120, 170, 52, 108);
    ctx.closePath();
  };
  glow(ctx, '#ff5a2b', 26, () => {
    eye();
    const w = ctx.createRadialGradient(120, 108, 10, 120, 108, 70);
    w.addColorStop(0, '#fff8ec');
    w.addColorStop(1, '#c9a98f');
    ctx.fillStyle = w;
    ctx.fill();
  });
  ctx.save();
  eye();
  ctx.clip();
  ctx.strokeStyle = 'rgba(180,20,30,0.55)';
  ctx.lineWidth = 1.6;
  const rnd = seeded(77);
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    let x = 120 + side * 70, y = 90 + rnd() * 36;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) ctx.lineTo((x -= side * (8 + rnd() * 6)), (y += (rnd() - 0.5) * 10));
    ctx.stroke();
  }
  const iris = ctx.createRadialGradient(120, 108, 4, 120, 108, 34);
  iris.addColorStop(0, '#ffe066');
  iris.addColorStop(0.45, '#ff7b00');
  iris.addColorStop(0.85, '#8a0a0a');
  iris.addColorStop(1, '#250000');
  ctx.beginPath();
  ctx.arc(120, 108, 34, 0, Math.PI * 2);
  ctx.fillStyle = iris;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(120, 108, 7, 27, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#050000';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(108, 96, 7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.restore();
  eye();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1a0408';
  ctx.stroke();
  banner(ctx, 'WILD', 204, '#f2b134', '#ff4dd2');
}

function drawScatter(ctx: Ctx) {
  // eldritch aura
  const aura = ctx.createRadialGradient(120, 104, 20, 120, 104, 118);
  aura.addColorStop(0, 'rgba(120,255,140,0.55)');
  aura.addColorStop(1, 'rgba(40,120,60,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, 240, 240);
  ctx.save();
  ctx.translate(120, 104);
  ctx.rotate(-0.08);
  // pages
  ctx.fillStyle = '#d9c9a3';
  roundRect(ctx, -66, -78, 142, 160, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,70,40,0.6)';
  ctx.lineWidth = 1.5;
  for (let y = -72; y < 78; y += 5) {
    ctx.beginPath();
    ctx.moveTo(66, y);
    ctx.lineTo(75, y);
    ctx.stroke();
  }
  // cover
  const cover = ctx.createLinearGradient(-70, -80, 70, 80);
  cover.addColorStop(0, '#5c1a12');
  cover.addColorStop(0.5, '#2c0a07');
  cover.addColorStop(1, '#120302');
  glow(ctx, 'rgba(0,0,0,0.8)', 10, () => {
    roundRect(ctx, -74, -84, 140, 164, 10);
    ctx.fillStyle = cover;
    ctx.fill();
  });
  // leather grain
  const rnd = seeded(5);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.2})`;
    ctx.fillRect(-70 + rnd() * 132, -80 + rnd() * 156, 2, 2);
  }
  // spine
  ctx.fillStyle = '#1a0503';
  ctx.fillRect(-74, -84, 18, 164);
  // gold corners
  ctx.fillStyle = '#c99a3c';
  for (const [x, y, sx, sy] of [[-56, -84, 1, 1], [66, -84, -1, 1], [-56, 80, 1, -1], [66, 80, -1, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sx * 24, y);
    ctx.lineTo(x, y + sy * 24);
    ctx.closePath();
    ctx.fill();
  }
  // glowing sigil
  glow(ctx, '#7dff8a', 22, () => {
    ctx.strokeStyle = '#b6ffb8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(5, -2, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
      const x = 5 + Math.cos(a) * 42, y = -2 + Math.sin(a) * 42;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5, -2, 10, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(5 + Math.cos(a) * 42, -2 + Math.sin(a) * 42, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#d4ffd6';
      ctx.fill();
    }
  });
  ctx.restore();
  banner(ctx, 'BONUS', 206, '#9dff9f', '#3bff6a');
}

const DRAWERS: ((ctx: Ctx) => void)[] = [
  (c) => drawRune(c, 0), (c) => drawRune(c, 1), (c) => drawRune(c, 2), (c) => drawRune(c, 3),
  drawCandle, drawDagger, drawChalice, drawCultist, drawWild, drawScatter,
];

export function symbolCanvas(sym: number): HTMLCanvasElement {
  const [c, ctx] = canvas(SYMBOL_PX, SYMBOL_PX);
  DRAWERS[sym](ctx);
  return c;
}

export interface Art {
  symbols: Texture[];
  /** Data URLs for the HTML paytable. */
  symbolUrls: string[];
  background: Texture;
  frame: Texture;
  moon: Texture;
  orb: Texture;
  candleLit: Texture;
  candleUnlit: Texture;
  flame: Texture;
  glow: Texture;
  ember: Texture;
  fog: Texture;
}

function drawBackground(): HTMLCanvasElement {
  const W = 1280, H = 720;
  const [c, ctx] = canvas(W, H);
  const rnd = seeded(2024);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1a050b');
  sky.addColorStop(0.5, '#0e0306');
  sky.addColorStop(1, '#030102');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // stone blocks
  for (let row = 0; row < 18; row++) {
    const h = 42;
    const off = row % 2 ? 0 : 50;
    for (let x = -100 + off; x < W; x += 100) {
      const shade = 10 + rnd() * 14;
      ctx.fillStyle = `rgba(${shade + 18},${shade},${shade + 4},0.55)`;
      ctx.fillRect(x + 2, row * h + 2, 96, h - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 2, row * h + h - 6, 96, 4);
    }
  }
  // central red glow behind the grid
  const glowG = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 560);
  glowG.addColorStop(0, 'rgba(170,20,30,0.45)');
  glowG.addColorStop(0.5, 'rgba(90,5,15,0.25)');
  glowG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowG;
  ctx.fillRect(0, 0, W, H);
  // gothic arches on the sides
  for (const x of [170, 1110]) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.moveTo(x - 120, H);
    ctx.lineTo(x - 120, 260);
    ctx.quadraticCurveTo(x - 120, 120, x, 60);
    ctx.quadraticCurveTo(x + 120, 120, x + 120, 260);
    ctx.lineTo(x + 120, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,40,50,0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // floor candles silhouettes
  for (let i = 0; i < 14; i++) {
    const x = i < 7 ? 20 + i * 42 : W - 20 - (i - 7) * 42;
    const h = 30 + rnd() * 60;
    ctx.fillStyle = '#050102';
    ctx.fillRect(x - 7, H - h, 14, h);
    const f = ctx.createRadialGradient(x, H - h - 10, 1, x, H - h - 10, 30);
    f.addColorStop(0, 'rgba(255,200,120,0.9)');
    f.addColorStop(0.2, 'rgba(255,120,40,0.35)');
    f.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = f;
    ctx.fillRect(x - 30, H - h - 40, 60, 60);
  }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 820);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return c;
}

export const GRID_PX = 580; // 5 cells * 116

function drawFrame(): HTMLCanvasElement {
  const pad = 26, S = GRID_PX + pad * 2;
  const [c, ctx] = canvas(S, S);
  // outer iron frame
  roundRect(ctx, 4, 4, S - 8, S - 8, 22);
  const iron = ctx.createLinearGradient(0, 0, S, S);
  iron.addColorStop(0, '#3a3236');
  iron.addColorStop(0.5, '#171214');
  iron.addColorStop(1, '#2d2427');
  ctx.fillStyle = iron;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#5c4a3a';
  ctx.stroke();
  // inner window
  ctx.save();
  roundRect(ctx, pad, pad, GRID_PX, GRID_PX, 10);
  ctx.clip();
  ctx.clearRect(0, 0, S, S);
  const inner = ctx.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, 420);
  inner.addColorStop(0, 'rgba(40,6,12,0.82)');
  inner.addColorStop(1, 'rgba(6,1,3,0.92)');
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,60,70,0.07)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(pad + i * 116, pad);
    ctx.lineTo(pad + i * 116, pad + GRID_PX);
    ctx.stroke();
  }
  ctx.restore();
  glow(ctx, '#ff2233', 18, () => {
    roundRect(ctx, pad - 2, pad - 2, GRID_PX + 4, GRID_PX + 4, 11);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#9e1424';
    ctx.stroke();
  });
  // rivets
  for (let i = 0; i <= 10; i++) {
    const t = 30 + (i * (S - 60)) / 10;
    for (const [x, y] of [[t, 13], [t, S - 13], [13, t], [S - 13, t]]) {
      const g = ctx.createRadialGradient(x - 2, y - 2, 0.5, x, y, 5);
      g.addColorStop(0, '#c9b19a');
      g.addColorStop(1, '#2a1f1a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // corner sigils
  for (const [x, y] of [[pad, pad], [S - pad, pad], [pad, S - pad], [S - pad, S - pad]]) {
    glow(ctx, '#ff3344', 10, () => {
      ctx.strokeStyle = '#c21a2c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    });
  }
  return c;
}

function drawMoon(): HTMLCanvasElement {
  const [c, ctx] = canvas(520, 520);
  const halo = ctx.createRadialGradient(260, 260, 120, 260, 260, 260);
  halo.addColorStop(0, 'rgba(255,40,40,0.55)');
  halo.addColorStop(1, 'rgba(120,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 520, 520);
  const body = ctx.createRadialGradient(220, 220, 20, 260, 260, 150);
  body.addColorStop(0, '#ff6a4a');
  body.addColorStop(0.6, '#b3121c');
  body.addColorStop(1, '#4a0308');
  ctx.beginPath();
  ctx.arc(260, 260, 150, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  const rnd = seeded(31);
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 120;
    ctx.beginPath();
    ctx.arc(260 + Math.cos(a) * r, 260 + Math.sin(a) * r, 6 + rnd() * 20, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(60,0,5,${0.15 + rnd() * 0.25})`;
    ctx.fill();
  }
  return c;
}

function drawOrb(): HTMLCanvasElement {
  const [c, ctx] = canvas(200, 200);
  const halo = ctx.createRadialGradient(100, 100, 50, 100, 100, 100);
  halo.addColorStop(0, 'rgba(255,40,40,0.7)');
  halo.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 200, 200);
  const g = ctx.createRadialGradient(80, 76, 4, 100, 100, 64);
  g.addColorStop(0, '#ffd2c2');
  g.addColorStop(0.25, '#ff4a3a');
  g.addColorStop(0.75, '#8a0010');
  g.addColorStop(1, '#2a0004');
  ctx.beginPath();
  ctx.arc(100, 100, 62, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  glow(ctx, '#ffcc66', 10, () => {
    ctx.strokeStyle = 'rgba(255,210,120,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(100, 100, 52, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(100 + Math.cos(a) * 52, 100 + Math.sin(a) * 52);
      ctx.lineTo(100 + Math.cos(a) * 60, 100 + Math.sin(a) * 60);
      ctx.stroke();
    }
  });
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2a0004';
  ctx.beginPath();
  ctx.arc(100, 100, 62, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

function drawMeterCandle(lit: boolean): HTMLCanvasElement {
  const [c, ctx] = canvas(60, 120);
  const body = ctx.createLinearGradient(18, 0, 42, 0);
  body.addColorStop(0, lit ? '#3a0a10' : '#2a2226');
  body.addColorStop(0.4, lit ? '#b22234' : '#6a5c62');
  body.addColorStop(1, lit ? '#2a050a' : '#1a1416');
  ctx.fillStyle = body;
  roundRect(ctx, 18, 52, 24, 64, 4);
  ctx.fill();
  ctx.fillStyle = lit ? '#d8364a' : '#7a6a70';
  ctx.beginPath();
  ctx.ellipse(30, 53, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(30, 52);
  ctx.lineTo(30, 44);
  ctx.stroke();
  return c;
}

function drawFlame(): HTMLCanvasElement {
  const [c, ctx] = canvas(80, 120);
  const halo = ctx.createRadialGradient(40, 70, 2, 40, 70, 40);
  halo.addColorStop(0, 'rgba(255,170,60,0.7)');
  halo.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 80, 120);
  ctx.beginPath();
  ctx.moveTo(40, 30);
  ctx.bezierCurveTo(56, 56, 54, 80, 40, 88);
  ctx.bezierCurveTo(26, 80, 24, 56, 40, 30);
  const f = ctx.createRadialGradient(40, 76, 1, 40, 66, 28);
  f.addColorStop(0, '#ffffff');
  f.addColorStop(0.35, '#fff0a0');
  f.addColorStop(0.75, '#ff8c1a');
  f.addColorStop(1, '#b8260a');
  ctx.fillStyle = f;
  ctx.fill();
  return c;
}

function radial(size: number, stops: [number, string][]): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function drawFog(): HTMLCanvasElement {
  const [c, ctx] = canvas(1024, 256);
  const rnd = seeded(404);
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 1024, y = 80 + rnd() * 120, r = 40 + rnd() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120,60,70,0.10)');
    g.addColorStop(1, 'rgba(120,60,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

export async function loadFonts(): Promise<void> {
  const fonts = ['900 40px Cinzel', '700 40px Cinzel', '700 40px Oswald', '500 40px Oswald'];
  try {
    await Promise.race([
      Promise.all(fonts.map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    // offline: fall back to serif / sans
  }
}

export function createArt(): Art {
  const symbolCanvases = Array.from({ length: SYMBOL_COUNT }, (_, i) => symbolCanvas(i));
  return {
    symbols: symbolCanvases.map((c) => Texture.from(c)),
    symbolUrls: symbolCanvases.map((c) => c.toDataURL()),
    background: Texture.from(drawBackground()),
    frame: Texture.from(drawFrame()),
    moon: Texture.from(drawMoon()),
    orb: Texture.from(drawOrb()),
    candleLit: Texture.from(drawMeterCandle(true)),
    candleUnlit: Texture.from(drawMeterCandle(false)),
    flame: Texture.from(drawFlame()),
    glow: Texture.from(radial(128, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']])),
    ember: Texture.from(radial(32, [[0, 'rgba(255,230,180,1)'], [0.3, 'rgba(255,120,40,0.8)'], [1, 'rgba(255,60,20,0)']])),
    fog: Texture.from(drawFog()),
  };
}

export const SYMBOL_ORDER_FOR_PAYTABLE = [Sym.H4, Sym.H3, Sym.H2, Sym.H1, Sym.L4, Sym.L3, Sym.L2, Sym.L1];
