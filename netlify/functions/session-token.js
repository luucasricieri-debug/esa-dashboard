'use strict';

const crypto = require('crypto');
const { getDatabase } = require('./_shared/firebase-admin');
const { generateToken, verifyToken, TTL_SECONDS } = require('./_shared/upload-session');
const { isAuthDiagnosticsEnabled, inspectTokenUnsafe, buildDiagnostics } = require('./_shared/auth-diagnostics');

function newRequestId() {
  try { return crypto.randomUUID(); } catch { return `rid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
}

function maskUid(uid) {
  if (!uid) return '(vazio)';
  if (uid.length <= 4) return '*'.repeat(uid.length);
  return `${uid.slice(0, 2)}***${uid.slice(-2)}`;
}

// Diagnóstico seguro: nunca loga token, secret ou senha — só requestId, code e uid mascarado.
function logDiag(requestId, fields) {
  try { console.info('[session-token][diag]', JSON.stringify({ requestId, ...fields })); } catch { /* nunca derruba a request */ }
}

function respond401(code, requestId, message, diagOpts) {
  const body = { ok: false, code, stage: 'session_refresh', message, requestId };
  if (isAuthDiagnosticsEnabled() && diagOpts) {
    body.diagnostics = buildDiagnostics('session_refresh', diagOpts);
  }
  return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  const requestId = newRequestId();

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const secret = process.env.UPLOAD_SESSION_SECRET;
  if (!secret) {
    logDiag(requestId, { fatal: 'missing_secret' });
    return { statusCode: 500, body: JSON.stringify({ error: 'UPLOAD_SESSION_SECRET não configurada' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  // Path A: renovar um sessionToken HMAC existente e ainda válido (rotação proativa)
  if (body.sessionToken && typeof body.sessionToken === 'string') {
    let payload;
    try {
      payload = verifyToken(body.sessionToken, secret);
    } catch (e) {
      // code pode ser token_expired, legacy_session (uid ausente — sessão
      // emitida antes da correção de resolução de identidade) ou
      // invalid_session (assinatura/issuer/audience incorretos).
      const code = e.code || 'invalid_session';
      logDiag(requestId, { path: 'A', code });
      const messages = {
        token_expired: 'Token inválido ou expirado',
        legacy_session: 'Sua sessão precisa ser atualizada.',
        invalid_session: 'Token inválido ou expirado',
      };
      return respond401(code, requestId, messages[code] || 'Token inválido ou expirado', inspectTokenUnsafe(body.sessionToken));
    }
    const token = generateToken(payload.uid, secret);
    logDiag(requestId, { path: 'A', uidMasked: maskUid(payload.uid), code: 'ok' });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token, expiresAt: Date.now() + TTL_SECONDS * 1000, requestId }),
    };
  }

  // Path B: validar uid + login contra Firebase — mecanismo oficial de renovação
  // quando o sessionToken já expirou (Path A não consegue renovar um token morto,
  // já que verifyToken rejeita expiração antes de chegar aqui). uid+login não são
  // segredo — são os mesmos identificadores já persistidos em sessionStorage/
  // localStorage por doLogin()/resumeSession(); a validação real acontece contra
  // o registro em users/{uid} no Firebase, nunca confiando cegamente no body.
  //
  // uid aqui DEVE ser a chave real do Firebase (users/{uid}) — desde a correção
  // de doLogin()/session-init.js, é sempre isso que fica salvo em
  // sessionStorage.esa_session.uid. Sessões capturadas antes dessa correção,
  // que porventura tenham uid ausente/errado, falham aqui com invalid_session
  // e exigem novo login (que já emitirá o uid canônico correto).
  const { uid, login } = body;
  if (!uid || typeof uid !== 'string' || !login || typeof login !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'sessionToken ou (uid + login) são obrigatórios' }) };
  }

  const normalizedLogin = login.trim().toLowerCase();

  let db;
  try {
    db = getDatabase();
  } catch {
    logDiag(requestId, { path: 'B', fatal: 'firebase_init_failed' });
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao acessar banco de dados' }) };
  }

  let user;
  try {
    const snap = await db.ref(`users/${uid}`).once('value');
    user = snap.val();
  } catch {
    logDiag(requestId, { path: 'B', uidMasked: maskUid(uid), fatal: 'user_read_failed' });
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao acessar banco de dados' }) };
  }

  if (!user || typeof user.login !== 'string' || user.login.trim().toLowerCase() !== normalizedLogin) {
    logDiag(requestId, { path: 'B', uidMasked: maskUid(uid), code: 'invalid_session' });
    return respond401('invalid_session', requestId, 'Sessão inválida', { uidPresent: true, loginPresent: true });
  }

  const token = generateToken(uid, secret);
  logDiag(requestId, { path: 'B', uidMasked: maskUid(uid), code: 'ok' });
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken: token, expiresAt: Date.now() + TTL_SECONDS * 1000, requestId }),
  };
};
