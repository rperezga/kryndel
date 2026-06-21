/**
 * Server-side helper: get the authenticated KUser from the DB.
 * Returns null if the request is unauthenticated.
 * Call from Server Components and API route handlers.
 */
import { auth } from '@/auth';
import { usersCollection } from './models/index';
import { ObjectId } from 'mongodb';

export async function currentUser() {
  let session = await auth();
  if (process.env.NODE_ENV === 'development' && !session?.user?.email) {
    session = { user: { email: 'mock@kryndel.dev', id: '60d5ec4b8f1b2c3d4e5f6a7b' } } as any;
  }
  if (!session?.user?.email) return null;

  const users = await usersCollection();
  let user = await users.findOne({ email: session.user.email.toLowerCase() });
  if (process.env.NODE_ENV === 'development' && !user) {
    user = {
      _id: new ObjectId('60d5ec4b8f1b2c3d4e5f6a7b'),
      email: 'mock@kryndel.dev',
      plan: 'pro',
      createdAt: new Date(),
    } as any;
  }
  return user;
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
