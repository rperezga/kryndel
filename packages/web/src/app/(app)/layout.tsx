import { currentUser } from '@/lib/current-user';
import { signOut } from '@/auth';
import { ChainSelector } from '@/components/ds/ChainSelector';
import { HeaderSearchTrigger } from '@/components/ds/HeaderSearchTrigger';
import { CommandPalette } from '@/components/ds/CommandPalette';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const isLoggedIn = !!user;

  let plan: 'free' | 'pro' = 'free';
  let email = '';
  if (user) {
    email = user.email;
    plan = user.plan === 'pro' ? 'pro' : 'free';
  }

  return (
    <div className="min-h-screen bg-ds-shell text-ds-text">
      {/* ── Top Navigation Bar ── */}
      <header className="fixed top-0 left-0 w-full h-[56px] bg-ds-panel border-0 border-b border-solid border-ds-border flex justify-between items-center px-6 z-50">
        <div className="flex items-center gap-6">
          <a
            href={isLoggedIn ? '/dashboard' : '/explorer'}
            className="font-ds-mono text-sm font-bold text-ds-green tracking-tight uppercase no-underline select-none"
          >
            Kryndel<span className="text-ds-text-3 font-normal">.dev</span>
          </a>
          <ChainSelector />
        </div>

        {/* Search trigger trigger command palette */}
        <div className="hidden md:block">
          <HeaderSearchTrigger />
        </div>

        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <>
              {/* Plan Badge */}
              <span className={`px-2 py-0.5 border border-solid rounded-full font-ds-mono text-[9px] uppercase tracking-wider font-bold ${
                plan === 'pro'
                  ? 'border-ds-green/40 text-ds-green bg-ds-green/5'
                  : 'border-ds-text-3/40 text-ds-text-3 bg-ds-text-3/5'
              }`}>
                {plan}
              </span>
              {/* User Identity */}
              <span className="hidden lg:inline font-ds-mono text-xs text-ds-text-3">
                {email}
              </span>
              {/* Sign Out Button */}
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
                className="m-0 p-0 flex items-center"
              >
                <button
                  type="submit"
                  className="bg-transparent border border-solid border-ds-border hover:border-ds-red/40 hover:text-ds-red text-ds-text-2 text-xs font-ds-mono px-3.5 py-1.5 rounded transition-colors cursor-pointer outline-none"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <a
              href="/login"
              className="border border-solid border-ds-green text-ds-green hover:bg-ds-green/10 text-xs font-ds-mono px-3.5 py-1.5 rounded no-underline transition-colors"
            >
              Sign in
            </a>
          )}
        </div>
      </header>

      {/* ── Side Navigation Bar (Desktop Only) ── */}
      {isLoggedIn && (
        <aside className="fixed left-0 top-[56px] h-[calc(100vh-56px)] w-64 z-40 flex flex-col pt-6 pb-8 bg-ds-panel border-0 border-r border-solid border-ds-border hidden md:flex">
          {/* Workspace Display */}
          <div className="px-6 mb-8 select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ds-green/10 border border-solid border-ds-green flex items-center justify-center rounded">
                <span className="text-ds-green text-xs font-bold font-ds-mono">[K]</span>
              </div>
              <div>
                <div className="text-ds-text font-bold text-sm font-ds-mono tracking-tight">Core_Net_Alpha</div>
                <div className="text-ds-text-3 font-ds-mono text-[9px] tracking-widest uppercase">EVM SIDECHAIN</div>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 flex flex-col px-3 gap-1 overflow-y-auto custom-scrollbar">
            <div className="px-3 py-2 text-ds-text-3 font-ds-mono text-[10px] font-bold uppercase tracking-wider select-none">
              Monitoring
            </div>
            <a
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 text-ds-text-2 hover:text-ds-green hover:bg-ds-panel-2 rounded transition-all font-ds-mono text-xs no-underline"
            >
              Overview
            </a>
            <a
              href="/dashboard/contracts"
              className="flex items-center gap-3 px-3 py-2 text-ds-text-2 hover:text-ds-green hover:bg-ds-panel-2 rounded transition-all font-ds-mono text-xs no-underline"
            >
              Contracts
            </a>
            <a
              href="/dashboard/rules"
              className="flex items-center gap-3 px-3 py-2 text-ds-text-2 hover:text-ds-green hover:bg-ds-panel-2 rounded transition-all font-ds-mono text-xs no-underline"
            >
              Alerts
            </a>
            <a
              href="/dashboard/events"
              className="flex items-center gap-3 px-3 py-2 text-ds-text-2 hover:text-ds-green hover:bg-ds-panel-2 rounded transition-all font-ds-mono text-xs no-underline"
            >
              Events
            </a>
            <a
              href="/dashboard/traces"
              className="flex items-center gap-3 px-3 py-2 text-ds-text-2 hover:text-ds-green hover:bg-ds-panel-2 rounded transition-all font-ds-mono text-xs no-underline"
            >
              Tx Traces
            </a>
            <a
              href="/dashboard/webhooks"
              className="flex items-center gap-3 px-3 py-2 text-ds-text-2 hover:text-ds-green hover:bg-ds-panel-2 rounded transition-all font-ds-mono text-xs no-underline"
            >
              Webhooks
            </a>
            <a
              href="/explorer"
              className="flex items-center gap-3 px-3 py-2 text-ds-text-2 hover:text-ds-green hover:bg-ds-panel-2 rounded transition-all font-ds-mono text-xs no-underline"
            >
              Explorer
            </a>

            <div className="px-3 py-2 text-ds-text-3 font-ds-mono text-[10px] font-bold uppercase tracking-wider mt-6 select-none">
              Workspace
            </div>
            <a
              href="/dashboard/settings"
              className="flex items-center gap-3 px-3 py-2 text-ds-text-2 hover:text-ds-green hover:bg-ds-panel-2 rounded transition-all font-ds-mono text-xs no-underline"
            >
              Settings
            </a>
            <a
              href="/dashboard/contracts?add=true"
              className="mx-3 mt-2 border border-solid border-ds-green text-ds-green bg-transparent font-ds-mono text-xs py-2 hover:bg-ds-green/10 text-center rounded transition-all no-underline"
            >
              DEPLOY NEW
            </a>
          </nav>

          {/* Footer links */}
          <div className="px-6 pt-4 border-t border-solid border-ds-border/30 flex flex-col gap-2">
            <a
              href="/docs"
              className="flex items-center gap-2 text-ds-text-3 hover:text-ds-green font-ds-mono text-[11px] no-underline transition-colors"
            >
              Documentation ↗
            </a>
            <a
              href="/status"
              className="flex items-center gap-2 text-ds-text-3 hover:text-ds-green font-ds-mono text-[11px] no-underline transition-colors"
            >
              System Status ↗
            </a>
          </div>
        </aside>
      )}

      {/* ── Main Content Area ── */}
      <main className={`pt-[56px] min-h-screen bg-ds-shell text-ds-text p-6 ${isLoggedIn ? 'ml-0 md:ml-64 pb-24 md:pb-6' : 'ml-0 pb-6'}`}>
        {children}
      </main>

      {/* ── Mobile Navigation Bar (Mobile Only) ── */}
      {isLoggedIn && (
        <nav className="fixed bottom-0 left-0 w-full h-[60px] bg-ds-panel border-t border-solid border-ds-border flex justify-around items-center px-4 pb-safe z-50 md:hidden">
          <a
            href="/dashboard"
            className="flex flex-col items-center justify-center text-ds-text-3 hover:text-ds-green active:scale-95 transition-all no-underline gap-1"
          >
            <span className="font-ds-mono text-[9px] uppercase tracking-wider font-bold">Home</span>
          </a>
          <a
            href="/dashboard/rules"
            className="flex flex-col items-center justify-center text-ds-text-3 hover:text-ds-green active:scale-95 transition-all no-underline gap-1"
          >
            <span className="font-ds-mono text-[9px] uppercase tracking-wider font-bold">Alerts</span>
          </a>
          <a
            href="/explorer"
            className="flex flex-col items-center justify-center text-ds-text-3 hover:text-ds-green active:scale-95 transition-all no-underline gap-1"
          >
            <span className="font-ds-mono text-[9px] uppercase tracking-wider font-bold">Explorer</span>
          </a>
          <a
            href="/dashboard/traces"
            className="flex flex-col items-center justify-center text-ds-text-3 hover:text-ds-green active:scale-95 transition-all no-underline gap-1"
          >
            <span className="font-ds-mono text-[9px] uppercase tracking-wider font-bold">Traces</span>
          </a>
          <a
            href="/dashboard/contracts?add=true"
            className="flex flex-col items-center justify-center text-ds-text-3 hover:text-ds-green active:scale-95 transition-all no-underline gap-1"
          >
            <span className="font-ds-mono text-[9px] uppercase tracking-wider font-bold">Add</span>
          </a>
          <a
            href="/dashboard/settings"
            className="flex flex-col items-center justify-center text-ds-text-3 hover:text-ds-green active:scale-95 transition-all no-underline gap-1"
          >
            <span className="font-ds-mono text-[9px] uppercase tracking-wider font-bold">Settings</span>
          </a>
          <a
            href="/status"
            className="flex flex-col items-center justify-center text-ds-text-3 hover:text-ds-green active:scale-95 transition-all no-underline gap-1"
          >
            <span className="font-ds-mono text-[9px] uppercase tracking-wider font-bold">Status</span>
          </a>
        </nav>
      )}

      {/* ── Command Palette dialog container ── */}
      <CommandPalette />
    </div>
  );
}
