import type { NextConfig } from 'next';

const config: NextConfig = {
  // Sin Tailwind — CSS propio de marca (globals.css)
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
  serverExternalPackages: ['resend'],
};

export default config;
