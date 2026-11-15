import { useCallback, useEffect, useMemo, useState } from 'react';
import { DISTRICTS, LEVELS, districtOf, levelById, levelsIn, type DistrictId, type Level } from './content/levels';
import { WORKSHOP_COLOR, blankProject, projectToLevel, unpackProject } from './content/share';
import { fresh, load, store, type SaveData, type Track, type WorkshopProject } from './save';
import { Comms, type CommsLine } from './ui/Comms';
import { Hub } from './ui/Hub';
import { LevelScreen } from './ui/LevelScreen';
import { Title, TrackSelect } from './ui/Title';
import { Workshop } from './ui/Workshop';
import type { GateId } from './ui/cityWorld';
import { getRunner } from './python/runner';

type Screen =
  | { kind: 'title' }
  | { kind: 'intro' }
  | { kind: 'track' }
  | { kind: 'hub' }
  | { kind: 'level'; id: string; nonce: number }
  | { kind: 'workshop' }
  | { kind: 'workshop-test' }
  | { kind: 'shared'; project: WorkshopProject };

const INTRO: CommsLine[] = [
  { who: 'vance', text: 'Patcher? Good, you’re awake. This is Director Vance, Nova Grid Emergency Code Team.' },
  { who: 'vance', text: 'Two nights ago the Glitch got into the city’s code. One by one, every district went dark.' },
  { who: 'vance', text: 'We can’t fix it by hand. We need someone who can write code, and a robot to carry it out.' },
  { who: 'kilo', text: 'That’s me! Kilo, courier unit K-1L0. I’m small, I’m fast, and I do exactly what my code says. Exactly.' },
  { who: 'vance', text: 'Restore the four districts. Then go to The Workshop and build something of your own. This city is yours to remake.' },
];

function sharedFromHash(): WorkshopProject | null {
  const m = location.hash.match(/#play=([\w-]+)/);
  return m ? unpackProject(m[1]) : null;
}

export function App() {
  const [save, setSaveState] = useState<SaveData>(() => load());
  const [screen, setScreen] = useState<Screen>(() => {
    const shared = sharedFromHash();
    if (shared) return load().track ? { kind: 'shared', project: shared } : { kind: 'track' };
    return { kind: 'title' };
  });
  const [lastGate, setLastGate] = useState<GateId | null>(null);
  const [wsVerified, setWsVerified] = useState(false);
  const unlockAll = useMemo(() => /unlock/.test(location.hash) || localStorage.getItem('relight.unlock') === '1', []);

  const setSave = useCallback((fn: (d: SaveData) => SaveData) => {
    setSaveState((old) => {
      const next = fn(old);
      store(next);
      return next;
    });
  }, []);

  // Start loading Python early: it is the slowest part of the first visit.
  useEffect(() => {
    void getRunner().ready().catch(() => undefined);
  }, []);

  const isDistrictOpen = useCallback(
    (d: DistrictId) => {
      if (unlockAll) return true;
      const i = DISTRICTS.findIndex((x) => x.id === d);
      if (i <= 0) return true;
      return levelsIn(DISTRICTS[i - 1].id).every((l) => save.progress[l.id]?.done);
    },
    [save, unlockAll],
  );

  const isLevelOpen = useCallback(
    (l: Level) => {
      if (unlockAll) return true;
      if (!isDistrictOpen(l.district)) return false;
      const ls = levelsIn(l.district);
      const i = ls.findIndex((x) => x.id === l.id);
      return i === 0 || !!save.progress[ls[i - 1].id]?.done;
    },
    [save, unlockAll, isDistrictOpen],
  );

  const track: Track = save.track ?? 'blocks';
  const setTrack = (t: Track) => setSave((d) => ({ ...d, track: t }));

  const playLevel = (l: Level) => {
    setLastGate(l.district);
    setScreen({ kind: 'level', id: l.id, nonce: Date.now() });
  };

  const project = save.workshop ?? blankProject('mission');

  // ----------------------------------------------------------- screens

  if (screen.kind === 'title') {
    return (
      <Title
        hasSave={!!save.track}
        onStart={() => setScreen(save.track && save.seenIntro ? { kind: 'hub' } : { kind: 'intro' })}
      />
    );
  }

  if (screen.kind === 'intro') {
    return (
      <div className="intro-screen">
        <Comms
          lines={INTRO}
          accent="#3FE3D1"
          title="NOVA GRID · EMERGENCY CHANNEL"
          finishLabel="I’m ready"
          onFinish={() => {
            setSave((d) => ({ ...d, seenIntro: true }));
            setScreen(save.track ? { kind: 'hub' } : { kind: 'track' });
          }}
        />
      </div>
    );
  }

  if (screen.kind === 'track') {
    return (
      <TrackSelect
        onPick={(t) => {
          setSave((d) => ({ ...d, track: t }));
          const shared = sharedFromHash();
          setScreen(shared ? { kind: 'shared', project: shared } : { kind: 'hub' });
        }}
      />
    );
  }

  if (screen.kind === 'level') {
    const level = levelById(screen.id)!;
    const d = districtOf(level);
    const idx = LEVELS.indexOf(level);
    const next = LEVELS[idx + 1];
    return (
      <LevelScreen
        key={`${level.id}-${screen.nonce}`}
        level={level}
        accent={d.color}
        districtName={d.name}
        track={track}
        savedPython={save.python[level.id]}
        savedBlocks={save.blocks[level.id]}
        onTrack={setTrack}
        onSaveCode={(py, bl) =>
          setSave((s) => ({
            ...s,
            python: py !== null ? { ...s.python, [level.id]: py } : s.python,
            blocks: bl !== null ? { ...s.blocks, [level.id]: bl } : s.blocks,
          }))
        }
        onComplete={({ stars }) =>
          setSave((s) => ({
            ...s,
            progress: { ...s.progress, [level.id]: { done: true, stars: Math.max(stars, s.progress[level.id]?.stars ?? 0) } },
          }))
        }
        onExit={() => setScreen({ kind: 'hub' })}
        onNext={
          next
            ? () => {
                if (next.district !== level.district) setScreen({ kind: 'hub' });
                else playLevel(next);
              }
            : () => setScreen({ kind: 'workshop' })
        }
      />
    );
  }

  if (screen.kind === 'workshop') {
    return (
      <Workshop
        project={project}
        verified={wsVerified}
        onChange={(p, structural) => {
          if (structural) setWsVerified(false);
          setSave((d) => ({ ...d, workshop: p }));
        }}
        onTest={() => setScreen({ kind: 'workshop-test' })}
        onShared={() => setSave((d) => ({ ...d, published: d.published + 1 }))}
        onBack={() => {
          setLastGate('workshop');
          setScreen({ kind: 'hub' });
        }}
      />
    );
  }

  if (screen.kind === 'workshop-test') {
    const level = projectToLevel(project, 'self');
    return (
      <LevelScreen
        level={level}
        accent={WORKSHOP_COLOR}
        districtName="Workshop test"
        track={track}
        savedPython={project.code || undefined}
        savedBlocks={project.blocks ?? undefined}
        onTrack={setTrack}
        skipBrief
        backLabel="← Workshop"
        onSaveCode={(py, bl, shown) =>
          setSave((d) => {
            const w = d.workshop ?? project;
            return { ...d, workshop: { ...w, code: py ?? shown, blocks: bl ?? (py !== null ? null : w.blocks) } };
          })
        }
        onComplete={() => setWsVerified(true)}
        onExit={() => setScreen({ kind: 'workshop' })}
        onNext={() => setScreen({ kind: 'workshop' })}
        nextLabel="Back to Workshop →"
      />
    );
  }

  if (screen.kind === 'shared') {
    const p = screen.project;
    const level = projectToLevel(p, 'shared');
    const forced: Track = p.mode === 'arcade' && !p.blocks ? 'python' : track;
    return (
      <LevelScreen
        level={level}
        accent={WORKSHOP_COLOR}
        districtName="Made by a Patcher"
        track={forced}
        savedPython={p.mode === 'arcade' ? p.code : undefined}
        savedBlocks={p.mode === 'arcade' && p.blocks ? p.blocks : undefined}
        onTrack={setTrack}
        onSaveCode={() => undefined}
        onComplete={() => undefined}
        onExit={() => {
          history.replaceState(null, '', location.pathname + location.search);
          setScreen({ kind: 'hub' });
        }}
        extraAction={{
          label: 'Remix in Workshop',
          run: () => {
            if (save.workshop && !window.confirm('Copy this level into your Workshop? It will replace your current project.')) return;
            setSave((d) => ({ ...d, workshop: { ...p, title: `${p.title} (remix)`.slice(0, 40) } }));
            setWsVerified(false);
            history.replaceState(null, '', location.pathname + location.search);
            setScreen({ kind: 'workshop' });
          },
        }}
      />
    );
  }

  return (
    <Hub
      save={save}
      unlockAll={unlockAll}
      isDistrictOpen={isDistrictOpen}
      isLevelOpen={isLevelOpen}
      onPlay={playLevel}
      onWorkshop={() => setScreen({ kind: 'workshop' })}
      onTrack={setTrack}
      lastGate={lastGate}
      onReset={() => {
        if (!window.confirm('Reset all progress, code and your Workshop level on this computer?')) return;
        const f = fresh();
        store(f);
        setSaveState(f);
        setScreen({ kind: 'title' });
      }}
    />
  );
}
