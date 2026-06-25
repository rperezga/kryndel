/**
 * /login — magic link sign-in page.
 */
import { signIn } from '@/auth';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export const metadata = { title: 'Sign in — Kryndel' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) redirect(params.callbackUrl ?? '/dashboard');

  const errorMessages: Record<string, string> = {
    OAuthSignin: 'Could not start sign-in. Try again.',
    EmailSignin: 'Could not send the sign-in email. Check your address.',
    Default: 'Sign-in failed. Try again.',
  };
  const errorMsg = params.error ? (errorMessages[params.error] ?? errorMessages.Default) : null;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-ds-shell text-ds-text relative overflow-hidden">

      {/* Decorative background labels */}
      <div className="absolute top-4 right-4 font-ds-mono text-[10px] text-ds-text-3/20 select-none hidden md:block" aria-hidden="true">
        ENCRYPTION: AES-256-GCM
      </div>
      <div className="absolute bottom-4 left-4 font-ds-mono text-[10px] text-ds-text-3/20 select-none hidden md:block" aria-hidden="true">
        LATENCY: 12MS · STREAMS: ACTIVE
      </div>

      {/* Card */}
      <div className="bg-ds-panel border border-solid border-ds-border w-full max-w-[400px] p-8 relative z-10 rounded-lg">

        {/* Branding */}
        <header className="mb-10 flex flex-col items-start gap-1">
          <div className="flex items-center gap-3 mb-4 select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-ds-green animate-pulse shadow-[0_0_8px_rgba(83,246,136,0.6)]" />
            <span className="font-ds-mono text-sm text-ds-green tracking-tight uppercase font-bold">
              kryndel<span className="text-ds-text-3 font-normal">.dev</span>
            </span>
          </div>
          <h1 className="font-ds-sans text-xl font-bold text-ds-text">Sign in to Kryndel</h1>
          <p className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider mt-1">
            No password needed — we&apos;ll email you a link
          </p>
        </header>

        {/* Error */}
        {errorMsg && (
          <div role="alert" className="mb-6 p-3 bg-ds-red/10 border border-solid border-ds-red/40 text-ds-red rounded text-xs font-ds-mono">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form
          action={async (formData: FormData) => {
            'use server';
            const email = formData.get('email') as string;
            await signIn('resend', {
              email,
              redirectTo: params.callbackUrl ?? '/dashboard',
            });
          }}
          className="space-y-5"
        >
          <div>
            <label
              className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest block mb-2"
              htmlFor="email"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              className="w-full bg-ds-shell border border-solid border-ds-border rounded py-3 px-4 font-ds-mono text-sm text-ds-text placeholder:text-ds-text-3/40 outline-none focus:border-ds-green transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-ds-green text-ds-shell font-ds-mono text-sm font-bold py-3 px-6 rounded hover:opacity-90 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 group outline-none"
          >
            <span>Send magic link</span>
            <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">→</span>
          </button>

          <p className="font-ds-sans text-[11px] text-center text-ds-text-3 leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-ds-text-2 hover:text-ds-green transition-colors underline underline-offset-4">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-ds-text-2 hover:text-ds-green transition-colors underline underline-offset-4">
              Privacy Policy
            </a>.
          </p>
        </form>

        {/* Footer status — no border, just subtle spacing */}
        <div className="mt-10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-ds-green animate-pulse" aria-hidden="true" />
            <span className="font-ds-mono text-[10px] text-ds-green/70 uppercase tracking-wider">System Ready</span>
          </div>
          <span className="font-ds-mono text-[10px] text-ds-text-3/50">v4.2.0-STABLE</span>
        </div>
      </div>
    </main>
  );
}
