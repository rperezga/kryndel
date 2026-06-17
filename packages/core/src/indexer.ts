import { MongoClient, type Db, type Collection } from 'mongodb';
import type { ContractRef, DecodedCall, ContractEvent } from './types.js';

// Indexer — persiste contratos, llamadas y eventos en MongoDB.
// Colecciones: `contracts`, `calls`, `events`.

export interface Indexer {
  upsertContract(c: ContractRef): Promise<void>;
  saveCall(contract: string, call: DecodedCall, txHash?: string): Promise<void>;
  saveEvent(contract: string, event: ContractEvent): Promise<void>;
  close(): Promise<void>;
}

// A2.3: sanitiza claves de objetos recursivamente para evitar operadores MongoDB.
// $ → ＄ (fullwidth dollar), . → _ (underscore)
export function sanitizeKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeKeys);
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k.replace(/\$/g, '＄').replace(/\./g, '_'),
      sanitizeKeys(v),
    ])
  );
}

export function createMongoIndexer(uri: string, dbName = 'kryndel'): Indexer {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8_000 });
  let db: Db | undefined;

  async function getDb(): Promise<Db> {
    if (!db) {
      await client.connect();
      db = client.db(dbName);
      const events: Collection = db.collection('events');
      const calls:  Collection = db.collection('calls');
      // A2.1: índice único incluye logIndex para capturar 2 Transfer en la misma tx.
      await events.createIndex(
        { contract: 1, txHash: 1, name: 1, logIndex: 1 },
        { unique: true, sparse: true, background: true },
      );
      await calls.createIndex(
        { contract: 1, txHash: 1 },
        { unique: true, sparse: true, background: true },
      );
      // [hist] PRE-PA-core el CLI creaba aquí un índice UNIQUE GLOBAL
      // sobre (address, surface). Era válido para uso single-user del CLI
      // pero rompe el modelo multi-usuario de Kryndel Cloud — bloquea que dos
      // cuentas registren el mismo contrato (E11000 duplicate key).
      // Se elimina su creación. La unicidad ahora vive en la collection web,
      // donde es compuesta (userId, address, surface). El upsertContract de
      // este indexer (legacy CLI) hace upsert por filtro y no necesita índice
      // único para funcionar.
      // Documentación operacional: Roger debe limpiar los índices sueltos
      // (address_1, surface_1, address_1_surface_1) en Atlas Data Explorer si
      // sobreviven de despliegues antiguos. Ver LOG 2026-06-17 §smoke-e2e.
    }
    return db;
  }

  return {
    async upsertContract(c: ContractRef): Promise<void> {
      const d = await getDb();
      await d.collection('contracts').updateOne(
        { address: c.address, surface: c.surface },
        { $set: { ...c, updatedAt: new Date() }, $setOnInsert: { firstSeenAt: new Date() } },
        { upsert: true },
      );
    },

    async saveCall(contract: string, call: DecodedCall, txHash?: string): Promise<void> {
      const d = await getDb();
      // A2.3: sanitizar args antes de guardar.
      const safeArgs = sanitizeKeys(call.args) as Record<string, unknown>;
      const doc = { contract, ...call, args: safeArgs, txHash, indexedAt: new Date() };
      if (txHash) {
        await d.collection('calls').updateOne(
          { contract, txHash },
          { $setOnInsert: doc },
          { upsert: true },
        );
      } else {
        await d.collection('calls').insertOne(doc);
      }
    },

    async saveEvent(contract: string, event: ContractEvent): Promise<void> {
      const d = await getDb();
      const { raw: _raw, ...rest } = event;
      // A2.3: sanitizar args antes de guardar.
      const safeArgs = sanitizeKeys(rest.args) as Record<string, unknown>;
      const doc = { contract, ...rest, args: safeArgs, indexedAt: new Date() };
      if (event.txHash) {
        // A2.1: filtro del upsert incluye logIndex.
        await d.collection('events').updateOne(
          { contract, txHash: event.txHash, name: event.name, logIndex: event.logIndex ?? null },
          { $setOnInsert: doc },
          { upsert: true },
        );
      } else {
        await d.collection('events').insertOne(doc);
      }
    },

    async close(): Promise<void> {
      await client.close();
    },
  };
}
