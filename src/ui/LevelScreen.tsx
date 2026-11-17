// One level: briefing, stage, code (blocks or Python), console, results.
// Handles both missions (run once, replay) and arcade games (live events).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { codeLines, unmetNeed, type Level } from '../content/levels';
import type { Frame, MissionResult, Snapshot } from '../engine/types';
import { getRunner, type ArcadeReply } from '../python/runner';
import type { Track } from '../save';
import { BlocksEditor } from './BlocksEditor';
import { cleanPython, starterState } from './blocks';
import { CodeEditor } from './CodeEditor';
import { Comms, Portrait, type CommsLine } from './Comms';
import { Stage, type StageHandle } from './Stage';
import { useRunnerStatus } from './useRunner';
import { isTouch, tapOr } from './device';
import { TouchPad } from './TouchPad';

export interface LevelOutcome {
  stars: number;
}

interface Props {
  level: Level;
  accent: string;
  districtName: string;
  track: Track;
  savedPython?: string;
  savedBlocks?: object;
  onTrack: (t: Track) => void;
  onSaveCode: (python: string | null, blocks: object | null, shownPython: string) => void;
  onComplete: (o: LevelOutcome) => void;
  onExit: () => void;
  onNext?: () => void;
  /** Optional extra button on the top bar (e.g. Remix for shared levels). */
  extraAction?: { label: string; run: () => void };
  skipBrief?: boolean;
  backLabel?: string;
  nextLabel?: string;
}

type LogKind = 'kilo' | 'error' | 'warn' | 'print' | 'ok' | 'hint' | 'info';
interface LogLine {
  kind: LogKind;
  title?: string;
  text: string;
  line?: number;
}

type Phase = 'brief' | 'edit' | 'running' | 'playing' | 'arcade' | 'result';

const SPEEDS = [1, 2, 4];
const KEYMAP: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  ' ': 'space',
};

export function LevelScreen(props: Props) {
  const { level, accent, track } = props;
  const isArcade = level.mode === 'arcade';
  const runner = getRunner();
  const pyStatus = useRunnerStatus();

  const [phase, setPhase] = useState<Phase>(props.skipBrief ? 'edit' : 'brief');
  const [python, setPython] = useState(props.savedPython ?? level.python);
  const [blocksRunnable, setBlocksRunnable] = useState('');
  const blocksState = useRef<object>(props.savedBlocks ?? starterState(level.blocks));
  const [blocksKey, setBlocksKey] = useState(0);
  const [showPy, setShowPy] = useState(true);
  const [mapIdx, setMapIdx] = useState(0);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [runLine, setRunLine] = useState(0);
  const [errorLine, setErrorLine] = useState(0);
  const [hlBlock, setHlBlock] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([{ kind: 'kilo', text: level.kilo }]);
  const [speed, setSpeed] = useState(1);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [stars, setStars] = useState(0);
  const [arcadeState, setArcadeState] = useState<Snapshot | null>(null);
  const [arcadeTime, setArcadeTime] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [failNote, setFailNote] = useState<string | null>(null);
  const [fastWin, setFastWin] = useState(false);
  const [logOpen, setLogOpen] = useState(true);
  const [unread, setUnread] = useState(0);
  const stage = useRef<StageHandle>(null);
  const stageWrap = useRef<HTMLDivElement>(null);
  const logEnd = useRef<HTMLDivElement>(null);
  const playingRun = useRef(0);
  const arcadeAlive = useRef(false);
  const arcadeStart = useRef(0);

  const code = track === 'python' ? python : blocksRunnable;
  const shownCode = track === 'python' ? python : cleanPython(blocksRunnable);
  const lines = codeLines(shownCode);

  useEffect(() => {
    void runner.ready().catch(() => undefined);
  }, [runner]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' });
  }, [log]);

  const logOpenRef = useRef(logOpen);
  logOpenRef.current = logOpen;
  const addLog = useCallback((l: LogLine | LogLine[]) => {
    const items = Array.isArray(l) ? l : [l];
    setLog((old) => [...old, ...items].slice(-60));
    if (!logOpenRef.current) setUnread((n) => n + items.length);
  }, []);

  // Save code as it changes.
  useEffect(() => {
    const id = window.setTimeout(() => props.onSaveCode(track === 'python' ? python : null, track === 'blocks' ? blocksState.current : null, shownCode), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [python, blocksRunnable, track]);

  // ------------------------------------------------------------ missions

  const computeStars = (extraOk: boolean) => 1 + (lines <= level.par ? 1 : 0) + (extraOk ? 1 : 0);

  const runMission = async () => {
    if (!code.trim()) {
      addLog({ kind: 'warn', title: 'Nothing to run', text: track === 'blocks' ? 'Drag some blocks into the workspace first.' : 'Type some code first.' });
      return;
    }
    setPhase('running');
    setErrorLine(0);
    setFailNote(null);
    addLog({ kind: 'info', text: `▶ Running on ${level.maps.length > 1 ? `${level.maps.length} test maps` : 'the map'}…` });
    let r: MissionResult;
    try {
      r = await runner.runMission(code, level.maps, level.goals);
    } catch {
      addLog({ kind: 'error', title: 'Python didn’t start', text: 'Kilo’s Python core failed to load. Check your connection and refresh the page.' });
      setPhase('edit');
      return;
    }
    if (r.timedOut) {
      addLog({
        kind: 'error',
        title: 'Stuck in a loop',
        text: 'Your code ran for ever without giving Kilo a command. Look for a while loop that can never stop.',
      });
      setPhase('edit');
      return;
    }
    if (r.warnings.length) addLog(r.warnings.map((w) => ({ kind: 'warn' as const, title: w.title, text: w.detail, line: w.line })));
    setResult(r);
    const firstFail = r.runs.findIndex((x) => !x.won);
    const play = firstFail === -1 ? 0 : r.runs[0].won ? firstFail : 0;
    startPlayback(r, play);
  };

  const pendingFrames = useRef<Frame[] | null>(null);
  const [playToken, setPlayToken] = useState(0);
  const startPlayback = (r: MissionResult, idx: number) => {
    playingRun.current = idx;
    pendingFrames.current = r.runs[idx].frames;
    setMapIdx(idx);
    setPhase('playing');
    setPlayToken((t) => t + 1);
  };
  // Runs after the Stage has (re)mounted for this map's rows.
  useEffect(() => {
    if (pendingFrames.current) {
      stage.current?.load(pendingFrames.current);
      pendingFrames.current = null;
    }
  }, [playToken]);

  const onFrame = useCallback(
    (f: Frame) => {
      setRunLine(track === 'python' ? f.line : 0);
      setHlBlock(f.block);
      if (f.ev.t === 'print') addLog({ kind: 'print', text: f.ev.text });
      if (f.ev.t === 'say') addLog({ kind: 'kilo', text: f.ev.text });
      if (f.ev.t === 'banner') setBanner(f.ev.text);
      if (isArcade) setArcadeState(f.state);
    },
    [track, addLog, isArcade],
  );

  const onPlaybackDone = useCallback(() => {
    if (isArcade || !result) return;
    const idx = playingRun.current;
    const run = result.runs[idx];
    setRunLine(0);
    setHlBlock(null);
    const allWon = result.runs.every((x) => x.won);
    if (run.error) {
      setErrorLine(run.error.line);
      addLog({ kind: 'error', title: run.error.title, text: run.error.detail, line: run.error.line });
    } else if (!run.won) {
      addLog({ kind: 'error', title: 'Not yet', text: run.reason });
    }
    const unmet = allWon ? unmetNeed(level, shownCode) : null;
    if (unmet) {
      addLog({ kind: 'warn', title: 'Nearly there', text: unmet });
      setFailNote(unmet);
      setPhase('edit');
      return;
    }
    if (allWon) {
      const s = computeStars(hintsUsed === 0);
      setStars(s);
      addLog({ kind: 'ok', title: 'Mission complete', text: level.maps.length > 1 ? `It worked on all ${level.maps.length} test maps!` : run.reason });
      setPhase('result');
      props.onComplete({ stars: s });
      return;
    }
    if (run.won && !allWon) {
      const bad = result.runs.findIndex((x) => !x.won);
      setFailNote(`Your code worked here, but not on test map ${bad + 1}.`);
      addLog({ kind: 'warn', title: `Map ${idx + 1} passed`, text: `But test map ${bad + 1} failed. Watching it now…` });
      window.setTimeout(() => startPlayback(result, bad), 900);
      return;
    }
    if (level.maps.length > 1) {
      const passed = result.runs.filter((x) => x.won).length;
      setFailNote(`${passed} of ${level.maps.length} test maps passed.`);
    }
    setPhase('edit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, isArcade, hintsUsed, lines, shownCode]);

  // ------------------------------------------------------------- arcade

  const stopArcade = useCallback(() => {
    arcadeAlive.current = false;
  }, []);

  const handleArcadeReply = useCallback(
    (rep: ArcadeReply | null | 'timeout') => {
      if (!arcadeAlive.current || rep === null) return;
      if (rep === 'timeout') {
        arcadeAlive.current = false;
        addLog({ kind: 'error', title: 'Game froze', text: 'One of your event functions never finished. Check for a while loop that never stops.' });
        setPhase('edit');
        return;
      }
      stage.current?.push(rep.frames);
      setArcadeState(rep.state);
      if (rep.state.banner) setBanner(rep.state.banner);
      for (const f of rep.frames) {
        if (f.ev.t === 'print') addLog({ kind: 'print', text: f.ev.text });
      }
      if (rep.error) {
        arcadeAlive.current = false;
        setErrorLine(rep.error.line);
        addLog({ kind: 'error', title: rep.error.title, text: rep.error.detail, line: rep.error.line });
        setPhase('edit');
        return;
      }
      if (rep.state.status !== 'running') {
        arcadeAlive.current = false;
        const secs = (performance.now() - arcadeStart.current) / 1000;
        if (rep.state.status === 'won') {
          const need = level.arcade?.needGlitchMoves ?? 0;
          if (rep.glitchMoves < need) {
            addLog({ kind: 'warn', title: 'You won… too easily', text: 'The glitches never moved! Use on_tick to make them chase Kilo, then beat your game again.' });
            setPhase('edit');
            return;
          }
          const fast = secs <= (level.arcade?.timeLimit ?? 60);
          setFastWin(fast);
          const s = computeStars(fast);
          setStars(s);
          addLog({ kind: 'ok', title: 'You won!', text: `${rep.reason} (${secs.toFixed(1)} s)` });
          window.setTimeout(() => {
            setPhase('result');
            props.onComplete({ stars: s });
          }, 900);
        } else {
          addLog({ kind: 'error', title: 'Game over', text: rep.reason || 'Kilo lost.' });
          setPhase('edit');
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addLog, level, lines],
  );

  const runArcade = async () => {
    if (!code.trim()) return;
    setErrorLine(0);
    setBanner(null);
    setPhase('running');
    addLog({ kind: 'info', text: tapOr('▶ Game loading. Use the arrows and ZAP under the game.', '▶ Game loading. Use the arrow keys (or WASD) and space.') });
    stage.current?.reset();
    const rep = await runner.arcadeLoad(code, level.maps[0]);
    if (rep !== 'timeout' && rep.warnings?.length) addLog(rep.warnings.map((w) => ({ kind: 'warn' as const, title: w.title, text: w.detail, line: w.line })));
    arcadeAlive.current = true;
    arcadeStart.current = performance.now();
    setArcadeTime(0);
    setPhase('arcade');
    stageWrap.current?.focus();
    handleArcadeReply(rep);
  };

  const sendKey = useCallback(
    async (k: string) => {
      if (!arcadeAlive.current) return;
      handleArcadeReply(await runner.arcade('arcade-key', k));
    },
    [runner, handleArcadeReply],
  );

  useEffect(() => {
    if (phase !== 'arcade') return;
    const tick = window.setInterval(async () => {
      if (!arcadeAlive.current) return;
      setArcadeTime((performance.now() - arcadeStart.current) / 1000);
      handleArcadeReply(await runner.arcade('arcade-tick'));
    }, 500);
    const onKey = (e: KeyboardEvent) => {
      const k = KEYMAP[e.key] ?? KEYMAP[e.key.toLowerCase()];
      if (!k || !arcadeAlive.current) return;
      if ((e.target as HTMLElement)?.closest?.('.cm-editor, input, textarea')) return;
      e.preventDefault();
      if (e.repeat && k === 'space') return;
      void sendKey(k);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(tick);
      window.removeEventListener('keydown', onKey);
    };
  }, [phase, runner, handleArcadeReply, sendKey]);

  useEffect(() => () => stopArcade(), [stopArcade]);

  // ------------------------------------------------------------- actions

  const reset = () => {
    stopArcade();
    setPhase('edit');
    setRunLine(0);
    setErrorLine(0);
    setHlBlock(null);
    setBanner(null);
    setFailNote(null);
    setArcadeState(null);
    stage.current?.reset();
  };

  const resetCode = () => {
    if (!window.confirm('Start this level’s code again from the beginning?')) return;
    reset();
    setPython(level.python);
    blocksState.current = starterState(level.blocks);
    setBlocksKey((k) => k + 1);
  };

  const hintCount = level.hints.length;
  const hint = () => {
    setLogOpen(true);
    setUnread(0);
    if (hintsUsed < hintCount) {
      setHintsUsed(hintsUsed + 1);
      addLog({ kind: 'hint', title: `Hint ${hintsUsed + 1} of ${hintCount}`, text: level.hints[hintsUsed] });
      return;
    }
    // Every hint is out already: show them again only if they have left the log.
    const missing = level.hints
      .map((text, i) => ({ kind: 'hint' as const, title: `Hint ${i + 1} of ${hintCount}`, text }))
      .filter((h) => !log.some((l) => l.kind === 'hint' && l.title === h.title));
    if (missing.length) addLog(missing);
  };

  const switchTrack = (t: Track) => {
    if (t === track) return;
    reset();
    if (t === 'python' && cleanPython(blocksRunnable).trim()) {
      setPython(cleanPython(blocksRunnable) + '\n');
      addLog({ kind: 'info', text: 'Your blocks have turned into Python. This is the same program, typed.' });
    }
    props.onTrack(t);
  };

  const busy = phase === 'running' || phase === 'playing' || phase === 'arcade';
  const rows = level.maps[mapIdx] ?? level.maps[0];

  const briefLines: CommsLine[] = useMemo(
    () => [...level.brief.map((text) => ({ who: 'vance' as const, text })), { who: 'kilo' as const, text: level.kilo }],
    [level],
  );

  const goalsList = [
    { ok: phase === 'result', text: level.goal },
    { ok: lines <= level.par && lines > 0, text: `Use ${level.par} lines of code or fewer (now ${lines})` },
    isArcade
      ? { ok: fastWin, text: `Win in under ${level.arcade?.timeLimit ?? 60} seconds` }
      : { ok: hintsUsed === 0, text: 'Finish without hints' },
  ];

  return (
    <div className={`level ${phase === 'arcade' ? 'is-live' : ''}`} style={{ ['--accent' as string]: accent }}>
      <header className="topbar">
        <button className="btn ghost" onClick={() => (stopArcade(), props.onExit())} aria-label={props.backLabel ? 'Back' : 'Back to the city'}>
          {props.backLabel ?? '← City'}
        </button>
        <div className="crumbs">
          <span className="crumb-district">{props.districtName}</span>
          <h1>{level.title}</h1>
        </div>
        <div className="top-actions">
          {props.extraAction && (
            <button className="btn ghost" onClick={props.extraAction.run}>
              {props.extraAction.label}
            </button>
          )}
          <div className="track-toggle" role="group" aria-label="How do you want to code?">
            <button className={track === 'blocks' ? 'on' : ''} onClick={() => switchTrack('blocks')} aria-pressed={track === 'blocks'}>
              Blocks
            </button>
            <button className={track === 'python' ? 'on' : ''} onClick={() => switchTrack('python')} aria-pressed={track === 'python'}>
              Python
            </button>
          </div>
        </div>
      </header>

      <main className="level-grid">
        <section className="play-col">
          <div className="goal-bar">
            <span className="goal-label">MISSION</span>
            <span>{level.goal}</span>
            <button className="link-btn" onClick={() => setPhase('brief')} disabled={busy}>
              Replay briefing
            </button>
          </div>
          <div className={`stage-wrap ${phase === 'arcade' ? 'live' : ''}`} ref={stageWrap} tabIndex={-1}>
            <Stage
              key={`${level.id}-${mapIdx}`}
              ref={stage}
              rows={rows}
              accent={accent}
              speed={speed}
              live={isArcade}
              onFrame={onFrame}
              onDone={onPlaybackDone}
              label={`${level.title} map${level.maps.length > 1 ? ` ${mapIdx + 1}` : ''}`}
            />
            {isArcade && (phase === 'arcade' || arcadeState) && (
              <div className="hud">
                <span>★ {arcadeState?.score ?? 0}</span>
                <span>⚡ {arcadeState ? arcadeState.cells.filter((c) => !c.taken).length : '-'} left</span>
                <span>⏱ {arcadeTime.toFixed(0)} s</span>
              </div>
            )}
            {banner && <div className="banner">{banner}</div>}
            {isArcade && phase === 'edit' && (
              <div className="stage-hint">Write your game rules, then press <b>Build &amp; play</b>.</div>
            )}
            {phase === 'running' && <div className="stage-hint">Compiling… <span className="spinner" /></div>}
          </div>
          {isArcade && isTouch && <TouchPad onKey={(k) => void sendKey(k)} enabled={phase === 'arcade'} />}
          {level.maps.length > 1 && (
            <div className="map-tabs" role="tablist" aria-label="Test maps">
              <span className="muted small">TEST MAPS</span>
              {level.maps.map((_, i) => {
                const run = result?.runs[i];
                const mark = run ? (run.won ? '✓' : '✗') : i === 0 ? '' : '?';
                return (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={mapIdx === i}
                    className={`map-tab ${mapIdx === i ? 'on' : ''} ${run ? (run.won ? 'pass' : 'fail') : ''}`}
                    disabled={busy || (!result && i > 0)}
                    onClick={() => (result ? startPlayback(result, i) : setMapIdx(i))}
                    title={!result && i > 0 ? 'Hidden until you run your code' : undefined}
                  >
                    Map {i + 1} {mark}
                  </button>
                );
              })}
              {failNote && <span className="fail-note">{failNote}</span>}
            </div>
          )}
          <ul className="stars-goals">
            {goalsList.slice(0, level.par >= 99 ? 1 : 3).map((g, i) => (
              <li key={i} className={phase === 'result' && (i === 0 || g.ok) ? 'ok' : g.ok ? 'on-track' : ''}>
                <span className="star">{phase === 'result' && (i === 0 || g.ok) ? '★' : '☆'}</span>
                {g.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="code-col">
          {level.newCommands.length > 0 && (
            <details className="manual" open={track === 'python'}>
              <summary>Kilo’s manual: new this level</summary>
              <ul>
                {level.newCommands.map((c) => (
                  <li key={c.code}>
                    <code>{c.code}</code>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="editor-box">
            {track === 'python' ? (
              <CodeEditor value={python} onChange={setPython} runLine={runLine} errorLine={errorLine} onRun={() => (isArcade ? runArcade() : runMission())} />
            ) : (
              <BlocksEditor
                state={blocksState.current}
                loadKey={`${level.id}-${blocksKey}`}
                tools={level.tools}
                highlight={hlBlock}
                onChange={(runnable, st) => {
                  setBlocksRunnable(runnable);
                  blocksState.current = st;
                }}
              />
            )}
          </div>
          {track === 'blocks' && (
            <div className={`py-preview ${showPy ? '' : 'closed'}`}>
              <button className="link-btn" onClick={() => setShowPy((s) => !s)} aria-expanded={showPy}>
                {showPy ? '▾' : '▸'} The Python your blocks make
              </button>
              {showPy && <pre>{cleanPython(blocksRunnable) || '# Drag blocks in to write Python'}</pre>}
            </div>
          )}
          <div className="console-head">
            <span className="console-title">KILO’S LOG</span>
            {!logOpen && unread > 0 && <span className="unread">{unread} new</span>}
            <button
              className="link-btn"
              onClick={() => {
                setLogOpen((o) => !o);
                setUnread(0);
              }}
              aria-expanded={logOpen}
            >
              {logOpen ? 'Hide ▾' : 'Show ▸'}
            </button>
          </div>
          <div className={`console ${logOpen ? '' : 'closed'}`} aria-live="polite" hidden={!logOpen}>
            {log.map((l, i) => (
              <div key={i} className={`log log-${l.kind}`}>
                {l.kind === 'kilo' && <Portrait who="kilo" size={24} accent={accent} />}
                <div>
                  {l.title && (
                    <strong>
                      {l.title}
                      {l.line ? ` · line ${l.line}` : ''}
                    </strong>
                  )}
                  <span>{l.kind === 'print' ? `> ${l.text}` : l.text}</span>
                </div>
              </div>
            ))}
            <div ref={logEnd} />
          </div>
          <div className="run-bar">
            {busy ? (
              <button className="btn danger" onClick={reset}>
                ■ Stop
              </button>
            ) : (
              <button className="btn primary run" onClick={() => (isArcade ? runArcade() : runMission())}>
                {isArcade ? '▶ Build & play' : '▶ Run'}
              </button>
            )}
            <button className="btn ghost" onClick={resetCode} disabled={busy}>
              ↺ Start again
            </button>
            {!isArcade && (
              <div className="speed" role="group" aria-label="Playback speed">
                {SPEEDS.map((s) => (
                  <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)} aria-pressed={speed === s}>
                    {s}×
                  </button>
                ))}
              </div>
            )}
            <button className="btn ghost" onClick={hint} disabled={busy} title={hintsUsed >= hintCount ? 'You have seen every hint. They are in Kilo’s log.' : undefined}>
              {hintsUsed === 0 ? 'Hint' : hintsUsed < hintCount ? 'Next hint' : 'Show hints'}
            </button>
            <span className={`py-status ${pyStatus}`} title="Kilo's Python core">
              {pyStatus === 'ready' ? 'Python' : pyStatus === 'booting' ? 'Loading…' : pyStatus === 'failed' ? 'Python failed' : ''}
            </span>
          </div>
        </section>
      </main>

      {phase === 'brief' && (
        <Comms
          lines={briefLines}
          accent={accent}
          title={`${props.districtName.toUpperCase()} · ${level.title.toUpperCase()}`}
          extra={
            level.newCommands.length > 0 && (
              <div className="new-commands">
                <div className="comms-name">NEW COMMANDS</div>
                {level.newCommands.map((c) => (
                  <div key={c.code} className="cmd-card">
                    <code>{c.code}</code>
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
            )
          }
          onFinish={() => setPhase('edit')}
        />
      )}

      {phase === 'result' && (
        <div className="result-backdrop">
          <div className="result-card" role="dialog" aria-modal="true" aria-label="Level complete">
            <div className="stamp">POWER RESTORED</div>
            <div className="big-stars" aria-label={`${stars} of 3 stars`}>
              {[1, 2, 3].map((n) => (
                <span key={n} className={n <= stars ? 'got' : ''} style={{ animationDelay: `${n * 0.18}s` }}>
                  ★
                </span>
              ))}
            </div>
            <div className="learn">
              <span className="learn-tag">GROWN-UP WORD</span>
              <strong>{level.learn.word}</strong>
              <p>{level.learn.text}</p>
            </div>
            {stars < 3 && <p className="muted small">Replay any time to earn all three stars.</p>}
            <div className="result-actions">
              <button className="btn ghost" onClick={reset}>
                Replay
              </button>
              {!props.nextLabel && (
                <button className="btn ghost" onClick={props.onExit}>
                  City map
                </button>
              )}
              {props.onNext && (
                <button className="btn primary" onClick={props.onNext} autoFocus>
                  {props.nextLabel ?? 'Next level →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
