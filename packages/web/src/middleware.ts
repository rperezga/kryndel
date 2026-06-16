/**
 * Next.js middleware — protects /dashboard/* routes.
 * Uses Edge-safe auth config (no MongoDB / crypto imports).
 * The authorized() callback in authConfig handles the redirect logic.
 */
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

// Only run middleware on dashboard routes (not on static files, API, etc.)
export const config = {
  matcher: ['/dashboard/:path*'],
};
