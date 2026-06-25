/**
 * /login/verify — post-magic-link confirmation screen.
 * Redesigned to match DS tokens and guide the user clearly.
 */
export const metadata = { title: 'Check your email — Kryndel' };

export default function VerifyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-ds-shell text-ds-text">

      <div className="w-full max-w-[420px]">

        {/* Branding */}
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2 no-underline">
            <span className="w-2 h-2 rounded-full bg-ds-green animate-pulse shadow-[0_0_8px_rgba(83,246,136,0.6)]" />
            <span className="font-ds-mono text-sm text-ds-green tracking-tight uppercase font-bold">
              Kryndel<span className="text-ds-text-3 font-normal">.dev</span>
            </span>
          </a>
        </div>

        <div className="bg-ds-panel border border-solid border-ds-border rounded-xl p-8 text-center">

          {/* Email icon */}
          <div
            className="w-16 h-16 rounded-full bg-ds-green/10 border border-solid border-ds-green/30 flex items-center justify-center mx-auto mb-6"
            aria-hidden="true"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ds-green">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </div>

          <h1 className="font-ds-sans text-xl font-bold text-ds-text mb-2">Check your email</h1>
          <p className="text-ds-text-2 text-sm leading-relaxed mb-6">
            We sent a sign-in link to your inbox. Click it to access your Kryndel dashboard.
          </p>

          {/* Steps */}
          <div className="bg-ds-shell/60 border border-solid border-ds-border/50 rounded-lg p-4 text-left mb-6">
            <p className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest mb-3">
              Follow these steps
            </p>
            <ol className="space-y-2.5 list-none p-0 m-0">
              {[
                'Open your email inbox',
                'Find the email from Kryndel',
                'Click "Sign in to Kryndel"',
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-ds-green/10 border border-solid border-ds-green/30 text-ds-green font-ds-mono text-[10px] flex items-center justify-center shrink-0 font-bold select-none">
                    {i + 1}
                  </span>
                  <span className="text-ds-text-2 text-[11px] font-ds-mono">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Expiry + retry */}
          <p className="text-ds-text-3 text-[11px] leading-relaxed">
            Link expires in{' '}
            <span className="text-ds-text-2 font-bold font-ds-mono">10 minutes</span>.
            <br />
            Didn&apos;t get it? Check spam or{' '}
            <a href="/login" className="text-ds-green hover:underline transition-colors">
              try again
            </a>.
          </p>
        </div>

        {/* Back link */}
        <div className="text-center mt-5">
          <a href="/login" className="text-[11px] text-ds-text-3 hover:text-ds-green transition-colors no-underline">
            ← Back to sign in
          </a>
        </div>
      </div>
    </main>
  );
}
