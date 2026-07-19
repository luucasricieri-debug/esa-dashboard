'use strict';

/**
 * ESA OS — Netlify Function
 * energy-credits-data — Gate 8B
 *
 * CRUD proxy para Firebase RTDB.
 * A UI NUNCA acessa o Firebase diretamente.
 *
 * Operações:
 *   get      — lê um path (collection ou item)
 *   set      — escreve um item; org mode usa transaction com versionamento
 *   snapshot — dual-read: organizations/ primeiro, fallback users/{uid}/
 *
 * Modo single-user (sem organizationId no body):
 *   Path RTDB: users/{uid}/energyCredits/{collection}[/{id}]
 *   Comportamento inalterado em relação ao Gate 7.1
 *
 * Modo organização (organizationId presente no body):
 *   Path RTDB: organizations/{orgId}/energyCredits/{collection}[/{id}]
 *   Membership validado no backend a cada request
 *   Permissões calculadas do role no backend — nunca do browser
 *   Snapshot: lê organizations/ primeiro; fallback para users/{uid}/ se vazio
 *   Set: idempotência + transação Firebase para versionamento otimista
 *   Audit log: organizations/{orgId}/auditLog/{id}
 *
 * Segurança:
 *   - Token HMAC validado antes de qualquer acesso ao RTDB
 *   - uid extraído do token verificado (nunca do body)
 *   - organizationId do body validado contra memberships do uid no backend
 *   - role do browser IGNORADO — calculado exclusivamente do membership
 *   - Path restrito a collections conhecidas de energyCredits
 *   - Dados sanitizados: campos sensíveis removidos
 *   - Payload limitado a 1 MB
 *   - Content-Type validado
 *   - CORS restrito ao domínio do site
 *   - Sem PII em logs
 *   - requestId gerado por request (rastreabilidade)
 */

function getDatabase() { return require('./_shared/firebase-admin').getDatabase(); }
const { verifyToken }  = require('./_shared/upload-session');
const {
  EC_COLLECTIONS,  // inclui generatingUnits, beneficiaryUnits e mais 10 collections
  ALLOWED_OPERATIONS,
  FORBIDDEN_KEYS,
  sanitize,
  validatePath,
  checkPayloadSize,
} = require('./_shared/energy-credits-validators');
const { ROLE_PERMISSIONS, hasPermission } = require('./_shared/org-permissions');

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSnapshot(raw) {
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
  return result;
}

function hasOrgData(raw) {
  return EC_COLLECTIONS.some(col => {
    const colData = raw[col];
    return colData && typeof colData === 'object' && Object.keys(colData).length > 0;
  });
}

// ── Handler factory (aceita deps injetadas para testabilidade) ─────────────────

function _createHandler(deps) {
  const _getDatabase = deps.getDatabase;
  const _verifyToken = deps.verifyToken;

  return async function handler(event) {
    const requestId = require('crypto').randomUUID();

    // ── CORS ─────────────────────────────────────────────────────────────────
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

    // ── Content-Type ──────────────────────────────────────────────────────────
    const contentType = (event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '';
    if (!contentType.includes('application/json')) {
      return { statusCode: 415, headers, body: JSON.stringify({ error: 'Content-Type deve ser application/json' }) };
    }

    // ── Payload size ──────────────────────────────────────────────────────────
    const payloadErr = checkPayloadSize(event.body);
    if (payloadErr) {
      return { statusCode: 413, headers, body: JSON.stringify({ error: payloadErr }) };
    }

    // ── Secrets ───────────────────────────────────────────────────────────────
    const secret = process.env.UPLOAD_SESSION_SECRET;
    if (!secret) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuração ausente no servidor' }) };
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_err) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
    }

    const {
      sessionToken,
      operation,
      path,
      value,
      organizationId,
      expectedVersion,
      requestId: clientRequestId,
    } = body;

    // ── Validar operação ───────────────────────────────────────────────────────
    if (!ALLOWED_OPERATIONS.has(operation)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Operação inválida: ${operation}` }) };
    }

    // ── Validar token → uid (nunca do body) ───────────────────────────────────
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

    // ── Determinar modo: organization vs single-user ──────────────────────────
    const isOrgMode = typeof organizationId === 'string' && organizationId !== '';

    // ── Modo organização: validar membership no backend ───────────────────────
    let orgRole = null;
    if (isOrgMode) {
      try {
        const membershipSnap = await db.ref(`users/${uid}/memberships/${organizationId}`).once('value');
        const membership = membershipSnap.val();
        if (!membership || membership.status !== 'active') {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Acesso negado a esta organização', code: 'organization_invalid' }) };
        }
        orgRole = membership.role;
      } catch (_err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao verificar acesso' }) };
      }

      // ── Verificação de permissão por operação (calculada do role no backend) ─
      if (operation === 'snapshot' || operation === 'get') {
        if (!hasPermission(orgRole, 'energyCredits.read')) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão de leitura', code: 'no_permission' }) };
        }
      } else if (operation === 'set') {
        const isCreate = typeof expectedVersion !== 'number' || expectedVersion === 0;
        const requiredPerm = isCreate ? 'energyCredits.create' : 'energyCredits.update';
        if (!hasPermission(orgRole, requiredPerm)) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão de escrita', code: 'no_permission' }) };
        }
      }
    }

    // ── SNAPSHOT ──────────────────────────────────────────────────────────────
    if (operation === 'snapshot') {
      try {
        if (isOrgMode) {
          // Dual-read: organizations/ primeiro, fallback para legacy se vazio
          const orgSnap = await db.ref(`organizations/${organizationId}/energyCredits`).once('value');
          const orgRaw = orgSnap.val() || {};

          if (hasOrgData(orgRaw)) {
            return {
              statusCode: 200, headers,
              body: JSON.stringify({ ok: true, data: formatSnapshot(orgRaw), dataSource: 'organization', migrationRequired: false, requestId }),
            };
          }

          const legacySnap = await db.ref(`users/${uid}/energyCredits`).once('value');
          const legacyRaw = legacySnap.val() || {};
          return {
            statusCode: 200, headers,
            body: JSON.stringify({ ok: true, data: formatSnapshot(legacyRaw), dataSource: 'legacy-single-user', migrationRequired: true, requestId }),
          };
        }

        // Single-user (backward compat — unchanged)
        const ref = db.ref(`users/${uid}/energyCredits`);
        const snap = await ref.once('value');
        const raw = snap.val() || {};
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ ok: true, data: formatSnapshot(raw), dataSource: 'legacy-single-user', migrationRequired: false, requestId }),
        };
      } catch (_err) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha ao carregar snapshot' }) };
      }
    }

    // ── GET / SET: validar path ───────────────────────────────────────────────
    const pathErr = validatePath(path);
    if (pathErr) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: pathErr }) };
    }

    // ── GET ───────────────────────────────────────────────────────────────────
    if (operation === 'get') {
      try {
        const scopedPath = isOrgMode
          ? `organizations/${organizationId}/${path}`
          : `users/${uid}/${path}`;
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

      // ── Modo organização: idempotência + transação com versionamento ─────────
      if (isOrgMode) {
        const entityPath = `organizations/${organizationId}/${path}`;

        // Idempotência: checar se já foi processado
        if (clientRequestId && typeof clientRequestId === 'string') {
          try {
            const idempotencyPath = `organizations/${organizationId}/idempotency/${clientRequestId}`;
            const idempotencySnap = await db.ref(idempotencyPath).once('value');
            if (idempotencySnap.val()) {
              return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId, idempotent: true }) };
            }
          } catch (_err) { /* idempotency check falhou — prosseguir sem cache */ }
        }

        const isCreate = typeof expectedVersion !== 'number' || expectedVersion === 0;

        // Transação Firebase: leitura atômica de versão + escrita
        let committed, newVersion;
        try {
          const txResult = await db.ref(entityPath).transaction(current => {
            if (isCreate) {
              if (current !== null) return undefined; // Abort: item já existe
              newVersion = 1;
              return { ...clean, organizationId, version: 1, updatedAt: Date.now(), updatedBy: uid, _requestId: requestId };
            } else {
              if (!current || current.version === undefined || current.version === null) return undefined;
              if (current.version !== expectedVersion) return undefined;
              newVersion = expectedVersion + 1;
              return { ...clean, organizationId, version: newVersion, updatedAt: Date.now(), updatedBy: uid, _requestId: requestId };
            }
          });
          committed = txResult.committed;
        } catch (_err) {
          return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha na escrita' }) };
        }

        if (!committed) {
          let currentVersion = null;
          try {
            const currentSnap = await db.ref(entityPath).once('value');
            currentVersion = currentSnap.val()?.version ?? null;
          } catch (_err) { /* best-effort */ }
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({
              ok: false,
              code: 'version_conflict',
              error: isCreate ? 'Item já existe' : 'Conflito de versão',
              expectedVersion: isCreate ? 0 : expectedVersion,
              currentVersion,
            }),
          };
        }

        // Registrar idempotência (best-effort)
        if (clientRequestId && typeof clientRequestId === 'string') {
          const idempotencyPath = `organizations/${organizationId}/idempotency/${clientRequestId}`;
          db.ref(idempotencyPath).set({ requestId, completedAt: Date.now() }).catch(() => {});
        }

        // Audit log por escrita organizacional (best-effort)
        const auditId = `${uid}_${clean.id}_${Date.now()}`;
        db.ref(`organizations/${organizationId}/auditLog/${auditId}`).set({
          id: auditId, requestId, uid, organizationId,
          targetId: clean.id, action: isCreate ? 'create' : 'update',
          completedAt: Date.now(),
        }).catch(() => {});

        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId, version: newVersion }) };
      }

      // ── Modo single-user (backward compat — inalterado) ──────────────────────
      const scopedPath = `users/${uid}/${path}`;
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

// ── Testing exports ───────────────────────────────────────────────────────────

exports._createHandler = _createHandler;
