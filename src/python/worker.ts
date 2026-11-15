/// <reference lib="webworker" />
// Runs pupil Python in Pyodide, away from the page, so an endless loop can be
// stopped by terminating the worker. All game rules live in host.ts.

import type { PyodideInterface } from 'pyodide';
import prelude from './prelude.py?raw';
import { arcadeEvent, arcadeLoad, attach, runMission } from './host';
import type { Goals, MapRows } from '../engine/types';

let ready = false;

async function init(indexURL: string) {
  if (ready) return;
  const mod = await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`);
  const py = (await mod.loadPyodide({ indexURL })) as PyodideInterface;
  attach(py, prelude);
  ready = true;
}

type Msg =
  | { id: number; type: 'init'; indexURL: string }
  | { id: number; type: 'mission'; code: string; maps: MapRows[]; goals: Partial<Goals>; budget?: number }
  | { id: number; type: 'arcade-load'; code: string; map: MapRows }
  | { id: number; type: 'arcade-key'; key: string }
  | { id: number; type: 'arcade-tick' };

self.onmessage = async (e: MessageEvent<Msg>) => {
  const m = e.data;
  const post = (data: unknown) => (self as unknown as Worker).postMessage(data);
  try {
    let result: unknown = null;
    if (m.type === 'init') {
      await init(m.indexURL);
      result = true;
    } else if (m.type === 'mission') result = runMission(m.code, m.maps, m.goals, m.budget);
    else if (m.type === 'arcade-load') result = arcadeLoad(m.code, m.map);
    else if (m.type === 'arcade-key') result = arcadeEvent('key', m.key);
    else if (m.type === 'arcade-tick') result = arcadeEvent('tick');
    post({ id: m.id, ok: true, result });
  } catch (err) {
    post({ id: m.id, ok: false, error: String(err) });
  }
};
