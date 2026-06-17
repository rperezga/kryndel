/**
 * Edge-safe NextAuth config — used by middleware (Edge runtime).
 * Must NOT import MongoDB, crypto, or any Node.js-only module.
 * Providers are empty here; the full list lives in auth.ts (Node.js only).
 */
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  providers: [], // providers only needed on Node.js side
  // JWT strategy: session encoded in a cookie — Edge middleware can verify it
  // without a DB round-trip.  The MongoDB adapter still stores Users + Accounts.
  session: { strategy: 'jwt' },
  pages: {
    signIn:        '/login',
    error:         '/login',
    verifyRequest: '/login/verify',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn  = !!auth?.user;
      const isDashboard = nextUrl.pathname.startsWith('/dashboard');
      if (isDashboard && !isLoggedIn) return false; // redirect to signIn
      return true;
    },
  },
  // ── trustHost: true — security rationale (AUDIT-PA-2026-06-16 §M5) ─────────
  //
  // `trustHost: true` tells NextAuth to derive callback URLs from the
  // `X-Forwarded-Host` header so magic-link redirects work behind a proxy.
  // The standard concern is that a client-controllable Host header could
  // redirect the magic link to an attacker domain (host header injection).
  //
  // Why it's safe in THIS deploy:
  //   1. The web package is deployed on Vercel. Vercel's edge proxies
  //      validate the incoming Host against the project's configured domains
  //      BEFORE handing the request to the Next.js runtime — an arbitrary
  //      attacker cannot inject an X-Forwarded-Host for kryndel.cloud.
  //   2. There is no additional reverse-proxy between Vercel and Next.js.
  //   3. `AUTH_SECRET` is server-only; tokens are signed, so a successful
  //      redirect still requires the attacker to control the signing key.
  //
  // **Do not** combine `trustHost: true` with a self-hosted proxy chain
  // (Cloudflare → nginx → Next) unless every hop strips and rewrites the
  // `X-Forwarded-Host` header.
  trustHost: true,
};
