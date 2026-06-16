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
  trustHost: true,
};
