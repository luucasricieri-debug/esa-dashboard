'use strict';

const crypto = require('crypto');
const { getDatabase, getBucket, STORAGE_BUCKET, getDatabaseHost } = require('./_shared/firebase-admin');
const { resolveAuthenticatedUserIdentity } = require('./_shared/user-identity');
const { isAuthDiagnosticsEnabled, inspectTokenUnsafe, buildDiagnostics } = require('./_shared/auth-diagnostics');

const CRM_LEVELS = ['diretor', 'trafego', 'gestor', 'engenharia', 'executivo', 'sdr', 'jackeline'];
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isValidDealId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0;
}

function isValidClientRequestId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}

// ── Diagnóstico seguro (sem token, sem secret, sem conteúdo de arquivo) ──────

function newRequestId() {
  try { return crypto.randomUUID(); } catch { return `rid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
}

function maskUid(uid) {
  if (!uid) return '(vazio)';
  if (uid.length <= 4) return '*'.repeat(uid.length);
  return `${uid.slice(0, 2)}***${uid.slice(-2)}`;
}

function logDiag(requestId, fields) {
  try { console.info('[crm-upload][diag]', JSON.stringify({ requestId, ...fields })); } catch { /* nunca derruba a request */ }
}

// respond(): monta a resposta 401/403/etc SEMPRE em JSON, com code/stage/
// message/requestId. Inclui `diagnostics` só quando CRM_UPLOAD_AUTH_DIAGNOSTICS
// estiver ativa — nunca token, secret, ou payload do arquivo.
function respond(statusCode, code, stage, message, requestId, extra, diagOpts) {
  const body = { ok: false, code, stage, message, requestId, ...extra };
  if (isAuthDiagnosticsEnabled() && diagOpts) {
    body.diagnostics = buildDiagnostics(stage, diagOpts);
  }
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  const requestId = newRequestId();

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, code: 'method_not_allowed', message: 'Método não permitido', requestId }) };
  }

  const secret = process.env.UPLOAD_SESSION_SECRET;
  if (!secret) {
    logDiag(requestId, { fatal: 'missing_secret' });
    return respond(500, 'upload_failed', 'upload_initial_auth', 'Erro de configuração do servidor.', requestId);
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return respond(400, 'invalid_body', 'payload_validation', 'Body inválido.', requestId);
  }

  const { sessionToken, dealId, fileName, contentType, fileBase64, clientRequestId } = body;

  let db;
  try {
    db = getDatabase();
  } catch (e) {
    logDiag(requestId, { fatal: 'firebase_init_failed' });
    return respond(500, 'upload_failed', 'upload_initial_auth', 'Erro de configuração do servidor.', requestId);
  }

  // Resolução canônica de identidade: uid SEMPRE vem do payload do token
  // verificado (nunca do body). Ver netlify/functions/_shared/user-identity.js
  // para a causa raiz do incidente "HTTP 401 para alguns usuários" (uid
  // resolvido antes por um campo de perfil que podia estar ausente/errado).
  let identity;
  try {
    identity = await resolveAuthenticatedUserIdentity(db, sessionToken, secret);
  } catch (e) {
    const code = e.code || 'invalid_session';
    const stage = e.stage || 'upload_initial_auth';
    logDiag(requestId, { code, stage });
    const messages = {
      token_expired: 'Sessão expirada.',
      legacy_session: 'Sua sessão precisa ser atualizada.',
      invalid_session: 'Sessão inválida.',
    };
    return respond(401, code, stage, messages[code] || 'Sessão inválida.', requestId, undefined, inspectTokenUnsafe(sessionToken));
  }

  const { uid, user } = identity;

  // Verificar acesso ao CRM pelo level server-side — erro de permissão é
  // SEMPRE 403, nunca 401 (401 é só para problemas de autenticação/sessão).
  const level = (user.level || '').toLowerCase().trim();
  if (!CRM_LEVELS.includes(level)) {
    logDiag(requestId, { uidMasked: maskUid(uid), code: 'no_permission' });
    return respond(403, 'no_permission', 'permission_check', 'Usuário sem permissão.', requestId, undefined, { ...inspectTokenUnsafe(sessionToken), expired: false });
  }

  // Validar dealId — sem path separators
  if (!isValidDealId(dealId)) {
    return respond(400, 'invalid_deal_id', 'payload_validation', 'dealId inválido.', requestId);
  }

  // Validar fileName
  if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
    return respond(400, 'invalid_file_name', 'payload_validation', 'fileName ausente.', requestId);
  }

  // Validar contentType — whitelist estrita de MIME
  if (!contentType || !ALLOWED_MIMES.has(contentType)) {
    logDiag(requestId, { uidMasked: maskUid(uid), code: 'unsupported_file_type' });
    return respond(415, 'unsupported_file_type', 'payload_validation', 'Formato de arquivo não permitido.', requestId);
  }

  // Validar e decodificar base64
  if (!fileBase64 || typeof fileBase64 !== 'string' || fileBase64.length === 0) {
    return respond(400, 'invalid_file_payload', 'payload_validation', 'fileBase64 ausente.', requestId);
  }

  const fileBuffer = Buffer.from(fileBase64, 'base64');
  if (fileBuffer.length === 0) {
    return respond(400, 'invalid_file_payload', 'payload_validation', 'Arquivo vazio ou base64 inválido.', requestId);
  }

  if (fileBuffer.length > MAX_BYTES) {
    logDiag(requestId, { uidMasked: maskUid(uid), code: 'file_too_large' });
    return respond(413, 'file_too_large', 'payload_validation', 'O arquivo excede o limite de 10 MB.', requestId);
  }

  // Idempotência: se o cliente reenviou um clientRequestId já processado
  // (retry pós-renovação de token, resposta atrasada, duplo clique), devolve
  // o resultado já gravado em vez de subir o arquivo de novo — nunca duplica
  // o anexo. Chave de idempotência mal-formada é ignorada (upload segue normal).
  const hasIdempotencyKey = isValidClientRequestId(clientRequestId);
  const idempotencyRef = hasIdempotencyKey ? db.ref(`crm/${dealId}/idempotency/${clientRequestId}`) : null;
  if (idempotencyRef) {
    try {
      const idemSnap = await idempotencyRef.once('value');
      const cached = idemSnap.val();
      if (cached && cached.result) {
        logDiag(requestId, { uidMasked: maskUid(uid), idempotent: true });
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cached.result) };
      }
    } catch { /* leitura de idempotência falhou — segue com upload normal */ }
  }

  const ts = Date.now();
  const safeNome = sanitizeFileName(fileName);
  const path = `crm/${dealId}/${ts}_${safeNome}`;

  let bucket;
  try {
    bucket = getBucket();
  } catch (e) {
    return respond(500, 'upload_failed', 'payload_validation', 'Erro de configuração do Storage.', requestId);
  }

  // Token de download permanente compatível com Firebase Storage getDownloadURL()
  const downloadToken = crypto.randomUUID();

  try {
    const file = bucket.file(path);
    await file.save(fileBuffer, {
      contentType,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });
  } catch (e) {
    logDiag(requestId, { uidMasked: maskUid(uid), code: 'upload_failed', databaseHost: getDatabaseHost() });
    return respond(500, 'upload_failed', 'payload_validation', 'Não foi possível enviar o arquivo. Tente novamente.', requestId);
  }

  // URL permanente no mesmo formato que getDownloadURL() gera
  const encodedPath = encodeURIComponent(path);
  const url =
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}` +
    `?alt=media&token=${downloadToken}`;

  const arqData = {
    nome: fileName,
    url,
    tipo: contentType,
    tamanho: fileBuffer.length,
    uploadedBy: user.name || uid,
    uploadedAt: ts,
    path,
  };

  if (idempotencyRef) {
    idempotencyRef.set({ result: arqData, completedAt: ts }).catch(() => {});
  }

  logDiag(requestId, { uidMasked: maskUid(uid), code: 'ok' });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arqData),
  };
};
