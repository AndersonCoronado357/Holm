import 'dotenv/config';
import { connect, getDb, closeDb } from './db.js';

async function main() {
  console.log('Conectando a MongoDB...');
  await connect();
  const db = getDb();

  // Prueba real de lectura/escritura sobre la base de la app.
  const probe = db.collection('_probe');
  const res = await probe.insertOne({ at: new Date(), ok: true });
  const count = await probe.countDocuments();
  await probe.deleteOne({ _id: res.insertedId });
  console.log('OK  lectura/escritura en base', db.databaseName, '(docs probados:', count, ')');

  const colls = await db.listCollections().toArray();
  console.log(
    'Colecciones existentes:',
    colls.map((c) => c.name).join(', ') || '(ninguna todavía)',
  );
  await closeDb();
  console.log('Listo.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FALLO la conexion a MongoDB:');
  console.error(err.message);
  process.exit(1);
});
