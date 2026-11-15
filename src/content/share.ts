// Pupil-made levels: turn a Workshop project into a playable Level, and pack
// it into a link. No server: the whole level lives in the URL after #play=.

import type { WorkshopProject } from '../save';
import { parseMap } from '../engine/sim';
import type { Level, ToolKey } from './levels';

export const WORKSHOP_COLOR = '#C9B6FF';
const MISSION_TOOLS: ToolKey[] = ['move', 'zap', 'say', 'repeat', 'while', 'if', 'sense'];
const ARCADE_TOOLS: ToolKey[] = [...MISSION_TOOLS, 'events', 'game'];

export const ARCADE_TEMPLATE = `# Your game! These functions run when things happen.

def on_start():
    game.say("Collect every cell. Don't get caught!")

def on_key(key):
    if key == "up":
        bot.move_up()
    elif key == "down":
        bot.move_down()
    elif key == "left":
        bot.move_left()
    elif key == "right":
        bot.move_right()
    elif key == "space":
        bot.zap()

def on_tick():
    for g in game.glitches():
        g.move_toward_bot()

def on_collect():
    game.add_score(1)
    if bot.cells_left() == 0:
        game.win("You win!")

# Runs when Kilo steps onto the exit (if your map has one).
def on_exit():
    if bot.cells_left() == 0:
        game.win("Kilo escaped!")
`;

export function blankProject(mode: 'mission' | 'arcade' = 'mission'): WorkshopProject {
  return {
    title: mode === 'mission' ? 'My Level' : 'My Game',
    message: mode === 'mission' ? 'Can you get Kilo to the exit?' : 'Use the arrow keys. Space zaps.',
    mode,
    rows:
      mode === 'mission'
        ? ['############', '#S.........#', '#..........#', '#..........#', '#..........#', '#..........#', '#.........E#', '############']
        : ['############', '#C........C#', '#..........#', '#....S.....#', '#..........#', '#G........G#', '#C........C#', '############'],
    cells: mode === 'mission',
    code: mode === 'arcade' ? ARCADE_TEMPLATE : '',
    blocks: null,
  };
}

/** Problems that stop a project being tested or shared. */
export function problems(p: WorkshopProject): string[] {
  const out: string[] = [];
  const all = p.rows.join('');
  const count = (ch: string) => all.split(ch).length - 1;
  if (count('S') !== 1) out.push('Place Kilo’s start (exactly one).');
  if (p.mode === 'mission' && count('E') !== 1) out.push('Place one exit pad.');
  if (p.mode === 'arcade' && !p.code.trim()) out.push('Write the game’s rules in code.');
  if (!p.title.trim()) out.push('Give it a name.');
  if (p.cells && count('C') === 0) out.push('Add an energy cell, or untick “cells needed”.');
  return out;
}

export function projectToLevel(p: WorkshopProject, author: 'self' | 'shared'): Level {
  const map = parseMap(p.rows);
  const goal =
    p.mode === 'arcade'
      ? 'Win the game!'
      : p.cells && map.cells.length
        ? map.cells.length === 1
          ? 'Collect the energy cell, then reach the exit.'
          : `Collect all ${map.cells.length} energy cells, then reach the exit.`
        : 'Reach the exit.';
  return {
    id: author === 'self' ? 'workshop-test' : 'shared',
    district: 'docks',
    title: p.title || 'Untitled',
    brief: [p.message || 'A level made in The Workshop.'],
    kilo: author === 'self' ? 'Let’s see if your level can be beaten!' : 'Someone made this level for us. Let’s beat it!',
    goal,
    newCommands: [],
    maps: [p.rows],
    goals: { cells: p.cells },
    mode: p.mode,
    par: 99,
    python: p.mode === 'arcade' ? p.code : author === 'self' ? '# Write code that beats your own level!\n' : '',
    blocks: [],
    tools: p.mode === 'arcade' ? ARCADE_TOOLS : MISSION_TOOLS,
    hints: ['Plan the route before you write any code.', 'Run your code often to check Kilo is where you think.'],
    solution: '',
    learn:
      author === 'self'
        ? { word: 'Playtesting', text: 'Game designers test their own levels to prove they can be beaten. Yours can. Now share it!' }
        : { word: 'Creator', text: 'You played a level someone else built. Now build one for them in The Workshop.' },
    arcade: p.mode === 'arcade' ? { timeLimit: 120 } : undefined,
  };
}

interface Packed {
  v: 1;
  t: string;
  m: string;
  mode: 'mission' | 'arcade';
  r: string[];
  c: 0 | 1;
  code?: string;
  b?: object;
}

function toB64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function packProject(p: WorkshopProject): string {
  const data: Packed = { v: 1, t: p.title.slice(0, 40), m: p.message.slice(0, 200), mode: p.mode, r: p.rows, c: p.cells ? 1 : 0 };
  // Mission solutions stay secret; arcade games ship their rules.
  if (p.mode === 'arcade') {
    data.code = p.code;
    if (p.blocks) data.b = p.blocks;
  }
  return toB64url(JSON.stringify(data));
}

export function unpackProject(s: string): WorkshopProject | null {
  try {
    const d = JSON.parse(fromB64url(s)) as Packed;
    if (d.v !== 1 || !Array.isArray(d.r) || d.r.length < 3 || d.r.length > 14) return null;
    const rows = d.r.map((row) => String(row).slice(0, 20).replace(/[^#.SECG ]/g, '.'));
    return {
      title: String(d.t ?? 'Untitled').slice(0, 40),
      message: String(d.m ?? '').slice(0, 200),
      mode: d.mode === 'arcade' ? 'arcade' : 'mission',
      rows,
      cells: d.c === 1,
      code: typeof d.code === 'string' ? d.code.slice(0, 6000) : '',
      blocks: d.b && typeof d.b === 'object' ? d.b : null,
    };
  } catch {
    return null;
  }
}

export function shareUrl(p: WorkshopProject): string {
  const base = location.href.split('#')[0];
  return `${base}#play=${packProject(p)}`;
}
