import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// La suite activa es el núcleo de observabilidad (packages/*/src + test).
// El simulador de Hooks archivado en packages/core/legacy/hooks-sim/ NO se testea aquí
// (se preserva como historia; ver DELTA.md / PLAN.md, DEC-006).
export default defineConfig({
  resolve: {
    alias: {
      // Mirror Next.js path alias so tests can import @/lib/... and @/auth etc.
      '@': resolve(__dirname, 'packages/web/src'),
      // @kryndel/core → its web-safe source, so tests resolve it without a built dist/.
      // (Only the addRule action imports it; prod uses the same 'web'/webpack export.)
      '@kryndel/core': resolve(__dirname, 'packages/core/src/web.ts'),
    },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/legacy/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
});
