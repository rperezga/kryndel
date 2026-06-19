'use client';
// A4.4 — Formulario "Vigilar un evento" (client component con useActionState).
import { useActionState } from 'react';
import { watchEvent, type WatchState } from './actions';

interface Props {
  contractAddress: string;
  eventNames: string[];
}

const initial: WatchState = {};

export default function WatchForm({ contractAddress, eventNames }: Props) {
  const [state, action, pending] = useActionState(watchEvent, initial);

  return (
    <div className="watch-panel">
      <h2>Watch an Event → Alert</h2>
      <form action={action}>
        {/* Campo oculto con la dirección del contrato */}
        <input type="hidden" name="contract" value={contractAddress} />

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="watch-event">Event</label>
            {eventNames.length > 0 ? (
              <select id="watch-event" name="event">
                {eventNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
                <option value="">— custom —</option>
              </select>
            ) : (
              <input
                id="watch-event"
                name="event"
                placeholder="Transfer or 0xabc123…"
                maxLength={80}
              />
            )}
          </div>

          <div className="form-group">
            <label htmlFor="watch-channel">Channel</label>
            <select id="watch-channel" name="channel">
              <option value="telegram">Telegram</option>
              <option value="discord">Discord</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="watch-target">Target</label>
            <input
              id="watch-target"
              name="target"
              placeholder="Chat ID or webhook URL"
              maxLength={256}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className="btn"
            disabled={pending}
            style={{ alignSelf: 'flex-end', minWidth: 100 }}
          >
            {pending ? 'Saving…' : 'Watch →'}
          </button>
        </div>

        {state.error && (
          <p className="form-msg error">
            {state.error === 'You must sign in to create alert rules.' ? (
              <span>
                You must{' '}
                <a
                  href={`/login?callbackUrl=${encodeURIComponent(`/contract/${contractAddress}`)}`}
                  style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 'bold' }}
                >
                  sign in
                </a>{' '}
                to create alert rules.
              </span>
            ) : (
              state.error
            )}
          </p>
        )}
        {state.success && (
          <p className="form-msg success">✓ {state.success}</p>
        )}
      </form>
    </div>
  );
}
