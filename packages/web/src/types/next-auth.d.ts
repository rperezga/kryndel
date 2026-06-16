/**
 * NextAuth v5 type augmentation.
 * Adds `id` to Session.user so API routes can use session.user.id directly.
 */
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
