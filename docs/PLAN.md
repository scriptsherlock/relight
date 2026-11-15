# Relight: plan and next steps

Updated 2026-11-15.

## Where it fits

turing-education.app already has Type Lab (Years 1–2), Maze Lab (blocks, Years 3–5), Code Lab (Python, Year 6+) and AI Fundamentals (15 modules, ages 7–13). What the site lacks is **a game world with a story** and **any way for pupils to make and share their own work**.

Relight fills both gaps:

- It **bridges Maze Lab → Code Lab**: the same level is playable in blocks or Python, and blocks turn into Python on demand.
- It is the **"make your own" layer**: The Workshop lets pupils build missions and arcade games and share them by link.
- It carries the **AI ideas that AI Fundamentals doesn't cover**, through play:

| AI idea | Where it appears in Relight | Covered by AI Fundamentals? |
|---|---|---|
| Rules vs learning | Every level is hand-written rules; the planned Learning district trains a creature from examples instead | Yes (module 1) |
| Testing on unseen examples (generalisation) | Signal Spires: code is run on hidden test maps | Partly |
| Search and planning | Planned district: pathfinding (the Maze Courier idea) | No |
| Game AI: simple rules that look clever | The Arcade: `g.move_toward_bot()` | No |
| Learning from reward | Planned: train an enemy with score, not code | No |
| Data shapes behaviour | Planned Learning district: biased training examples | Yes (modules 3, 6) |

## Next steps (suggested order)

1. **Playtest with a class**: watch where pupils get stuck in Docks 5, Spires 3 and Arcade 1.
2. **Accounts and class gallery**: plug into the site's class codes so shared levels go to a teacher-approved class gallery instead of raw links.
3. **More districts**: Search (pathfinding), Functions (`def`), Learning (train from examples), Reward (train with score).
4. **Workshop v2**: more tiles (doors, keys, moving glitches), sprite choice, and blocks-only mode for arcade games.
5. **Art pass**: commissioned character art for Vance and Kilo (currently SVG and canvas drawings).
6. **Teacher view**: progress per pupil, answers, and the `#unlock` switch as a proper setting.

## Known limits

- Desktop only (keyboard needed for arcade games).
- First load downloads ~4 MB (gzipped) of Python runtime; later loads are cached.
- Shared links are not moderated. Fine for a POC, but this needs the class gallery before wider use.
