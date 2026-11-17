// Title screen and first-run track choice.

import { useEffect, useRef } from 'react';
import type { Track } from '../save';
import { Portrait } from './Comms';

export function Title({ hasSave, onStart }: { hasSave: boolean; onStart: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    // Skyline on both sides, leaving the sun clear in the middle.
    const towers = Array.from({ length: 46 }, (_, i) => {
      const x = i / 46;
      const mid = Math.abs(x + 0.01 - 0.5) < 0.2;
      return { x, w: 0.012 + ((i * 37) % 11) / 400, h: mid ? 0.03 + ((i * 53) % 5) / 160 : 0.08 + ((i * 53) % 17) / 70, lit: (i * 7) % 3 === 0 };
    });
    const draw = (now: number) => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (c.width !== Math.round(r.width * dpr)) {
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = r.width;
      const H = r.height;
      const horizon = H * 0.62;
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#05060f');
      sky.addColorStop(1, '#1a1150');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // sun
      const sunR = Math.min(W * 0.18, H * 0.3);
      const sun = ctx.createLinearGradient(0, horizon - sunR * 2, 0, horizon);
      sun.addColorStop(0, '#FFBC3D');
      sun.addColorStop(1, '#FF5FD2');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(W / 2, horizon, sunR, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#1a1150';
      for (let i = 0; i < 7; i++) {
        const y = horizon - sunR * 0.12 - i * sunR * 0.13;
        ctx.fillRect(W / 2 - sunR, y, sunR * 2, 2 + i * 0.6);
      }
      // skyline
      for (const t of towers) {
        const x = t.x * W;
        const w = t.w * W;
        const h = t.h * H;
        ctx.fillStyle = '#0b0b22';
        ctx.fillRect(x, horizon - h, w, h);
        if (t.lit) {
          ctx.fillStyle = 'rgba(63, 227, 209, 0.7)';
          for (let y = horizon - h + 6; y < horizon - 4; y += 9) {
            if (Math.sin(now / 900 + x + y) > 0.2) ctx.fillRect(x + 3, y, Math.max(2, w - 6), 2);
          }
        }
      }
      // ground grid
      ctx.fillStyle = '#07051a';
      ctx.fillRect(0, horizon, W, H - horizon);
      ctx.strokeStyle = 'rgba(255, 95, 210, 0.45)';
      ctx.lineWidth = 1;
      const off = (now / 30) % 40;
      for (let i = 0; i < 18; i++) {
        const p = (i * 40 + off) / 720;
        const y = horizon + Math.pow(p, 2) * (H - horizon) * 1.4;
        if (y > H) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (let i = -14; i <= 14; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 22, horizon);
        ctx.lineTo(W / 2 + i * W * 0.12, H);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="title-screen">
      <canvas ref={canvas} className="title-canvas" aria-hidden="true" />
      <div className="title-content">
        <p className="kicker">NOVA GRID · EMERGENCY CODE TEAM</p>
        <h1 className="title-logo flicker">RELIGHT</h1>
        <p className="tagline">The city has gone dark. Write the code that brings it back.</p>
        <button className="btn primary big" onClick={onStart} autoFocus>
          {hasSave ? 'Continue' : 'Start'}
        </button>
        <p className="title-foot">Blocks or real Python. Make your own levels and games.</p>
      </div>
    </div>
  );
}

export function TrackSelect({ onPick }: { onPick: (t: Track) => void }) {
  return (
    <div className="track-screen">
      <div className="track-inner">
        <div className="track-head">
          <Portrait who="vance" size={56} />
          <div>
            <div className="comms-name">Director Vance</div>
            <p>Every Patcher codes differently. How do you want to talk to Kilo? You can switch at any time, even in the middle of a level.</p>
          </div>
        </div>
        <div className="track-cards">
          <button className="track-card blocks" onClick={() => onPick('blocks')}>
            <span className="tc-tag">BUILDER</span>
            <h2>Blocks</h2>
            <div className="tc-demo" aria-hidden="true">
              <span className="b b-loop">repeat 4 times</span>
              <span className="b b-move in">move right → 1</span>
              <span className="b b-move in">move down ↓ 1</span>
            </div>
            <p>Snap blocks together. See the Python they make as you go.</p>
            <span className="tc-age">Best for ages 7–10, or anyone new to code</span>
          </button>
          <button className="track-card python" onClick={() => onPick('python')}>
            <span className="tc-tag">CODER</span>
            <h2>Python</h2>
            <pre className="tc-demo" aria-hidden="true">
              <span className="k">for</span> i <span className="k">in</span> range(<span className="n">4</span>):{'\n'}
              {'    '}bot.<span className="f">move_right</span>(){'\n'}
              {'    '}bot.<span className="f">move_down</span>()
            </pre>
            <p>Type real Python, the language used by scientists, game makers and AI engineers.</p>
            <span className="tc-age">Best for ages 10+, or blocks graduates</span>
          </button>
        </div>
      </div>
    </div>
  );
}
