// Runs every level's reference solution through real Python (Pyodide in Node).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPyodide } from 'pyodide';
import { arcadeEvent, arcadeLoad, attach, runMission } from '../../src/python/host';
import { LEVELS, codeLines, unmetNeed } from '../../src/content/levels';
import { parseMap } from '../../src/engine/sim';
import { ARCADE_TEMPLATE, blankProject, fixProject, switchMode } from '../../src/content/share';

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

describe('foundry: the idea is required, not just the win', () => {
  const lv = (id: string) => LEVELS.find((l) => l.id === id)!;

  it('every reference solution uses the idea its level teaches', () => {
    for (const l of LEVELS) expect(unmetNeed(l, l.solution), l.id).toBeNull();
  });

  it('foundry-1: winning without a function is not enough', () => {
    const l = lv('foundry-1');
    const plain =
      'bot.move_right()\nbot.zap("up")\nbot.move_up(2)\nbot.move_down(2)\nbot.move_right(3)\nbot.zap("up")\nbot.move_up(2)\nbot.move_down(2)\nbot.move_right(4)\nbot.zap("up")\nbot.move_up(2)\nbot.move_down(2)\nbot.move_right(3)\nbot.zap("up")\nbot.move_up(2)\nbot.move_down(2)\nbot.move_right()\n';
    expect(runMission(plain, l.maps, l.goals).runs[0].won).toBe(true);
    expect(unmetNeed(l, plain)).toContain('def');
    // A def that is never called doesn't count either.
    expect(unmetNeed(l, 'def grab():\n    pass\n' + plain)).toContain('def');
  });

  it('foundry-2: a function without an input is not enough', () => {
    expect(unmetNeed(lv('foundry-2'), 'def go():\n    bot.move_right()\ngo()\n')).toContain('input');
  });

  it('foundry-3: needs a variable that changes', () => {
    const l = lv('foundry-3');
    expect(unmetNeed(l, 'bot.move_right()\nbot.move_down()\n')).toContain('variable');
    expect(unmetNeed(l, 'steps = 1\nfor i in range(4):\n    bot.move_right(steps)\n    steps += 1\n')).toBeNull();
  });

  it('warns when a function is built but never used', () => {
    const r = runMission('def hop():\n    bot.move_right()\n', [['#####', '#S.E#', '#####']], {});
    expect(r.warnings[0].title).toBe('hop() is never used');
  });

  it('bot.move takes any direction', () => {
    const r = runMission('bot.move("right", 2)', [['#####', '#S.E#', '#####']], {});
    expect(r.runs[0].won).toBe(true);
  });
});

describe('workshop modes keep their own code', () => {
  const mission = { ...blankProject('mission'), code: 'bot.move_right(2)\n' };

  it('switching to arcade and back gives the mission code back', () => {
    const arcade = switchMode(mission, 'arcade');
    expect(arcade.code).toContain('def on_key');
    const edited = { ...arcade, code: arcade.code + '\n# my rule\n' };
    const back = switchMode(edited, 'mission');
    expect(back.code).toBe('bot.move_right(2)\n');
    expect(switchMode(back, 'arcade').code).toContain('# my rule');
  });

  it('repairs a mission that was left holding arcade rules', () => {
    const stuck = { ...mission, code: ARCADE_TEMPLATE };
    const fixed = fixProject(stuck);
    expect(fixed.code).toBe('');
    expect(switchMode(fixed, 'arcade').code).toBe(ARCADE_TEMPLATE);
    expect(fixProject(mission)).toBe(mission);
  });

  it('warns when game code is run as a mission', () => {
    const r = runMission(ARCADE_TEMPLATE, [['#####', '#S.E#', '#####']], {});
    expect(r.warnings.map((w) => w.title)).toContain('This is game code');
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
