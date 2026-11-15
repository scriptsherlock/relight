// Main-thread side of the Python worker: boots Pyodide once, sends jobs, and
// restarts the worker when pupil code runs forever without calling a command.

import type { Frame, Goals, MapRows, MissionResult, PyError, Snapshot } from '../engine/types';

export interface ArcadeReply {
  frames: Frame[];
  state: Snapshot;
  error: PyError | null;
  glitchMoves: number;
  reason: string;
  /** Only on arcade-load: likely mistakes spotted before the game starts. */
  warnings?: PyError[];
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: number };

class TimeoutError extends Error {}

export class PythonRunner {
  private worker!: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private booting: Promise<void> | null = null;
  private listeners = new Set<(s: RunnerStatus) => void>();
  status: RunnerStatus = 'idle';

  constructor() {
    this.spawn();
  }

  onStatus(fn: (s: RunnerStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: RunnerStatus) {
    this.status = s;
    this.listeners.forEach((fn) => fn(s));
  }

  private spawn() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error));
    };
    this.booting = null;
  }

  private send<T>(msg: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        this.restart();
        reject(new TimeoutError('timeout'));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.worker.postMessage({ id, ...msg });
    });
  }

  private restart() {
    this.worker.terminate();
    this.pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new TimeoutError('restarted'));
    });
    this.pending.clear();
    this.spawn();
    this.setStatus('idle');
    void this.ready();
  }

  ready(): Promise<void> {
    if (!this.booting) {
      this.setStatus('booting');
      const indexURL = new URL('pyodide/', document.baseURI).href;
      this.booting = this.send<boolean>({ type: 'init', indexURL }, 60000).then(
        () => this.setStatus('ready'),
        (err) => {
          this.setStatus('failed');
          this.booting = null;
          throw err;
        },
      );
    }
    return this.booting;
  }

  async runMission(code: string, maps: MapRows[], goals: Partial<Goals>, budget?: number): Promise<MissionResult> {
    await this.ready();
    try {
      return await this.send<MissionResult>({ type: 'mission', code, maps, goals, budget }, 4000 + maps.length * 1500);
    } catch (err) {
      if (err instanceof TimeoutError) {
        return {
          runs: [],
          warnings: [],
          timedOut: true,
        };
      }
      throw err;
    }
  }

  async arcadeLoad(code: string, map: MapRows): Promise<ArcadeReply | 'timeout'> {
    await this.ready();
    try {
      return await this.send<ArcadeReply>({ type: 'arcade-load', code, map }, 4000);
    } catch (err) {
      if (err instanceof TimeoutError) return 'timeout';
      throw err;
    }
  }

  async arcade(type: 'arcade-key' | 'arcade-tick', key?: string): Promise<ArcadeReply | null | 'timeout'> {
    try {
      return await this.send<ArcadeReply | null>({ type, key }, 2500);
    } catch (err) {
      if (err instanceof TimeoutError) return 'timeout';
      throw err;
    }
  }
}

export type RunnerStatus = 'idle' | 'booting' | 'ready' | 'failed';

let shared: PythonRunner | null = null;
export function getRunner(): PythonRunner {
  if (!shared) shared = new PythonRunner();
  return shared;
}
