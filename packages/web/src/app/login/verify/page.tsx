/**
 * /login/verify — post-magic-link confirmation screen.
 * Matches login page layout and DS tokens.
 */
export const metadata = { title: 'Check your email — Kryndel' };

export default function VerifyPage() {
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

        {/* Branding — same as login */}
        <header className="mb-10 flex flex-col items-start gap-1">
          <div className="flex items-center gap-3 mb-4 select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-ds-green animate-pulse shadow-[0_0_8px_rgba(83,246,136,0.6)]" />
            <span className="font-ds-mono text-sm text-ds-green tracking-tight uppercase font-bold">
              kryndel<span className="text-ds-text-3 font-normal">.dev</span>
            </span>
          </div>
          <h1 className="font-ds-sans text-xl font-bold text-ds-text">Check your email</h1>
          <p className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider mt-1">
            A sign-in link is on its way to your inbox
          </p>
        </header>

        {/* Email icon */}
        <div className="flex justify-center mb-6" aria-hidden="true">
          <div className="w-14 h-14 rounded-full bg-ds-green/10 border border-solid border-ds-green/30 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ds-green">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2.5 mb-8">
          {[
            'Open your email inbox',
            'Find the email from Kryndel',
            'Click "Sign in to Kryndel"',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full border border-solid border-ds-green/30 text-ds-green font-ds-mono text-[10px] flex items-center justify-center shrink-0 font-bold select-none">
                {i + 1}
              </span>
              <span className="text-ds-text-2 text-[11px] font-ds-mono">{step}</span>
            </div>
          ))}
        </div>

        {/* Expiry + retry */}
        <p className="font-ds-sans text-[11px] text-center text-ds-text-3 leading-relaxed">
          Link expires in{' '}
          <span className="text-ds-text-2 font-bold font-ds-mono">10 minutes</span>.
          {' '}Didn&apos;t get it? Check spam or{' '}
          <a href="/login" className="text-ds-green hover:underline transition-colors">
            try again
          </a>.
        </p>

        {/* Footer status — same as login */}
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
