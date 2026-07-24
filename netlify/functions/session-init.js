'use strict';

const crypto = require('crypto');
const { getDatabase } = require('./_shared/firebase-admin');
const { generateToken, TTL_SECONDS } = require('./_shared/upload-session');
const { resolveUserByLogin } = require('./_shared/user-identity');

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

  // Causa raiz do incidente "HTTP 401 para alguns usuários": localizar o
  // usuário e então usar o CAMPO `userEntry.uid` (que pode estar ausente em
  // registros legados) como uid da sessão. resolveUserByLogin() retorna
  // sempre a CHAVE do Firebase — a única fonte de verdade de uid em todo o
  // projeto (é ela que users/{uid} usa em todos os outros endpoints).
  let resolved;
  try {
    resolved = await resolveUserByLogin(db, normalizedLogin);
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao acessar banco de dados' }) };
  }

  const userKey = resolved ? resolved.uid : null;
  const userEntry = resolved ? resolved.user : null;

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

  // uid canônico = chave do Firebase (userKey), NUNCA userEntry.uid — esse
  // campo pode estar ausente ou desatualizado em registros legados.
  const token = generateToken(userKey, secret);
  const expiresAt = Date.now() + TTL_SECONDS * 1000;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken: token, expiresAt }),
  };
};
