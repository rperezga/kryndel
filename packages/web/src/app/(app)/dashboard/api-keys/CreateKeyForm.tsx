'use client';
/**
 * Client Component — handles the "Create API Key" form using useActionState
 * so we can display the generated raw key returned by the Server Action.
 */
import { useActionState } from 'react';
import { createApiKey, type CreateKeyState } from './actions';

const initialState: CreateKeyState = {};

export function CreateKeyForm() {
  const [state, formAction, isPending] = useActionState(createApiKey, initialState);

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Show the generated key once */}
      {state.rawKey && (
        <div style={{
          background: 'var(--bg-card, #111)',
          border: '1px solid var(--accent)',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            ✅ API key created — copy it now, you won&apos;t see it again:
          </p>
          <code style={{
            display: 'block',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            padding: '0.5rem',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 4,
          }}>
            {state.rawKey}
          </code>
        </div>
      )}

      {state.error && (
        <p style={{ color: '#f87171', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          {state.error}
        </p>
      )}

      <form action={formAction} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          name="name"
          placeholder="Key name (e.g. production, ci-bot)"
          required
          disabled={isPending}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: 6,
            border: '1px solid var(--border, #333)',
            background: 'var(--bg-card, #111)',
            color: 'inherit',
            opacity: isPending ? 0.6 : 1,
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Creating…' : 'Create API Key'}
        </button>
      </form>
    </div>
  );
}
