// Bridges Pyodide and the Sim. Used by the worker and by the unit tests.

import type { PyodideInterface } from 'pyodide';
import { Sim } from '../engine/sim';
import type { Dir, Goals, MapRows, PyError, RunResult } from '../engine/types';

let py: PyodideInterface | null = null;
let sim: Sim | null = null;
let arcadeSent = 0;

const world = {
  act(name: string, a: unknown, b: unknown, line: number) {
    const s = sim!;
    s.line = line;
    switch (name) {
      case 'move':
        return s.move(a as Dir, Number(b ?? 1));
      case 'zap':
        return s.zap((a as Dir | null) ?? null);
      case 'look':
        return s.doLook(a as Dir);
      case 'say':
        return s.speak(String(a));
      case 'print':
        return s.print(String(a));
      case 'at_exit':
        return s.mode === 'mission' ? s.query(() => s.atExit()) : { s: 'ok', v: s.atExit() };
      case 'cells_left':
        return s.mode === 'mission' ? s.query(() => s.cellsLeft()) : { s: 'ok', v: s.cellsLeft() };
      default:
        return { s: 'ok' };
    }
  },
  block(id: string) {
    if (sim) sim.block = id;
  },
  bot_x: () => sim!.bot.x,
  bot_y: () => sim!.bot.y,
  over: () => sim!.over,
  score: () => sim!.score,
  cells_left: () => sim!.cellsLeft(),
  take_collects() {
    const n = sim!.pendingCollects;
    sim!.pendingCollects = 0;
    return n;
  },
  take_exits() {
    const n = sim!.pendingExits;
    sim!.pendingExits = 0;
    return n;
  },
  glitch_ids: () => sim!.glitches.filter((g) => g.alive).map((g) => g.id),
  glitch_x: (id: number) => sim!.glitches.find((g) => g.id === id)?.x ?? -1,
  glitch_y: (id: number) => sim!.glitches.find((g) => g.id === id)?.y ?? -1,
  glitch_toward(id: number, line: number) {
    sim!.line = line;
    sim!.glitchToward(id);
  },
  glitch_move(id: number, dir: Dir, line: number) {
    sim!.line = line;
    sim!.moveGlitch(id, dir);
  },
  game_end(status: 'won' | 'lost', msg: string, line: number) {
    sim!.line = line;
    if (status === 'won') sim!.win(msg);
    else sim!.lose(msg);
  },
  banner(msg: string, line: number) {
    sim!.line = line;
    sim!.setBanner(msg);
  },
  add_score(n: number, line: number) {
    sim!.line = line;
    sim!.addScore(n);
  },
};

/** Wire a loaded Pyodide to the simulation and load the Relight prelude. */
export function attach(instance: PyodideInterface, preludeSource: string): void {
  py = instance;
  py.registerJsModule('_world', world);
  py.runPython(preludeSource, { filename: '<relight>' });
}

function call(fn: string, ...args: unknown[]): { error: PyError | null } {
  const f = py!.globals.get(fn);
  const out = f(...args) as string;
  f.destroy?.();
  return JSON.parse(out);
}

export function runMission(code: string, maps: MapRows[], goals: Partial<Goals>, budget?: number) {
  const warnings = JSON.parse(py!.globals.get('check')(code)) as PyError[];
  const runs: RunResult[] = [];
  for (const rows of maps) {
    sim = new Sim(rows, { mode: 'mission', goals, budget });
    const { error } = call('run_mission', code);
    if (!error && !sim.over) sim.finishMission();
    runs.push({ frames: sim.frames, won: sim.status === 'won' && !error, reason: error ? error.title : sim.reason, error });
    sim = null;
  }
  return { runs, warnings, timedOut: false };
}

function arcadeReply(error: PyError | null) {
  const s = sim!;
  const frames = s.frames.slice(arcadeSent);
  arcadeSent = s.frames.length;
  // Keep memory flat in long games.
  if (s.frames.length > 2000) {
    s.frames = [];
    arcadeSent = 0;
  }
  return { frames, state: s.snapshot(), error, glitchMoves: s.glitchMoves, reason: s.reason };
}

export function arcadeLoad(code: string, map: MapRows) {
  sim = new Sim(map, { mode: 'arcade' });
  arcadeSent = 0;
  const warnings = JSON.parse(py!.globals.get('check')(code)) as PyError[];
  return { ...arcadeReply(call('arcade_load', code).error), warnings };
}

export function arcadeEvent(type: 'key' | 'tick', key?: string) {
  if (!sim || sim.over) return null;
  return arcadeReply(type === 'key' ? call('arcade_key', key ?? '').error : call('arcade_tick').error);
}
