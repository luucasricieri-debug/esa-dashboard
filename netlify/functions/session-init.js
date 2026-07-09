'use strict';

const crypto = require('crypto');
const { getDatabase } = require('./_shared/firebase-admin');
const { generateToken, TTL_SECONDS } = require('./_shared/upload-session');

const GENERIC_401 = JSON.stringify({ error: 'Login ou senha inválidos' });

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const secret = process.env.UPLOAD_SESSION_SECRET;
  if (!secret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'UPLOAD_SESSION_SECRET não configurada' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { login, password } = body;
  if (!login || typeof login !== 'string' || !password || typeof password !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'login e password são obrigatórios' }) };
  }

  // Normalizar login exatamente como doLogin() faz no cliente
  const normalizedLogin = login.trim().toLowerCase();

  let db;
  try {
    db = getDatabase();
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro de configuração do servidor' }) };
  }

  let users;
  try {
    const snapshot = await db.ref('users').once('value');
    users = snapshot.val() || {};
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao acessar banco de dados' }) };
  }

  // Localizar usuário por login — mesmo critério do doLogin() legado
  const userEntry = Object.values(users).find(u => u && u.login === normalizedLogin);

  // SHA-256 hex do password, UTF-8 — mesmo algo de hashPass() no browser
  const receivedHash = sha256Hex(password);

  if (!userEntry || !userEntry.passHash || typeof userEntry.passHash !== 'string') {
    return { statusCode: 401, body: GENERIC_401 };
  }

  // Comparação timing-safe: ambos são hex SHA-256 → 64 chars
  const receivedBuf = Buffer.from(receivedHash, 'utf8');
  const storedBuf = Buffer.from(userEntry.passHash, 'utf8');
  let validPassword = false;
  if (receivedBuf.length === storedBuf.length) {
    validPassword = crypto.timingSafeEqual(receivedBuf, storedBuf);
  }

  if (!validPassword) {
    return { statusCode: 401, body: GENERIC_401 };
  }

  const token = generateToken(userEntry.uid, secret);
  const expiresAt = Date.now() + TTL_SECONDS * 1000;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken: token, expiresAt }),
  };
};
