// Runs every level's reference solution through real Python (Pyodide in Node).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPyodide } from 'pyodide';
import { arcadeEvent, arcadeLoad, attach, runMission } from '../../src/python/host';
import { LEVELS, codeLines } from '../../src/content/levels';
import { parseMap } from '../../src/engine/sim';

const prelude = readFileSync(fileURLToPath(new URL('../../src/python/prelude.py', import.meta.url)), 'utf8');

beforeAll(async () => {
  const py = await loadPyodide({ indexURL: fileURLToPath(new URL('../../node_modules/pyodide/', import.meta.url)) });
  attach(py, prelude);
}, 60000);

describe('mission levels', () => {
  for (const level of LEVELS.filter((l) => l.mode === 'mission')) {
    it(`${level.id} solution wins on every map within par`, () => {
      const r = runMission(level.solution, level.maps, level.goals);
      for (const run of r.runs) {
        expect(run.error, JSON.stringify(run.error)).toBeNull();
        expect(run.won, run.reason).toBe(true);
      }
      expect(codeLines(level.solution)).toBeLessThanOrEqual(level.par);
      expect(r.warnings).toEqual([]);
    });
    it(`${level.id} starter code does not already win`, () => {
      const r = runMission(level.python, level.maps, level.goals);
      expect(r.runs.every((x) => x.won)).toBe(false);
    });
    it(`${level.id} maps have a start and an exit`, () => {
      for (const m of level.maps) expect(parseMap(m).exit).not.toBeNull();
    });
  }
});

describe('arcade levels', () => {
  it('arcade-1 solution is winnable with the arrow keys', () => {
    const level = LEVELS.find((l) => l.id === 'arcade-1')!;
    expect(arcadeLoad(level.solution, level.maps[0]).error).toBeNull();
    const keys = 'L3 U2 D4 R3 U2 R5 U2 D4'.split(' ');
    const name: Record<string, string> = { L: 'left', R: 'right', U: 'up', D: 'down' };
    let last = null as ReturnType<typeof arcadeEvent>;
    for (const k of keys) for (let i = 0; i < Number(k.slice(1)); i++) last = arcadeEvent('key', name[k[0]]) ?? last;
    expect(last?.state.status).toBe('won');
  });

  it('arcade-1 starter only moves right', () => {
    const level = LEVELS.find((l) => l.id === 'arcade-1')!;
    arcadeLoad(level.python, level.maps[0]);
    const r = arcadeEvent('key', 'left');
    expect(r?.state.bot.x).toBe(4);
  });

  it('arcade-2 solution makes glitches chase', () => {
    const level = LEVELS.find((l) => l.id === 'arcade-2')!;
    expect(arcadeLoad(level.solution, level.maps[0]).error).toBeNull();
    const r = arcadeEvent('tick');
    expect(r?.glitchMoves).toBeGreaterThan(0);
  });
});

describe('friendly errors', () => {
  const map = [['#####', '#S.E#', '#####']];
  const err = (code: string) => runMission(code, map, {}).runs[0].error;

  it('suggests the right command for a typo', () => {
    expect(err('bot.move_rigth()')?.detail).toContain('bot.move_right()');
  });
  it('explains missing colons with the line number', () => {
    const e = err('bot.move_right()\nfor i in range(2)\n    bot.move_right()');
    expect(e?.title).toBe('Missing colon');
    expect(e?.line).toBe(2);
  });
  it('explains indentation', () => {
    expect(err('for i in range(2):\nbot.move_right()')?.title).toBe('Spacing problem');
  });
  it('catches bad directions', () => {
    expect(err('bot.zap("rigt")')?.detail).toContain('Did you mean "right"?');
  });
  it('warns about missing brackets', () => {
    const r = runMission('bot.move_right\nbot.move_right(2)', map, {});
    expect(r.warnings[0].title).toBe('Missing brackets');
    expect(r.runs[0].won).toBe(true);
  });
  it('records print output and line numbers', () => {
    const r = runMission('print("hi")\nbot.move_right(2)', map, {});
    const f = r.runs[0].frames;
    expect(f.find((x) => x.ev.t === 'print')?.line).toBe(1);
    expect(f.find((x) => x.ev.t === 'move')?.line).toBe(2);
  });
  it('stops while loops that never reach the exit', () => {
    const r = runMission('while True:\n    bot.move_up()', map, {});
    expect(r.runs[0].won).toBe(false);
    expect(r.runs[0].reason).toContain('battery');
  });
});
