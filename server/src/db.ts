import { MongoClient, Db } from 'mongodb';

// Autenticacion por opciones (no por URI) para que los caracteres especiales de
// la contraseña ('@', '$', etc.) no rompan el parseo del connection string.
const host = process.env.MONGO_HOST ?? '127.0.0.1';
const port = process.env.MONGO_PORT ?? '27017';
const dbName = process.env.MONGO_DB ?? 'holm';
const user = process.env.MONGO_USER;
const password = process.env.MONGO_PASSWORD;
const authSource = process.env.MONGO_AUTH_SOURCE ?? 'admin';

const uri = `mongodb://${host}:${port}`;

const client = new MongoClient(uri, {
  ...(user && password
    ? { auth: { username: user, password }, authSource }
    : {}),
  serverSelectionTimeoutMS: 5000,
});

let db: Db | null = null;

export async function connect(): Promise<Db> {
  if (db) return db;
  await client.connect();
  db = client.db(dbName);
  await ensureIndexes(db);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('La base de datos no esta conectada todavía');
  return db;
}

async function ensureIndexes(database: Db): Promise<void> {
  await database.collection('users').createIndex({ email: 1 }, { unique: true });
  await database.collection('pages').createIndex({ userId: 1, view: 1, order: 1 });
  await database.collection('elements').createIndex({ userId: 1, pageId: 1 });
  await database.collection('habits').createIndex({ userId: 1, order: 1 });
  await database
    .collection('habitLogs')
    .createIndex({ habitId: 1, date: 1 }, { unique: true });
  await database.collection('habitLogs').createIndex({ userId: 1, date: 1 });
}

export async function closeDb(): Promise<void> {
  await client.close();
  db = null;
}
