// Prueba de integración del programador de avisos de Holm.
//
// Corre EN PROCESO (importa el propio push.ts) e intercepta `https.request`,
// que es por donde web-push manda el aviso. Así se comprueba el envío real
// —cifrado, cabeceras VAPID, prioridad— sin depender de un servicio push
// externo ni de certificados.
//
//   npm run prueba:push  -w server
import https from 'node:https';
import crypto from 'node:crypto';
import 'dotenv/config';
import { ObjectId } from 'mongodb';

// --- Captura de lo que sale ---------------------------------------------
const capturado = [];
let respuesta = { status: 201 };
const originalRequest = https.request;
https.request = function (opciones, cb) {
  const trozos = [];
  const falso = {
    on: () => falso,
    write: (d) => trozos.push(Buffer.from(d)),
    end: () => {
      capturado.push({
        host: opciones.hostname ?? opciones.host,
        ruta: opciones.path,
        metodo: opciones.method,
        ttl: opciones.headers?.TTL,
        urgency: opciones.headers?.Urgency,
        autorizacion: String(opciones.headers?.Authorization ?? '').slice(0, 5),
        encoding: opciones.headers?.['Content-Encoding'],
        bytes: Buffer.concat(trozos).length,
      });
      // web-push espera un stream de respuesta.
      const res = { statusCode: respuesta.status, headers: {}, on: (ev, fn) => { if (ev === 'end') fn(); return res; } };
      setImmediate(() => cb(res));
    },
    setTimeout: () => falso,
    destroy: () => {},
  };
  return falso;
};

const { connect, getDb, closeDb } = await import('./db.ts');
const { runScheduler } = await import('./push.ts');

await connect();
const db = getDb();

// --- Datos de prueba -----------------------------------------------------
const ec = crypto.createECDH('prime256v1');
ec.generateKeys();
const p256dh = ec.getPublicKey().toString('base64url');
const auth = crypto.randomBytes(16).toString('base64url');
const userId = new ObjectId().toString();
const endpoint = 'https://fcm.googleapis.com/fcm/send/prueba-holm';

const offset = Number(process.env.HOLM_TZ_OFFSET_MINUTES ?? -300);
const local = new Date(Date.now() + offset * 60_000);
const hoy = local.toISOString().slice(0, 10);
const ahoraMin = local.getUTCHours() * 60 + local.getUTCMinutes();
const hhmm = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const limpiar = async () => {
  await db.collection('pushSubscriptions').deleteMany({ userId });
  await db.collection('events').deleteMany({ userId });
  await db.collection('settings').deleteMany({ userId });
};

const sembrar = async (eventos, prefs = { enabled: true, leadMinutes: 10 }, conDispositivo = true) => {
  await limpiar();
  capturado.length = 0;
  if (conDispositivo) await db.collection('pushSubscriptions').insertOne({ userId, endpoint, p256dh, auth });
  await db.collection('settings').insertOne({ userId, notifications: prefs });
  if (eventos.length) {
    await db.collection('events').insertMany(
      eventos.map((e) => ({ userId, title: e.t, eventDate: e.d ?? hoy, startTime: e.h, endTime: null, color: '#21C2D9', createdAt: new Date() })),
    );
  }
};

const marcado = async (titulo) => !!(await db.collection('events').findOne({ userId, title: titulo }))?.pushedAt;

const res = [];
const comprobar = (n, ok, d) => res.push(`${ok ? 'OK   ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`);

// --- Casos ---------------------------------------------------------------
await sembrar([{ t: 'Debido', h: hhmm(ahoraMin - 5) }]);
let r = await runScheduler();
comprobar('un evento cuya hora de aviso ya pasó se envía', r.events === 1 && capturado.length === 1, JSON.stringify(r));
comprobar('sale cifrado, con VAPID y prioridad alta',
  capturado[0]?.encoding === 'aes128gcm' && capturado[0]?.urgency === 'high' &&
  Number(capturado[0]?.ttl) === 43200 && capturado[0]?.autorizacion === 'vapid' && capturado[0]?.bytes > 0,
  JSON.stringify(capturado[0]));
comprobar('el evento queda marcado como avisado', await marcado('Debido'));

capturado.length = 0;
r = await runScheduler();
comprobar('el siguiente ciclo no lo repite', r.events === 0 && capturado.length === 0);

await sembrar([{ t: 'Futuro', h: hhmm(ahoraMin + 90) }]);
r = await runScheduler();
comprobar('un evento futuro todavía no se envía', r.events === 0 && capturado.length === 0);

await sembrar([{ t: 'Antelacion', h: hhmm(ahoraMin + 30) }], { enabled: true, leadMinutes: 60 });
r = await runScheduler();
comprobar('con 60 min de antelación, uno a 30 min ya toca', r.events === 1 && capturado.length === 1, JSON.stringify(r));

await sembrar([{ t: 'Apagado', h: hhmm(ahoraMin - 5) }], { enabled: false, leadMinutes: 10 });
r = await runScheduler();
comprobar('con los avisos apagados no se manda', r.events === 0 && capturado.length === 0);
comprobar('aun apagado se marca, para no reevaluarlo cada minuto', await marcado('Apagado'));

await sembrar([{ t: 'Viejo', h: hhmm(ahoraMin - 260) }]);
r = await runScheduler();
comprobar('un aviso de hace 4 h no se dispara al arrancar', r.events === 0 && capturado.length === 0);
comprobar('el viejo se marca, para no reevaluarlo', await marcado('Viejo'));

await sembrar([{ t: 'OtroDia', h: hhmm(ahoraMin - 5), d: '2030-01-01' }]);
r = await runScheduler();
comprobar('los eventos de otro día se ignoran', r.events === 0 && capturado.length === 0);

await sembrar([{ t: 'TodoElDia', h: null }]);
r = await runScheduler();
comprobar('un evento de todo el día no genera aviso', r.events === 0 && capturado.length === 0);

respuesta = { status: 500 };
await sembrar([{ t: 'Fallo', h: hhmm(ahoraMin - 5) }]);
r = await runScheduler();
comprobar('si el envío falla NO se marca (se reintentará)', capturado.length === 1 && !(await marcado('Fallo')));

respuesta = { status: 410 };
await sembrar([{ t: 'Muerta', h: hhmm(ahoraMin - 5) }]);
await runScheduler();
const quedan = await db.collection('pushSubscriptions').countDocuments({ userId });
comprobar('una suscripción caducada (410) se borra sola', quedan === 0, `quedan ${quedan}`);
respuesta = { status: 201 };

await sembrar([{ t: 'SinDispositivo', h: hhmm(ahoraMin - 5) }], { enabled: true, leadMinutes: 10 }, false);
r = await runScheduler();
comprobar('sin dispositivos suscritos no se manda nada', r.events === 0 && capturado.length === 0);

// Dos dispositivos de la misma cuenta reciben los dos.
await sembrar([{ t: 'DosEquipos', h: hhmm(ahoraMin - 5) }]);
await db.collection('pushSubscriptions').insertOne({ userId, endpoint: endpoint + '-2', p256dh, auth });
capturado.length = 0;
r = await runScheduler();
comprobar('un evento avisa a los dos dispositivos de la cuenta', capturado.length === 2, `${capturado.length} envíos`);

await limpiar();
await closeDb();
https.request = originalRequest;
console.log(res.join('\n'));
const ok = res.filter((x) => x.startsWith('OK')).length;
console.log(`\n${ok}/${res.length} correctos`);
process.exit(ok === res.length ? 0 : 1);
