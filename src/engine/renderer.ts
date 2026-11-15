// Canvas renderer for a level: neon grid, Kilo, cells, glitches, effects.
// Stateless about rules. It draws a tween between two snapshots plus effects.

import { parseMap, type ParsedMap } from './sim';
import { DELTA, type Dir, type MapRows, type SimEvent, type Snapshot } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Effect {
  kind: 'zap' | 'look' | 'text' | 'ring' | 'flash';
  born: number;
  dur: number;
  x: number;
  y: number;
  tx?: number;
  ty?: number;
  hit?: boolean;
  text?: string;
  color: string;
}

export interface View {
  prev: Snapshot;
  cur: Snapshot;
  ev: SimEvent | null;
  /** 0..1 progress of the tween from prev to cur. */
  t: number;
}

const CELL = '#FFD34D';
const GLITCH = '#FF3B6B';
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class GridRenderer {
  private ctx: CanvasRenderingContext2D;
  private map!: ParsedMap;
  private rows!: MapRows;
  private tile = 40;
  private ox = 0;
  private oy = 0;
  private particles: Particle[] = [];
  private effects: Effect[] = [];
  private shake = 0;
  private wallEdge: boolean[] = [];
  private cssW = 0;
  private cssH = 0;
  accent: string;

  constructor(
    private canvas: HTMLCanvasElement,
    rows: MapRows,
    accent: string,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.accent = accent;
    this.setMap(rows);
  }

  setMap(rows: MapRows): void {
    this.rows = rows;
    this.map = parseMap(rows);
    const { w, h, walls } = this.map;
    this.wallEdge = walls.map((isWall, i) => {
      if (!isWall) return false;
      const x = i % w;
      const y = Math.floor(i / w);
      if ((rows[y][x] ?? ' ') === ' ') return false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && !walls[ny * w + nx]) return true;
        }
      return false;
    });
    this.particles = [];
    this.effects = [];
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = r.width;
    this.cssH = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 24;
    this.tile = Math.floor(Math.min((r.width - pad * 2) / this.map.w, (r.height - pad * 2) / this.map.h, 88));
    this.ox = Math.round((r.width - this.tile * this.map.w) / 2);
    this.oy = Math.round((r.height - this.tile * this.map.h) / 2);
  }

  /** Which tile is under a point in canvas CSS pixels, or null. */
  tileAt(px: number, py: number): { x: number; y: number } | null {
    const x = Math.floor((px - this.ox) / this.tile);
    const y = Math.floor((py - this.oy) / this.tile);
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return null;
    return { x, y };
  }

  /** Centre of a tile in CSS pixels. */
  private cx(x: number) {
    return this.ox + (x + 0.5) * this.tile;
  }
  private cy(y: number) {
    return this.oy + (y + 0.5) * this.tile;
  }

  /** Called once when a new frame starts playing, to spawn effects. */
  trigger(ev: SimEvent, state: Snapshot, now: number): void {
    const bx = state.bot.x;
    const by = state.bot.y;
    switch (ev.t) {
      case 'collect':
        this.burst(this.cx(ev.x), this.cy(ev.y), CELL, 22);
        this.effects.push({ kind: 'text', born: now, dur: 900, x: this.cx(ev.x), y: this.cy(ev.y), text: '+1', color: CELL });
        break;
      case 'zap':
        this.effects.push({ kind: 'zap', born: now, dur: 380, x: this.cx(bx), y: this.cy(by), tx: this.cx(ev.x), ty: this.cy(ev.y), hit: ev.hit, color: this.accent });
        if (ev.hit) this.burst(this.cx(ev.x), this.cy(ev.y), GLITCH, 30);
        break;
      case 'look': {
        const [dx, dy] = DELTA[ev.dir];
        this.effects.push({ kind: 'look', born: now, dur: 380, x: this.cx(bx), y: this.cy(by), tx: this.cx(bx + dx), ty: this.cy(by + dy), text: ev.seen, color: this.accent });
        break;
      }
      case 'bump':
        this.shake = 6;
        break;
      case 'caught':
        this.shake = 14;
        this.burst(this.cx(bx), this.cy(by), GLITCH, 40);
        this.effects.push({ kind: 'flash', born: now, dur: 500, x: 0, y: 0, color: GLITCH });
        break;
      case 'win':
        this.effects.push({ kind: 'ring', born: now, dur: 1200, x: this.cx(bx), y: this.cy(by), color: this.accent });
        this.burst(this.cx(bx), this.cy(by), this.accent, 50);
        break;
      case 'locked':
        this.effects.push({ kind: 'text', born: now, dur: 1100, x: this.cx(bx), y: this.cy(by) - this.tile * 0.4, text: 'LOCKED', color: '#F0645D' });
        break;
      case 'score':
        this.effects.push({ kind: 'text', born: now, dur: 800, x: this.cx(bx), y: this.cy(by) - this.tile * 0.5, text: `★ ${ev.value}`, color: CELL });
        break;
      default:
        break;
    }
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.4 + Math.random() * 0.5, color, size: 1.5 + Math.random() * 2.5 });
    }
  }

  draw(view: View, now: number, dt: number): void {
    const { ctx } = this;
    const W = this.cssW;
    const H = this.cssH;
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // Backdrop
    const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#121a2a');
    g.addColorStop(1, '#080b12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake = Math.max(0, this.shake - dt * 40);
    }

    this.drawTiles(view.cur, now);
    this.drawCells(view.cur, view.prev, view.t, now);
    this.drawExit(view.cur, now);
    this.drawGlitches(view, now);
    this.drawEffects(now, 'under');
    this.drawBot(view, now);
    this.drawEffects(now, 'over');
    this.drawParticles(dt);
    if (view.cur.say) this.drawBubble(view.cur.say, view);
    ctx.restore();
  }

  private drawTiles(_s: Snapshot, now: number) {
    const { ctx, tile: T, map } = this;
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const px = this.ox + x * T;
        const py = this.oy + y * T;
        const ch = this.rows[y][x] ?? ' ';
        if (ch === ' ') continue;
        const i = y * map.w + x;
        if (map.walls[i]) {
          if (!this.wallEdge[i]) {
            ctx.fillStyle = '#0d121c';
            ctx.fillRect(px, py, T, T);
            continue;
          }
          // Raised neon block
          ctx.fillStyle = '#1b2436';
          ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
          ctx.fillStyle = '#232f46';
          ctx.fillRect(px + 1, py + 1, T - 2, T * 0.28);
          ctx.strokeStyle = this.alpha(this.accent, 0.35);
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 3.5, py + 3.5, T - 7, T - 7);
          continue;
        }
        ctx.fillStyle = (x + y) % 2 ? '#111927' : '#131c2b';
        ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
        ctx.fillStyle = this.alpha(this.accent, 0.12 + 0.04 * Math.sin(now / 900 + x * 0.6 + y * 0.4));
        const d = Math.max(1.5, T * 0.04);
        ctx.fillRect(px + 2, py + 2, d, d);
        ctx.fillRect(px + T - 2 - d, py + T - 2 - d, d, d);
      }
    }
  }

  private drawExit(s: Snapshot, now: number) {
    const e = this.map.exit;
    if (!e) return;
    const { ctx, tile: T } = this;
    const x = this.cx(e.x);
    const y = this.cy(e.y);
    const col = s.exitOpen ? this.accent : '#5b6578';
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = s.exitOpen ? 18 : 0;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2, T * 0.06);
    ctx.beginPath();
    ctx.arc(x, y, T * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([T * 0.12, T * 0.1]);
    ctx.lineDashOffset = -now / 40;
    ctx.beginPath();
    ctx.arc(x, y, T * 0.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (s.exitOpen) {
      const p = (now / 1200) % 1;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.arc(x, y, T * (0.2 + p * 0.3), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // padlock
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      const lw = T * 0.18;
      ctx.fillRect(x - lw / 2, y - lw * 0.2, lw, lw * 0.8);
      ctx.lineWidth = Math.max(1.5, T * 0.04);
      ctx.beginPath();
      ctx.arc(x, y - lw * 0.2, lw * 0.32, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCells(s: Snapshot, prev: Snapshot, t: number, now: number) {
    const { ctx, tile: T } = this;
    s.cells.forEach((c, i) => {
      const wasTaken = prev.cells[i]?.taken;
      if (c.taken && wasTaken) return;
      const fade = c.taken ? 1 - t : 1;
      if (fade <= 0) return;
      const x = this.cx(c.x);
      const y = this.cy(c.y) + Math.sin(now / 400 + i) * T * 0.05;
      const r = T * 0.17 * (c.taken ? 1 + t : 1);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.shadowColor = CELL;
      ctx.shadowBlur = 16;
      ctx.fillStyle = CELL;
      ctx.translate(x, y);
      ctx.rotate(now / 1400 + i);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.3);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r * 1.3);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff6cf';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.6);
      ctx.lineTo(r * 0.4, 0);
      ctx.lineTo(0, r * 0.6);
      ctx.lineTo(-r * 0.4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  private drawGlitches(view: View, now: number) {
    const { ctx, tile: T } = this;
    const { cur, prev, t } = view;
    const k = easeInOut(Math.min(1, t));
    cur.glitches.forEach((g) => {
      const p = prev.glitches.find((q) => q.id === g.id) ?? g;
      if (!g.alive && !p.alive) return;
      const dying = !g.alive;
      const gx = p.x + (g.x - p.x) * k;
      const gy = p.y + (g.y - p.y) * k;
      const x = this.cx(gx);
      const y = this.cy(gy);
      const scale = dying ? Math.max(0, 1 - t * 1.4) : 1;
      if (scale <= 0) return;
      const r = T * 0.32 * scale;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = GLITCH;
      ctx.shadowBlur = 14;
      // jagged body, re-jittered a few times a second
      const seed = Math.floor(now / 90) + g.id * 31;
      ctx.fillStyle = GLITCH;
      ctx.beginPath();
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const jr = r * (0.78 + 0.32 * this.rand(seed + i));
        ctx.lineTo(Math.cos(a) * jr, Math.sin(a) * jr);
      }
      ctx.closePath();
      ctx.fill();
      // chromatic offset slice
      if (this.rand(seed * 7) > 0.6) {
        ctx.fillStyle = 'rgba(80, 220, 255, 0.55)';
        ctx.fillRect(-r, (this.rand(seed * 3) - 0.5) * r, r * 2, r * 0.18);
      }
      ctx.shadowBlur = 0;
      // eyes look at Kilo
      const bx = cur.bot.x - gx;
      const by = cur.bot.y - gy;
      const len = Math.hypot(bx, by) || 1;
      const lx = (bx / len) * r * 0.12;
      const ly = (by / len) * r * 0.12;
      ctx.fillStyle = '#fff';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * r * 0.3 + lx, -r * 0.1 + ly, r * 0.16, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#2a0010';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * r * 0.3 + lx * 1.8, -r * 0.1 + ly * 1.8, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  private botPos(view: View): { x: number; y: number; squash: number } {
    const { prev, cur, ev, t } = view;
    const k = easeInOut(Math.min(1, t));
    let x = prev.bot.x + (cur.bot.x - prev.bot.x) * k;
    let y = prev.bot.y + (cur.bot.y - prev.bot.y) * k;
    let squash = 0;
    if (ev?.t === 'bump') {
      const [dx, dy] = DELTA[ev.dir];
      const b = Math.sin(t * Math.PI) * 0.22;
      x += dx * b;
      y += dy * b;
      squash = Math.sin(t * Math.PI) * 0.18;
    } else if (ev?.t === 'move') {
      squash = Math.sin(t * Math.PI) * 0.08;
    }
    return { x, y, squash };
  }

  private drawBot(view: View, now: number) {
    const { ctx, tile: T } = this;
    const { x: gx, y: gy, squash } = this.botPos(view);
    const won = view.cur.status === 'won';
    const lost = view.cur.status === 'lost';
    const hop = won ? Math.abs(Math.sin(now / 160)) * T * 0.12 : 0;
    const bob = Math.sin(now / 320) * T * 0.03;
    const x = this.cx(gx);
    const y = this.cy(gy) + bob - hop;
    const r = T * 0.3;
    const dir: Dir = view.cur.bot.dir;

    // shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(this.cx(gx), this.cy(gy) + r * 1.05, r * 0.9 * (1 - hop / T), r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 + squash, 1 - squash);
    if (lost) ctx.rotate(Math.sin(now / 60) * 0.06);

    // antenna
    ctx.strokeStyle = '#9fb4cc';
    ctx.lineWidth = Math.max(1.5, T * 0.035);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(r * 0.15, -r * 1.35);
    ctx.stroke();
    ctx.fillStyle = lost ? GLITCH : this.accent;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10 + 6 * Math.sin(now / 200);
    ctx.beginPath();
    ctx.arc(r * 0.15, -r * 1.4, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // body
    const body = ctx.createLinearGradient(0, -r, 0, r);
    body.addColorStop(0, '#f4f8ff');
    body.addColorStop(1, '#a9bad1');
    ctx.fillStyle = body;
    this.roundRect(-r, -r, r * 2, r * 2, r * 0.7);
    ctx.fill();
    ctx.strokeStyle = this.alpha(this.accent, 0.8);
    ctx.lineWidth = Math.max(1, T * 0.025);
    ctx.stroke();

    // visor
    ctx.fillStyle = '#0c1220';
    this.roundRect(-r * 0.72, -r * 0.45, r * 1.44, r * 0.72, r * 0.36);
    ctx.fill();
    const [dx, dy] = DELTA[dir];
    const ex = dx * r * 0.16;
    const ey = dy * r * 0.1;
    ctx.fillStyle = lost ? GLITCH : this.accent;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    const blink = Math.sin(now / 1700) > 0.985 ? 0.15 : 1;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (won) {
        ctx.lineWidth = r * 0.12;
        ctx.strokeStyle = this.accent;
        ctx.arc(s * r * 0.3 + ex, -r * 0.05, r * 0.14, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        ctx.ellipse(s * r * 0.3 + ex, -r * 0.09 + ey, r * 0.12, r * 0.16 * blink, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    // chest light
    ctx.fillStyle = this.alpha(this.accent, 0.9);
    ctx.fillRect(-r * 0.25, r * 0.5, r * 0.5, r * 0.12);
    ctx.restore();
  }

  private drawBubble(text: string, view: View) {
    const { ctx, tile: T } = this;
    const { x: gx, y: gy } = this.botPos(view);
    ctx.save();
    ctx.font = `600 ${Math.max(12, Math.round(T * 0.26))}px "Atkinson Hyperlegible", system-ui, sans-serif`;
    const w = Math.min(ctx.measureText(text).width + 20, 320);
    const h = Math.max(24, T * 0.5);
    let x = this.cx(gx) - w / 2;
    const y = this.cy(gy) - T * 0.55 - h - 10;
    x = Math.max(6, Math.min(this.cssW - w - 6, x));
    ctx.fillStyle = '#f4f8ff';
    this.roundRect(x, Math.max(4, y), w, h, 8);
    ctx.fill();
    ctx.fillStyle = '#0c1220';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 10, Math.max(4, y) + h / 2, w - 20);
    ctx.restore();
  }

  private drawEffects(now: number, layer: 'under' | 'over') {
    const { ctx, tile: T } = this;
    this.effects = this.effects.filter((e) => now - e.born < e.dur);
    for (const e of this.effects) {
      const p = (now - e.born) / e.dur;
      ctx.save();
      if (e.kind === 'look' && layer === 'under') {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = e.color;
        ctx.fillStyle = this.alpha(e.color, 0.15);
        const tx = e.tx!;
        const ty = e.ty!;
        ctx.fillRect(tx - T / 2 + 2, ty - T / 2 + 2, T - 4, T - 4);
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(tx - T / 2 + 2, ty - T / 2 + 2, T - 4, T - 4);
      } else if (e.kind === 'zap' && layer === 'over') {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = e.hit ? '#ffffff' : e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 16;
        ctx.lineWidth = Math.max(2, T * 0.07);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        const segs = 6;
        for (let i = 1; i < segs; i++) {
          const f = i / segs;
          ctx.lineTo(e.x + (e.tx! - e.x) * f + (Math.random() - 0.5) * T * 0.3, e.y + (e.ty! - e.y) * f + (Math.random() - 0.5) * T * 0.3);
        }
        ctx.lineTo(e.tx!, e.ty!);
        ctx.stroke();
      } else if (e.kind === 'text' && layer === 'over') {
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = e.color;
        ctx.font = `700 ${Math.max(12, Math.round(T * 0.3))}px "IBM Plex Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(e.text!, e.x, e.y - p * T * 0.8);
      } else if (e.kind === 'ring' && layer === 'under') {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 20;
        for (const off of [0, 0.25]) {
          const q = Math.min(1, p + off);
          ctx.beginPath();
          ctx.arc(e.x, e.y, T * (0.3 + q * 3), 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (e.kind === 'flash' && layer === 'over') {
        ctx.globalAlpha = (1 - p) * 0.35;
        ctx.fillStyle = e.color;
        ctx.fillRect(0, 0, this.cssW, this.cssH);
      }
      ctx.restore();
    }
  }

  private drawParticles(dt: number) {
    const { ctx } = this;
    this.particles = this.particles.filter((p) => p.life < p.max);
    ctx.save();
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  private rand(n: number) {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  private alpha(hex: string, a: number) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
}

/** How long each event takes to play, in ms at 1x speed. */
export function eventDuration(ev: SimEvent): number {
  switch (ev.t) {
    case 'start':
    case 'print':
    case 'score':
    case 'banner':
      return 0;
    case 'look':
      return 260;
    case 'say':
      return 900;
    case 'zap':
      return 380;
    case 'collect':
      return 120;
    case 'locked':
      return 600;
    case 'win':
    case 'lose':
      return 300;
    default:
      return 300;
  }
}
