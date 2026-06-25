/**
 * /login — magic link sign-in page (redesigned v2).
 * More guided UX: explains magic link flow, trust signals, cleaner layout.
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

      {/* Subtle top/bottom accent lines */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ds-green/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ds-green/10 to-transparent" />
        <div className="absolute top-4 right-4 font-ds-mono text-[10px] text-ds-text-3/15 select-none hidden md:block">
          ENCRYPTION: AES-256-GCM
        </div>
        <div className="absolute bottom-4 left-4 font-ds-mono text-[10px] text-ds-text-3/15 select-none hidden md:block">
          LATENCY: 12MS · STREAMS: ACTIVE
        </div>
      </div>

      <div className="w-full max-w-[420px] relative z-10">

        {/* Top branding */}
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2 no-underline mb-1">
            <span className="w-2 h-2 rounded-full bg-ds-green animate-pulse shadow-[0_0_8px_rgba(83,246,136,0.6)]" />
            <span className="font-ds-mono text-sm text-ds-green tracking-tight uppercase font-bold">
              Kryndel<span className="text-ds-text-3 font-normal">.dev</span>
            </span>
          </a>
          <h1 className="font-ds-sans text-2xl font-bold text-ds-text mt-5 mb-2">Welcome back</h1>
          <p className="text-ds-text-2 text-sm">Sign in to monitor your XRPL contracts</p>
        </div>

        {/* Main card */}
        <div className="bg-ds-panel border border-solid border-ds-border rounded-xl p-8">

          {/* Error banner */}
          {errorMsg && (
            <div role="alert" className="mb-6 p-3 bg-ds-red/10 border border-solid border-ds-red/40 text-ds-red rounded-lg text-xs font-ds-mono flex items-start gap-2">
              <span aria-hidden="true">⚠</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Magic link explainer */}
          <div className="mb-6 flex items-start gap-3 p-3 bg-ds-shell/60 border border-solid border-ds-border/50 rounded-lg">
            <span className="text-ds-green text-base leading-none mt-0.5" aria-hidden="true">✉</span>
            <div>
              <p className="font-ds-mono text-[10px] font-bold text-ds-text uppercase tracking-wider mb-0.5">
                No password needed
              </p>
              <p className="text-ds-text-3 text-[11px] leading-relaxed">
                Enter your email and we&apos;ll send a secure sign-in link — no password, no hassle.
              </p>
            </div>
          </div>

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
            className="space-y-4"
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
                className="w-full bg-ds-shell border border-solid border-ds-border rounded-lg py-3 px-4 font-ds-mono text-sm text-ds-text placeholder:text-ds-text-3/40 outline-none focus:border-ds-green transition-colors"
                autoFocus
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-ds-green text-ds-shell font-ds-mono text-sm font-bold py-3 px-6 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:ring-offset-2 focus-visible:ring-offset-ds-panel"
            >
              <span>Send magic link</span>
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">
                →
              </span>
            </button>
          </form>

          {/* Step guide */}
          <div className="mt-6 pt-5 border-t border-solid border-ds-border/40">
            <p className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest mb-3">
              What happens next
            </p>
            <ol className="space-y-2.5 list-none p-0 m-0">
              {[
                'Enter your email above and click send',
                'Check your inbox for the Kryndel link',
                'Click it — you\'re in, no password ever',
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full border border-solid border-ds-green/30 text-ds-green font-ds-mono text-[10px] flex items-center justify-center shrink-0 font-bold select-none">
                    {i + 1}
                  </span>
                  <span className="text-ds-text-2 text-[11px] font-ds-mono">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Footer legal + status */}
        <div className="mt-5 flex flex-col items-center gap-3">
          <p className="text-center text-[11px] text-ds-text-3 leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-ds-text-2 hover:text-ds-green transition-colors underline underline-offset-4">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-ds-text-2 hover:text-ds-green transition-colors underline underline-offset-4">
              Privacy Policy
            </a>.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-ds-green animate-pulse" aria-hidden="true" />
              <span className="font-ds-mono text-[9px] text-ds-green/60 uppercase tracking-widest">System Ready</span>
            </div>
            <span className="font-ds-mono text-[9px] text-ds-text-3/40">v4.2.0-STABLE</span>
          </div>
        </div>

        {/* New user nudge */}
        <p className="text-center text-[11px] text-ds-text-3 mt-4">
          New to Kryndel?{' '}
          <a href="/" className="text-ds-green hover:underline transition-colors">
            See what we build →
          </a>
        </p>
      </div>
    </main>
  );
}
