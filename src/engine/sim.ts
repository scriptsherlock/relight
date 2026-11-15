// Deterministic grid simulation. Pure TypeScript: runs in the Python worker,
// in unit tests, and nowhere else needs to know the rules.

import {
  DELTA,
  type BotState,
  type CellState,
  type Dir,
  type Frame,
  type GlitchState,
  type Goals,
  type MapRows,
  type Mode,
  type Seen,
  type SimEvent,
  type Snapshot,
  type Status,
} from './types';

export interface ParsedMap {
  w: number;
  h: number;
  walls: boolean[];
  start: { x: number; y: number };
  exit: { x: number; y: number } | null;
  cells: { x: number; y: number }[];
  glitches: { x: number; y: number }[];
}

export function parseMap(rows: MapRows): ParsedMap {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const walls: boolean[] = new Array(w * h).fill(false);
  let start = { x: 0, y: 0 };
  let exit: ParsedMap['exit'] = null;
  const cells: ParsedMap['cells'] = [];
  const glitches: ParsedMap['glitches'] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x] ?? ' ';
      if (c === '#' || c === ' ') walls[y * w + x] = true;
      else if (c === 'S') start = { x, y };
      else if (c === 'E') exit = { x, y };
      else if (c === 'C') cells.push({ x, y });
      else if (c === 'G') glitches.push({ x, y });
    }
  }
  return { w, h, walls, start, exit, cells, glitches };
}

export const DEFAULT_BUDGET = 400;

export type ActResult = { s: 'ok' | 'stop' | 'budget'; v?: unknown };

export class Sim {
  readonly map: ParsedMap;
  readonly mode: Mode;
  readonly goals: Goals;
  bot: BotState;
  cells: CellState[];
  glitches: GlitchState[];
  status: Status = 'running';
  score = 0;
  say: string | null = null;
  banner: string | null = null;
  steps = 0;
  budget: number;
  frames: Frame[] = [];
  line = 0;
  block: string | null = null;
  reason = '';
  /** Arcade: count of glitch moves the pupil's code made. */
  glitchMoves = 0;
  /** Arcade: cells collected since the last drain (for on_collect handlers). */
  pendingCollects = 0;
  /** Arcade: times Kilo stepped onto the exit since the last drain (for on_exit handlers). */
  pendingExits = 0;

  constructor(rows: MapRows, opts: { mode?: Mode; goals?: Partial<Goals>; budget?: number } = {}) {
    this.map = parseMap(rows);
    this.mode = opts.mode ?? 'mission';
    this.goals = { cells: false, glitches: false, ...opts.goals };
    this.budget = opts.budget ?? DEFAULT_BUDGET;
    this.bot = { x: this.map.start.x, y: this.map.start.y, dir: 'right' };
    this.cells = this.map.cells.map((c) => ({ ...c, taken: false }));
    this.glitches = this.map.glitches.map((g, i) => ({ id: i + 1, ...g, alive: true }));
    this.push({ t: 'start' });
  }

  get over(): boolean {
    return this.status !== 'running';
  }

  snapshot(): Snapshot {
    return {
      bot: { ...this.bot },
      cells: this.cells.map((c) => ({ ...c })),
      glitches: this.glitches.map((g) => ({ ...g })),
      status: this.status,
      score: this.score,
      say: this.say,
      banner: this.banner,
      exitOpen: this.exitOpen(),
    };
  }

  push(ev: SimEvent): void {
    this.frames.push({ ev, line: this.line, block: this.block, state: this.snapshot() });
  }

  isWall(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return true;
    return this.map.walls[y * this.map.w + x];
  }

  glitchAt(x: number, y: number): GlitchState | undefined {
    return this.glitches.find((g) => g.alive && g.x === x && g.y === y);
  }

  cellAt(x: number, y: number): CellState | undefined {
    return this.cells.find((c) => !c.taken && c.x === x && c.y === y);
  }

  cellsLeft(): number {
    return this.cells.filter((c) => !c.taken).length;
  }

  glitchesLeft(): number {
    return this.glitches.filter((g) => g.alive).length;
  }

  exitOpen(): boolean {
    if (this.goals.cells && this.cellsLeft() > 0) return false;
    if (this.goals.glitches && this.glitchesLeft() > 0) return false;
    return true;
  }

  atExit(): boolean {
    const e = this.map.exit;
    return !!e && e.x === this.bot.x && e.y === this.bot.y;
  }

  look(dir: Dir): Seen {
    const [dx, dy] = DELTA[dir];
    const x = this.bot.x + dx;
    const y = this.bot.y + dy;
    if (this.isWall(x, y)) return 'wall';
    if (this.glitchAt(x, y)) return 'glitch';
    if (this.cellAt(x, y)) return 'cell';
    const e = this.map.exit;
    if (e && e.x === x && e.y === y) return 'exit';
    return 'empty';
  }

  private tick(): ActResult | null {
    if (this.over) return { s: 'stop' };
    this.steps += 1;
    if (this.mode === 'mission' && this.steps > this.budget) {
      this.lose(`Kilo's battery ran out after ${this.budget} actions. Is a loop running forever?`);
      return { s: 'budget' };
    }
    return null;
  }

  win(reason: string): void {
    if (this.over) return;
    this.status = 'won';
    this.reason = reason;
    this.push({ t: 'win', reason });
  }

  lose(reason: string): void {
    if (this.over) return;
    this.status = 'lost';
    this.reason = reason;
    this.push({ t: 'lose', reason });
  }

  // ---- Commands the pupil's code can call ----

  move(dir: Dir, steps = 1): ActResult {
    for (let i = 0; i < steps; i++) {
      const stop = this.tick();
      if (stop) return stop;
      this.say = null;
      this.bot.dir = dir;
      const [dx, dy] = DELTA[dir];
      const nx = this.bot.x + dx;
      const ny = this.bot.y + dy;
      if (this.isWall(nx, ny)) {
        const edge = nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h;
        this.push({ t: 'bump', dir, into: edge ? 'edge' : 'wall' });
        continue;
      }
      const g = this.glitchAt(nx, ny);
      if (g) {
        this.bot.x = nx;
        this.bot.y = ny;
        this.push({ t: 'caught', id: g.id });
        this.lose(this.mode === 'arcade' ? 'A glitch caught Kilo!' : 'Kilo walked straight into a glitch! Zap it first.');
        return { s: 'stop' };
      }
      this.bot.x = nx;
      this.bot.y = ny;
      this.push({ t: 'move', dir });
      const c = this.cellAt(nx, ny);
      if (c) {
        c.taken = true;
        this.pendingCollects += 1;
        this.push({ t: 'collect', x: nx, y: ny });
      }
      if (this.atExit() && this.mode === 'arcade') this.pendingExits += 1;
      if (this.atExit() && this.mode === 'mission') {
        if (this.exitOpen()) {
          this.win('Kilo reached the exit. District power restored!');
          return { s: 'stop' };
        }
        this.push({ t: 'locked' });
      }
    }
    return { s: 'ok' };
  }

  zap(dirIn?: Dir | null): ActResult {
    const stop = this.tick();
    if (stop) return stop;
    const dir = dirIn ?? this.bot.dir;
    this.bot.dir = dir;
    const [dx, dy] = DELTA[dir];
    const x = this.bot.x + dx;
    const y = this.bot.y + dy;
    const g = this.glitchAt(x, y);
    if (g) {
      g.alive = false;
      this.push({ t: 'zap', dir, hit: true, x, y });
      if (this.mode === 'arcade') this.score += 1;
    } else {
      this.push({ t: 'zap', dir, hit: false, x, y });
    }
    return { s: 'ok' };
  }

  doLook(dir: Dir): ActResult {
    const stop = this.tick();
    if (stop) return stop;
    const seen = this.look(dir);
    // Only record a frame in missions; in arcade it would flood the replay.
    if (this.mode === 'mission') this.push({ t: 'look', dir, seen });
    return { s: 'ok', v: seen };
  }

  speak(text: string): ActResult {
    const stop = this.tick();
    if (stop) return stop;
    this.say = String(text).slice(0, 80);
    this.push({ t: 'say', text: this.say });
    return { s: 'ok' };
  }

  print(text: string): ActResult {
    const stop = this.tick();
    if (stop) return stop;
    this.push({ t: 'print', text: String(text).slice(0, 200) });
    return { s: 'ok' };
  }

  /** A question such as bot.at_exit(): costs one action so `while` loops cannot spin for ever. */
  query<T>(v: () => T): ActResult {
    const stop = this.tick();
    if (stop) return stop;
    return { s: 'ok', v: v() };
  }

  // ---- Arcade-only helpers ----

  moveGlitch(id: number, dir: Dir): void {
    const g = this.glitches.find((q) => q.id === id && q.alive);
    if (!g || this.over) return;
    const [dx, dy] = DELTA[dir];
    const nx = g.x + dx;
    const ny = g.y + dy;
    if (!this.glitchCanEnter(nx, ny, g)) return;
    g.x = nx;
    g.y = ny;
    this.glitchMoves += 1;
    this.push({ t: 'glitchMove', id });
    this.checkCaught();
  }

  /** Can a glitch step onto this square? Not walls or other glitches; the exit only to catch Kilo on it. */
  private glitchCanEnter(x: number, y: number, self: GlitchState): boolean {
    if (this.isWall(x, y)) return false;
    const other = this.glitchAt(x, y);
    if (other && other !== self) return false;
    const e = this.map.exit;
    if (e && e.x === x && e.y === y && !(this.bot.x === x && this.bot.y === y)) return false;
    return true;
  }

  /**
   * Chase: one step along the shortest path to Kilo, walking round walls.
   * If no path exists (Kilo is sealed off), fall back to stepping closer.
   */
  glitchToward(id: number): void {
    const g = this.glitches.find((q) => q.id === id && q.alive);
    if (!g || this.over) return;
    const { w, h } = this.map;
    const goal = this.bot.y * w + this.bot.x;
    const first = new Int16Array(w * h).fill(-1);
    const seen = new Uint8Array(w * h);
    const queue: number[] = [g.y * w + g.x];
    seen[queue[0]] = 1;
    const dirs: Dir[] = ['up', 'right', 'down', 'left'];
    let step: Dir | null = null;
    for (let qi = 0; qi < queue.length && step === null; qi++) {
      const cur = queue[qi];
      const cx = cur % w;
      const cy = (cur - cx) / w;
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = DELTA[dirs[d]];
        const nx = cx + dx;
        const ny = cy + dy;
        const ni = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ni]) continue;
        if (!this.glitchCanEnter(nx, ny, g)) continue;
        seen[ni] = 1;
        first[ni] = qi === 0 ? d : first[cur];
        if (ni === goal) {
          step = dirs[first[ni]];
          break;
        }
        queue.push(ni);
      }
    }
    if (step) {
      this.moveGlitch(id, step);
      return;
    }
    // No route: step along the longer axis, try the other if blocked.
    const dx = this.bot.x - g.x;
    const dy = this.bot.y - g.y;
    const horiz: Dir | null = dx > 0 ? 'right' : dx < 0 ? 'left' : null;
    const vert: Dir | null = dy > 0 ? 'down' : dy < 0 ? 'up' : null;
    const order = Math.abs(dx) >= Math.abs(dy) ? [horiz, vert] : [vert, horiz];
    for (const d of order) {
      if (!d) continue;
      const [ox, oy] = [g.x, g.y];
      this.moveGlitch(id, d);
      if (g.x !== ox || g.y !== oy) return;
    }
  }

  checkCaught(): void {
    const g = this.glitchAt(this.bot.x, this.bot.y);
    if (g && !this.over) {
      this.push({ t: 'caught', id: g.id });
      this.lose('A glitch caught Kilo!');
    }
  }

  setBanner(text: string): void {
    this.banner = String(text).slice(0, 90);
    this.push({ t: 'banner', text: this.banner });
  }

  addScore(n: number): void {
    this.score += n;
    this.push({ t: 'score', value: this.score });
  }

  /** Called when the pupil's mission code has finished without a win or loss. */
  finishMission(): void {
    if (this.over) return;
    const left = this.cellsLeft();
    const glitches = this.glitchesLeft();
    if (this.atExit() && !this.exitOpen()) {
      const parts: string[] = [];
      if (this.goals.cells && left) parts.push(`${left} energy cell${left === 1 ? '' : 's'}`);
      if (this.goals.glitches && glitches) parts.push(`${glitches} glitch${glitches === 1 ? '' : 'es'}`);
      this.lose(`The exit is locked. Still to do: ${parts.join(' and ')}.`);
      return;
    }
    if (this.goals.cells && left) {
      this.lose(`The code ended with ${left} energy cell${left === 1 ? '' : 's'} still on the floor.`);
      return;
    }
    this.lose("The code ended before Kilo reached the exit.");
  }
}
