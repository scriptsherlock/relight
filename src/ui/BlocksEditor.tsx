// Blockly workspace for the Builder track. Reports runnable Python on every change.

import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import type { ToolKey } from '../content/levels';
import { defineBlocks, relightTheme, toolboxFor, workspaceToRunnable } from './blocks';

interface Props {
  /** Blockly JSON state to load. Changing `loadKey` reloads it. */
  state: object;
  loadKey: string;
  tools: ToolKey[];
  highlight: string | null;
  onChange: (runnable: string, state: object) => void;
}

export function BlocksEditor({ state, loadKey, tools, highlight, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ws = useRef<Blockly.WorkspaceSvg | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    defineBlocks();
    const w = Blockly.inject(host.current!, {
      toolbox: toolboxFor(tools),
      renderer: 'zelos',
      theme: relightTheme(),
      trashcan: true,
      sounds: false,
      zoom: { controls: true, wheel: false, startScale: 0.9 * (parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1), maxScale: 1.6, minScale: 0.5 },
      move: { scrollbars: true, drag: true, wheel: true },
      grid: { spacing: 28, length: 2, colour: '#1c2433', snap: false },
    });
    ws.current = w;
    try {
      Blockly.serialization.workspaces.load(state, w);
    } catch {
      w.clear();
    }
    const emit = () => cb.current(workspaceToRunnable(w), Blockly.serialization.workspaces.save(w));
    emit();
    w.addChangeListener((e) => {
      if (e.isUiEvent) return;
      emit();
    });
    const ro = new ResizeObserver(() => Blockly.svgResize(w));
    ro.observe(host.current!);
    return () => {
      ro.disconnect();
      w.dispose();
      ws.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  useEffect(() => {
    ws.current?.updateToolbox(toolboxFor(tools));
  }, [tools]);

  useEffect(() => {
    ws.current?.highlightBlock(highlight);
  }, [highlight]);

  return <div className="blocks-editor" ref={host} />;
}
