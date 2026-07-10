'use strict';

const admin = require('firebase-admin');

const DATABASE_URL = 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';
const STORAGE_BUCKET = 'agenda-executiva-esa.firebasestorage.app';

let _initialized = false;

function ensureInit() {
  if (_initialized) return;

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) throw new Error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON não configurada');

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(saJson);
  } catch (e) {
    throw new Error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON inválida (JSON malformado)');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: DATABASE_URL,
      storageBucket: STORAGE_BUCKET,
    });
  }

  _initialized = true;
}

function getDatabase() {
  ensureInit();
  return admin.database();
}

function getBucket() {
  ensureInit();
  return admin.storage().bucket();
}

module.exports = { getDatabase, getBucket, DATABASE_URL, STORAGE_BUCKET };
