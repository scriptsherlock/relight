// CodeMirror 6 Python editor with the running line highlighted, an error line
// marker, and autocomplete for Kilo's and the game's commands.

import { useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers, highlightActiveLine, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { indentUnit, syntaxHighlighting, HighlightStyle, bracketMatching } from '@codemirror/language';
import { autocompletion, closeBrackets, type CompletionContext } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';

const setMarks = StateEffect.define<{ run: number; error: number }>();

const marks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setMarks)) continue;
      const b = new RangeSetBuilder<Decoration>();
      const { run, error } = e.value;
      const lines = [
        [run, 'cm-run-line'],
        [error, 'cm-error-line'],
      ]
        .filter(([n]) => (n as number) > 0 && (n as number) <= tr.state.doc.lines)
        .sort((a, b2) => (a[0] as number) - (b2[0] as number));
      for (const [n, cls] of lines) {
        const line = tr.state.doc.line(n as number);
        b.add(line.from, line.from, Decoration.line({ class: cls as string }));
      }
      value = b.finish();
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const BOT = [
  ['move_right()', 'Move right'],
  ['move_left()', 'Move left'],
  ['move_up()', 'Move up'],
  ['move_down()', 'Move down'],
  ['move("right", 2)', 'Move in any direction'],
  ['zap("right")', 'Zap a square'],
  ['look("right")', 'What is next to Kilo?'],
  ['at_exit()', 'Is Kilo on the exit?'],
  ['cells_left()', 'How many cells are left?'],
  ['say("Hello!")', 'Speech bubble'],
];
const GAME = [
  ['glitches()', 'Every glitch still alive'],
  ['win("You win!")', 'End the game: win'],
  ['lose("Game over!")', 'End the game: lose'],
  ['say("Go!")', 'Show a banner'],
  ['add_score(1)', 'Add points'],
  ['score', 'Current score'],
];

function complete(ctx: CompletionContext) {
  const m = ctx.matchBefore(/\b(bot|game|g)\.\w*/);
  if (!m) return null;
  const dot = m.text.indexOf('.');
  const obj = m.text.slice(0, dot);
  const list =
    obj === 'bot' ? BOT : obj === 'game' ? GAME : [['move_toward_bot()', 'Step towards Kilo'], ['move_random()', 'Random step'], ['move("left")', 'Move this glitch']];
  return {
    from: m.from + dot + 1,
    options: list.map(([label, detail]) => ({ label, detail, type: 'method', apply: label })),
  };
}

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#FF7AD9', fontWeight: '700' },
  { tag: [tags.string], color: '#FFD36B' },
  { tag: [tags.number, tags.bool], color: '#9BFF5A' },
  { tag: tags.comment, color: '#6F7A90', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#6FE9FF' },
  { tag: tags.propertyName, color: '#6FE9FF' },
  { tag: tags.variableName, color: '#E4E8F0' },
  { tag: tags.operator, color: '#C9B6FF' },
  { tag: tags.definitionKeyword, color: '#FF7AD9' },
]);

const theme = EditorView.theme(
  {
    '&': { height: '100%', background: '#0f1420', color: '#E4E8F0', fontSize: '1.06rem' },
    '.cm-content': { fontFamily: '"IBM Plex Mono", ui-monospace, monospace', padding: '12px 0', caretColor: '#3FE3D1' },
    '.cm-gutters': { background: '#0f1420', color: '#58627a', border: 'none' },
    '.cm-activeLine': { background: 'rgba(255,255,255,0.03)' },
    '.cm-activeLineGutter': { background: 'transparent', color: '#97A1B4' },
    '.cm-run-line': { background: 'rgba(63, 227, 209, 0.16)', boxShadow: 'inset 3px 0 0 var(--accent)' },
    '.cm-error-line': { background: 'rgba(240, 100, 93, 0.18)', boxShadow: 'inset 3px 0 0 #F0645D' },
    '.cm-cursor': { borderLeftColor: '#3FE3D1', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { background: 'rgba(63,227,209,0.22) !important' },
    '.cm-tooltip-autocomplete': { background: '#171D29', border: '1px solid #2B3345', fontFamily: '"IBM Plex Mono", monospace' },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { background: '#2B3345', color: '#fff' },
    '.cm-completionDetail': { color: '#97A1B4', marginLeft: '1em', fontStyle: 'normal' },
  },
  { dark: true },
);

interface Props {
  value: string;
  onChange: (code: string) => void;
  runLine: number;
  errorLine: number;
  readOnly?: boolean;
  onRun?: () => void;
}

export function CodeEditor({ value, onChange, runLine, errorLine, readOnly, onRun }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ onChange, onRun });
  cb.current = { onChange, onRun };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          highlightActiveLine(),
          bracketMatching(),
          closeBrackets(),
          indentUnit.of('    '),
          EditorState.tabSize.of(4),
          python(),
          syntaxHighlighting(highlight),
          autocompletion({ override: [complete], activateOnTyping: true }),
          keymap.of([
            { key: 'Mod-Enter', run: () => (cb.current.onRun?.(), true) },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          marks,
          theme,
          EditorState.readOnly.of(!!readOnly),
          EditorView.contentAttributes.of({ 'aria-label': 'Python code', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cb.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // External value changes (reset, switching levels).
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: setMarks.of({ run: runLine, error: errorLine }) });
  }, [runLine, errorLine]);

  return <div className="code-editor" ref={host} />;
}
