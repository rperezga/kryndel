/**
 * Server-side helper: get the authenticated KUser from the DB.
 * Returns null if the request is unauthenticated.
 * Call from Server Components and API route handlers.
 */
import { auth } from '@/auth';
import { usersCollection } from './models/index.js';

export async function currentUser() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const users = await usersCollection();
  return users.findOne({ email: session.user.email.toLowerCase() });
}

/**
 * Like currentUser() but throws if unauthenticated.
 * Use in API routes that require auth.
 */
export async function requireUser() {
  const user = await currentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}
