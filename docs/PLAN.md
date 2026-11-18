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
3. **More districts**: Search (pathfinding), Learning (train from examples), Reward (train with score). Functions is done: The Foundry (6 levels, added 2026-11-17) covers `def`, parameters, variables, nested loops and general functions on unseen maps. A level can list `needs` so a win that skips the idea gets a nudge instead of stars.
4. **Workshop v2**: more tiles (doors, keys, moving glitches), sprite choice, and blocks-only mode for arcade games.
5. **Art pass**: commissioned character art for Vance and Kilo (currently SVG and canvas drawings).
6. **Teacher view**: progress per pupil, answers, and the `#unlock` switch as a proper setting.

## Next build: make the hub feel like a city

Requested 2026-11-17: the open world should look and feel like a living city, not a map.

**Status (2026-11-18, `dev` branch):** first version built in `src/ui/city3d.ts`.
- Done: three.js city (loaded only when the hub opens), lit windows per district, rooftop billboards, pedestrians, a talking local at every gate, cars that stop for Kilo, drones over the Spires, Foundry steam, and portal gates with power rings.
- Done: quest tracker ("Next job" with Go there and Play), approach card with progress, labelled minimap.
- Done: the flat map stays as a menu option and as the automatic fallback when WebGL fails.
- Still to do: traffic lights, and a real-device frame-rate check on a school laptop and an iPad. The renderer lowers its resolution by itself when frames are slow.

Original idea list:

- **Move the hub to three.js**: a low-poly neon city at a tilted 3D angle, Kilo driving the streets, with the same districts, gates and progress rules. Keep the current 2D canvas as the fallback for slow school laptops and older iPads.
- **People**: simple pedestrians and other bots walking the pavements, more of them in districts that are lit, and a few who say a line when Kilo passes (hints, jokes, district lore).
- **Adverts and signs**: neon billboards and shop signs, some playful ("Loop Line: Repeat Yourself!"). They switch on when their district is restored.
- **City life**: traffic lights, cars on the avenues, drones over the Spires, and steam in the Foundry.
- **More UI**: a proper minimap with labels, a quest tracker showing the next level, and a district preview card on approach.
- **Budget**: keep the first load small (three.js is about 150 KB gzipped, on top of Pyodide). Test frame rate on a 1366×768 school laptop and an iPad before shipping.

## Known limits

- Desktop only (keyboard needed for arcade games).
- First load downloads ~4 MB (gzipped) of Python runtime; later loads are cached.
- Shared links are not moderated. Fine for a POC, but this needs the class gallery before wider use.
