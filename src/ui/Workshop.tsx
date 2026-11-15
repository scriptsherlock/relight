// The Workshop: paint a map, choose mission or arcade, test it, share a link.

import { useRef, useState } from 'react';
import type { WorkshopProject } from '../save';
import { WORKSHOP_COLOR, blankProject, problems, shareUrl, unpackProject } from '../content/share';
import { Portrait } from './Comms';
import { Stage, type StageHandle } from './Stage';
import { tapOr } from './device';

interface Props {
  project: WorkshopProject;
  verified: boolean;
  onChange: (p: WorkshopProject, structural: boolean) => void;
  onTest: () => void;
  onShared: () => void;
  onBack: () => void;
}

const TOOLS: { ch: string; label: string }[] = [
  { ch: '#', label: 'Wall' },
  { ch: '.', label: 'Floor' },
  { ch: 'C', label: 'Cell' },
  { ch: 'G', label: 'Glitch' },
  { ch: 'S', label: 'Kilo start' },
  { ch: 'E', label: 'Exit' },
];

function setTile(rows: string[], x: number, y: number, ch: string): string[] {
  let out = rows;
  if (ch === 'S' || ch === 'E') out = out.map((r) => r.replaceAll(ch, '.'));
  return out.map((r, j) => (j === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));
}

function resize(rows: string[], w: number, h: number): string[] {
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const old = rows[y]?.[x];
      const inside = x < rows[0].length - 1 && y < rows.length - 1;
      row += edge ? '#' : inside && old ? old : '.';
    }
    out.push(row);
  }
  return out;
}

export function Workshop({ project: p, verified, onChange, onTest, onShared, onBack }: Props) {
  const [tool, setTool] = useState('#');
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');
  const stage = useRef<StageHandle>(null);
  const painting = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const issues = problems(p);
  const w = p.rows[0].length;
  const h = p.rows.length;

  const paint = (e: React.PointerEvent) => {
    const t = stage.current?.pick(e.clientX, e.clientY);
    if (!t) return;
    const edge = t.x === 0 || t.y === 0 || t.x === w - 1 || t.y === h - 1;
    if (edge && tool !== '#') return;
    if (p.rows[t.y][t.x] === tool) return;
    onChange({ ...p, rows: setTile(p.rows, t.x, t.y, tool) }, true);
  };

  const share = async () => {
    const url = shareUrl(p);
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
    onShared();
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${p.title.replace(/[^\w-]+/g, '-').toLowerCase() || 'level'}.relight.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (f: File) => {
    try {
      const text = await f.text();
      const trimmed = text.trim();
      const proj = trimmed.startsWith('{') ? (JSON.parse(trimmed) as WorkshopProject) : unpackProject(trimmed.split('#play=').pop() ?? '');
      if (!proj || !Array.isArray(proj.rows)) throw new Error('bad');
      onChange({ ...blankProject(proj.mode), ...proj }, true);
    } catch {
      window.alert('That file is not a Relight level.');
    }
  };

  return (
    <div className="workshop" style={{ ['--accent' as string]: WORKSHOP_COLOR }}>
      <header className="topbar">
        <button className="btn ghost" onClick={onBack}>
          ← City
        </button>
        <div className="crumbs">
          <span className="crumb-district">The Workshop</span>
          <h1>Build your own</h1>
        </div>
        <div className="top-actions">
          <button
            className="btn ghost"
            onClick={() => {
              if (window.confirm('Start a new mission level? Your current one will be replaced.')) onChange(blankProject('mission'), true);
            }}
          >
            New mission
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              if (window.confirm('Start a new arcade game from the chase template? Your current one will be replaced.')) onChange(blankProject('arcade'), true);
            }}
          >
            New game
          </button>
        </div>
      </header>
      <main className="ws-grid">
        <section className="ws-map">
          <div className="palette" role="toolbar" aria-label="Map tools">
            {TOOLS.map((t) => (
              <button key={t.ch} className={`tool ${tool === t.ch ? 'on' : ''}`} onClick={() => setTool(t.ch)} aria-pressed={tool === t.ch} title={t.label}>
                <span className={`swatch sw-${t.ch === '#' ? 'wall' : t.ch === '.' ? 'floor' : t.ch}`} />
                {t.label}
              </button>
            ))}
            <span className="sizes">
              <label>
                W
                <input type="number" min={5} max={18} value={w} onChange={(e) => onChange({ ...p, rows: resize(p.rows, Math.max(5, Math.min(18, Number(e.target.value))), h) }, true)} />
              </label>
              <label>
                H
                <input type="number" min={3} max={12} value={h} onChange={(e) => onChange({ ...p, rows: resize(p.rows, w, Math.max(3, Math.min(12, Number(e.target.value)))) }, true)} />
              </label>
            </span>
          </div>
          <div
            className="stage-wrap paintable"
            onPointerDown={(e) => {
              painting.current = true;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              paint(e);
            }}
            onPointerMove={(e) => painting.current && paint(e)}
            onPointerUp={() => (painting.current = false)}
            onPointerLeave={() => (painting.current = false)}
          >
            <Stage ref={stage} rows={p.rows} accent={WORKSHOP_COLOR} speed={1} label={tapOr("Your level map. Tap or drag to paint.", "Your level map. Click or drag to paint.")} />
          </div>
          <p className="muted small">{tapOr("Tap or drag your finger to paint.", "Click or drag to paint.")} The outside edge is always wall.</p>
        </section>

        <section className="ws-side">
          <label className="field">
            <span>Name</span>
            <input value={p.title} maxLength={40} onChange={(e) => onChange({ ...p, title: e.target.value }, false)} />
          </label>
          <label className="field">
            <span>Briefing for players</span>
            <textarea value={p.message} maxLength={200} rows={2} onChange={(e) => onChange({ ...p, message: e.target.value }, false)} />
          </label>
          <div className="field">
            <span>Type</span>
            <div className="seg" role="radiogroup" aria-label="Level type">
              <button role="radio" aria-checked={p.mode === 'mission'} className={p.mode === 'mission' ? 'on' : ''} onClick={() => onChange({ ...p, mode: 'mission' }, true)}>
                Mission
                <small>Players write code to solve it</small>
              </button>
              <button
                role="radio"
                aria-checked={p.mode === 'arcade'}
                className={p.mode === 'arcade' ? 'on' : ''}
                onClick={() => onChange({ ...p, mode: 'arcade', code: p.code.includes('def on_key') ? p.code : blankProject('arcade').code }, true)}
              >
                Arcade game
                <small>You code the rules, players play</small>
              </button>
            </div>
          </div>
          {p.mode === 'mission' && (
            <label className="check">
              <input type="checkbox" checked={p.cells} onChange={(e) => onChange({ ...p, cells: e.target.checked }, true)} />
              Players must collect every cell before the exit opens
            </label>
          )}

          <div className={`verify ${verified ? 'ok' : ''}`}>
            <Portrait who="kilo" size={40} accent={WORKSHOP_COLOR} />
            <div>
              {issues.length > 0 ? (
                <>
                  <strong>Almost ready</strong>
                  <ul>
                    {issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </>
              ) : verified ? (
                <>
                  <strong>Tested and beaten ✓</strong>
                  <span>You proved it can be won. Share it!</span>
                </>
              ) : (
                <>
                  <strong>{p.mode === 'mission' ? 'Prove it can be solved' : 'Build and playtest your game'}</strong>
                  <span>{p.mode === 'mission' ? 'Write code that beats your own level. Then you can share it.' : 'Write the rules, then win your own game once to unlock sharing.'}</span>
                </>
              )}
            </div>
          </div>
          <button className="btn primary big" disabled={issues.length > 0} onClick={onTest}>
            {p.mode === 'mission' ? '▶ Test it with code' : '▶ Code & playtest'}
          </button>

          <div className="share-box">
            <div className="comms-name">SHARE</div>
            <button className="btn" disabled={!verified || issues.length > 0} onClick={share}>
              {copied ? 'Link copied!' : 'Copy share link'}
            </button>
            {link && <input className="share-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />}
            <div className="share-row">
              <button className="link-btn" onClick={download}>
                Download file
              </button>
              <button className="link-btn" onClick={() => fileInput.current?.click()}>
                Open a file…
              </button>
              <input ref={fileInput} type="file" accept=".json,.txt" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            </div>
            <p className="muted small">Anyone with the link can play it. Mission links keep your solution secret. Game links include your code so friends can remix it.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
