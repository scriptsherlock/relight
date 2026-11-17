// Local save: progress, chosen track, code per level, workshop projects.
// No accounts, no server: everything stays in this browser.

export type Track = 'blocks' | 'python';

export interface LevelProgress {
  stars: number;
  done: boolean;
}

export interface SaveData {
  version: 1;
  name: string;
  track: Track | null;
  seenIntro: boolean;
  progress: Record<string, LevelProgress>;
  python: Record<string, string>;
  blocks: Record<string, object>;
  published: number;
  workshop: WorkshopProject | null;
}

export interface WorkshopProject {
  title: string;
  message: string;
  mode: 'mission' | 'arcade';
  rows: string[];
  cells: boolean;
  code: string;
  blocks: object | null;
  /** The other mode's code, kept so switching Mission/Arcade loses nothing. */
  other?: { code: string; blocks: object | null };
}

const KEY = 'relight.save.v1';

export function fresh(): SaveData {
  return { version: 1, name: '', track: null, seenIntro: false, progress: {}, python: {}, blocks: {}, published: 0, workshop: null };
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw) as SaveData;
    return d.version === 1 ? { ...fresh(), ...d } : fresh();
  } catch {
    return fresh();
  }
}

export function store(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage full or blocked: the game still works for this visit */
  }
}

export const RANKS = [
  { min: 0, name: 'Rookie' },
  { min: 3, name: 'Spark' },
  { min: 6, name: 'Patcher' },
  { min: 9, name: 'Engineer' },
  { min: 13, name: 'Architect' },
];

export function rankFor(done: number): { name: string; next: { name: string; need: number } | null } {
  let i = 0;
  RANKS.forEach((r, j) => {
    if (done >= r.min) i = j;
  });
  const n = RANKS[i + 1];
  return { name: RANKS[i].name, next: n ? { name: n.name, need: n.min - done } : null };
}
