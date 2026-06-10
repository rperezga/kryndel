import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { validateAddress, validateTxHash } from '@/lib/validate';

interface Props { params: Promise<{ address: string; hash: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  return { title: `tx ${hash.slice(0, 10)}… · Timeline` };
}

function fmtArgs(args: unknown): string {
  try { return JSON.stringify(args, null, 2); }
  catch { return String(args); }
}

export default async function TxPage({ params }: Props) {
  const { address, hash } = await params;

  // A4.5: validar ambos parámetros antes de consultar Mongo
  if (!validateAddress(address) || !validateTxHash(hash)) notFound();

  const db = await getDb();
  const addrLower = address.toLowerCase();
  const hashLower = hash.toLowerCase(); // EVM hashes son lowercase; XRPL son uppercase

  // Buscar en ambas casings
  const [calls, events] = await Promise.all([
    db.collection('calls')
      .find({
        $or: [{ contract: addrLower }, { contract: address }],
        $or: [{ txHash: hash }, { txHash: hashLower }, { txHash: hash.toUpperCase() }],
      } as object)
      .limit(1)
      .toArray(),
    db.collection('events')
      .find({
        $or: [{ contract: addrLower }, { contract: address }],
        $or: [{ txHash: hash }, { txHash: hashLower }, { txHash: hash.toUpperCase() }],
      } as object)
      .sort({ logIndex: 1, indexedAt: 1 })
      .limit(50) // A4.5: límite de paginación
      .toArray(),
  ]);

  if (calls.length === 0 && events.length === 0) notFound();

  const call = calls[0];

  return (
    <div className="timeline-page">
      <nav className="breadcrumb">
        <a href="/">Explorer</a>
        {' / '}
        <a href={`/contract/${address}`}>{address.slice(0, 10)}…</a>
        {' / tx'}
      </nav>

      <h1>tx {hash}</h1>

      <div className="timeline">
        {/* Call node */}
        {call && (
          <div className="timeline-node node-call" data-icon="→">
            <div className="node-kind">call</div>
            <span className="node-label">{call.name as string}</span>
            <pre className="node-args">{fmtArgs(call.args)}</pre>
            {(call.ledgerOrBlock as number | undefined) !== undefined && (
              <div className="node-block">
                block / ledger {call.ledgerOrBlock as number}
              </div>
            )}
          </div>
        )}

        {/* Event nodes */}
        {events.map((ev, i) => {
          // Detectar si es un EmittedTxn (tipo 'emit') vs evento EVM
          const isEmit = (ev.name as string)?.startsWith('[emit]') ||
                         (ev.name as string) === 'EmittedTxn';
          return (
            <div
              key={i}
              className={`timeline-node ${isEmit ? 'node-emit' : 'node-event'}`}
              data-icon={isEmit ? '↗' : '◆'}
            >
              <div className="node-kind">{isEmit ? 'emitted tx' : 'event'}</div>
              <span className="node-label">{ev.name as string}</span>
              <pre className="node-args">{fmtArgs(ev.args)}</pre>
              {(ev.logIndex as number | undefined) !== undefined && (
                <div className="node-block">log index {ev.logIndex as number}</div>
              )}
              {(ev.ledgerOrBlock as number | undefined) !== undefined && (
                <div className="node-block">ledger {ev.ledgerOrBlock as number}</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <a href={`/contract/${address}`} className="btn btn-ghost">
          ← Back to contract
        </a>
      </div>
    </div>
  );
}
