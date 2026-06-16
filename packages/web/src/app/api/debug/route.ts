import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Gate: only available when KRYNDEL_DEBUG=true (never expose in production).
  if (process.env.KRYNDEL_DEBUG !== 'true') {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  try {
    const db = await getDb();
    const [contracts, events, calls] = await Promise.all([
      db.collection('contracts').countDocuments(),
      db.collection('events').countDocuments(),
      db.collection('calls').countDocuments(),
    ]);
    const uri = process.env.MONGODB_URI ?? 'NOT SET';
    // Only expose cluster host, not credentials
    const host = uri.replace(/mongodb\+srv:\/\/[^@]+@/, 'mongodb+srv://***@');
    return Response.json({ host, contracts, events, calls });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
