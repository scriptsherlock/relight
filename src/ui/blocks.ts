// Blockly blocks for the Builder (blocks) track. Every block generates the
// same Python that the Coder track types, so pupils can watch the code grow.

import * as Blockly from 'blockly/core';
import * as En from 'blockly/msg/en';
import { pythonGenerator } from 'blockly/python';
import type { BlockNode, ToolKey } from '../content/levels';

Blockly.setLocale(En as unknown as Record<string, string>);

const C = {
  move: '#1FB5A6',
  zap: '#E2456A',
  say: '#8E7BE8',
  loop: '#C94FB8',
  logic: '#D9962B',
  sense: '#3D8BE0',
  event: '#5FAE2E',
  game: '#2F9E6C',
  fn: '#3F7FE0',
  vars: '#E07A2F',
};

const RESERVED = new Set(['bot', 'game', 'print', 'range', 'random', 'steps', 'n', 'i', 't', 'def', 'for', 'if', 'else', 'elif', 'while', 'in', 'not', 'and', 'or', 'pass', 'return', 'True', 'False', 'None']);

/** Turn whatever was typed into a safe Python function name. */
export function fnName(raw: string): string {
  let s = String(raw).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = 'my_command';
  if (/^[0-9]/.test(s)) s = 'do_' + s;
  if (RESERVED.has(s)) s += '_cmd';
  return s;
}

const DIR_OPTIONS = [
  ['right →', 'right'],
  ['left ←', 'left'],
  ['up ↑', 'up'],
  ['down ↓', 'down'],
];
const THINGS = [
  ['a glitch', 'glitch'],
  ['a wall', 'wall'],
  ['a cell', 'cell'],
  ['the exit', 'exit'],
  ['empty', 'empty'],
];
const KEYS = [
  ['→ right', 'right'],
  ['← left', 'left'],
  ['↑ up', 'up'],
  ['↓ down', 'down'],
  ['space', 'space'],
];

let defined = false;

export function defineBlocks(): void {
  if (defined) return;
  defined = true;
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'kilo_move',
      message0: 'move %1 %2',
      args0: [
        { type: 'field_dropdown', name: 'DIR', options: DIR_OPTIONS },
        { type: 'field_number', name: 'N', value: 1, min: 1, max: 20, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: C.move,
      tooltip: 'Move Kilo. The number is how many squares.',
    },
    {
      type: 'kilo_zap',
      message0: 'zap %1',
      args0: [{ type: 'field_dropdown', name: 'DIR', options: DIR_OPTIONS }],
      previousStatement: null,
      nextStatement: null,
      colour: C.zap,
      tooltip: 'Zap the square next to Kilo.',
    },
    {
      type: 'kilo_zap_facing',
      message0: 'zap forward',
      previousStatement: null,
      nextStatement: null,
      colour: C.zap,
      tooltip: 'Zap the square Kilo is facing.',
    },
    {
      type: 'kilo_say',
      message0: 'say %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello!' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.say,
    },
    {
      type: 'kilo_repeat',
      message0: 'repeat %1 times',
      args0: [{ type: 'field_number', name: 'N', value: 3, min: 1, max: 50, precision: 1 }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.loop,
    },
    {
      type: 'kilo_while_exit',
      message0: 'repeat until Kilo is at the exit',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.loop,
    },
    {
      type: 'kilo_while',
      message0: 'repeat while %1',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.loop,
      tooltip: 'Keep repeating while the question is answered yes.',
    },
    {
      type: 'fn_def',
      message0: 'define %1 %2',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'grab' },
        { type: 'field_dropdown', name: 'PARAM', options: [['(no input)', ''], ['with input n', 'n']] },
      ],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      colour: C.fn,
      hat: 'cap',
      tooltip: 'Makes a new command. Nothing happens until you use it with a "do" block.',
    },
    {
      type: 'fn_call',
      message0: 'do %1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'grab' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.fn,
      tooltip: 'Runs a command you defined. The name must match exactly.',
    },
    {
      type: 'fn_call_n',
      message0: 'do %1 with n = %2',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'clear' },
        { type: 'field_number', name: 'N', value: 2, min: 1, max: 20, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: C.fn,
      tooltip: 'Runs a command you defined, giving it a number to use as n.',
    },
    {
      type: 'kilo_move_var',
      message0: 'move %1 %2 squares',
      args0: [
        { type: 'field_dropdown', name: 'DIR', options: DIR_OPTIONS },
        { type: 'field_dropdown', name: 'VAR', options: [['n', 'n'], ['steps', 'steps']] },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: C.move,
      tooltip: 'Move Kilo by whatever number n or steps holds right now.',
    },
    {
      type: 'var_set',
      message0: 'set steps to %1',
      args0: [{ type: 'field_number', name: 'N', value: 1, min: 0, max: 20, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: C.vars,
      tooltip: 'Stores a number in the variable steps.',
    },
    {
      type: 'var_change',
      message0: 'add %1 to steps',
      args0: [{ type: 'field_number', name: 'N', value: 1, min: -10, max: 10, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: C.vars,
      tooltip: 'Changes the number stored in steps.',
    },
    {
      type: 'kilo_if',
      message0: 'if %1',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.logic,
    },
    {
      type: 'kilo_ifelse',
      message0: 'if %1',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      message2: 'else %1',
      args2: [{ type: 'input_statement', name: 'ELSE' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.logic,
    },
    {
      type: 'kilo_look_is',
      message0: '%1 %2 %3',
      args0: [
        { type: 'field_dropdown', name: 'DIR', options: DIR_OPTIONS },
        { type: 'field_dropdown', name: 'OP', options: [['is', '=='], ['is not', '!=']] },
        { type: 'field_dropdown', name: 'THING', options: THINGS },
      ],
      output: 'Boolean',
      colour: C.sense,
      tooltip: 'Kilo looks one square in a direction.',
    },
    { type: 'kilo_at_exit', message0: 'Kilo is at the exit', output: 'Boolean', colour: C.sense },
    { type: 'kilo_no_cells', message0: 'no cells left', output: 'Boolean', colour: C.sense },
    {
      type: 'game_on_key',
      message0: 'when %1 key pressed',
      args0: [{ type: 'field_dropdown', name: 'KEY', options: KEYS }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      colour: C.event,
      hat: 'cap',
    },
    {
      type: 'game_every_tick',
      message0: 'every tick (twice a second)',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      colour: C.event,
      hat: 'cap',
    },
    {
      type: 'game_on_collect',
      message0: 'when Kilo collects a cell',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      colour: C.event,
      hat: 'cap',
    },
    {
      type: 'game_on_exit',
      message0: 'when Kilo reaches the exit',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      colour: C.event,
      hat: 'cap',
    },
    {
      type: 'game_on_start',
      message0: 'when the game starts',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      colour: C.event,
      hat: 'cap',
    },
    {
      type: 'game_win',
      message0: 'win: %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'You win!' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.game,
    },
    {
      type: 'game_lose',
      message0: 'lose: %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'Game over!' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.game,
    },
    {
      type: 'game_say',
      message0: 'show message %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'Go!' }],
      previousStatement: null,
      nextStatement: null,
      colour: C.game,
    },
    {
      type: 'game_score',
      message0: 'add %1 to score',
      args0: [{ type: 'field_number', name: 'N', value: 1, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: C.game,
    },
    {
      type: 'game_glitch_chase',
      message0: 'every glitch steps towards Kilo',
      previousStatement: null,
      nextStatement: null,
      colour: C.zap,
    },
    {
      type: 'game_glitch_wander',
      message0: 'every glitch steps somewhere random',
      previousStatement: null,
      nextStatement: null,
      colour: C.zap,
    },
  ]);

  const g = pythonGenerator;
  g.INDENT = '    ';
  g.STATEMENT_PREFIX = '_hl(%1)\n';
  const q = (s: string) => JSON.stringify(String(s));
  const body = (b: Blockly.Block, name = 'DO') => g.statementToCode(b, name) || g.INDENT + 'pass\n';
  let fnCount = 0;

  g.forBlock['kilo_move'] = (b) => {
    const n = Number(b.getFieldValue('N'));
    return `bot.move_${b.getFieldValue('DIR')}(${n > 1 ? n : ''})\n`;
  };
  g.forBlock['kilo_zap'] = (b) => `bot.zap(${q(b.getFieldValue('DIR'))})\n`;
  g.forBlock['kilo_zap_facing'] = () => 'bot.zap()\n';
  g.forBlock['kilo_say'] = (b) => `bot.say(${q(b.getFieldValue('TEXT'))})\n`;
  g.forBlock['kilo_repeat'] = (b) => `for i in range(${Number(b.getFieldValue('N'))}):\n${body(b)}`;
  g.forBlock['kilo_while_exit'] = (b) => `while not bot.at_exit():\n${body(b)}`;
  g.forBlock['kilo_while'] = (b) => `while ${g.valueToCode(b, 'COND', 0) || 'False'}:\n${body(b)}`;
  // Functions go to the top of the program, so they exist before anything uses them.
  g.forBlock['fn_def'] = (b) => {
    const name = fnName(b.getFieldValue('NAME'));
    (g as unknown as { definitions_: Record<string, string> }).definitions_['%fn_' + name + '_' + b.id] =`def ${name}(${b.getFieldValue('PARAM')}):\n${body(b)}`;
    return null;
  };
  g.forBlock['fn_call'] = (b) => `${fnName(b.getFieldValue('NAME'))}()\n`;
  g.forBlock['fn_call_n'] = (b) => `${fnName(b.getFieldValue('NAME'))}(${Number(b.getFieldValue('N'))})\n`;
  g.forBlock['kilo_move_var'] = (b) => `bot.move_${b.getFieldValue('DIR')}(${b.getFieldValue('VAR')})\n`;
  g.forBlock['var_set'] = (b) => `steps = ${Number(b.getFieldValue('N'))}\n`;
  g.forBlock['var_change'] = (b) => {
    const n = Number(b.getFieldValue('N'));
    return `steps = steps ${n < 0 ? '-' : '+'} ${Math.abs(n)}\n`;
  };
  g.forBlock['kilo_if'] = (b) =>`if ${g.valueToCode(b, 'COND', 0) || 'False'}:\n${body(b)}`;
  g.forBlock['kilo_ifelse'] = (b) =>
    `if ${g.valueToCode(b, 'COND', 0) || 'False'}:\n${body(b)}else:\n${body(b, 'ELSE')}`;
  g.forBlock['kilo_look_is'] = (b) => [
    `bot.look(${q(b.getFieldValue('DIR'))}) ${b.getFieldValue('OP')} ${q(b.getFieldValue('THING'))}`,
    0,
  ];
  g.forBlock['kilo_at_exit'] = () => ['bot.at_exit()', 0];
  g.forBlock['kilo_no_cells'] = () => ['bot.cells_left() == 0', 0];
  g.forBlock['game_on_key'] = (b) => {
    const k = b.getFieldValue('KEY');
    return `@game.when_key(${q(k)})\ndef when_${k}_${++fnCount}():\n${body(b)}\n`;
  };
  g.forBlock['game_every_tick'] = (b) => `@game.every_tick\ndef every_tick_${++fnCount}():\n${body(b)}\n`;
  g.forBlock['game_on_collect'] = (b) => `@game.when_collect\ndef when_collect_${++fnCount}():\n${body(b)}\n`;
  g.forBlock['game_on_exit'] = (b) => `@game.when_exit\ndef when_exit_${++fnCount}():\n${body(b)}\n`;
  g.forBlock['game_on_start'] =(b) => `@game.when_start\ndef when_start_${++fnCount}():\n${body(b)}\n`;
  g.forBlock['game_win'] = (b) => `game.win(${q(b.getFieldValue('TEXT'))})\n`;
  g.forBlock['game_lose'] = (b) => `game.lose(${q(b.getFieldValue('TEXT'))})\n`;
  g.forBlock['game_say'] = (b) => `game.say(${q(b.getFieldValue('TEXT'))})\n`;
  g.forBlock['game_score'] = (b) => `game.add_score(${Number(b.getFieldValue('N'))})\n`;
  g.forBlock['game_glitch_chase'] = () => 'for g in game.glitches():\n    g.move_toward_bot()\n';
  g.forBlock['game_glitch_wander'] = () => 'for g in game.glitches():\n    g.move_random()\n';
}

/** Python for running: includes _hl() calls so the playing block lights up. */
export function workspaceToRunnable(ws: Blockly.Workspace): string {
  return pythonGenerator.workspaceToCode(ws);
}

/** Python for showing to pupils: the same code without highlight calls. */
export function cleanPython(code: string): string {
  return code
    .split('\n')
    .filter((l) => !/^\s*_hl\(.*\)\s*$/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const TOOL_BLOCKS: Record<ToolKey, object[]> = {
  move: [
    { kind: 'block', type: 'kilo_move', fields: { DIR: 'right', N: 1 } },
    { kind: 'block', type: 'kilo_move', fields: { DIR: 'down', N: 1 } },
    { kind: 'block', type: 'kilo_move', fields: { DIR: 'left', N: 1 } },
    { kind: 'block', type: 'kilo_move', fields: { DIR: 'up', N: 1 } },
  ],
  zap: [
    { kind: 'block', type: 'kilo_zap', fields: { DIR: 'right' } },
    { kind: 'block', type: 'kilo_zap_facing' },
  ],
  say: [{ kind: 'block', type: 'kilo_say' }],
  repeat: [{ kind: 'block', type: 'kilo_repeat' }],
  while: [
    { kind: 'block', type: 'kilo_while_exit' },
    { kind: 'block', type: 'kilo_while', inputs: { COND: { block: { type: 'kilo_look_is', fields: { DIR: 'right', OP: '!=', THING: 'wall' } } } } },
  ],
  functions: [
    { kind: 'block', type: 'fn_def', fields: { NAME: 'grab', PARAM: '' } },
    { kind: 'block', type: 'fn_call', fields: { NAME: 'grab' } },
    { kind: 'block', type: 'fn_def', fields: { NAME: 'clear', PARAM: 'n' } },
    { kind: 'block', type: 'fn_call_n', fields: { NAME: 'clear', N: 2 } },
    { kind: 'block', type: 'kilo_move_var', fields: { DIR: 'right', VAR: 'n' } },
  ],
  variables: [
    { kind: 'block', type: 'var_set', fields: { N: 1 } },
    { kind: 'block', type: 'var_change', fields: { N: 1 } },
    { kind: 'block', type: 'kilo_move_var', fields: { DIR: 'right', VAR: 'steps' } },
  ],
  if: [
    { kind: 'block', type: 'kilo_if', inputs: { COND: { block: { type: 'kilo_look_is', fields: { DIR: 'right', OP: '==', THING: 'glitch' } } } } },
    { kind: 'block', type: 'kilo_ifelse', inputs: { COND: { block: { type: 'kilo_look_is', fields: { DIR: 'right', OP: '==', THING: 'wall' } } } } },
  ],
  sense: [
    { kind: 'block', type: 'kilo_look_is', fields: { DIR: 'right', OP: '==', THING: 'glitch' } },
    { kind: 'block', type: 'kilo_at_exit' },
    { kind: 'block', type: 'kilo_no_cells' },
  ],
  events: [
    { kind: 'block', type: 'game_on_key', fields: { KEY: 'left' } },
    { kind: 'block', type: 'game_every_tick' },
    { kind: 'block', type: 'game_on_collect' },
    { kind: 'block', type: 'game_on_exit' },
    { kind: 'block', type: 'game_on_start' },
  ],
  game: [
    { kind: 'block', type: 'game_glitch_chase' },
    { kind: 'block', type: 'game_glitch_wander' },
    { kind: 'block', type: 'game_win' },
    { kind: 'block', type: 'game_lose' },
    { kind: 'block', type: 'game_say' },
    { kind: 'block', type: 'game_score' },
  ],
};

const ORDER: ToolKey[] = ['events', 'functions', 'move', 'zap', 'say', 'repeat', 'variables', 'while', 'if', 'sense', 'game'];

export function toolboxFor(tools: ToolKey[]): Blockly.utils.toolbox.ToolboxDefinition {
  const set = new Set<ToolKey>([...tools, 'say']);
  const contents: object[] = [];
  for (const k of ORDER) {
    if (!set.has(k)) continue;
    contents.push(...TOOL_BLOCKS[k]);
    contents.push({ kind: 'sep', gap: 28 });
  }
  return { kind: 'flyoutToolbox', contents } as Blockly.utils.toolbox.ToolboxDefinition;
}

/** Turn a BlockNode starter into Blockly's JSON serialisation. */
function nodeToJson(n: BlockNode): Record<string, unknown> {
  const out: Record<string, unknown> = { type: n.type };
  if (n.fields) out.fields = n.fields;
  const inputs: Record<string, unknown> = {};
  for (const [name, list] of Object.entries(n.body ?? {})) {
    const chain = chainJson(list);
    if (chain) inputs[name] = { block: chain };
  }
  for (const [name, v] of Object.entries(n.value ?? {})) inputs[name] = { block: nodeToJson(v) };
  if (Object.keys(inputs).length) out.inputs = inputs;
  return out;
}

function chainJson(list: BlockNode[]): Record<string, unknown> | null {
  if (!list.length) return null;
  const [first, ...rest] = list;
  const j = nodeToJson(first);
  const next = chainJson(rest);
  if (next) j.next = { block: next };
  return j;
}

export function starterState(stacks: BlockNode[][]) {
  let y = 30;
  const blocks = stacks
    .map((stack) => {
      const j = chainJson(stack);
      if (!j) return null;
      j.x = 30;
      j.y = y;
      y += 60 + stack.length * 50 + stack.reduce((a, n) => a + Object.values(n.body ?? {}).flat().length * 45, 0);
      return j;
    })
    .filter(Boolean);
  return { blocks: { languageVersion: 0, blocks } };
}

export function relightTheme() {
  return Blockly.Theme.defineTheme('relight', {
    name: 'relight',
    base: Blockly.Themes.Zelos,
    componentStyles: {
      workspaceBackgroundColour: '#0f1420',
      toolboxBackgroundColour: '#151c2a',
      flyoutBackgroundColour: '#151c2a',
      flyoutOpacity: 1,
      scrollbarColour: '#2B3345',
      insertionMarkerColour: '#ffffff',
      insertionMarkerOpacity: 0.3,
      cursorColour: '#3FE3D1',
    },
    fontStyle: { family: '"Atkinson Hyperlegible", system-ui, sans-serif', weight: '700', size: 12 },
  });
}
