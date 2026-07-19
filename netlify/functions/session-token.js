'use strict';

const { getDatabase } = require('./_shared/firebase-admin');
const { generateToken, verifyToken, TTL_SECONDS } = require('./_shared/upload-session');

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
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  // Path A: renovar um sessionToken HMAC existente e válido
  if (body.sessionToken && typeof body.sessionToken === 'string') {
    let payload;
    try {
      payload = verifyToken(body.sessionToken, secret);
    } catch {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token inválido ou expirado' }) };
    }
    const token = generateToken(payload.uid, secret);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token, expiresAt: Date.now() + TTL_SECONDS * 1000 }),
    };
  }

  // Path B: validar uid + login contra Firebase (mecanismo oficial de resumeSession)
  const { uid, login } = body;
  if (!uid || typeof uid !== 'string' || !login || typeof login !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'sessionToken ou (uid + login) são obrigatórios' }) };
  }

  const normalizedLogin = login.trim().toLowerCase();

  let db;
  try {
    db = getDatabase();
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro de configuração do servidor' }) };
  }

  let user;
  try {
    const snap = await db.ref(`users/${uid}`).once('value');
    user = snap.val();
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao acessar banco de dados' }) };
  }

  if (!user || typeof user.login !== 'string') {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sessão inválida' }) };
  }

  if (user.login.trim().toLowerCase() !== normalizedLogin) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sessão inválida' }) };
  }

  const token = generateToken(uid, secret);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken: token, expiresAt: Date.now() + TTL_SECONDS * 1000 }),
  };
};
