// The level canvas. Plays a list of frames as animation, or streams frames
// live (arcade). Imperative handle: load() replaces the queue, push() appends.

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { GridRenderer, eventDuration } from '../engine/renderer';
import { Sim } from '../engine/sim';
import type { Frame, MapRows, SimEvent, Snapshot } from '../engine/types';

export interface StageHandle {
  load(frames: Frame[]): void;
  push(frames: Frame[]): void;
  reset(): void;
  pick(clientX: number, clientY: number): { x: number; y: number } | null;
}

interface Props {
  rows: MapRows;
  accent: string;
  speed: number;
  live?: boolean;
  onFrame?: (f: Frame, index: number) => void;
  onDone?: () => void;
  label?: string;
}

export const Stage = forwardRef<StageHandle, Props>(function Stage({ rows, accent, speed, live, onFrame, onDone, label }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const r = useRef({
    renderer: null as GridRenderer | null,
    queue: [] as Frame[],
    idx: 0,
    t: 1,
    prev: null as Snapshot | null,
    cur: null as Snapshot | null,
    ev: null as SimEvent | null,
    done: true,
    speed,
    onFrame,
    onDone,
    live,
  });
  r.current.speed = speed;
  r.current.onFrame = onFrame;
  r.current.onDone = onDone;
  r.current.live = live;

  const initial = (m: MapRows) => new Sim(m).snapshot();

  useImperativeHandle(ref, () => ({
    load(frames) {
      const s = r.current;
      s.queue = frames.slice();
      s.idx = 0;
      s.t = 1;
      s.done = frames.length === 0;
      if (frames[0]) {
        s.prev = frames[0].state;
        s.cur = frames[0].state;
        s.ev = null;
        s.onFrame?.(frames[0], 0);
      }
    },
    push(frames) {
      const s = r.current;
      if (!frames.length) return;
      s.queue.push(...frames);
      s.done = false;
    },
    pick(cx, cy) {
      const c = canvasRef.current;
      if (!c || !r.current.renderer) return null;
      const b = c.getBoundingClientRect();
      return r.current.renderer.tileAt(cx - b.left, cy - b.top);
    },
    reset() {
      const s = r.current;
      s.queue = [];
      s.idx = 0;
      s.done = true;
      s.prev = s.cur = initial(rows);
      s.ev = null;
      s.t = 1;
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const s = r.current;
    s.renderer = new GridRenderer(canvas, rows, accent);
    s.prev = s.cur = initial(rows);
    s.queue = [];
    s.idx = 0;
    s.done = true;
    s.renderer.resize();
    const ro = new ResizeObserver(() => s.renderer?.resize());
    ro.observe(canvas);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const st = r.current;
      // Advance playback
      if (!st.done) {
        let guard = 0;
        while (guard++ < 50) {
          const next = st.queue[st.idx + 1];
          if (!next) {
            if (st.t >= 1 && !st.live) {
              st.done = true;
              st.onDone?.();
            }
            break;
          }
          if (st.t < 1) break;
          st.idx += 1;
          st.prev = st.cur;
          st.cur = next.state;
          st.ev = next.ev;
          st.t = 0;
          st.renderer!.trigger(next.ev, next.state, now);
          st.onFrame?.(next, st.idx);
          const d = eventDuration(next.ev);
          if (d === 0) st.t = 1;
        }
        if (st.t < 1 && st.ev) {
          const behind = st.queue.length - 1 - st.idx;
          const boost = st.live ? (behind > 4 ? 6 : 2.2) : 1;
          st.t = Math.min(1, st.t + (dt * 1000 * st.speed * boost) / Math.max(1, eventDuration(st.ev)));
        }
      }
      st.renderer!.draw({ prev: st.prev!, cur: st.cur!, ev: st.ev, t: st.t }, now, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => {
    if (r.current.renderer) r.current.renderer.accent = accent;
  }, [accent]);

  return <canvas ref={canvasRef} className="stage-canvas" role="img" aria-label={label ?? 'Level map'} />;
});
