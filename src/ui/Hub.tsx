// City hub screen: canvas world + HUD + district panel.

import { useEffect, useRef, useState } from 'react';
import { DISTRICTS, levelsIn, type DistrictId, type Level } from '../content/levels';
import { rankFor, type SaveData, type Track } from '../save';
import { CityWorld, GATES, type GateId } from './cityWorld';
import { Portrait } from './Comms';
import { tapOr } from './device';

interface Props {
  save: SaveData;
  unlockAll: boolean;
  isDistrictOpen: (d: DistrictId) => boolean;
  isLevelOpen: (l: Level) => boolean;
  onPlay: (l: Level) => void;
  onWorkshop: () => void;
  onTrack: (t: Track) => void;
  onReset: () => void;
  lastGate: GateId | null;
}

const KEY_DIR: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

export function Hub({ save, isDistrictOpen, isLevelOpen, onPlay, onWorkshop, onTrack, onReset, lastGate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<CityWorld | null>(null);
  const [near, setNear] = useState<GateId | null>(null);
  const [panel, setPanel] = useState<GateId | null>(null);
  const [menu, setMenu] = useState(false);
  const [tipOpen, setTipOpen] = useState(() => localStorage.getItem('relight.tipHidden') !== '1');
  const showTip = (open: boolean) => {
    setTipOpen(open);
    localStorage.setItem('relight.tipHidden', open ? '0' : '1');
  };
  const panelRef = useRef(panel);
  panelRef.current = panel;

  const done = Object.values(save.progress).filter((p) => p.done).length;
  const rank = rankFor(done + (save.published > 0 ? 1 : 0));
  const districtLit = (d: DistrictId) => {
    const ls = levelsIn(d);
    return ls.filter((l) => save.progress[l.id]?.done).length / ls.length;
  };
  const nextDistrict = DISTRICTS.find((d) => isDistrictOpen(d.id) && districtLit(d.id) < 1);
  const litCount = DISTRICTS.filter((d) => districtLit(d.id) === 1).length;

  const openGate = (id: GateId) => {
    if (id === 'workshop') onWorkshop();
    else setPanel(id);
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const w = new CityWorld(canvas);
    worldRef.current = w;
    if (lastGate) {
      const g = GATES.find((q) => q.id === lastGate);
      if (g) {
        w.bot.x = g.x;
        w.bot.y = g.y + 140;
      }
    }
    w.onNear = setNear;
    w.onArrive = (id) => openGate(id);
    w.resize();
    const ro = new ResizeObserver(() => w.resize());
    ro.observe(canvas);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!panelRef.current) w.update(dt);
      w.draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const down = (e: KeyboardEvent) => {
      if (panelRef.current) {
        if (e.key === 'Escape') setPanel(null);
        return;
      }
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      const d = KEY_DIR[e.key] ?? KEY_DIR[e.key.toLowerCase()];
      if (d) {
        e.preventDefault();
        w.key(d, true);
      } else if ((e.key === 'Enter' || e.key === 'e') && w.near && !(e.target as HTMLElement)?.closest?.('button')) {
        e.preventDefault();
        openGate(w.near);
      }
    };
    const up = (e: KeyboardEvent) => {
      const d = KEY_DIR[e.key] ?? KEY_DIR[e.key.toLowerCase()];
      if (d) w.key(d, false);
    };
    const blur = () => w.clearKeys();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep gate state in sync with progress.
  useEffect(() => {
    const w = worldRef.current;
    if (!w) return;
    w.gates = GATES.map((g) => {
      if (g.id === 'workshop') return { ...g, lit: 1, locked: false, beacon: false };
      const d = g.id as DistrictId;
      return { ...g, lit: districtLit(d), locked: !isDistrictOpen(d), beacon: nextDistrict?.id === d };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, isDistrictOpen]);

  const district = panel && panel !== 'workshop' ? DISTRICTS.find((d) => d.id === panel)! : null;
  const nearGate = near ? GATES.find((g) => g.id === near) : null;
  const tip =
    done === 0
      ? tapOr('Drive Kilo to the glowing beacon at The Docks. Tap where you want to go.', 'Drive Kilo to the glowing beacon at The Docks. Use the arrow keys, or click where you want to go.')
      : litCount === 4
        ? 'Every district is back online. Now build something of your own in The Workshop.'
        : nextDistrict
          ? `${nextDistrict.name} needs power. Follow the beacon.`
          : 'Visit The Workshop to build your own level.';

  return (
    <div className="hub">
      <canvas
        ref={canvasRef}
        className="hub-canvas"
        aria-label={tapOr("Nova Grid city map. Tap to drive Kilo, or use the Districts menu.", "Nova Grid city map. Use the arrow keys to drive Kilo, or the Districts menu.")}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          worldRef.current?.click(e.clientX - r.left, e.clientY - r.top);
        }}
      />
      <div className="hub-top">
        <div className="brand">
          <span className="logo">RELIGHT</span>
          <span className="rank-chip" title={rank.next ? `${rank.next.need} more to ${rank.next.name}` : 'Top rank'}>
            {rank.name}
          </span>
          <span className="lit-count">
            {litCount}/4 districts lit · {done} levels
          </span>
        </div>
        <div className="hub-actions">
          <button className="btn ghost" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
            Districts ▾
          </button>
          <button className="btn ghost" onClick={onWorkshop}>
            Workshop
          </button>
          <div className="track-toggle" role="group" aria-label="How do you want to code?">
            <button className={save.track === 'blocks' ? 'on' : ''} onClick={() => onTrack('blocks')} aria-pressed={save.track === 'blocks'}>
              Blocks
            </button>
            <button className={save.track === 'python' ? 'on' : ''} onClick={() => onTrack('python')} aria-pressed={save.track === 'python'}>
              Python
            </button>
          </div>
        </div>
      </div>
      {menu && (
        <div className="district-menu" role="menu">
          {DISTRICTS.map((d) => (
            <button
              key={d.id}
              role="menuitem"
              disabled={!isDistrictOpen(d.id)}
              onClick={() => {
                setMenu(false);
                setPanel(d.id);
              }}
              style={{ ['--accent' as string]: d.color }}
            >
              <span className="dot" />
              {d.name}
              <span className="muted small">{isDistrictOpen(d.id) ? `${Math.round(districtLit(d.id) * 100)}%` : 'locked'}</span>
            </button>
          ))}
          <button role="menuitem" onClick={() => (setMenu(false), onWorkshop())} style={{ ['--accent' as string]: '#C9B6FF' }}>
            <span className="dot" />
            The Workshop
          </button>
          <hr />
          <button role="menuitem" className="danger-text" onClick={() => (setMenu(false), onReset())}>
            Reset my progress…
          </button>
        </div>
      )}
      {nearGate && !panel && (
        <button className="gate-prompt" style={{ ['--accent' as string]: nearGate.color }} onClick={() => openGate(nearGate.id)}>
          <kbd className="desk-only">Enter</kbd> {nearGate.id === 'workshop' ? 'Open' : 'Enter'} {nearGate.name}
        </button>
      )}
      {tipOpen ? (
        <div className="hub-tip">
          <Portrait who="vance" size={44} />
          <div>
            <div className="comms-name">Director Vance</div>
            <p>{tip}</p>
          </div>
          <button className="tip-close" onClick={() => showTip(false)} aria-label="Hide Director Vance's tip">
            ✕
          </button>
        </div>
      ) : (
        <button className="tip-open" onClick={() => showTip(true)} aria-label="Show Director Vance's tip">
          <Portrait who="vance" size={40} />
        </button>
      )}

      {district && (
        <div className="panel-backdrop" onClick={() => setPanel(null)}>
          <div className="district-panel" style={{ ['--accent' as string]: district.color }} role="dialog" aria-modal="true" aria-label={district.name} onClick={(e) => e.stopPropagation()}>
            <div className="dp-head">
              <div>
                <span className="dp-concept">{district.concept.toUpperCase()}</span>
                <h2>{district.name}</h2>
                <p className="muted">{district.blurb}</p>
              </div>
              <button className="btn ghost" onClick={() => setPanel(null)} aria-label="Close">
                ✕
              </button>
            </div>
            {!isDistrictOpen(district.id) ? (
              <p className="locked-msg">The Glitch is still too strong here. Restore the district before this one first.</p>
            ) : (
              <ol className="level-list">
                {levelsIn(district.id).map((l, i) => {
                  const p = save.progress[l.id];
                  const open = isLevelOpen(l);
                  return (
                    <li key={l.id}>
                      <button className={`level-card ${p?.done ? 'done' : ''}`} disabled={!open} onClick={() => onPlay(l)} autoFocus={open && !p?.done}>
                        <span className="lc-num">{i + 1}</span>
                        <span className="lc-title">{l.title}</span>
                        <span className="lc-stars" aria-label={`${p?.stars ?? 0} stars`}>
                          {[1, 2, 3].map((n) => (
                            <span key={n} className={n <= (p?.stars ?? 0) ? 'got' : ''}>
                              ★
                            </span>
                          ))}
                        </span>
                        <span className="lc-state">{!open ? '🔒' : p?.done ? 'Replay' : 'Play'}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
