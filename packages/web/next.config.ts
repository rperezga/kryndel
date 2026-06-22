// @ts-check  (r3)
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Compile @kryndel/core TypeScript source inline — avoids pre-building core on Vercel.
  // webpack 5 resolves the "webpack" export condition in core/package.json → src/index.ts.
  transpilePackages: ['@kryndel/core'],
  webpack(webpackConfig) {
    // core/src uses ESM-style imports with .js extensions (e.g. './recorder.js')
    // that refer to .ts source files. Tell webpack to try .ts when .js isn't found.
    webpackConfig.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return webpackConfig;
  },
  // Tailwind v3 activado (Etapa 0) — preflight=false en tailwind.config.ts
  // MONGODB_URI se lee solo en el servidor (no NEXT_PUBLIC_)
  eslint: {
    // Root eslint.config.js uses @typescript-eslint not available in packages/web npm install
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // resend imports @react-email/render optionally — webpack can't resolve it.
  // Marking resend as external lets Node.js load it at runtime instead of bundling it.
  // viem: used by @kryndel/core tracer/decoder (server-side only).
  // webpack can't bundle it from core/src because it resolves relative to core's dir,
  // not web's node_modules. Mark as external → Node.js resolves it from root node_modules at runtime.
  serverExternalPackages: ['resend', 'viem'],
};

export default config;
