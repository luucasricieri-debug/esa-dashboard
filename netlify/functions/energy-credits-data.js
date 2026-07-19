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
 *   - uid extraído exclusivamente do token (nunca do body)
 *   - Path restrito a collections conhecidas de energyCredits
 *   - Dados sanitizados: campos sensíveis removidos
 *   - Sem credenciais ou PII em logs
 */

const { getDatabase }  = require('./_shared/firebase-admin');
const { verifyToken }  = require('./_shared/upload-session');

// ── Collections conhecidas (espelho de energy-credits-paths.js) ───────────────

const EC_COLLECTIONS = [
  'generatingUnits',
  'beneficiaryUnits',
  'generatingUnitMonthlyRecords',
  'beneficiaryMonthlyRecords',
  'creditAllocations',
  'ownerSettlements',
  'esaInvoices',
  'monthlyReports',
  'creditDocuments',
  'creditAuditLog',
  'beneficiaryCreditBalanceRecords',
  'utilityBillImports',
];

const ALLOWED_OPERATIONS = new Set(['get', 'set', 'snapshot']);

// ── Campos proibidos em escritas ──────────────────────────────────────────────

const FORBIDDEN_KEYS = new Set([
  'password', 'passHash', 'sessionToken', 'sessionExpiresAt',
  'serviceAccount', 'firebaseConfig', 'apiKey', 'secret',
  'stack', 'stackTrace', 'internalLog',
]);

// ── Sanitização recursiva ─────────────────────────────────────────────────────

function sanitize(v, depth = 0) {
  if (depth > 10) return null;
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (typeof v === 'boolean' || typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(item => sanitize(item, depth + 1));
  if (typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      out[k] = sanitize(val, depth + 1);
    }
    return out;
  }
  return null;
}

// ── Validação de path ─────────────────────────────────────────────────────────

const INVALID_PATH_PATTERNS = ['..', '#', '$', '[', ']'];

function validatePath(path) {
  if (!path || typeof path !== 'string') return 'path ausente';
  if (!path.startsWith('energyCredits/') && path !== 'energyCredits') return 'path deve começar com energyCredits/';
  for (const p of INVALID_PATH_PATTERNS) {
    if (path.includes(p)) return `path contém caractere inválido: ${p}`;
  }
  const parts = path.split('/');
  if (parts.length < 2) return 'path deve incluir a collection';
  const collection = parts[1];
  if (!collection) return 'collection ausente';
  if (!EC_COLLECTIONS.includes(collection)) return `collection inválida: ${collection}`;
  if (parts.length > 3) return 'path muito profundo (máx: collection/id)';
  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const secret = process.env.UPLOAD_SESSION_SECRET;
  if (!secret) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuração ausente no servidor' }) };
  }

  // ── Parse body ─────────────────────────────────────────────────────────────

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { sessionToken, operation, path, value } = body;

  // ── Validar operação ───────────────────────────────────────────────────────

  if (!ALLOWED_OPERATIONS.has(operation)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Operação inválida: ${operation}` }) };
  }

  // ── Validar e verificar token → uid = organizationId ──────────────────────

  let uid;
  try {
    const payload = verifyToken(sessionToken, secret);
    uid = payload.uid;
    if (!uid) throw new Error('uid ausente no token');
  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido ou expirado' }) };
  }

  // ── Conectar ao RTDB ───────────────────────────────────────────────────────

  let db;
  try {
    db = getDatabase();
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro de configuração do servidor' }) };
  }

  // ── Snapshot: carrega todas as collections em uma única query ──────────────

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
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: result }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha ao carregar snapshot' }) };
    }
  }

  // ── get / set: validar path ────────────────────────────────────────────────

  const pathErr = validatePath(path);
  if (pathErr) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: pathErr }) };
  }

  const scopedPath = `users/${uid}/${path}`;

  // ── GET ────────────────────────────────────────────────────────────────────

  if (operation === 'get') {
    try {
      const snap = await db.ref(scopedPath).once('value');
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: snap.val() }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha na leitura' }) };
    }
  }

  // ── SET ────────────────────────────────────────────────────────────────────

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
    // Force organizationId = uid for every persisted record
    const withOrg = { ...clean, organizationId: uid };
    try {
      await db.ref(scopedPath).set(withOrg);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha na escrita' }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Operação não reconhecida' }) };
};
