// The open-world hub: a top-down neon city that Kilo drives around.
// Districts light up as they are restored. Pure canvas, no React.

export type GateId = 'docks' | 'loops' | 'spires' | 'arcade' | 'workshop';

export interface GateInfo {
  id: GateId;
  name: string;
  color: string;
  x: number;
  y: number;
  /** 0..1 how much of the district is restored. */
  lit: number;
  locked: boolean;
  beacon: boolean;
}

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  zone: GateId;
  seed: number;
}

export const WORLD = { w: 2400, h: 1500 };

const ROADS = [
  // main avenues
  { x: 0, y: 700, w: 2400, h: 110 },
  { x: 1145, y: 0, w: 110, h: 1500 },
  // side streets
  { x: 0, y: 330, w: 2400, h: 60 },
  { x: 0, y: 1120, w: 2400, h: 60 },
  { x: 520, y: 0, w: 60, h: 1500 },
  { x: 1820, y: 0, w: 60, h: 1500 },
];

export const GATES: Omit<GateInfo, 'lit' | 'locked' | 'beacon'>[] = [
  { id: 'docks', name: 'The Docks', color: '#3FE3D1', x: 550, y: 1150 },
  { id: 'loops', name: 'Loop Line', color: '#FF5FD2', x: 550, y: 360 },
  { id: 'spires', name: 'Signal Spires', color: '#FFBC3D', x: 1850, y: 360 },
  { id: 'arcade', name: 'The Arcade', color: '#9BFF5A', x: 1850, y: 1150 },
  { id: 'workshop', name: 'The Workshop', color: '#C9B6FF', x: 1200, y: 755 },
];

function zoneOf(x: number, y: number): GateId {
  const cx = 1200;
  const cy = 755;
  if (Math.hypot(x - cx, y - cy) < 330) return 'workshop';
  if (x < cx) return y < cy ? 'loops' : 'docks';
  return y < cy ? 'spires' : 'arcade';
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad = 0) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

function makeBuildings(): Building[] {
  const r = rng(42);
  const out: Building[] = [];
  const plazas = GATES.map((g) => ({ x: g.x - 170, y: g.y - 150, w: 340, h: 300 }));
  for (let i = 0; i < 900 && out.length < 120; i++) {
    const w = 70 + r() * 110;
    const h = 60 + r() * 100;
    const x = 40 + r() * (WORLD.w - 80 - w);
    const y = 40 + r() * (WORLD.h - 80 - h);
    const b = { x, y, w, h };
    if (ROADS.some((rd) => overlaps(b, rd, 18))) continue;
    if (plazas.some((p) => overlaps(b, p, 10))) continue;
    if (out.some((o) => overlaps(b, o, 22))) continue;
    const zone = zoneOf(x + w / 2, y + h / 2);
    out.push({ ...b, z: zone === 'spires' ? 30 + r() * 40 : 14 + r() * 22, zone, seed: Math.floor(r() * 1e6) });
  }
  return out;
}

export class CityWorld {
  private ctx: CanvasRenderingContext2D;
  private buildings = makeBuildings();
  private W = 0;
  private H = 0;
  bot = { x: 1200, y: 960, vx: 0, vy: 0, dir: 0 };
  private keys = new Set<string>();
  private target: { x: number; y: number; gate: GateId | null } | null = null;
  gates: GateInfo[] = [];
  cam = { x: 0, y: 0 };
  private sparks: { t: number; road: number; speed: number; off: number }[] = [];
  near: GateId | null = null;
  onNear: (g: GateId | null) => void = () => undefined;
  onArrive: (g: GateId) => void = () => undefined;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    const r = rng(7);
    for (let i = 0; i < 46; i++) this.sparks.push({ t: r(), road: Math.floor(r() * ROADS.length), speed: 0.02 + r() * 0.05, off: r() });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = rect.width;
    this.H = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  key(k: string, down: boolean) {
    if (down) {
      this.keys.add(k);
      this.target = null;
    } else this.keys.delete(k);
  }

  clearKeys() {
    this.keys.clear();
  }

  /** Click on the canvas: walk there, or to a gate. */
  click(sx: number, sy: number) {
    const wx = sx + this.cam.x;
    const wy = sy + this.cam.y;
    const g = this.gates.find((q) => Math.hypot(q.x - wx, q.y - wy) < 80);
    this.target = g ? { x: g.x, y: g.y + 50, gate: g.id } : { x: wx, y: wy, gate: null };
  }

  travelTo(id: GateId) {
    const g = this.gates.find((q) => q.id === id);
    if (g) this.target = { x: g.x, y: g.y + 50, gate: g.id };
  }

  private blocked(x: number, y: number) {
    const r = 15;
    if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
    return this.buildings.some((b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h);
  }

  update(dt: number) {
    const b = this.bot;
    let ax = 0;
    let ay = 0;
    if (this.keys.has('left')) ax -= 1;
    if (this.keys.has('right')) ax += 1;
    if (this.keys.has('up')) ay -= 1;
    if (this.keys.has('down')) ay += 1;
    if (this.target) {
      const dx = this.target.x - b.x;
      const dy = this.target.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        const gate = this.target.gate;
        this.target = null;
        if (gate) this.onArrive(gate);
      } else {
        ax = dx / d;
        ay = dy / d;
      }
    }
    const len = Math.hypot(ax, ay) || 1;
    const speed = 300;
    const tvx = (ax / len) * speed;
    const tvy = (ay / len) * speed;
    b.vx += (tvx - b.vx) * Math.min(1, dt * 10);
    b.vy += (tvy - b.vy) * Math.min(1, dt * 10);
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    let moved = false;
    if (!this.blocked(nx, b.y)) {
      b.x = nx;
      moved = true;
    } else b.vx = 0;
    if (!this.blocked(b.x, ny)) {
      b.y = ny;
      moved = true;
    } else b.vy = 0;
    if (this.target && !moved) this.target = null;
    if (Math.hypot(b.vx, b.vy) > 20) b.dir = Math.atan2(b.vy, b.vx);

    const near = this.gates.find((g) => Math.hypot(g.x - b.x, g.y - b.y) < 110)?.id ?? null;
    if (near !== this.near) {
      this.near = near;
      this.onNear(near);
    }

    this.cam.x = Math.max(0, Math.min(WORLD.w - this.W, b.x - this.W / 2));
    this.cam.y = Math.max(0, Math.min(WORLD.h - this.H, b.y - this.H / 2));
    if (this.W > WORLD.w) this.cam.x = (WORLD.w - this.W) / 2;
    if (this.H > WORLD.h) this.cam.y = (WORLD.h - this.H) / 2;
    for (const s of this.sparks) s.t = (s.t + s.speed * dt) % 1;
  }

  private gate(id: GateId) {
    return this.gates.find((g) => g.id === id);
  }

  private alpha(hex: string, a: number) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  draw(now: number) {
    const { ctx, W, H } = this;
    ctx.save();
    ctx.fillStyle = '#070a11';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    // ground grid
    ctx.strokeStyle = 'rgba(80, 110, 170, 0.08)';
    ctx.lineWidth = 1;
    const x0 = Math.floor(this.cam.x / 60) * 60;
    const y0 = Math.floor(this.cam.y / 60) * 60;
    ctx.beginPath();
    for (let x = x0; x < this.cam.x + W + 60; x += 60) {
      ctx.moveTo(x, this.cam.y);
      ctx.lineTo(x, this.cam.y + H);
    }
    for (let y = y0; y < this.cam.y + H + 60; y += 60) {
      ctx.moveTo(this.cam.x, y);
      ctx.lineTo(this.cam.x + W, y);
    }
    ctx.stroke();

    // water along the Docks edge
    const docks = this.gate('docks');
    ctx.fillStyle = '#06131c';
    ctx.fillRect(0, 1380, 1140, 120);
    ctx.strokeStyle = this.alpha('#3FE3D1', docks && docks.lit > 0 ? 0.35 : 0.08);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      for (let x = 0; x <= 1140; x += 20) ctx.lineTo(x, 1400 + i * 16 + Math.sin(now / 700 + x / 60 + i) * 3);
      ctx.stroke();
    }

    // roads
    for (const r of ROADS) {
      ctx.fillStyle = '#0f1420';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(151, 161, 180, 0.18)';
      ctx.setLineDash([18, 16]);
      ctx.beginPath();
      if (r.w > r.h) {
        ctx.moveTo(r.x, r.y + r.h / 2);
        ctx.lineTo(r.x + r.w, r.y + r.h / 2);
      } else {
        ctx.moveTo(r.x + r.w / 2, r.y);
        ctx.lineTo(r.x + r.w / 2, r.y + r.h);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // data sparks travelling the roads, coloured by the zone they pass through
    for (const s of this.sparks) {
      const r = ROADS[s.road];
      const horiz = r.w > r.h;
      const x = horiz ? r.x + s.t * r.w : r.x + r.w * (0.25 + s.off * 0.5);
      const y = horiz ? r.y + r.h * (0.25 + s.off * 0.5) : r.y + s.t * r.h;
      const g = this.gate(zoneOf(x, y));
      if (!g || g.lit === 0) continue;
      ctx.fillStyle = g.color;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(x - 3, y - 1.5, horiz ? 14 : 3, horiz ? 3 : 14);
    }
    ctx.shadowBlur = 0;

    // plazas + gates
    for (const g of this.gates) this.drawGate(g, now);

    // buildings: sort by y for overlap
    const sorted = [...this.buildings].sort((a, b) => a.y + a.h - (b.y + b.h));
    for (const b of sorted) {
      if (b.x > this.cam.x + W + 50 || b.x + b.w < this.cam.x - 50 || b.y > this.cam.y + H + 80 || b.y + b.h < this.cam.y - 80) continue;
      this.drawBuilding(b, now);
    }

    // glitch fog on locked districts
    for (const g of this.gates) {
      if (!g.locked) continue;
      const seed = Math.floor(now / 120);
      for (let i = 0; i < 18; i++) {
        const a = rng(seed * 31 + i + g.x)();
        const bx = g.x + (rng(i * 13 + g.y)() - 0.5) * 700;
        const by = g.y + (rng(i * 7 + g.x)() - 0.5) * 520;
        ctx.fillStyle = `rgba(255, 59, 107, ${0.05 + a * 0.08})`;
        ctx.fillRect(bx, by, 40 + a * 120, 3 + a * 6);
      }
    }

    this.drawBot(now);
    ctx.restore();
    this.drawMinimap();
  }

  private drawGate(g: GateInfo, now: number) {
    const { ctx } = this;
    const col = g.locked ? '#4a5266' : g.color;
    ctx.save();
    // plaza
    ctx.fillStyle = this.alpha(col, g.locked ? 0.04 : 0.07);
    ctx.beginPath();
    ctx.arc(g.x, g.y, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.alpha(col, 0.5);
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = now / 60;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // portal ring
    ctx.shadowColor = col;
    ctx.shadowBlur = g.locked ? 0 : 24;
    ctx.lineWidth = 6;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 44, 0, Math.PI * 2);
    ctx.stroke();
    // progress arc
    if (g.lit > 0) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 56, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.lit);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.alpha(col, 0.25 + 0.1 * Math.sin(now / 400));
    ctx.beginPath();
    ctx.arc(g.x, g.y, 38, 0, Math.PI * 2);
    ctx.fill();
    // beacon beam for the next place to go
    if (g.beacon) {
      const grad = ctx.createLinearGradient(g.x, g.y - 260, g.x, g.y);
      grad.addColorStop(0, this.alpha(g.color, 0));
      grad.addColorStop(1, this.alpha(g.color, 0.35 + 0.15 * Math.sin(now / 300)));
      ctx.fillStyle = grad;
      ctx.fillRect(g.x - 14, g.y - 260, 28, 260);
    }
    // label
    ctx.font = '400 20px "Saira Stencil One", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = g.locked ? '#6b7489' : '#ffffff';
    ctx.fillText(g.name.toUpperCase(), g.x, g.y - 72);
    ctx.font = '700 13px "IBM Plex Mono", monospace';
    ctx.fillStyle = col;
    ctx.fillText(g.locked ? 'LOCKED' : g.id === 'workshop' ? 'BUILD YOUR OWN' : `${Math.round(g.lit * 100)}% POWER`, g.x, g.y + 84);
    ctx.restore();
  }

  private drawBuilding(b: Building, now: number) {
    const { ctx } = this;
    const g = this.gate(b.zone)!;
    const lit = g && !g.locked && g.lit > 0;
    const col = g?.color ?? '#97A1B4';
    // south face (extrusion)
    ctx.fillStyle = lit ? '#141b2b' : '#0d111b';
    ctx.fillRect(b.x, b.y + b.h - 2, b.w, b.z);
    // roof
    ctx.fillStyle = lit ? '#1c2539' : '#121826';
    ctx.fillRect(b.x, b.y - 0, b.w, b.h);
    ctx.strokeStyle = lit ? this.alpha(col, 0.55) : 'rgba(120, 130, 150, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    // windows on the south face
    const r = rng(b.seed);
    const cols = Math.max(2, Math.floor(b.w / 16));
    const rows = Math.max(1, Math.floor(b.z / 10));
    const share = lit ? 0.35 + g.lit * 0.6 : 0.06;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const on = r() < share;
        const flick = !lit && on && Math.sin(now / 90 + b.seed + i) > 0.6;
        if (!on || flick) continue;
        ctx.fillStyle = lit ? this.alpha(col, 0.85) : 'rgba(255, 59, 107, 0.5)';
        ctx.fillRect(b.x + 6 + i * ((b.w - 12) / cols), b.y + b.h + 3 + j * 10, Math.max(3, (b.w - 12) / cols - 5), 4);
      }
    }
    // rooftop detail
    if (lit && b.seed % 3 === 0) {
      ctx.fillStyle = this.alpha(col, 0.6 + 0.4 * Math.sin(now / 500 + b.seed));
      ctx.beginPath();
      ctx.arc(b.x + b.w - 12, b.y + 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBot(now: number) {
    const { ctx } = this;
    const { x, y } = this.bot;
    const bob = Math.sin(now / 250) * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // headlight cone
    const d = this.bot.dir;
    const grad = ctx.createRadialGradient(x, y, 10, x, y, 140);
    grad.addColorStop(0, 'rgba(63, 227, 209, 0.25)');
    grad.addColorStop(1, 'rgba(63, 227, 209, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 140, d - 0.45, d + 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.translate(x, y + bob);
    const body = ctx.createLinearGradient(0, -16, 0, 16);
    body.addColorStop(0, '#f4f8ff');
    body.addColorStop(1, '#a9bad1');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-16, -16, 32, 32, 11);
    ctx.fill();
    ctx.strokeStyle = '#3FE3D1';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#0c1220';
    ctx.beginPath();
    ctx.roundRect(-12, -7, 24, 12, 6);
    ctx.fill();
    const ex = Math.cos(d) * 3;
    ctx.fillStyle = '#3FE3D1';
    ctx.shadowColor = '#3FE3D1';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(-5 + ex, -1, 2.2, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(5 + ex, -1, 2.2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, -24, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMinimap() {
    const { ctx, W } = this;
    const mw = 180;
    const mh = (mw * WORLD.h) / WORLD.w;
    const x = W - mw - 18;
    const y = 74;
    const s = mw / WORLD.w;
    ctx.save();
    ctx.fillStyle = 'rgba(14, 18, 26, 0.85)';
    ctx.strokeStyle = '#2B3345';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a2130';
    for (const r of ROADS) ctx.fillRect(x + r.x * s, y + r.y * s, Math.max(1, r.w * s), Math.max(1, r.h * s));
    for (const g of this.gates) {
      ctx.fillStyle = g.locked ? '#4a5266' : g.color;
      ctx.beginPath();
      ctx.arc(x + g.x * s, y + g.y * s, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + this.bot.x * s, y + this.bot.y * s, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(x + this.cam.x * s, y + this.cam.y * s, this.W * s, this.H * s);
    ctx.restore();
  }
}
