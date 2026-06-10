import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { validateAddress } from '@/lib/validate';
import WatchForm from './WatchForm';

interface Props { params: Promise<{ address: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  return { title: `${address.slice(0, 10)}… · Contract` };
}

function fmtDate(d: unknown): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d as string);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function badgeClass(surface: string): string {
  if (surface === 'evm') return 'badge badge-evm';
  if (surface === 'alphanet') return 'badge badge-alphanet';
  return 'badge badge-native';
}

export default async function ContractPage({ params }: Props) {
  const { address } = await params;

  // A4.5: validar address antes de consultar Mongo
  if (!validateAddress(address)) notFound();

  const db = await getDb();
  const addrLower = address.toLowerCase();

  // Buscar en ambas formas (EVM lowercased, Xahau case-sensitive)
  const contract = await db.collection('contracts').findOne({
    $or: [{ address: addrLower }, { address }],
  });

  // A4.5: máx 50 items por consulta
  const [calls, events] = await Promise.all([
    db.collection('calls')
      .find({ $or: [{ contract: addrLower }, { contract: address }] })
      .sort({ indexedAt: -1 })
      .limit(50)
      .toArray(),
    db.collection('events')
      .find({ $or: [{ contract: addrLower }, { contract: address }] })
      .sort({ indexedAt: -1 })
      .limit(50)
      .toArray(),
  ]);

  const surface: string = (contract?.surface as string | undefined) ?? 'evm';

  // Recolectar event names únicos para el watch form
  const eventNames = [...new Set(events.map((e) => e.name as string))].slice(0, 20);

  return (
    <div>
      <nav className="breadcrumb">
        <a href="/">Explorer</a> / contract
      </nav>

      {/* Header */}
      <div className="contract-header">
        <h1 className="mono">{address}</h1>
        <div className="contract-meta">
          <span className={badgeClass(surface)}>{surface}</span>
          {contract?.label && <span>{contract.label as string}</span>}
          {contract?.firstSeenAt && (
            <span>First seen: {fmtDate(contract.firstSeenAt)}</span>
          )}
          {contract?.updatedAt && (
            <span>Last active: {fmtDate(contract.updatedAt)}</span>
          )}
          <span>{calls.length} calls · {events.length} events indexed</span>
        </div>
      </div>

      {/* Calls */}
      <div className="section">
        <div className="section-title">Recent Calls</div>
        {calls.length === 0 ? (
          <p className="empty">No calls indexed yet. Run <code style={{fontFamily:'var(--mono)'}}>kryndel watch {address}</code> to start indexing.</p>
        ) : (
          <table className="activity-table">
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>Function</th>
                <th>Args</th>
                <th>Block / Ledger</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c, i) => {
                const hash = c.txHash as string | undefined;
                return (
                  <tr key={i}>
                    <td>
                      {hash ? (
                        <a className="link-tx" href={`/contract/${address}/tx/${hash}`}>
                          {hash.slice(0, 10)}…
                        </a>
                      ) : (
                        <span className="mono" style={{ color: 'var(--muted2)' }}>—</span>
                      )}
                    </td>
                    <td><span className="call-name">{c.name as string}</span></td>
                    <td>
                      <span className="args-snippet">
                        {JSON.stringify(c.args).slice(0, 80)}
                      </span>
                    </td>
                    <td className="mono" style={{ color: 'var(--muted2)', fontSize: '.75rem' }}>
                      {(c.ledgerOrBlock as number | undefined) ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Events */}
      <div className="section">
        <div className="section-title">Recent Events</div>
        {events.length === 0 ? (
          <p className="empty">No events indexed yet.</p>
        ) : (
          <table className="activity-table">
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>Event</th>
                <th>Args</th>
                <th>Block / Ledger</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
                const hash = ev.txHash as string | undefined;
                return (
                  <tr key={i}>
                    <td>
                      {hash ? (
                        <a className="link-tx" href={`/contract/${address}/tx/${hash}`}>
                          {hash.slice(0, 10)}…
                        </a>
                      ) : (
                        <span className="mono" style={{ color: 'var(--muted2)' }}>—</span>
                      )}
                    </td>
                    <td><span className="event-name">{ev.name as string}</span></td>
                    <td>
                      <span className="args-snippet">
                        {JSON.stringify(ev.args).slice(0, 80)}
                      </span>
                    </td>
                    <td className="mono" style={{ color: 'var(--muted2)', fontSize: '.75rem' }}>
                      {(ev.ledgerOrBlock as number | undefined) ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* A4.4 — Watch form */}
      <WatchForm contractAddress={address} eventNames={eventNames} />
    </div>
  );
}
