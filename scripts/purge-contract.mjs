/**
 * purge-contract.mjs — Borra de Atlas un contrato y sus eventos/llamadas por
 * dirección (útil para limpiar datos basura, p.ej. un placeholder mal pegado).
 *
 * Uso (raíz del repo, con .env = MONGODB_URI):
 *   PURGE=0xTU_NUEVO node --env-file=.env scripts/purge-contract.mjs
 *   PURGE=0x1234... node --env-file=.env scripts/purge-contract.mjs
 *
 * Hace match case-insensitive por contención, así que sirve aunque la dirección
 * se haya guardado en mayúsculas/minúsculas. Reporta cuántos documentos borró
 * (si sale 0, no había nada — sirve también como verificación).
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const target = (process.env.PURGE ?? '').trim();
if (!uri || !target) {
  console.error('❌  Falta MONGODB_URI (en .env) o PURGE=<dirección>');
  process.exit(1);
}

// Escapa el target para usarlo como regex literal.
const rx = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

try {
  await client.connect();
  const db = client.db('kryndel');
  const ev = await db.collection('events').deleteMany({ contract: { $regex: rx, $options: 'i' } });
  const ca = await db.collection('calls').deleteMany({ contract: { $regex: rx, $options: 'i' } });
  const co = await db.collection('contracts').deleteMany({ address: { $regex: rx, $options: 'i' } });
  console.log(`🧹  Purga de "${target}": ${co.deletedCount} contrato(s), ${ev.deletedCount} evento(s), ${ca.deletedCount} llamada(s).`);
} finally {
  await client.close();
}
