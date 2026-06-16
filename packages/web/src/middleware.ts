/**
 * Next.js middleware — protects /dashboard/* routes.
 * Unauthenticated requests are redirected to /login.
 * All other routes (public explorer, /api/auth/*) pass through.
 */
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!(req as { auth?: { user?: unknown } }).auth?.user;

  if (pathname.startsWith('/dashboard') && !isAuthed) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// Only run middleware on dashboard routes (not on static files, API, etc.)
export const config = {
  matcher: ['/dashboard/:path*'],
};
