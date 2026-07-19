'use strict';

/**
 * ESA OS — Shared Validators
 * energy-credits-validators.js
 *
 * Pure functions para validação do endpoint energy-credits-data.
 * SEM imports de firebase-admin ou quaisquer dependências externas.
 * Exportado aqui para que testes possam importar sem o SDK do Firebase.
 */

// ── Collections permitidas ─────────────────────────────────────────────────────

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

const EC_COLLECTIONS_SET = new Set(EC_COLLECTIONS);

// ── Operações permitidas ───────────────────────────────────────────────────────

const ALLOWED_OPERATIONS = new Set(['get', 'set', 'snapshot']);

// ── Campos proibidos em escritas ──────────────────────────────────────────────

const FORBIDDEN_KEYS = new Set([
  'password', 'passHash', 'sessionToken', 'sessionExpiresAt',
  'serviceAccount', 'firebaseConfig', 'apiKey', 'secret',
  'stack', 'stackTrace', 'internalLog', 'downloadUrl',
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
  if (!path.startsWith('energyCredits/') && path !== 'energyCredits') {
    return 'path deve começar com energyCredits/';
  }
  for (const p of INVALID_PATH_PATTERNS) {
    if (path.includes(p)) return `path contém caractere inválido: ${p}`;
  }
  const parts = path.split('/');
  if (parts.length < 2) return 'path deve incluir a collection';
  const collection = parts[1];
  if (!collection) return 'collection ausente';
  if (!EC_COLLECTIONS_SET.has(collection)) return `collection inválida: ${collection}`;
  if (parts.length > 3) return 'path muito profundo (máx: collection/id)';
  return null;
}

// ── Limite de tamanho de payload ──────────────────────────────────────────────

const MAX_PAYLOAD_BYTES = 1_048_576; // 1 MB

function checkPayloadSize(body) {
  if (!body) return null;
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes > MAX_PAYLOAD_BYTES) return `Payload muito grande (${bytes} bytes; máximo: ${MAX_PAYLOAD_BYTES})`;
  return null;
}

module.exports = {
  EC_COLLECTIONS,
  EC_COLLECTIONS_SET,
  ALLOWED_OPERATIONS,
  FORBIDDEN_KEYS,
  sanitize,
  validatePath,
  checkPayloadSize,
  MAX_PAYLOAD_BYTES,
};
