/**
 * NextAuth v5 route handler — handles all /api/auth/* requests.
 * (GET for redirects/callbacks, POST for sign-in/sign-out)
 */
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
