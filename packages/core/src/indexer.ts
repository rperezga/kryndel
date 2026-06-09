import { MongoClient, type Db, type Collection } from 'mongodb';
import type { ContractRef, DecodedCall, ContractEvent } from './types.js';

// Indexer — persiste contratos, llamadas y eventos en MongoDB.
// Colecciones: `contracts`, `calls`, `events`.
// URI desde la variable de entorno MONGODB_URI (p.ej. mongodb://localhost:27017).

export interface Indexer {
  upsertContract(c: ContractRef): Promise<void>;
  saveCall(contract: string, call: DecodedCall, txHash?: string): Promise<void>;
  saveEvent(contract: string, event: ContractEvent): Promise<void>;
  close(): Promise<void>;
}

export function createMongoIndexer(uri: string, dbName = 'kryndel'): Indexer {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8_000 });
  let db: Db | undefined;

  async function getDb(): Promise<Db> {
    if (!db) {
      await client.connect();
      db = client.db(dbName);
      // Índices únicos para evitar duplicados en re-indexaciones.
      const events: Collection = db.collection('events');
      const calls:  Collection = db.collection('calls');
      await events.createIndex({ contract: 1, txHash: 1, name: 1 }, { unique: true, sparse: true, background: true });
      await calls.createIndex(  { contract: 1, txHash: 1 },          { unique: true, sparse: true, background: true });
      await db.collection('contracts').createIndex({ address: 1, surface: 1 }, { unique: true, background: true });
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
      const doc = { contract, ...call, txHash, indexedAt: new Date() };
      if (txHash) {
        // Idempotente: si ya está indexado lo ignora.
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
      // Extraemos `raw` para no guardarlo en Mongo (puede ser muy grande).
      const { raw: _raw, ...rest } = event;
      const doc = { contract, ...rest, indexedAt: new Date() };
      if (event.txHash) {
        await d.collection('events').updateOne(
          { contract, txHash: event.txHash, name: event.name },
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
