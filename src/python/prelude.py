# Relight Python prelude. Runs inside Pyodide in a Web Worker.
# Defines `bot` (Kilo) and `game`, runs pupil code, and turns Python errors
# into short, friendly explanations.

import sys, ast, json, difflib, random, builtins
import _world

PLAYER = "<player>"
DIRS = ("up", "down", "left", "right")
KEYS = ("up", "down", "left", "right", "space")


class _Stop(BaseException):
    """Ends the pupil's program. BaseException so `except Exception` can't swallow it."""


def _line():
    f = sys._getframe(1)
    while f is not None:
        if f.f_code.co_filename == PLAYER:
            return f.f_lineno
        f = f.f_back
    return 0


def _act(name, a=None, b=None):
    r = _world.act(name, a, b, _line())
    if r.s != "ok":
        raise _Stop()
    return getattr(r, "v", None)


def _dir(d, cmd):
    if isinstance(d, str) and d.strip().lower() in DIRS:
        return d.strip().lower()
    guess = difflib.get_close_matches(str(d).lower(), DIRS, n=1)
    hint = f' Did you mean "{guess[0]}"?' if guess else ""
    raise ValueError(f'{cmd}() needs a direction in quotes: "up", "down", "left" or "right".{hint}')


def _steps(n, cmd):
    if isinstance(n, bool) or not isinstance(n, int):
        raise TypeError(f"{cmd}() needs a whole number of steps, like bot.{cmd}(3).")
    if n < 1:
        raise ValueError(f"{cmd}() needs at least 1 step.")
    return min(n, 50)


class Bot:
    """Kilo, the courier robot."""

    def move_up(self, steps=1):
        _act("move", "up", _steps(steps, "move_up"))

    def move_down(self, steps=1):
        _act("move", "down", _steps(steps, "move_down"))

    def move_left(self, steps=1):
        _act("move", "left", _steps(steps, "move_left"))

    def move_right(self, steps=1):
        _act("move", "right", _steps(steps, "move_right"))

    def zap(self, direction=None):
        _act("zap", None if direction is None else _dir(direction, "zap"))

    def look(self, direction):
        return str(_act("look", _dir(direction, "look")))

    def say(self, message):
        _act("say", str(message))

    def at_exit(self):
        return bool(_act("at_exit"))

    def cells_left(self):
        return int(_act("cells_left"))

    @property
    def x(self):
        return int(_world.bot_x())

    @property
    def y(self):
        return int(_world.bot_y())

    def __repr__(self):
        return "Kilo"


BOT_METHODS = [m for m in dir(Bot) if not m.startswith("_")]


class Glitch:
    def __init__(self, gid):
        self._id = gid

    def move_toward_bot(self):
        _world.glitch_toward(self._id, _line())

    def move(self, direction):
        _world.glitch_move(self._id, _dir(direction, "move"), _line())

    def move_random(self):
        _world.glitch_move(self._id, random.choice(DIRS), _line())

    @property
    def x(self):
        return int(_world.glitch_x(self._id))

    @property
    def y(self):
        return int(_world.glitch_y(self._id))

    def __repr__(self):
        return f"Glitch {self._id}"


class Game:
    """Rules for arcade games the pupil builds."""

    def __init__(self):
        self._keys = {}
        self._ticks = []
        self._collects = []
        self._exits = []
        self._starts = []

    # --- actions ---
    def glitches(self):
        return [Glitch(int(i)) for i in _world.glitch_ids().to_py()]

    def win(self, message="You win!"):
        _world.game_end("won", str(message), _line())
        raise _Stop()

    def lose(self, message="Game over!"):
        _world.game_end("lost", str(message), _line())
        raise _Stop()

    def say(self, message):
        _world.banner(str(message), _line())

    def add_score(self, points=1):
        _world.add_score(int(points), _line())

    @property
    def score(self):
        return int(_world.score())

    def cells_left(self):
        return int(_world.cells_left())

    # --- event decorators (blocks generate these) ---
    def when_key(self, key):
        def deco(fn):
            self._keys.setdefault(str(key), []).append(fn)
            return fn
        return deco

    def every_tick(self, fn):
        self._ticks.append(fn)
        return fn

    def when_collect(self, fn):
        self._collects.append(fn)
        return fn

    def when_exit(self, fn):
        self._exits.append(fn)
        return fn

    def when_start(self, fn):
        self._starts.append(fn)
        return fn


GAME_METHODS = [m for m in dir(Game) if not m.startswith("_")]


# ---------------------------------------------------------------- errors

def _player_line(tb):
    line = 0
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == PLAYER:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def _known_words(ns):
    words = set(k for k in ns if not k.startswith("_"))
    words.update(["print", "range", "len", "True", "False", "None", "str", "int", "random"])
    return sorted(words)


def _fmt(e, ns):
    title, detail, line = type(e).__name__, str(e), _player_line(e.__traceback__)
    if isinstance(e, SyntaxError):
        line = e.lineno or 0
        msg = (e.msg or "").lower()
        if isinstance(e, IndentationError) or "indent" in msg:
            title = "Spacing problem"
            if "expected an indented block" in msg:
                detail = "The line after a colon ( : ) must be pushed in by 4 spaces."
            elif "unexpected indent" in msg:
                detail = "This line has extra spaces at the start. Line it up with the line above."
            elif "unindent" in msg:
                detail = "The spaces at the start of this line don't line up with the lines above."
            else:
                detail = e.msg
        elif "expected ':'" in msg:
            title = "Missing colon"
            detail = "Lines that start with for, while, if, else or def must end with a colon ( : )."
        elif "never closed" in msg:
            title = "Bracket not closed"
            detail = "A bracket is opened here but never closed. Every ( needs a )."
        elif "unmatched" in msg:
            title = "Extra bracket"
            detail = "There's a closing bracket with no opening bracket."
        elif "unterminated string" in msg:
            title = "Missing quote mark"
            detail = 'Text needs a quote mark at both ends, like "right".'
        elif "forgot a comma" in msg:
            title = "Missing comma"
            detail = "Python thinks a comma is missing between two things on this line."
        elif "'=' " in msg or "maybe you meant '=='" in msg:
            title = "One = or two?"
            detail = "Use = to store a value, and == to compare two values."
        else:
            title = "Python couldn't read this line"
            detail = (e.msg or "Check the spelling, brackets and quote marks.") + "."
    elif isinstance(e, NameError):
        name = getattr(e, "name", None) or ""
        title = "Unknown word"
        if name in BOT_METHODS:
            detail = f"Commands belong to Kilo. Try bot.{name}()"
        else:
            guess = difflib.get_close_matches(name, _known_words(ns), n=1)
            detail = f'Python doesn\'t know the word "{name}".'
            if guess:
                detail += f' Did you mean "{guess[0]}"?'
    elif isinstance(e, AttributeError):
        name = getattr(e, "name", None) or ""
        obj = getattr(e, "obj", None)
        if isinstance(obj, Bot):
            title = "Kilo doesn't know that command"
            guess = difflib.get_close_matches(name, BOT_METHODS, n=1)
            detail = f'Kilo can\'t "{name}".' + (f" Did you mean bot.{guess[0]}()?" if guess else "")
        elif isinstance(obj, Game):
            title = "Unknown game command"
            guess = difflib.get_close_matches(name, GAME_METHODS, n=1)
            detail = f'game can\'t "{name}".' + (f" Did you mean game.{guess[0]}?" if guess else "")
        else:
            title = "Unknown command"
    elif isinstance(e, ValueError):
        title = "Check the input"
    elif isinstance(e, TypeError):
        title = "Wrong inputs"
        if "positional argument" in detail and "required" in detail:
            detail = "This command needs something inside its brackets. " + detail
    elif isinstance(e, RecursionError):
        title = "Never-ending function"
        detail = "A function keeps calling itself and never stops."
    elif isinstance(e, ZeroDivisionError):
        title = "Divide by zero"
        detail = "Nothing can be divided by zero."
    return {"title": title, "detail": detail, "line": int(line or 0)}


def _warnings(code):
    """Spot `bot.move_right` without brackets, the most common beginner bug."""
    out = []
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return out
    for node in ast.walk(tree):
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Attribute):
            v = node.value
            if isinstance(v.value, ast.Name) and v.value.id in ("bot", "game"):
                out.append({
                    "title": "Missing brackets",
                    "detail": f"{v.value.id}.{v.attr} does nothing without brackets. Write {v.value.id}.{v.attr}()",
                    "line": node.lineno,
                })
        # The exit has no cell, so at_exit() inside on_collect is never true.
        if isinstance(node, ast.FunctionDef) and node.name == "on_collect":
            for sub in ast.walk(node):
                if isinstance(sub, ast.Attribute) and sub.attr == "at_exit":
                    out.append({
                        "title": "This exit check never runs",
                        "detail": "on_collect only runs when Kilo picks up a cell, and the exit has no cell. Put the exit check in def on_exit(): instead.",
                        "line": sub.lineno,
                    })
                    break
    return out


# ---------------------------------------------------------------- running

def _print(*args, sep=" ", end="\n", **_):
    _act("print", sep.join(str(a) for a in args))


def _hl(block_id):
    _world.block(block_id)


def _namespace():
    g = Game()
    ns = {"__name__": "__main__", "__builtins__": builtins, "bot": Bot(), "game": g,
          "print": _print, "random": random, "_hl": _hl}
    return ns, g


def _compile(code):
    return compile(code, PLAYER, "exec")


def run_mission(code):
    ns, _ = _namespace()
    try:
        exec(_compile(code), ns)
    except _Stop:
        pass
    except Exception as e:
        return json.dumps({"error": _fmt(e, ns)})
    return json.dumps({"error": None})


def check(code):
    return json.dumps(_warnings(code))


_arcade = {"ns": None, "game": None}


def _call_handlers(fns, *args):
    for fn in fns:
        if fn is not None and not _world.over():
            fn(*args)


def _drain_collects():
    n = int(_world.take_collects())
    ns, g = _arcade["ns"], _arcade["game"]
    for _ in range(n):
        _call_handlers([ns.get("on_collect")] + g._collects)
    # on_exit runs after on_collect, so "cells_left() == 0" is already up to date.
    for _ in range(int(_world.take_exits())):
        _call_handlers([ns.get("on_exit")] + g._exits)


def _arcade_run(fn):
    ns = _arcade["ns"]
    try:
        fn()
        _drain_collects()
    except _Stop:
        pass
    except Exception as e:
        return json.dumps({"error": _fmt(e, ns)})
    return json.dumps({"error": None})


def arcade_load(code):
    ns, g = _namespace()
    _arcade["ns"], _arcade["game"] = ns, g

    def start():
        exec(_compile(code), ns)
        _call_handlers([ns.get("on_start")] + g._starts)

    return _arcade_run(start)


def arcade_key(key):
    ns, g = _arcade["ns"], _arcade["game"]
    if ns is None:
        return json.dumps({"error": None})
    return _arcade_run(lambda: _call_handlers([ns.get("on_key")], key) or _call_handlers(g._keys.get(key, [])))


def arcade_tick():
    ns, g = _arcade["ns"], _arcade["game"]
    if ns is None:
        return json.dumps({"error": None})
    return _arcade_run(lambda: _call_handlers([ns.get("on_tick")] + g._ticks))
