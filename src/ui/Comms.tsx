// Story comms: messages type in one at a time, like Countersign's briefings.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tapOr } from './device';

export type Speaker = 'vance' | 'kilo';

export interface CommsLine {
  who: Speaker;
  text: string;
}

export function Portrait({ who, size = 64, accent = '#3FE3D1' }: { who: Speaker; size?: number; accent?: string }) {
  if (who === 'kilo') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="portrait">
        <rect width="64" height="64" rx="14" fill="#101726" />
        <line x1="34" y1="16" x2="38" y2="7" stroke="#9fb4cc" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="38.5" cy="6.5" r="3.5" fill={accent} className="blink-light" />
        <rect x="12" y="16" width="40" height="40" rx="15" fill="url(#kb)" stroke={accent} strokeWidth="1.5" />
        <rect x="17" y="25" width="30" height="15" rx="7.5" fill="#0c1220" />
        <ellipse cx="26" cy="32.5" rx="3" ry="4" fill={accent} className="eye" />
        <ellipse cx="38" cy="32.5" rx="3" ry="4" fill={accent} className="eye" />
        <rect x="27" y="47" width="10" height="2.5" rx="1.2" fill={accent} />
        <defs>
          <linearGradient id="kb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4f8ff" />
            <stop offset="1" stopColor="#a9bad1" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="portrait">
      <rect width="64" height="64" rx="14" fill="#111A4D" />
      <circle cx="32" cy="70" r="30" fill="#0C1340" />
      <path d="M14 64c2-14 9-20 18-20s16 6 18 20z" fill="#2a3170" />
      <path d="M26 44l6 8 6-8" fill="#FFBC3D" />
      <circle cx="32" cy="29" r="12" fill="#c98f6b" />
      <path d="M19 28c0-10 6-15 13-15s13 5 13 15c-3-5-7-7-13-7s-10 2-13 7z" fill="#1b1433" />
      <rect x="21" y="26" width="22" height="6" rx="3" fill="#C9B6FF" opacity="0.92" />
      <path d="M44 30c3 0 4 3 4 6" stroke="#9fb4cc" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="47.5" cy="37" r="2" fill="#FFBC3D" />
    </svg>
  );
}

const NAMES: Record<Speaker, string> = { vance: 'Director Vance', kilo: 'Kilo' };

interface Props {
  lines: CommsLine[];
  accent: string;
  title?: string;
  /** Shown under the last line, e.g. new command cards. */
  extra?: ReactNode;
  finishLabel?: string;
  onFinish: () => void;
}

export function Comms({ lines, accent, title, extra, finishLabel = 'Let’s go', onFinish }: Props) {
  const [shown, setShown] = useState(1);
  const [hidden, setHidden] = useState(false);
  const [typed, setTyped] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const current = lines[shown - 1];
  const typing = typed < current.text.length;
  const allDone = shown >= lines.length && !typing;

  useEffect(() => {
    setTyped(0);
  }, [shown]);

  useEffect(() => {
    if (!typing) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setTyped(current.text.length);
      return;
    }
    const id = window.setTimeout(() => setTyped((t) => Math.min(current.text.length, t + 2)), 16);
    return () => clearTimeout(id);
  }, [typed, typing, current.text.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [shown, allDone]);

  const advance = () => {
    if (typing) setTyped(current.text.length);
    else if (shown < lines.length) setShown((s) => s + 1);
    else onFinish();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hidden) return;
      if (e.key === 'Escape') {
        setHidden(true);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (hidden) {
    const who = lines[shown - 1].who;
    return (
      <button className="comms-chip" style={{ ['--accent' as string]: accent }} onClick={() => setHidden(false)} aria-label={`Open message from ${NAMES[who]}`}>
        <Portrait who={who} size={34} accent={accent} />
        <span>
          <strong>{NAMES[who]}</strong>
          <span className="muted small">Message hidden · tap to open</span>
        </span>
      </button>
    );
  }

  return (
    <div className="comms-backdrop" role="dialog" aria-modal="true" aria-label={title ?? 'Incoming message'}>
      <div className="comms" style={{ ['--accent' as string]: accent }}>
        <div className="comms-head">
          <span className="comms-dot" />
          <span>{title ?? 'INCOMING TRANSMISSION'}</span>
          <button className="link-btn" onClick={() => setHidden(true)} title="Hide this message for now (Esc)">
            Hide
          </button>
          <button className="link-btn" onClick={onFinish}>
            Skip
          </button>
        </div>
        <div className="comms-feed" onClick={advance}>
          {lines.slice(0, shown).map((l, i) => {
            const isCur = i === shown - 1;
            const text = isCur ? l.text.slice(0, typed) : l.text;
            return (
              <div key={i} className={`comms-msg from-${l.who}`}>
                <Portrait who={l.who} size={48} accent={accent} />
                <div>
                  <div className="comms-name">{NAMES[l.who]}</div>
                  <p>
                    {text}
                    {isCur && typing && <span className="caret">▍</span>}
                  </p>
                </div>
              </div>
            );
          })}
          {allDone && extra}
          <div ref={endRef} />
        </div>
        <div className="comms-foot">
          <span className="muted small">{allDone ? '' : tapOr('Tap to continue', 'Click or press Enter')}</span>
          <button className="btn primary" onClick={advance} autoFocus>
            {allDone ? finishLabel : typing ? 'Skip typing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
