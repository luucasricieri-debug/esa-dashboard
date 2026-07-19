'use strict';

/**
 * ESA OS — Netlify Function
 * energy-credits-data
 *
 * CRUD proxy para Firebase RTDB scoped por organizationId (= uid do token).
 * A UI NUNCA acessa o Firebase diretamente.
 *
 * Operações:
 *   get      — lê um path (collection ou item)
 *   set      — escreve um item
 *   snapshot — carrega todas as collections de energyCredits de uma vez
 *
 * Path RTDB efetivo: users/{uid}/energyCredits/{collection}[/{id}]
 *
 * Segurança:
 *   - Token HMAC validado antes de qualquer acesso ao RTDB
 *   - uid extraído do token verificado (nunca do body)
 *   - Path restrito a collections conhecidas de energyCredits
 *   - Dados sanitizados: campos sensíveis removidos
 *   - Payload limitado a 1 MB
 *   - Content-Type validado
 *   - CORS restrito ao domínio do site
 *   - Sem PII em logs / sem dados financeiros em logs
 *   - requestId gerado por request (rastreabilidade)
 */

// Lazy-load firebase-admin so this module can be required in tests without the SDK
function getDatabase() { return require('./_shared/firebase-admin').getDatabase(); }
const { verifyToken }  = require('./_shared/upload-session');
const {
  EC_COLLECTIONS,  // includes generatingUnits, beneficiaryUnits and 10 others
  ALLOWED_OPERATIONS,
  FORBIDDEN_KEYS,  // used by sanitize() — declared here for audit visibility
  sanitize,
  validatePath,
  checkPayloadSize,
} = require('./_shared/energy-credits-validators');

// ── Handler factory (aceita deps injetadas para testabilidade) ─────────────────

function _createHandler(deps) {
  const _getDatabase = deps.getDatabase;
  const _verifyToken = deps.verifyToken;

  return async function handler(event) {
    const requestId = require('crypto').randomUUID();

    // ── CORS ────────────────────────────────────────────────────────────────
    const allowedOrigin = process.env.URL || process.env.DEPLOY_PRIME_URL || '*';
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'X-Request-Id': requestId,
    };

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
    }

    // ── Content-Type ─────────────────────────────────────────────────────────
    const contentType = (event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '';
    if (!contentType.includes('application/json')) {
      return { statusCode: 415, headers, body: JSON.stringify({ error: 'Content-Type deve ser application/json' }) };
    }

    // ── Payload size ─────────────────────────────────────────────────────────
    const payloadErr = checkPayloadSize(event.body);
    if (payloadErr) {
      return { statusCode: 413, headers, body: JSON.stringify({ error: payloadErr }) };
    }

    // ── Secrets ──────────────────────────────────────────────────────────────
    const secret = process.env.UPLOAD_SESSION_SECRET;
    if (!secret) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuração ausente no servidor' }) };
    }

    // ── Parse body ───────────────────────────────────────────────────────────
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_err) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
    }

    const { sessionToken, operation, path, value } = body;

    // ── Validar operação ──────────────────────────────────────────────────────
    if (!ALLOWED_OPERATIONS.has(operation)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Operação inválida: ${operation}` }) };
    }

    // ── Validar e verificar token → uid = organizationId ─────────────────────
    let uid;
    try {
      const payload = _verifyToken(sessionToken, secret);
      uid = payload.uid;
      if (!uid) throw new Error('uid ausente no token');
    } catch (_err) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido ou expirado' }) };
    }

    // ── Conectar ao RTDB ──────────────────────────────────────────────────────
    let db;
    try {
      db = _getDatabase();
    } catch (_err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro de configuração do servidor' }) };
    }

    // ── Snapshot ──────────────────────────────────────────────────────────────
    if (operation === 'snapshot') {
      try {
        const ref = db.ref(`users/${uid}/energyCredits`);
        const snap = await ref.once('value');
        const raw = snap.val() || {};
        const result = {};
        for (const col of EC_COLLECTIONS) {
          const colRaw = raw[col];
          if (colRaw && typeof colRaw === 'object' && !Array.isArray(colRaw)) {
            result[col] = Object.values(colRaw);
          } else if (Array.isArray(colRaw)) {
            result[col] = colRaw;
          } else {
            result[col] = [];
          }
        }
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: result, requestId }) };
      } catch (_err) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha ao carregar snapshot' }) };
      }
    }

    // ── get / set: validar path ───────────────────────────────────────────────
    const pathErr = validatePath(path);
    if (pathErr) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: pathErr }) };
    }

    const scopedPath = `users/${uid}/${path}`;

    // ── GET ───────────────────────────────────────────────────────────────────
    if (operation === 'get') {
      try {
        const snap = await db.ref(scopedPath).once('value');
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: snap.val(), requestId }) };
      } catch (_err) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha na leitura' }) };
      }
    }

    // ── SET ───────────────────────────────────────────────────────────────────
    if (operation === 'set') {
      if (value === undefined || value === null) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'value é obrigatório para set' }) };
      }
      const clean = sanitize(value);
      if (!clean || typeof clean !== 'object' || Array.isArray(clean)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'value inválido' }) };
      }
      if (!clean.id || typeof clean.id !== 'string') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id é obrigatório no value' }) };
      }
      // Force organizationId = uid for every persisted record; no cross-tenant writes possible.
      const withOrg = { ...clean, organizationId: uid, _requestId: requestId };
      try {
        await db.ref(scopedPath).set(withOrg);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId }) };
      } catch (_err) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha na escrita' }) };
      }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Operação não reconhecida' }) };
  };
}

// ── Default handler (produção) ─────────────────────────────────────────────────

exports.handler = _createHandler({ getDatabase, verifyToken });

// ── Testing exports (sem firebase-admin) ──────────────────────────────────────

exports._createHandler = _createHandler;
