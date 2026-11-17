// Every playable level. Each has a reference solution that the unit tests run
// through real Python against every map, so no level can ship unsolvable.

import type { Goals, MapRows, Mode } from '../engine/types';

export type DistrictId = 'docks' | 'loops' | 'spires' | 'arcade' | 'foundry';

export interface District {
  id: DistrictId;
  name: string;
  concept: string;
  color: string;
  blurb: string;
}

export const DISTRICTS: District[] = [
  { id: 'docks', name: 'The Docks', concept: 'Commands', color: '#3FE3D1', blurb: 'Give Kilo its first instructions.' },
  { id: 'loops', name: 'Loop Line', concept: 'Loops', color: '#FF5FD2', blurb: 'Stop repeating yourself.' },
  { id: 'spires', name: 'Signal Spires', concept: 'If & while', color: '#FFBC3D', blurb: 'Code that works on maps it has never seen.' },
  { id: 'arcade', name: 'The Arcade', concept: 'Events', color: '#9BFF5A', blurb: 'Stop playing games. Start making them.' },
  { id: 'foundry', name: 'The Foundry', concept: 'Functions', color: '#5AA9FF', blurb: 'Build your own commands.' },
];

/** A tiny description of starter blocks, turned into Blockly JSON in blocks.ts. */
export interface BlockNode {
  type: string;
  fields?: Record<string, string | number>;
  /** Statement inputs, e.g. DO or ELSE. */
  body?: Record<string, BlockNode[]>;
  /** Value inputs, e.g. COND. */
  value?: Record<string, BlockNode>;
}

export type ToolKey =
  | 'move'
  | 'zap'
  | 'say'
  | 'repeat'
  | 'if'
  | 'while'
  | 'sense'
  | 'events'
  | 'game'
  | 'functions'
  | 'variables';

/** Ideas a level must use, checked after Kilo wins (the map alone can't force them). */
export type Need = 'def' | 'param' | 'variable';

export interface NewCommand {
  code: string;
  text: string;
}

export interface Level {
  id: string;
  district: DistrictId;
  title: string;
  /** Director Vance's briefing, one line per comms message. */
  brief: string[];
  /** Kilo's line when the level opens. */
  kilo: string;
  goal: string;
  newCommands: NewCommand[];
  maps: MapRows[];
  goals: Partial<Goals>;
  mode: Mode;
  /** Third star: finish in this many lines of Python (or blocks). */
  par: number;
  python: string;
  blocks: BlockNode[][];
  tools: ToolKey[];
  hints: string[];
  solution: string;
  learn: { word: string; text: string };
  arcade?: { needGlitchMoves?: number; timeLimit: number };
  needs?: Need[];
}

const mv = (dir: string, n = 1): BlockNode => ({ type: 'kilo_move', fields: { DIR: dir, N: n } });

export const LEVELS: Level[] = [
  // ------------------------------------------------------------- THE DOCKS
  {
    id: 'docks-1',
    district: 'docks',
    title: 'Wake Up, Kilo',
    brief: [
      'Patcher, this is Director Vance. Welcome to Nova Grid. Or what is left of it.',
      'The Glitch scrambled the city’s code and every district went dark.',
      'Kilo is our courier bot. It only understands Python, so you write the instructions and it follows them, one line at a time.',
      'First job: get Kilo to the exit pad. Four squares to the right.',
    ],
    kilo: 'Boot complete! I can see the exit. I just need you to tell me how to get there.',
    goal: 'Reach the exit pad.',
    newCommands: [{ code: 'bot.move_right()', text: 'Kilo moves one square to the right.' }],
    maps: [['#######', '#S...E#', '#######']],
    goals: {},
    mode: 'mission',
    par: 4,
    python: 'bot.move_right()\n',
    blocks: [[mv('right')]],
    tools: ['move'],
    hints: [
      'One bot.move_right() moves Kilo one square. How many squares away is the exit?',
      'Write bot.move_right() on four lines, one under the other.',
    ],
    solution: 'bot.move_right()\nbot.move_right()\nbot.move_right()\nbot.move_right()\n',
    learn: { word: 'Program', text: 'A list of instructions a computer follows in order, from the top to the bottom. You just wrote one.' },
  },
  {
    id: 'docks-2',
    district: 'docks',
    title: 'Round the Crates',
    brief: [
      'Good work. The dock cranes are blocking the straight route.',
      'Kilo can move in four directions. Plan the route before you run it.',
    ],
    kilo: 'Crates! I can’t go through those. Can you steer me round?',
    goal: 'Steer round the crates to the exit.',
    newCommands: [
      { code: 'bot.move_down()', text: 'One square down.' },
      { code: 'bot.move_up()', text: 'One square up.' },
      { code: 'bot.move_left()', text: 'One square left.' },
    ],
    maps: [['########', '#S..####', '###.####', '###...E#', '########']],
    goals: {},
    mode: 'mission',
    par: 7,
    python: 'bot.move_right()\nbot.move_right()\n',
    blocks: [[mv('right'), mv('right')]],
    tools: ['move'],
    hints: ['Trace the path with your finger first: right, right, then down…', 'Right 2, down 2, right 3.'],
    solution:
      'bot.move_right()\nbot.move_right()\nbot.move_down()\nbot.move_down()\nbot.move_right()\nbot.move_right()\nbot.move_right()\n',
    learn: { word: 'Sequence', text: 'The order of instructions matters. Swap two lines and Kilo goes a different way.' },
  },
  {
    id: 'docks-3',
    district: 'docks',
    title: 'Power Cells',
    brief: [
      'Those glowing things are energy cells. The district needs every one of them.',
      'The exit stays locked until Kilo has collected them all.',
      'Tip: put a number in the brackets to move more than one square at a time.',
    ],
    kilo: 'Ooh, shiny! I collect cells just by rolling over them.',
    goal: 'Collect all 3 energy cells, then reach the exit.',
    newCommands: [{ code: 'bot.move_right(3)', text: 'The number tells Kilo how many squares to move.' }],
    maps: [['#########', '#SC..####', '####C####', '####.C.E#', '#########']],
    goals: { cells: true },
    mode: 'mission',
    par: 3,
    python: 'bot.move_right(3)\n',
    blocks: [[mv('right', 3)]],
    tools: ['move'],
    hints: ['Use a number inside the brackets: bot.move_down(2).', 'Right 3, down 2, right 3. Three lines.'],
    solution: 'bot.move_right(3)\nbot.move_down(2)\nbot.move_right(3)\n',
    learn: { word: 'Input', text: 'The number in the brackets is an input. It changes what the command does without changing its name.' },
  },
  {
    id: 'docks-4',
    district: 'docks',
    title: 'Glitch in the Wire',
    brief: [
      'Careful. That red thing is a glitch: scrambled code that has come alive.',
      'If Kilo touches one, it crashes. Zap it first.',
    ],
    kilo: 'It’s looking at me! I have a zapper. Tell me which way to point it.',
    goal: 'Zap the glitch and reach the exit.',
    newCommands: [{ code: 'bot.zap("right")', text: 'Zaps the square next to Kilo. The direction goes in quote marks.' }],
    maps: [['#########', '#S..G..E#', '#########']],
    goals: {},
    mode: 'mission',
    par: 3,
    python: 'bot.move_right(2)\n',
    blocks: [[mv('right', 2)]],
    tools: ['move', 'zap'],
    hints: ['Kilo has to be right next to the glitch to zap it.', 'Move right 2, zap right, then move right 4.'],
    solution: 'bot.move_right(2)\nbot.zap("right")\nbot.move_right(4)\n',
    learn: { word: 'Command', text: 'An instruction with a name, like zap. Some commands need an input in brackets to know what to do.' },
  },
  {
    id: 'docks-5',
    district: 'docks',
    title: 'Night Shift',
    brief: [
      'Last stretch of the Docks. Cells and glitches together.',
      'If it goes wrong, read Kilo’s message, change one thing, and run it again. That is what programmers do all day.',
    ],
    kilo: 'This one’s tricky. Let’s do it a bit at a time.',
    goal: 'Collect both cells, deal with the glitch, reach the exit.',
    newCommands: [],
    maps: [['##########', '#S..C#####', '####.#####', '####G..C.#', '#######.E#', '##########']],
    goals: { cells: true },
    mode: 'mission',
    par: 7,
    python: 'bot.move_right(3)\n',
    blocks: [[mv('right', 3)]],
    tools: ['move', 'zap'],
    hints: [
      'Run your code after every line or two to check Kilo is where you think.',
      'After going down one square, the glitch is right below Kilo.',
    ],
    solution:
      'bot.move_right(3)\nbot.move_down()\nbot.zap("down")\nbot.move_down()\nbot.move_right(3)\nbot.move_down()\nbot.move_right()\n',
    learn: { word: 'Debugging', text: 'Finding and fixing mistakes in code. Every programmer does it, every single day.' },
  },

  // ------------------------------------------------------------- LOOP LINE
  {
    id: 'loops-1',
    district: 'loops',
    title: 'The Stairway',
    brief: [
      'The Docks are back online. The whole city saw the lights come on.',
      'Loop Line is full of repeating patterns. You could write the same lines again and again…',
      '…or you could tell Kilo to repeat them. That is a loop.',
    ],
    kilo: 'Right, down, right, down… I spot a pattern!',
    goal: 'Climb down the stairs to the exit using a loop.',
    newCommands: [
      { code: 'for i in range(4):', text: 'Repeat the lines underneath 4 times.' },
      { code: '    bot.move_right()', text: 'Lines inside the loop are pushed in by 4 spaces.' },
    ],
    maps: [['########', '#S.#####', '##..####', '###..###', '####..##', '#####.E#', '########']],
    goals: {},
    mode: 'mission',
    par: 4,
    python: 'for i in range(4):\n    bot.move_right()\n',
    blocks: [[{ type: 'kilo_repeat', fields: { N: 4 }, body: { DO: [mv('right')] } }]],
    tools: ['move', 'repeat'],
    hints: [
      'The pattern is right, then down. Put both inside the loop.',
      'After the loop, Kilo needs one more step right. That line is not pushed in.',
    ],
    solution: 'for i in range(4):\n    bot.move_right()\n    bot.move_down()\nbot.move_right()\n',
    learn: { word: 'Loop', text: 'A way to repeat instructions without writing them again. for i in range(4) repeats 4 times.' },
  },
  {
    id: 'loops-2',
    district: 'loops',
    title: 'Glitch Alley',
    brief: [
      'A whole alley of glitches, each one guarding a cell.',
      'Zap, move, collect. Zap, move, collect. You know what to do.',
    ],
    kilo: 'So many glitches! Good thing my zapper recharges instantly.',
    goal: 'Clear the alley and collect every cell.',
    newCommands: [],
    maps: [['############', '#SGCGCGCGCE#', '############']],
    goals: { cells: true },
    mode: 'mission',
    par: 4,
    python: 'for i in range(4):\n    bot.zap("right")\n',
    blocks: [[{ type: 'kilo_repeat', fields: { N: 4 }, body: { DO: [{ type: 'kilo_zap', fields: { DIR: 'right' } }] } }]],
    tools: ['move', 'zap', 'repeat'],
    hints: ['Each repeat: zap, then move 2 squares (onto the cell).', 'One last step to the exit after the loop.'],
    solution: 'for i in range(4):\n    bot.zap("right")\n    bot.move_right(2)\nbot.move_right()\n',
    learn: { word: 'Loop body', text: 'The pushed-in lines are the body of the loop. Everything in the body repeats together.' },
  },
  {
    id: 'loops-3',
    district: 'loops',
    title: 'Snake Street',
    brief: [
      'Snake Street winds up and down. The long way round is the only way.',
      'Find the part that repeats. Then make the loop do the work.',
    ],
    kilo: 'Down, right, up, right… and again?',
    goal: 'Follow the snake to the exit and collect both cells.',
    newCommands: [],
    maps: [['###########', '#S#...#...#', '#.#C#.#C#.#', '#...#...#E#', '###########']],
    goals: { cells: true },
    mode: 'mission',
    par: 6,
    python: '',
    blocks: [],
    tools: ['move', 'repeat'],
    hints: [
      'The repeating part has 4 moves: down 2, right 2, up 2, right 2.',
      'It repeats twice, then Kilo needs to go down 2 more.',
    ],
    solution:
      'for i in range(2):\n    bot.move_down(2)\n    bot.move_right(2)\n    bot.move_up(2)\n    bot.move_right(2)\nbot.move_down(2)\n',
    learn: { word: 'Pattern', text: 'Spotting the part that repeats is the first step to writing a loop. Computer scientists call this decomposition.' },
  },

  // --------------------------------------------------------- SIGNAL SPIRES
  {
    id: 'spires-1',
    district: 'spires',
    title: 'Scanner Sweep',
    brief: [
      'The Spires are different. The glitches here move around between runs.',
      'Your code will be tested on four maps, and you can only see the first one.',
      'Kilo needs to look before it moves, and decide.',
    ],
    kilo: 'I have a scanner! I can look one square in any direction.',
    goal: 'Write code that gets Kilo through all 4 test maps.',
    newCommands: [
      { code: 'bot.look("right")', text: 'Kilo reports what is next to it: "wall", "glitch", "cell", "exit" or "empty".' },
      { code: 'if bot.look("right") == "glitch":', text: 'Only run the pushed-in lines if the answer is yes.' },
    ],
    maps: [
      ['##########', '#S.G..G.E#', '##########'],
      ['##########', '#SG...G.E#', '##########'],
      ['##########', '#S..G...E#', '##########'],
      ['##########', '#S.....GE#', '##########'],
    ],
    goals: {},
    mode: 'mission',
    par: 4,
    python: 'for i in range(7):\n    bot.move_right()\n',
    blocks: [[{ type: 'kilo_repeat', fields: { N: 7 }, body: { DO: [mv('right')] } }]],
    tools: ['move', 'zap', 'repeat', 'if', 'sense'],
    hints: [
      'Inside the loop, check first: is there a glitch to the right?',
      'if bot.look("right") == "glitch": then zap it (pushed in 8 spaces). Then move.',
    ],
    solution:
      'for i in range(7):\n    if bot.look("right") == "glitch":\n        bot.zap("right")\n    bot.move_right()\n',
    learn: {
      word: 'Condition',
      text: 'A yes-or-no question. if runs code only when the answer is yes. AI systems are full of millions of these decisions.',
    },
  },
  {
    id: 'spires-2',
    district: 'spires',
    title: 'How Far?',
    brief: [
      'Each test road is a different length. A for loop with a fixed number won’t fit them all.',
      'Use a while loop: keep going while Kilo is not at the exit yet.',
    ],
    kilo: 'I don’t know how far it is. Can I just keep going until I get there?',
    goal: 'One program, three roads of different lengths.',
    newCommands: [
      { code: 'while not bot.at_exit():', text: 'Repeat the pushed-in lines until Kilo reaches the exit.' },
    ],
    maps: [
      ['#######', '#S...E#', '#######'],
      ['############', '#S........E#', '############'],
      ['#####', '#S.E#', '#####'],
    ],
    goals: {},
    mode: 'mission',
    par: 2,
    python: '',
    blocks: [],
    tools: ['move', 'while', 'sense'],
    hints: ['Two lines are enough.', 'while not bot.at_exit(): then bot.move_right() pushed in.'],
    solution: 'while not bot.at_exit():\n    bot.move_right()\n',
    learn: { word: 'While loop', text: 'Repeats for as long as something is true. Useful when you don’t know how many times in advance.' },
  },
  {
    id: 'spires-3',
    district: 'spires',
    title: 'Blind Maze',
    brief: [
      'Last spire. Three mazes, all different. Kilo has to find its own way.',
      'Here is a rule that works: go right if you can, and go down if you can’t.',
      'Turn that rule into code and Kilo can solve mazes it has never seen.',
    ],
    kilo: 'No map? No problem. Just give me a rule and I’ll follow it.',
    goal: 'Solve all three mazes with one program.',
    newCommands: [{ code: 'else:', text: 'What to do when the if question is answered no.' }],
    maps: [
      ['########', '#S..####', '###.####', '###...##', '#####.##', '#####E##', '########'],
      ['########', '#S.....#', '######.#', '######.#', '######E#', '########'],
      ['#######', '#S#####', '#.#####', '#....E#', '#######'],
    ],
    goals: {},
    mode: 'mission',
    par: 5,
    python: 'while not bot.at_exit():\n    bot.move_right()\n',
    blocks: [[{ type: 'kilo_while_exit', body: { DO: [mv('right')] } }]],
    tools: ['move', 'while', 'if', 'sense'],
    hints: [
      'Inside the while loop, ask: is there a wall to the right?',
      'if bot.look("right") == "wall": move down, else: move right.',
    ],
    solution:
      'while not bot.at_exit():\n    if bot.look("right") == "wall":\n        bot.move_down()\n    else:\n        bot.move_right()\n',
    learn: {
      word: 'Algorithm',
      text: 'A step-by-step method that works for many problems, not just one. AI is tested the same way: on examples it never practised on.',
    },
  },

  // ------------------------------------------------------------- THE ARCADE
  {
    id: 'arcade-1',
    district: 'arcade',
    title: 'Take the Controls',
    brief: [
      'The Arcade is different. Here, the code doesn’t run once. It waits for events.',
      'Every time a player presses a key, on_key runs. Every time Kilo picks up a cell, on_collect runs.',
      'Only the right arrow works so far. Finish the controls, then play your game with the arrow keys.',
    ],
    kilo: 'You’re not telling me where to go any more. You’re building the controls!',
    goal: 'Make all four arrow keys work, then win by collecting every cell.',
    newCommands: [
      { code: 'def on_key(key):', text: 'Runs every time a key is pressed. key is "up", "down", "left", "right" or "space".' },
      { code: 'elif key == "left":', text: 'elif means "else if": check another option.' },
    ],
    maps: [['###########', '#C...#...C#', '#.##.#.##.#', '#...S....C#', '#.##.#.##.#', '#C...#...C#', '###########']],
    goals: {},
    mode: 'arcade',
    par: 12,
    python:
      '# Runs every time a key is pressed.\ndef on_key(key):\n    if key == "right":\n        bot.move_right()\n    # Add up, down and left here!\n\n# Runs every time Kilo collects a cell.\ndef on_collect():\n    if bot.cells_left() == 0:\n        game.win("All cells collected!")\n',
    blocks: [
      [{ type: 'game_on_key', fields: { KEY: 'right' }, body: { DO: [mv('right')] } }],
      [
        {
          type: 'game_on_collect',
          body: { DO: [{ type: 'kilo_if', value: { COND: { type: 'kilo_no_cells' } }, body: { DO: [{ type: 'game_win', fields: { TEXT: 'All cells collected!' } }] } }] },
        },
      ],
    ],
    tools: ['move', 'events', 'game', 'if', 'sense'],
    hints: [
      'Copy the right-arrow part and change "right" to "left" and move_right to move_left.',
      'Use elif key == "left": for each extra key, lined up with the if.',
    ],
    solution:
      'def on_key(key):\n    if key == "right":\n        bot.move_right()\n    elif key == "left":\n        bot.move_left()\n    elif key == "up":\n        bot.move_up()\n    elif key == "down":\n        bot.move_down()\n\ndef on_collect():\n    if bot.cells_left() == 0:\n        game.win("All cells collected!")\n',
    learn: { word: 'Event', text: 'Something that happens, like a key press. Event code waits until its event happens, then runs.' },
    arcade: { timeLimit: 40 },
  },
  {
    id: 'arcade-2',
    district: 'arcade',
    title: 'Make It Hard',
    brief: [
      'A game with nothing chasing you isn’t much of a game.',
      'on_tick runs twice every second. Use it to make the glitches hunt Kilo.',
      'Then beat your own game. Space zaps whatever Kilo is facing.',
    ],
    kilo: 'Wait, you’re making the glitches chase me? Whose side are you on?!',
    goal: 'Make the glitches chase Kilo, then win your own game.',
    newCommands: [
      { code: 'def on_tick():', text: 'Runs twice a second, all by itself.' },
      { code: 'for g in game.glitches():', text: 'Loops through every glitch still alive.' },
      { code: '    g.move_toward_bot()', text: 'That glitch takes one step towards Kilo.' },
    ],
    maps: [['#############', '#C....#....C#', '#.###.#.###.#', '#.....S.....#', '#.###.#.###.#', '#G....C....G#', '#############']],
    goals: {},
    mode: 'arcade',
    par: 18,
    python:
      'def on_key(key):\n    if key == "up":\n        bot.move_up()\n    elif key == "down":\n        bot.move_down()\n    elif key == "left":\n        bot.move_left()\n    elif key == "right":\n        bot.move_right()\n    elif key == "space":\n        bot.zap()\n\n# Runs twice a second. Make the glitches hunt Kilo!\ndef on_tick():\n    pass\n\ndef on_collect():\n    game.add_score(1)\n    if bot.cells_left() == 0:\n        game.win("You beat your own game!")\n',
    blocks: [
      [{ type: 'game_on_key', fields: { KEY: 'up' }, body: { DO: [mv('up')] } }],
      [{ type: 'game_on_key', fields: { KEY: 'down' }, body: { DO: [mv('down')] } }],
      [{ type: 'game_on_key', fields: { KEY: 'left' }, body: { DO: [mv('left')] } }],
      [{ type: 'game_on_key', fields: { KEY: 'right' }, body: { DO: [mv('right')] } }],
      [{ type: 'game_on_key', fields: { KEY: 'space' }, body: { DO: [{ type: 'kilo_zap_facing' }] } }],
      [{ type: 'game_every_tick' }],
      [
        {
          type: 'game_on_collect',
          body: {
            DO: [
              { type: 'game_score', fields: { N: 1 } },
              { type: 'kilo_if', value: { COND: { type: 'kilo_no_cells' } }, body: { DO: [{ type: 'game_win', fields: { TEXT: 'You beat your own game!' } }] } },
            ],
          },
        },
      ],
    ],
    tools: ['move', 'zap', 'events', 'game', 'if', 'sense'],
    hints: [
      'Replace pass with a loop over game.glitches().',
      'for g in game.glitches(): then g.move_toward_bot() pushed in.',
    ],
    solution:
      'def on_key(key):\n    if key == "up":\n        bot.move_up()\n    elif key == "down":\n        bot.move_down()\n    elif key == "left":\n        bot.move_left()\n    elif key == "right":\n        bot.move_right()\n    elif key == "space":\n        bot.zap()\n\ndef on_tick():\n    for g in game.glitches():\n        g.move_toward_bot()\n\ndef on_collect():\n    game.add_score(1)\n    if bot.cells_left() == 0:\n        game.win("You beat your own game!")\n',
    learn: {
      word: 'Game AI',
      text: 'Your glitches follow a simple rule: step towards Kilo. Most game enemies are rules like this, not magic.',
    },
    arcade: { needGlitchMoves: 5, timeLimit: 60 },
  },

  // ----------------------------------------------------------- THE FOUNDRY
  {
    id: 'foundry-1',
    district: 'foundry',
    title: 'Your Own Command',
    brief: [
      'The Arcade is buzzing again. One district is still dark: The Foundry, where the city’s commands were first made.',
      'Kilo only knows the commands it was built with. Here, you build new ones.',
      'Each bay has a glitch guarding a cell. Teach Kilo one command that clears a bay, then use it four times.',
    ],
    kilo: 'A brand new command, just for me? Give it a good name.',
    goal: 'Build a grab() command and use it to clear all four bays.',
    newCommands: [
      { code: 'def grab():', text: 'Makes a new command called grab. The pushed-in lines underneath are what it does.' },
      { code: 'grab()', text: 'Runs your command. Writing def only teaches Kilo the command; this line uses it.' },
    ],
    maps: [['###############', '##C##C###C##C##', '##G##G###G##G##', '#S...........E#', '###############']],
    goals: { cells: true },
    mode: 'mission',
    par: 13,
    python:
      '# def makes a new command. The pushed-in lines are what it does.\ndef grab():\n    bot.zap("up")\n    # Finish grab: move up 2, then move down 2.\n\nbot.move_right()\ngrab()\n',
    blocks: [
      [{ type: 'fn_def', fields: { NAME: 'grab', PARAM: '' }, body: { DO: [{ type: 'kilo_zap', fields: { DIR: 'up' } }] } }],
      [mv('right'), { type: 'fn_call', fields: { NAME: 'grab' } }],
    ],
    tools: ['move', 'zap', 'functions'],
    hints: [
      'grab() should do one bay’s work: zap the glitch above Kilo, go up 2 squares to the cell, then come back down 2.',
      'Now use grab() under the function, not pushed in. Move right 1, then grab(). Move right 3, grab(). Move right 4, grab(). Move right 3, grab(). Then one last step right to the exit.',
    ],
    solution:
      'def grab():\n    bot.zap("up")\n    bot.move_up(2)\n    bot.move_down(2)\n\nbot.move_right()\ngrab()\nbot.move_right(3)\ngrab()\nbot.move_right(4)\ngrab()\nbot.move_right(3)\ngrab()\nbot.move_right()\n',
    learn: { word: 'Function', text: 'A named set of instructions you can run again and again. Big programs are built out of lots of small functions.' },
    needs: ['def'],
  },
  {
    id: 'foundry-2',
    district: 'foundry',
    title: 'Give It an Input',
    brief: [
      'grab() always does exactly the same thing. That’s fine until things start moving about.',
      'These glitches are all different distances apart.',
      'Give your function an input, a number in its brackets, so one command can handle any gap.',
    ],
    kilo: 'So clear(2) and clear(4) are the same command with different numbers? Clever.',
    goal: 'Build clear(n) and use it to get past all four glitches.',
    newCommands: [
      { code: 'def clear(n):', text: 'n is an input. Whatever number goes in the brackets when you use clear becomes n.' },
      { code: '    bot.move_right(n)', text: 'Use n inside the function, just like a number.' },
      { code: 'clear(4)', text: 'Runs clear with n set to 4.' },
    ],
    maps: [['####################', '#S..G....G.G....G.E#', '####################']],
    goals: {},
    mode: 'mission',
    par: 9,
    python: 'def clear(n):\n    bot.move_right(n)\n    # Add: zap right, then move right 1.\n\nclear(2)\n',
    blocks: [
      [{ type: 'fn_def', fields: { NAME: 'clear', PARAM: 'n' }, body: { DO: [{ type: 'kilo_move_var', fields: { DIR: 'right', VAR: 'n' } }] } }],
      [{ type: 'fn_call_n', fields: { NAME: 'clear', N: 2 } }],
    ],
    tools: ['move', 'zap', 'functions'],
    hints: [
      'clear(n) should walk n squares, zap the glitch in front of Kilo, then step onto the square it just cleared.',
      'Count the empty squares before each glitch. The first gap is 2, so start with clear(2). Then clear(4), clear(1) and clear(4). Finish with two steps right.',
    ],
    solution:
      'def clear(n):\n    bot.move_right(n)\n    bot.zap("right")\n    bot.move_right()\n\nclear(2)\nclear(4)\nclear(1)\nclear(4)\nbot.move_right(2)\n',
    learn: { word: 'Parameter', text: 'An input that a function takes, like n. The same function can do different jobs with different inputs.' },
    needs: ['param'],
  },
  {
    id: 'foundry-3',
    district: 'foundry',
    title: 'Growing Stairs',
    brief: [
      'These stairs get longer every step: 1 square, then 2, then 3, then 4.',
      'A loop repeats the same thing. But here the number has to change each time round.',
      'Keep the number in a variable, and add 1 to it every time the loop repeats.',
    ],
    kilo: 'Every step is longer than the last one. Can my loop keep count?',
    goal: 'Use a growing variable to get down the stairs and collect every cell.',
    newCommands: [
      { code: 'steps = 1', text: 'Makes a variable called steps and stores 1 in it.' },
      { code: 'steps = steps + 1', text: 'Works out steps + 1, then stores the answer back in steps.' },
    ],
    maps: [['#############', '#SC##########', '##..C########', '####...C#####', '#######....C#', '###########E#', '#############']],
    goals: { cells: true },
    mode: 'mission',
    par: 5,
    python: 'steps = 1\nbot.move_right(steps)\nbot.move_down()\n',
    blocks: [[{ type: 'var_set', fields: { N: 1 } }, { type: 'kilo_move_var', fields: { DIR: 'right', VAR: 'steps' } }, mv('down')]],
    tools: ['move', 'repeat', 'variables'],
    hints: [
      'Each stair is the same three jobs: go right by steps squares, go down 1, then make steps one bigger.',
      'Put steps = 1 above the loop, so it only happens once. Inside a loop that repeats 4 times: bot.move_right(steps), then bot.move_down(), then steps = steps + 1.',
    ],
    solution: 'steps = 1\nfor i in range(4):\n    bot.move_right(steps)\n    bot.move_down()\n    steps = steps + 1\n',
    learn: { word: 'Variable', text: 'A named box that holds a value. The value can change while the program runs.' },
    needs: ['variable'],
  },
  {
    id: 'foundry-4',
    district: 'foundry',
    title: 'Sawtooth Ridge',
    brief: [
      'The ridge goes up three, then down three, again and again.',
      'Climbing up is a loop. Coming down is a loop. And the whole tooth repeats as well.',
      'Good news: you can put a loop inside another loop.',
    ],
    kilo: 'Up, up, up, down, down, down… Loops inside loops? My circuits are spinning.',
    goal: 'Cross all three teeth and collect the cells on top.',
    newCommands: [
      { code: 'for t in range(3):', text: 'The outer loop: once for each tooth.' },
      { code: '    for i in range(3):', text: 'An inner loop, pushed in further. It runs all the way through every time the outer loop goes round.' },
    ],
    maps: [['#####################', '###.C####.C####.C####', '##....##....##....###', '#..##....##....##..##', '#S####..####..####.E#', '#####################']],
    goals: { cells: true },
    mode: 'mission',
    par: 7,
    python: 'for i in range(3):\n    bot.move_up()\n    bot.move_right()\n',
    blocks: [[{ type: 'kilo_repeat', fields: { N: 3 }, body: { DO: [mv('up'), mv('right')] } }]],
    tools: ['move', 'repeat'],
    hints: [
      'Climbing one step is move up, then move right. Do that 3 times. Coming down is move down, then move right, 3 times.',
      'The climb and the drop together make one tooth. Put both small loops inside for t in range(3):, pushed in 4 more spaces, to cross all three teeth.',
    ],
    solution:
      'for t in range(3):\n    for i in range(3):\n        bot.move_up()\n        bot.move_right()\n    for i in range(3):\n        bot.move_down()\n        bot.move_right()\n',
    learn: { word: 'Nested loop', text: 'A loop inside another loop. The inner loop runs all the way through each time the outer loop repeats once.' },
  },
  {
    id: 'foundry-5',
    district: 'foundry',
    title: 'Wall Runner',
    brief: [
      'Three test maps again, all different, and you can only see the first one.',
      'Here is a rule that solves them all: run right until you hit a wall, then run down until you hit a wall. Repeat.',
      'Put each run in its own function. Then your main program is short enough to read in one go.',
    ],
    kilo: 'run_right() and run_down(). Two commands, and I can go anywhere!',
    goal: 'Get through all three test maps using run_right() and run_down().',
    newCommands: [
      { code: 'while bot.look("right") != "wall":', text: 'Keep going while the square to the right is not a wall. != means “is not”.' },
    ],
    maps: [
      ['##########', '#S...#####', '####.#####', '####.....#', '########.#', '########E#', '##########'],
      ['############', '#S.#########', '##.#########', '##.#########', '##........E#', '############'],
      ['#########', '#S#######', '#.#######', '#...#####', '###.#####', '###....E#', '#########'],
    ],
    goals: {},
    mode: 'mission',
    par: 9,
    python:
      'def run_right():\n    while bot.look("right") != "wall":\n        bot.move_right()\n\n# Build run_down() here.\n\nwhile not bot.at_exit():\n    run_right()\n',
    blocks: [
      [
        {
          type: 'fn_def',
          fields: { NAME: 'run_right', PARAM: '' },
          body: { DO: [{ type: 'kilo_while', value: { COND: { type: 'kilo_look_is', fields: { DIR: 'right', OP: '!=', THING: 'wall' } } }, body: { DO: [mv('right')] } }] },
        },
      ],
      [{ type: 'kilo_while_exit', body: { DO: [{ type: 'fn_call', fields: { NAME: 'run_right' } }] } }],
    ],
    tools: ['move', 'while', 'sense', 'functions'],
    hints: [
      'run_down() is a copy of run_right(). Change "right" to "down" in all three places.',
      'In the main loop, under while not bot.at_exit():, use run_right() and then run_down().',
    ],
    solution:
      'def run_right():\n    while bot.look("right") != "wall":\n        bot.move_right()\n\ndef run_down():\n    while bot.look("down") != "wall":\n        bot.move_down()\n\nwhile not bot.at_exit():\n    run_right()\n    run_down()\n',
    learn: {
      word: 'Abstraction',
      text: 'Hiding the details inside a name. Once run_right() works, you can use it without thinking about how it works inside.',
    },
    needs: ['def'],
  },
  {
    id: 'foundry-6',
    district: 'foundry',
    title: 'The Foundry Core',
    brief: [
      'This is it: the Glitch’s core. Three test maps, cells hidden above and below the corridor, glitches in the way.',
      'Break the job into small functions. One checks above Kilo, one checks below. Then the main loop uses them.',
      'Get this right and every light in Nova Grid comes back on.',
    ],
    kilo: 'Small jobs, good names, one loop. Let’s finish this, Patcher.',
    goal: 'Collect every cell on all three test maps.',
    newCommands: [],
    maps: [
      ['############', '###C####C###', '#S...G....E#', '#####C######', '############'],
      ['############', '##C#####C###', '#S.G..G...E#', '####C####C##', '############'],
      ['############', '#########C##', '#SG.G.G.G.E#', '##C###C#####', '############'],
    ],
    goals: { cells: true },
    mode: 'mission',
    par: 14,
    python: 'while not bot.at_exit():\n    bot.move_right()\n',
    blocks: [[{ type: 'kilo_while_exit', body: { DO: [mv('right')] } }]],
    tools: ['move', 'zap', 'while', 'if', 'sense', 'functions'],
    hints: [
      'Write check_up(): if bot.look("up") == "cell", move up, then back down. check_down() is the same, but looking and moving down first.',
      'Each time round the main loop, do four things in order: check_up(), check_down(), zap right if there is a glitch, then move right one square.',
    ],
    solution:
      'def check_up():\n    if bot.look("up") == "cell":\n        bot.move_up()\n        bot.move_down()\n\ndef check_down():\n    if bot.look("down") == "cell":\n        bot.move_down()\n        bot.move_up()\n\nwhile not bot.at_exit():\n    check_up()\n    check_down()\n    if bot.look("right") == "glitch":\n        bot.zap("right")\n    bot.move_right()\n',
    learn: {
      word: 'Decomposition',
      text: 'Breaking a big problem into small parts you can solve one at a time. Every large program, and every AI system, is built this way.',
    },
    needs: ['def'],
  },
];

const NEED_TEXT: Record<Need, string> = {
  def: 'Kilo made it, but this level is about building your own command. Put the moves inside a def, then use it by writing its name with brackets.',
  param: 'Kilo made it! Now give your function an input in its brackets, like def clear(n):, so one command can handle every gap.',
  variable: 'Kilo made it! Now use a variable that grows each time round, like steps = steps + 1.',
};

/** Why a winning program still misses the point of the level, or null if it doesn't. */
export function unmetNeed(level: Level, code: string): string | null {
  const src = code.replace(/#.*$/gm, '');
  for (const need of level.needs ?? []) {
    if (need === 'def' || need === 'param') {
      const defs = [...src.matchAll(/^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/gm)];
      const used = defs.filter(([, name]) => new RegExp(`^(?!\\s*def\\s).*\\b${name}\\s*\\(`, 'm').test(src));
      if (!used.length) return NEED_TEXT.def;
      if (need === 'param' && !used.some(([, , params]) => params.trim())) return NEED_TEXT.param;
    }
    if (need === 'variable' && !/^\s*([A-Za-z_]\w*)\s*(\+=|-=|=\s*\1\s*[-+*])/m.test(src)) return NEED_TEXT.variable;
  }
  return null;
}

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function levelsIn(d: DistrictId): Level[] {
  return LEVELS.filter((l) => l.district === d);
}

export function districtOf(level: Level): District {
  return DISTRICTS.find((d) => d.id === level.district)!;
}

/** Count lines of real code: not blank, not comments, not `pass`. */
export function codeLines(code: string): number {
  return code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l !== 'pass').length;
}
