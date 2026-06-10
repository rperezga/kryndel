// Cliente MongoDB para Next.js — singleton cacheado en dev, nueva instancia en prod.
// Las variables de entorno sin prefijo NEXT_PUBLIC_ son server-only.
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI no está definida — añádela al .env local o a las variables de entorno.');
}

const uri = process.env.MONGODB_URI;
const opts = { serverSelectionTimeoutMS: 8_000 };

declare global {
  // pnpm hot-reload reutiliza el módulo; evitamos abrir N conexiones en dev.
  // eslint-disable-next-line no-var
  var _kryndelMongoPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!global._kryndelMongoPromise) {
    global._kryndelMongoPromise = new MongoClient(uri, opts).connect();
  }
  clientPromise = global._kryndelMongoPromise;
} else {
  clientPromise = new MongoClient(uri, opts).connect();
}

export async function getDb(dbName = 'kryndel') {
  const client = await clientPromise;
  return client.db(dbName);
}
