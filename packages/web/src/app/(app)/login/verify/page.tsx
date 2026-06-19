export const metadata = { title: 'Check your email' };

export default function VerifyPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
        <h1 style={{ color: 'var(--accent)', marginBottom: '1rem' }}>Check your email</h1>
        <p style={{ color: 'var(--muted)' }}>
          We sent a sign-in link to your email address.<br />
          Click the link in the email to continue.
        </p>
        <p style={{ marginTop: '1.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          The link expires in 10 minutes. Didn&apos;t receive it? Check your spam folder or{' '}
          <a href="/login" style={{ color: 'var(--accent)' }}>try again</a>.
        </p>
      </div>
    </main>
  );
}
