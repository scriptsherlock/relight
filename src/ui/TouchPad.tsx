// On-screen controls for arcade games on tablets: a D-pad and a zap button.
// Holding an arrow repeats it, like holding a key down.

import { useEffect, useRef } from 'react';

interface Props {
  onKey: (key: string) => void;
  enabled: boolean;
}

const ARROWS: { key: string; label: string; glyph: string }[] = [
  { key: 'up', label: 'Up', glyph: '▲' },
  { key: 'left', label: 'Left', glyph: '◀' },
  { key: 'right', label: 'Right', glyph: '▶' },
  { key: 'down', label: 'Down', glyph: '▼' },
];

export function TouchPad({ onKey, enabled }: Props) {
  const timer = useRef<number | undefined>(undefined);
  const cb = useRef(onKey);
  cb.current = onKey;

  const stop = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled]);

  const press = (key: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!enabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stop();
    cb.current(key);
    if (key === 'space') return;
    const repeat = () => {
      cb.current(key);
      timer.current = window.setTimeout(repeat, 170);
    };
    timer.current = window.setTimeout(repeat, 330);
  };

  const common = {
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return (
    <div className={`touchpad ${enabled ? '' : 'idle'}`} aria-label="Game controls">
      <div className="dpad">
        {ARROWS.map((a) => (
          <button key={a.key} className={`pad-btn pad-${a.key}`} aria-label={a.label} onPointerDown={press(a.key)} {...common}>
            {a.glyph}
          </button>
        ))}
      </div>
      <span className="pad-note">{enabled ? 'Hold an arrow to keep moving' : 'Controls work while your game is running'}</span>
      <button className="pad-btn pad-zap" aria-label="Zap (space)" onPointerDown={press('space')} {...common}>
        ZAP
      </button>
    </div>
  );
}
