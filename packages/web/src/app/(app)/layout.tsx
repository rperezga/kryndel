/**
 * App layout — wraps explorer, contract, dashboard, login.
 * Preserves the original site-header (kryndel.explorer branding).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-header">
        <a href="/explorer" className="logo">
          kryndel<span>.explorer</span>
        </a>
        <nav aria-label="App navigation">
          <a href="https://github.com/rperezga/kryndel" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a
            href="https://github.com/rperezga/kryndel/blob/main/LIMITATIONS.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Limitations
          </a>
          <a href="/dashboard">Dashboard</a>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </>
  );
}
