import type { Config } from 'tailwindcss';

/**
 * Tailwind config — Etapa 0 Fundaciones del sistema de diseño
 *
 * CRÍTICO: preflight = false → no toca el reset ni las vars existentes de globals.css
 * Los tokens usan prefijo --ds- para evitar colisión con --bg, --panel, etc.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false, // globals.css ya tiene su propio reset; no romper páginas vivas
  },
  theme: {
    extend: {
      colors: {
        'ds-shell':    'var(--ds-shell)',
        'ds-panel':    'var(--ds-panel)',
        'ds-panel-2':  'var(--ds-panel-2)',
        'ds-green':    'var(--ds-green)',
        'ds-amber':    'var(--ds-amber)',
        'ds-red':      'var(--ds-red)',
        'ds-text':     'var(--ds-text)',
        'ds-text-2':   'var(--ds-text-2)',
        'ds-text-3':   'var(--ds-text-3)',
        'ds-border':   'var(--ds-border)',
        'ds-border-on':'var(--ds-border-on)',
      },
      fontFamily: {
        'ds-sans': ['var(--font-inter)', 'system-ui', 'sans-serif'],
        'ds-mono': ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },
      fontVariantNumeric: {
        'tabular': 'tabular-nums',
      },
      keyframes: {
        'ds-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':       { opacity: '0.45', transform: 'scale(0.85)' },
        },
        'ds-phosphor': {
          '0%':   { boxShadow: '0 0 0 0 rgba(43, 217, 111, 0.55)' },
          '70%':  { boxShadow: '0 0 0 8px rgba(43, 217, 111, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(43, 217, 111, 0)' },
        },
      },
      animation: {
        'ds-pulse':    'ds-pulse 1.8s ease-in-out infinite',
        'ds-phosphor': 'ds-phosphor 0.6s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
