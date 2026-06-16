/**
 * Worker MongoDB client — single long-running process, no Next.js globals.
 * Pool is small: worker only needs a handful of concurrent operations.
 */
import { MongoClient, type Db, type Collection } from 'mongodb';

let _client: MongoClient | null = null;

function getClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('[worker] MONGODB_URI not set');
  if (!_client) {
    _client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 5,
      minPoolSize: 1,
    });
  }
  return _client;
}

export async function getDb(dbName = 'kryndel'): Promise<Db> {
  const client = getClient();
  await client.connect();
  return client.db(dbName);
}

export async function collection<T extends object>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
  }
}
