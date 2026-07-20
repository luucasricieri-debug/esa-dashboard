'use strict';

const admin = require('firebase-admin');

// Fallback only — DATABASE_URL env var (added in Netlify) takes precedence.
// Prior to this fix this URL was hardcoded and the env var was silently ignored,
// so adding DATABASE_URL in Netlify had no effect on which RTDB instance Functions read from.
const DEFAULT_DATABASE_URL = 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';
const STORAGE_BUCKET = 'agenda-executiva-esa.firebasestorage.app';

let _app = null;

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function getDatabaseHost() {
  try { return new URL(resolveDatabaseUrl()).host; } catch { return null; }
}

function getProjectId() {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) return null;
  try { return JSON.parse(saJson).project_id || null; } catch { return null; }
}

function getFirebaseAdminApp() {
  const databaseURL = resolveDatabaseUrl();

  if (_app) {
    const cachedUrl = _app.options && _app.options.databaseURL;
    if (cachedUrl === databaseURL) return _app;
    // DATABASE_URL changed since this container's app was created — do not
    // keep serving reads against the stale instance.
    _app = null;
  }

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) throw new Error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON não configurada');

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(saJson);
  } catch (e) {
    throw new Error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON inválida (JSON malformado)');
  }

  const existingDefault = admin.apps.find((a) => a && a.name === '[DEFAULT]');
  if (existingDefault) {
    const existingUrl = existingDefault.options && existingDefault.options.databaseURL;
    if (existingUrl === databaseURL) {
      _app = existingDefault;
      return _app;
    }
    // A default app already exists in this process with a different databaseURL
    // (e.g. initialized before DATABASE_URL was set). The Admin SDK does not
    // support re-pointing an existing app, so silently reusing it would read
    // from the wrong RTDB instance without any signal. Fail loudly instead.
    throw new Error(
      '[firebase-admin] Firebase Admin App já inicializado com databaseURL incompatível ' +
      `(esperado host=${getDatabaseHost() || '?'}, app existente usa outra configuração). ` +
      'Reinicialização em processo compartilhado não é suportada.',
    );
  }

  _app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL,
    storageBucket: STORAGE_BUCKET,
  });
  return _app;
}

function getDatabase() {
  const app = getFirebaseAdminApp();
  return admin.database(app);
}

function getBucket() {
  const app = getFirebaseAdminApp();
  return admin.storage(app).bucket();
}

module.exports = {
  getDatabase,
  getBucket,
  getFirebaseAdminApp,
  getDatabaseHost,
  getProjectId,
  resolveDatabaseUrl,
  DATABASE_URL: DEFAULT_DATABASE_URL,
  STORAGE_BUCKET,
};
