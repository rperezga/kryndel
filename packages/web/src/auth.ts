/**
 * NextAuth v5 configuration — Kryndel Cloud.
 *
 * Strategy: magic link (email) via Resend.
 * - User enters email → Resend sends a one-click login link.
 * - On click, NextAuth creates a session and sets a httpOnly cookie.
 * - Sessions are stored in MongoDB (`sessions` collection via @auth/mongodb-adapter).
 *
 * Wallet auth (SIWE) is deferred to Fase B.
 *
 * Required env vars:
 *   AUTH_SECRET     — random 32-byte secret (openssl rand -base64 32)
 *   RESEND_API_KEY  — Resend API key
 *   EMAIL_FROM      — verified sender address (e.g. login@kryndel.dev once domain verified in Resend;
 *                      currently noreply@kryndel.xyz until kryndel.dev DNS propagates)
 *   MONGODB_URI     — MongoDB connection string
 *   NEXTAUTH_URL    — app base URL (http://localhost:3000 in dev)
 */
import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import { authConfig } from '@/auth.config';

// NextAuth v5 needs its own MongoClient reference (separate from our app client).
// We create a dedicated client here so the adapter lifecycle is self-contained.
function getAuthClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  return new MongoClient(uri, { maxPoolSize: 5 });
}

declare global {
  // eslint-disable-next-line no-var
  var _kryndelAuthClient: MongoClient | undefined;
}

const authClient: MongoClient =
  process.env.NODE_ENV === 'development'
    ? (global._kryndelAuthClient ??= getAuthClient())
    : getAuthClient();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(authClient, {
    databaseName: 'kryndel',
    collections: {
      // Use our collection names (NextAuth defaults differ)
      Users:            'users',
      Accounts:         'accounts',          // OAuth accounts (future)
      Sessions:         'auth_sessions',     // NextAuth sessions (separate from our KSession)
      VerificationTokens: 'auth_tokens',     // magic link tokens
    },
  }),

  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from:   process.env.EMAIL_FROM ?? 'noreply@kryndel.xyz',
      // Custom email subject and body
      sendVerificationRequest: async ({ identifier: email, url, provider }) => {
        const { Resend: ResendClient } = await import('resend');
        const resend = new ResendClient(provider.apiKey as string);

        const { error } = await resend.emails.send({
          from:    provider.from as string,
          to:      [email],
          subject: 'Sign in to Kryndel',
          html: `
            <div style="font-family:monospace;max-width:480px;margin:40px auto;padding:24px;border:1px solid #1e293b;border-radius:8px;background:#0f172a;color:#e2e8f0">
              <div style="font-size:20px;font-weight:700;color:#f97316;margin-bottom:16px">kryndel<span style="color:#e2e8f0">.cloud</span></div>
              <p style="margin:0 0 24px">Click the link below to sign in. The link expires in 10 minutes.</p>
              <a href="${url}" style="display:inline-block;padding:10px 20px;background:#f97316;color:#0f172a;font-weight:700;text-decoration:none;border-radius:6px;font-size:14px">Sign in to Kryndel</a>
              <p style="margin:24px 0 0;font-size:12px;color:#64748b">If you didn't request this, you can ignore this email.</p>
            </div>
          `,
        });

        if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
      },
    }),
  ],

  callbacks: {
    // JWT strategy: persist user id into the token on first sign-in.
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    // Expose user id in the session object so API routes can use it directly.
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
