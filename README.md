# Relight (working title)

A level-based coding game. Pupils write code (blocks or real Python) to guide Kilo, a courier robot, through a dark neon city, district by district. Then they build and share their own levels and arcade games in The Workshop.

Proof of concept. Desktop browsers only.

## Run it

Node 22 or newer.

```sh
npm install
npm run dev        # http://127.0.0.1:5180/
npm test           # every level's solution through real Python, plus error messages
npm run build      # static site in dist/ (works on GitHub Pages)
```

On Windows, run `npm test` from PowerShell. Vitest breaks if the drive letter is lowercase (`/e/...` in Git Bash).

Teacher shortcut: add `#unlock` to the URL to open every district.

## What's in the POC

| Area | What pupils do | Coding idea |
|---|---|---|
| Title, story intro, track choice | Meet Director Vance and Kilo. Pick **Blocks** or **Python** (switch at any time) | |
| City hub (open world) | Drive Kilo round Nova Grid; districts light up as they're restored | |
| The Docks (5 levels) | Move, collect cells, zap glitches | Sequences, commands, inputs |
| Loop Line (3) | Stairs, alleys, snakes | `for` loops, patterns |
| Signal Spires (3) | Code is run on **hidden test maps** | `if`/`else`, `while`, sensing. Also generalisation, an AI idea |
| The Arcade (2) | Write `on_key`, `on_tick` and `on_collect` to build a playable game | Events, game AI |
| The Workshop | Paint a map, prove it can be beaten, share it as a link; or code your own arcade game | Making, testing, sharing |

Each level has a briefing, three stars (finish / short code / no hints or fast win), and a "grown-up word" card.

## How it works

- **Real Python** runs in the browser through [Pyodide](https://pyodide.org), inside a Web Worker. Nothing is sent to a server. An endless loop is stopped by a 400-action battery and by restarting the worker.
- **One simulation** (`src/engine/sim.ts`) is shared by the Python worker and the tests. Missions run instantly, then replay as animation with the running line (or block) highlighted.
- **Blocks** (Blockly) generate the same Python. Switching to Python turns your blocks into typed code.
- **Friendly errors** (`src/python/prelude.py`) explain the error and suggest fixes, such as "Kilo can't "move_rigth". Did you mean bot.move_right()?", missing colons, spacing problems and missing brackets.
- **Sharing needs no server**: a Workshop level is packed into the URL after `#play=`. Mission links hide the solution. Game links include the code so friends can remix.
- **Save** is `localStorage` only.

```
src/engine/    sim.ts (rules), renderer.ts (canvas), types.ts
src/python/    prelude.py (bot/game API + errors), host.ts, worker.ts, runner.ts
src/content/   levels.ts (all levels + solutions), share.ts (Workshop links)
src/ui/        Hub + cityWorld (open world), LevelScreen, Stage, CodeEditor, BlocksEditor, Workshop, Comms, Title
tests/unit/    sim + level solvability + error messages (Pyodide in Node)
tools/qa/      Playwright walk-throughs (screenshots to qa-shots/)
```

See [docs/PLAN.md](docs/PLAN.md) for how this fits the Turing Education pathway and what comes next.
