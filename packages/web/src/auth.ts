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
import { getDb } from '@/lib/db';

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
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#050706;font-family:ui-monospace,'Cascadia Code','Fira Mono',monospace">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#050706;padding:40px 16px">
                <tr><td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#090d0a;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:36px">

                    <!-- Branding -->
                    <tr><td style="padding-bottom:28px">
                      <table cellpadding="0" cellspacing="0"><tr>
                        <td style="padding-right:8px;vertical-align:middle">
                          <div style="width:8px;height:8px;border-radius:50%;background:#2bd96f;display:inline-block"></div>
                        </td>
                        <td style="vertical-align:middle">
                          <span style="font-size:13px;font-weight:700;color:#2bd96f;text-transform:uppercase;letter-spacing:.05em">KRYNDEL</span><span style="font-size:13px;font-weight:400;color:rgba(232,245,236,.4)">.DEV</span>
                        </td>
                      </tr></table>
                    </td></tr>

                    <!-- Heading -->
                    <tr><td style="padding-bottom:8px">
                      <p style="margin:0;font-size:18px;font-weight:700;color:#e8f5ec;font-family:ui-sans-serif,system-ui,sans-serif">Sign in to Kryndel</p>
                    </td></tr>

                    <!-- Subtitle -->
                    <tr><td style="padding-bottom:28px">
                      <p style="margin:0;font-size:11px;color:rgba(232,245,236,.4);text-transform:uppercase;letter-spacing:.1em">SECURE_AUTH_LAYER: V4.2.0-STABLE</p>
                    </td></tr>

                    <!-- Body -->
                    <tr><td style="padding-bottom:28px">
                      <p style="margin:0;font-size:13px;color:rgba(232,245,236,.65);line-height:1.6">Click the button below to sign in. This link expires in <strong style="color:#e8f5ec">10 minutes</strong> and can only be used once.</p>
                    </td></tr>

                    <!-- CTA Button -->
                    <tr><td style="padding-bottom:28px">
                      <a href="${url}" style="display:inline-block;padding:12px 28px;background:#2bd96f;color:#050706;font-weight:700;text-decoration:none;border-radius:6px;font-size:13px;letter-spacing:.03em">
                        Sign in to Kryndel →
                      </a>
                    </td></tr>

                    <!-- Divider -->
                    <tr><td style="padding-bottom:20px;border-top:1px solid rgba(255,255,255,.06)"></td></tr>

                    <!-- Footer -->
                    <tr><td>
                      <table width="100%" cellpadding="0" cellspacing="0"><tr>
                        <td>
                          <div style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#2bd96f;vertical-align:middle;margin-right:6px"></div>
                          <span style="font-size:10px;color:rgba(43,217,111,.6);text-transform:uppercase;letter-spacing:.1em;vertical-align:middle">SYSTEM READY</span>
                        </td>
                        <td align="right">
                          <span style="font-size:10px;color:rgba(232,245,236,.2)">If you didn't request this, ignore this email.</span>
                        </td>
                      </tr></table>
                    </td></tr>

                  </table>
                </td></tr>
              </table>
            </body>
            </html>
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

  // Login tracking: registra cada sign-in real (magic link) en la colección `logins`.
  // Con estrategia JWT no hay sesión en DB, así que esto es lo que alimenta el panel /admin.
  events: {
    async signIn({ user }) {
      try {
        if (!user?.email) return;
        const db = await getDb();
        await db.collection('logins').insertOne({
          email: user.email.toLowerCase(),
          at: new Date(),
        });
      } catch {
        // nunca bloquear el login si el tracking falla
      }
    },
  },
});
