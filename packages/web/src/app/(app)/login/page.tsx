/**
 * /login — magic link sign-in page.
 * Re-skinned with Kryndel Design System tokens and console aesthetic.
 * Preserves next-auth login rules and error messages.
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
  const params = await searchParams;

  // Already signed in → go to dashboard
  if (session?.user) redirect(params.callbackUrl ?? '/dashboard');

  const errorMessages: Record<string, string> = {
    OAuthSignin: 'Could not start sign-in. Try again.',
    EmailSignin: 'Could not send the sign-in email. Check your address.',
    Default: 'Sign-in failed. Try again.',
  };
  const errorMsg = params.error ? (errorMessages[params.error] ?? errorMessages.Default) : null;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-ds-shell text-ds-text relative overflow-hidden">
      {/* Centered Login Card */}
      <div className="bg-ds-panel border border-solid border-ds-border w-full max-w-[400px] p-8 relative z-10 rounded-lg">
        {/* Technical Header Branding */}
        <header className="mb-10 flex flex-col items-start gap-1">
          <div className="flex items-center gap-3 mb-4 select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-ds-green animate-pulse shadow-[0_0_8px_rgba(83,246,136,0.6)]" />
            <h1 className="font-ds-mono text-sm text-ds-green tracking-tight uppercase">
              kryndel<span className="text-ds-text-3 font-normal">.dev</span>
            </h1>
          </div>
          <h2 className="font-ds-sans text-xl font-bold text-ds-text">Sign in to Kryndel</h2>
          <p className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider">
            SECURE_AUTH_LAYER: v4.2.0-STABLE
          </p>
        </header>

        {/* Error message banner */}
        {errorMsg && (
          <div className="mb-6 p-3 bg-ds-red/10 border border-solid border-ds-red text-ds-red/90 rounded text-xs font-ds-mono">
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form
          action={async (formData: FormData) => {
            'use server';
            const email = formData.get('email') as string;
            await signIn('resend', {
              email,
              redirectTo: params.callbackUrl ?? '/dashboard',
            });
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <label
              className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest block"
              htmlFor="email"
            >
              Network Identity / Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              placeholder="user@kryndel.network"
              className="w-full bg-ds-shell border border-solid border-ds-border rounded-none py-3 px-4 font-ds-mono text-sm text-ds-text placeholder:text-ds-text-3 outline-none focus:border-ds-green transition-all"
              autoFocus
            />
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              className="w-full bg-transparent border border-solid border-ds-green text-ds-green font-ds-mono text-xs py-3 px-6 hover:bg-ds-green/10 active:opacity-80 transition-all duration-150 flex items-center justify-center gap-2 group outline-none focus:bg-ds-green/10"
            >
              <span>Send magic link</span>
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform font-ds-mono">
                &rarr;
              </span>
            </button>
            
            <p className="font-ds-sans text-[11px] text-center text-ds-text-3 leading-relaxed">
              By continuing, you agree to our{' '}
              <a href="#" className="text-ds-text-2 hover:text-ds-green transition-colors underline underline-offset-4">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-ds-text-2 hover:text-ds-green transition-colors underline underline-offset-4">
                Privacy Protocol
              </a>
              .
            </p>
          </div>
        </form>

        {/* Bottom Status Decorations */}
        <div className="mt-12 pt-6 border-t border-solid border-ds-border/40 flex justify-between items-center text-xs font-ds-mono">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-ds-green animate-pulse" />
            <span className="text-[10px] text-ds-green uppercase tracking-wider font-bold">System Ready</span>
          </div>
          <span className="text-[10px] text-ds-text-3">LOC: 127.0.0.1</span>
        </div>
      </div>

      {/* Decorative background labels for high contrast theme visual appeal (hidden on mobile) */}
      <div className="absolute bottom-4 left-4 font-ds-mono text-[10px] text-ds-text-3/20 select-none hidden md:block" aria-hidden="true">
        LATENCY: 12MS | STREAMS: ACTIVE | OBSERVE: ON
      </div>
      <div className="absolute top-4 right-4 font-ds-mono text-[10px] text-ds-text-3/20 select-none hidden md:block" aria-hidden="true">
        ENCRYPTION: AES-256-GCM
      </div>
    </main>
  );
}
