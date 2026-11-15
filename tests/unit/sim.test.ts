import { describe, expect, it } from 'vitest';
import { Sim } from '../../src/engine/sim';

describe('Sim', () => {
  it('wins when Kilo reaches an open exit', () => {
    const s = new Sim(['#####', '#S.E#', '#####']);
    s.move('right', 2);
    expect(s.status).toBe('won');
  });

  it('bumps walls without moving', () => {
    const s = new Sim(['####', '#S.E', '####']);
    s.move('up');
    expect(s.bot).toMatchObject({ x: 1, y: 1 });
    expect(s.frames.at(-1)?.ev.t).toBe('bump');
  });

  it('keeps the exit locked until cells are collected', () => {
    const s = new Sim(['######', '#SE.C#', '######'], { goals: { cells: true } });
    s.move('right');
    expect(s.status).toBe('running');
    expect(s.frames.at(-1)?.ev.t).toBe('locked');
    s.move('right', 2);
    s.move('left', 2);
    expect(s.status).toBe('won');
  });

  it('loses when walking into a glitch, and zap clears it', () => {
    const a = new Sim(['#####', '#SGE#', '#####']);
    a.move('right');
    expect(a.status).toBe('lost');
    const b = new Sim(['#####', '#SGE#', '#####']);
    b.zap('right');
    b.move('right', 2);
    expect(b.status).toBe('won');
  });

  it('stops endless programs with the action budget', () => {
    const s = new Sim(['###', '#S#', '###'], { budget: 10 });
    let r = s.move('right');
    for (let i = 0; i < 20 && r.s === 'ok'; i++) r = s.move('right');
    expect(r.s).toBe('budget');
    expect(s.status).toBe('lost');
  });

  it('lets arcade glitches chase Kilo', () => {
    const s = new Sim(['#######', '#S...G#', '#######'], { mode: 'arcade' });
    for (let i = 0; i < 4; i++) s.glitchToward(1);
    expect(s.status).toBe('lost');
    expect(s.glitchMoves).toBe(4);
  });

  it('walks a glitch round a wall instead of getting stuck behind it', () => {
    // Kilo hides directly behind a block; the straight-line step is a wall.
    const s = new Sim(['#######', '#.....#', '#S.#.G#', '#.....#', '#######'], { mode: 'arcade' });
    for (let i = 0; i < 12 && s.status === 'running'; i++) s.glitchToward(1);
    expect(s.status).toBe('lost');
  });

  it('lets a glitch catch Kilo standing on the exit', () => {
    const s = new Sim(['######', '#S.EG#', '######'], { mode: 'arcade' });
    s.move('right', 2);
    expect(s.atExit()).toBe(true);
    s.glitchToward(1);
    expect(s.status).toBe('lost');
  });

  it('keeps glitches off the exit when Kilo is not on it', () => {
    const s = new Sim(['######', '#S.EG#', '######'], { mode: 'arcade' });
    s.moveGlitch(1, 'left');
    expect(s.glitches[0].x).toBe(4);
  });

  it('counts arcade exit arrivals for on_exit handlers', () => {
    const s = new Sim(['#####', '#S.E#', '#####'], { mode: 'arcade' });
    s.move('right', 2);
    expect(s.status).toBe('running');
    expect(s.pendingExits).toBe(1);
  });
});
