// Copies the Pyodide runtime into public/pyodide so the game never loads code from a CDN.
import { cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = join('node_modules', 'pyodide');
const dest = join('public', 'pyodide');
const files = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
mkdirSync(dest, { recursive: true });
for (const f of files) {
  const from = join(src, f);
  const to = join(dest, f);
  if (!existsSync(from)) throw new Error(`Missing ${from}. Run npm install.`);
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  cpSync(from, to);
}
console.log('pyodide runtime ready in public/pyodide');
