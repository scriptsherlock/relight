// Shared types for the simulation, the Python worker and the renderer.

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
export const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** What bot.look() can report. */
export type Seen = 'wall' | 'glitch' | 'cell' | 'exit' | 'empty';

/**
 * A map is a list of rows. Characters:
 *   #  wall          .  floor        S  Kilo's start
 *   E  exit pad      C  energy cell  G  glitch
 *   (space) empty void, treated as a wall
 */
export type MapRows = string[];

export interface Goals {
  /** Every energy cell must be collected before the exit opens. */
  cells: boolean;
  /** Every glitch must be zapped before the exit opens. */
  glitches: boolean;
}

export type Mode = 'mission' | 'arcade';

export interface BotState {
  x: number;
  y: number;
  dir: Dir;
}

export interface GlitchState {
  id: number;
  x: number;
  y: number;
  alive: boolean;
}

export interface CellState {
  x: number;
  y: number;
  taken: boolean;
}

export type Status = 'running' | 'won' | 'lost';

export interface Snapshot {
  bot: BotState;
  cells: CellState[];
  glitches: GlitchState[];
  status: Status;
  score: number;
  /** Speech bubble text, if Kilo is talking. */
  say: string | null;
  /** Banner from game.say() in arcade mode. */
  banner: string | null;
  exitOpen: boolean;
}

export type SimEvent =
  | { t: 'start' }
  | { t: 'move'; dir: Dir }
  | { t: 'bump'; dir: Dir; into: 'wall' | 'edge' }
  | { t: 'collect'; x: number; y: number }
  | { t: 'zap'; dir: Dir; hit: boolean; x: number; y: number }
  | { t: 'look'; dir: Dir; seen: Seen }
  | { t: 'say'; text: string }
  | { t: 'print'; text: string }
  | { t: 'locked' }
  | { t: 'glitchMove'; id: number }
  | { t: 'caught'; id: number }
  | { t: 'score'; value: number }
  | { t: 'banner'; text: string }
  | { t: 'win'; reason: string }
  | { t: 'lose'; reason: string };

export interface Frame {
  ev: SimEvent;
  /** 1-based line in the pupil's code, or 0 if unknown. */
  line: number;
  /** Blockly block id that was running, in blocks mode. */
  block: string | null;
  state: Snapshot;
}

export interface PyError {
  title: string;
  detail: string;
  line: number;
}

export interface RunResult {
  frames: Frame[];
  won: boolean;
  reason: string;
  error: PyError | null;
}

export interface MissionResult {
  runs: RunResult[];
  warnings: PyError[];
  /** True if the worker had to be stopped (endless loop with no commands). */
  timedOut: boolean;
}
