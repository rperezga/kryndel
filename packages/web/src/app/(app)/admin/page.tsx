/**
 * /admin — Panel interno de actividad del sitio (solo admin).
 *
 * Muestra una vista general para tomar decisiones: usuarios, signups, logins,
 * uso del producto y entregas de webhooks. Gateado por ADMIN_EMAIL (ver lib/admin.ts).
 *
 * Datos en vivo desde MongoDB. Para el tráfico anónimo (visitantes, países,
 * referrers) ver el dashboard de Vercel Web Analytics.
 */
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/current-user';
import { isAdminEmail } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { MetricTile } from '@/components/ds';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Activity', robots: { index: false, follow: false } };

const DAY = 24 * 60 * 60 * 1000;

function fmtDate(d: unknown): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function ago(d: unknown): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d as string);
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default async function AdminPage() {
  const user = await currentUser();
  const allowed = isAdminEmail(user?.email) || process.env.NODE_ENV === 'development';
  if (!allowed) notFound();

  const db = await getDb();
  const users = db.collection('users');
  const sessions = db.collection('sessions');
  const contracts = db.collection('contracts');
  const alertRules = db.collection('alert_rules');
  const events = db.collection('events');
  const apiKeys = db.collection('api_keys');
  const webhookDeliveries = db.collection('webhook_deliveries');

  const now = Date.now();
  const since7 = new Date(now - 7 * DAY);
  const since30 = new Date(now - 30 * DAY);
  const since14 = new Date(now - 14 * DAY);

  const [
    totalUsers,
    proUsers,
    signups7,
    signups30,
    recentSignups,
    signupsByDayRaw,
    totalContracts,
    totalAlerts,
    totalEvents,
    totalApiKeys,
    logins7,
    recentLoginsRaw,
    whTotal,
    whFailed,
  ] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ plan: 'pro' }),
    users.countDocuments({ createdAt: { $gte: since7 } }),
    users.countDocuments({ createdAt: { $gte: since30 } }),
    users.find({}, { projection: { email: 1, plan: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(15).toArray(),
    users.aggregate([
      { $match: { createdAt: { $gte: since14 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    contracts.estimatedDocumentCount(),
    alertRules.estimatedDocumentCount(),
    events.estimatedDocumentCount(),
    apiKeys.estimatedDocumentCount(),
    sessions.countDocuments({ createdAt: { $gte: since7 } }),
    sessions.aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 15 },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $project: { createdAt: 1, email: { $arrayElemAt: ['$u.email', 0] }, plan: { $arrayElemAt: ['$u.plan', 0] } } },
    ]).toArray(),
    webhookDeliveries.estimatedDocumentCount(),
    webhookDeliveries.countDocuments({ status: 'failed' }),
  ]);

  const freeUsers = totalUsers - proUsers;
  const conversion = totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(1) : '0.0';
  const whFailRate = whTotal > 0 ? ((whFailed / whTotal) * 100).toFixed(1) : '0.0';

  // Sparkline de signups (últimos 14 días, rellenando huecos con 0)
  const byDay = new Map<string, number>();
  for (const r of signupsByDayRaw as Array<{ _id: string; count: number }>) byDay.set(r._id, r.count);
  const spark: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * DAY).toISOString().slice(0, 10);
    spark.push({ day: d, count: byDay.get(d) ?? 0 });
  }
  const sparkMax = Math.max(1, ...spark.map((s) => s.count));

  return (
    <div className="px-6 py-8 max-w-[1100px] mx-auto">
      <header className="mb-8">
        <div className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest mb-1">admin · internal</div>
        <h1 className="text-2xl font-bold text-ds-text font-ds-mono">Site activity</h1>
        <p className="text-ds-text-3 text-sm mt-1">
          Actividad real (MongoDB). Tráfico anónimo —visitantes, países, referrers— en{' '}
          <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="text-ds-green no-underline hover:underline">Vercel Web Analytics</a>.
        </p>
      </header>

      {/* ── Métricas clave ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricTile label="Total users" value={totalUsers} status="ok" />
        <MetricTile label="Pro / Free" value={`${proUsers} / ${freeUsers}`} status={proUsers > 0 ? 'ok' : 'neutral'} />
        <MetricTile label="Conversion" value={`${conversion}%`} status="neutral" />
        <MetricTile label="Signups · 7d" value={signups7} delta={`30d: ${signups30}`} trend={signups7 > 0 ? 'up' : 'neutral'} status={signups7 > 0 ? 'ok' : 'neutral'} />
        <MetricTile label="Logins · 7d" value={logins7} status={logins7 > 0 ? 'ok' : 'neutral'} />
        <MetricTile label="Contracts watched" value={totalContracts} status="neutral" />
        <MetricTile label="Alert rules" value={totalAlerts} status="neutral" />
        <MetricTile label="Events indexed" value={totalEvents.toLocaleString()} status="neutral" />
      </section>

      {/* ── Signups sparkline (14d) ── */}
      <section className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 mb-4">
        <div className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest mb-3">Signups · last 14 days</div>
        <div className="flex items-end gap-1 h-24">
          {spark.map((s) => (
            <div key={s.day} className="flex-1 flex flex-col items-center justify-end gap-1 group" title={`${s.day}: ${s.count}`}>
              <div
                className="w-full rounded-sm bg-ds-green/70 group-hover:bg-ds-green transition-colors min-h-[2px]"
                style={{ height: `${(s.count / sparkMax) * 100}%` }}
              />
              <span className="font-ds-mono text-[8px] text-ds-text-3">{s.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* ── Signups recientes ── */}
        <section className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5">
          <div className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest mb-3">Recent signups</div>
          {recentSignups.length === 0 ? (
            <p className="text-ds-text-3 text-sm font-ds-mono">— no users yet —</p>
          ) : (
            <table className="w-full text-xs font-ds-mono">
              <tbody>
                {recentSignups.map((u: any) => (
                  <tr key={String(u._id)} className="border-0 border-b border-solid border-ds-border/40">
                    <td className="py-1.5 text-ds-text-2 truncate max-w-[200px]">{u.email}</td>
                    <td className="py-1.5 text-right">
                      <span className={u.plan === 'pro' ? 'text-ds-green' : 'text-ds-text-3'}>{u.plan ?? 'free'}</span>
                    </td>
                    <td className="py-1.5 text-right text-ds-text-3 whitespace-nowrap pl-3">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── Logins recientes ── */}
        <section className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5">
          <div className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest mb-3">Recent logins</div>
          {recentLoginsRaw.length === 0 ? (
            <p className="text-ds-text-3 text-sm font-ds-mono">— no logins yet —</p>
          ) : (
            <table className="w-full text-xs font-ds-mono">
              <tbody>
                {recentLoginsRaw.map((s: any, i: number) => (
                  <tr key={i} className="border-0 border-b border-solid border-ds-border/40">
                    <td className="py-1.5 text-ds-text-2 truncate max-w-[200px]">{s.email ?? '— unknown —'}</td>
                    <td className="py-1.5 text-right text-ds-text-3 whitespace-nowrap pl-3">{fmtDate(s.createdAt)}</td>
                    <td className="py-1.5 text-right text-ds-green/70 whitespace-nowrap pl-2">{ago(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* ── Salud de entregas ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile label="API keys" value={totalApiKeys} status="neutral" />
        <MetricTile label="Webhook deliveries" value={whTotal.toLocaleString()} status="neutral" />
        <MetricTile label="Webhook failed" value={whFailed} status={whFailed > 0 ? 'warn' : 'ok'} />
        <MetricTile label="Fail rate" value={`${whFailRate}%`} status={Number(whFailRate) > 5 ? 'fail' : 'ok'} />
      </section>

      <p className="mt-6 text-ds-text-3 text-[11px] font-ds-mono">
        Datos en vivo · refresca para actualizar · gateado por ADMIN_EMAIL
      </p>
    </div>
  );
}
