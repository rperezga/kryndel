// @ts-check  (r3)
import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

// Absolute path to packages/web/ (where this config lives).
const webDir = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  // Compile @kryndel/core TypeScript source inline — avoids pre-building core on Vercel.
  // webpack 5 resolves the "webpack" export condition in core/package.json → src/web.ts.
  transpilePackages: ['@kryndel/core'],
  webpack(webpackConfig) {
    // core/src uses ESM-style imports with .js extensions (e.g. './recorder.js')
    // that refer to .ts source files. Tell webpack to try .ts when .js isn't found.
    webpackConfig.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };

    // Problem: @kryndel/core source (tracer.ts, decoder.ts) imports 'viem'.
    // Webpack resolves bare imports by walking UP the filesystem from the source
    // file being processed (packages/core/src/tracer.ts → packages/core/ → packages/ → …).
    // On Vercel, Root Directory = packages/web, so viem is installed in
    // packages/web/node_modules — a SIBLING directory that webpack never reaches.
    //
    // Fix: prepend packages/web/node_modules to webpack's module resolution list.
    // This makes webpack find viem (and any other web dep) regardless of which
    // source file triggered the import.
    webpackConfig.resolve.modules = [
      path.join(webDir, 'node_modules'),
      'node_modules',
    ];

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
  // resend imports @react-email/render optionally — webpack can't resolve it at build time.
  serverExternalPackages: ['resend'],
};

export default config;
