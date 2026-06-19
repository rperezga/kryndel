/**
 * /login — magic link sign-in page.
 * User enters email; NextAuth sends a sign-in link via Resend.
 */
import { signIn } from '@/auth';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params  = await searchParams;

  // Already signed in → go to dashboard
  if (session?.user) redirect(params.callbackUrl ?? '/dashboard');

  const errorMessages: Record<string, string> = {
    OAuthSignin:  'Could not start sign-in. Try again.',
    EmailSignin:  'Could not send the sign-in email. Check your address.',
    Default:      'Sign-in failed. Try again.',
  };
  const errorMsg = params.error ? (errorMessages[params.error] ?? errorMessages.Default) : null;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent)' }}>
            kryndel<span style={{ color: 'var(--text)' }}>.cloud</span>
          </h1>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
            Sign in with your email — we&apos;ll send you a magic link.
          </p>
        </div>

        {errorMsg && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#7f1d1d22', border: '1px solid #7f1d1d', borderRadius: 4, color: '#fca5a5', fontSize: '0.875rem' }}>
            {errorMsg}
          </div>
        )}

        <form
          action={async (formData: FormData) => {
            'use server';
            const email = formData.get('email') as string;
            await signIn('resend', {
              email,
              redirectTo: params.callbackUrl ?? '/dashboard',
            });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <label style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
            Email address
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            style={{
              padding: '0.625rem 0.75rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text)',
              fontSize: '0.9375rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.625rem',
              background: 'var(--accent)',
              color: '#0f172a',
              border: 'none',
              borderRadius: 4,
              fontWeight: 700,
              fontSize: '0.9375rem',
              cursor: 'pointer',
            }}
          >
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
