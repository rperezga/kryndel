import { defineConfig } from 'vitest/config';

// La suite activa es el núcleo de observabilidad (packages/*/src + test).
// El simulador de Hooks archivado en packages/core/legacy/hooks-sim/ NO se testea aquí
// (se preserva como historia; ver DELTA.md / PLAN.md, DEC-006).
export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/legacy/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
});
