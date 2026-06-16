import type { NextConfig } from 'next';

const config: NextConfig = {
  // Sin Tailwind — CSS propio de marca (globals.css)
  // MONGODB_URI se lee solo en el servidor (no NEXT_PUBLIC_)
  eslint: {
    // Root eslint.config.js uses @typescript-eslint not available in packages/web npm install
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TypeScript check runs via Next's bundled tsc; suppress extra errors from missing root deps
    ignoreBuildErrors: false,
  },
};

export default config;
