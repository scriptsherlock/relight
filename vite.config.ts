/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works on GitHub Pages and from a sub-folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  server: { port: 5180, strictPort: true },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
