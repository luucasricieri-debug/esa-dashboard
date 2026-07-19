'use strict';

/**
 * ESA OS — Netlify Function: organization-members — Gate 8F
 *
 * CRUD de memberships organizacionais.
 *
 * Ações (action no body):
 *   list          — lista membros com dados de perfil
 *   add           — adiciona usuário existente como membro
 *   update-role   — altera papel de um membro
 *   suspend       — suspende membership
 *   reactivate    — reativa membership suspenso
 *
 * Segurança:
 *   - Token HMAC validado; uid extraído do token (nunca do body)
 *   - Membership do ator validado no backend
 *   - Permissões calculadas da role no backend; nunca do browser
 *   - Owner protegido contra suspensão e downgrade
 *   - Self-role-change proibido
 *   - Dual-path atômico: organizations/{orgId}/members/{uid} + users/{uid}/memberships/{orgId}
 *   - Versionamento otimista nas mutações
 *   - Idempotência via requestId
 *   - Audit log por operação (sem PII — uid mascarado)
 */

const { getDatabase } = require('./_shared/firebase-admin');
const { verifyToken } = require('./_shared/upload-session');
const { ROLE_PERMISSIONS, hasPermission } = require('./_shared/org-permissions');

const ALLOWED_ROLES = ['admin', 'manager', 'operator', 'financial', 'viewer'];
const ALLOWED_ACTIONS = new Set(['list', 'add', 'update-role', 'suspend', 'reactivate']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractBearerToken(headers) {
  const auth = headers?.authorization || headers?.Authorization || '';
  const m = auth.match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}

function maskUid(uid) {
  if (!uid || uid.length < 4) return '***';
  return uid.slice(0, 3) + '***' + uid.slice(-3);
}

// ── createHandler (injetável para testes) ────────────────────────────────────

function _createHandler(deps) {
  const _getDatabase = deps.getDatabase;
  const _verifyToken = deps.verifyToken;

  return async function handler(event) {
    const requestId = require('crypto').randomUUID();
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Request-Id': requestId,
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
    }

    const secret = process.env.UPLOAD_SESSION_SECRET;
    if (!secret) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuração inválida do servidor' }) };

    const rawToken = extractBearerToken(event.headers);
    if (!rawToken) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token ausente' }) };

    let actorUid;
    try {
      const payload = _verifyToken(rawToken, secret);
      actorUid = payload.uid;
      if (!actorUid) throw new Error('uid ausente');
    } catch {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido ou expirado' }) };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
    }

    const { action, organizationId } = body;
    if (!ALLOWED_ACTIONS.has(action)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Ação inválida: ${action}` }) };
    }
    if (!organizationId || typeof organizationId !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'organizationId obrigatório' }) };
    }

    let db;
    try {
      db = _getDatabase();
    } catch {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro de configuração do servidor' }) };
    }

    // ── Validar membership do ator ─────────────────────────────────────────────
    let actorMembership;
    try {
      const snap = await db.ref(`users/${actorUid}/memberships/${organizationId}`).once('value');
      actorMembership = snap.val();
    } catch {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao verificar acesso' }) };
    }
    if (!actorMembership) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem acesso a esta organização', code: 'organization_invalid' }) };
    }
    if (actorMembership.status !== 'active') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Membership inativo', code: 'membership_inactive' }) };
    }
    const actorRole = actorMembership.role;

    // ── Despachar ação ────────────────────────────────────────────────────────

    if (action === 'list') {
      if (!hasPermission(actorRole, 'organization.members.read')) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão para listar membros', code: 'no_permission' }) };
      }
      return _handleList(db, organizationId, requestId, headers);
    }

    if (action === 'add') {
      if (!hasPermission(actorRole, 'organization.members.manage')) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão para adicionar membros', code: 'no_permission' }) };
      }
      return _handleAdd(db, actorUid, organizationId, body, requestId, headers);
    }

    if (action === 'update-role') {
      if (!hasPermission(actorRole, 'organization.members.manage')) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão para alterar papéis', code: 'no_permission' }) };
      }
      return _handleUpdateRole(db, actorUid, actorRole, organizationId, body, requestId, headers);
    }

    if (action === 'suspend') {
      if (!hasPermission(actorRole, 'organization.members.manage')) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão para suspender membros', code: 'no_permission' }) };
      }
      return _handleSuspend(db, actorUid, organizationId, body, requestId, headers);
    }

    if (action === 'reactivate') {
      if (!hasPermission(actorRole, 'organization.members.manage')) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão para reativar membros', code: 'no_permission' }) };
      }
      return _handleReactivate(db, actorUid, organizationId, body, requestId, headers);
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ação não reconhecida' }) };
  };
}

// ── list ─────────────────────────────────────────────────────────────────────

async function _handleList(db, organizationId, requestId, headers) {
  try {
    const snap = await db.ref(`organizations/${organizationId}/members`).once('value');
    const raw = snap.val() || {};
    const members = await Promise.all(
      Object.values(raw).map(async (m) => {
        const uid = m.uid;
        let displayName = '';
        let login = '';
        try {
          const userSnap = await db.ref(`users/${uid}`).once('value');
          const u = userSnap.val() || {};
          displayName = u.displayName || u.name || '';
          login = u.login || u.email || '';
        } catch { /* perfil indisponível — retorna registro mínimo */ }
        return { uid, displayName, login, role: m.role, status: m.status, createdAt: m.createdAt || null, updatedAt: m.updatedAt || null, version: m.version || 1 };
      }),
    );
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: members, requestId }) };
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha ao listar membros' }) };
  }
}

// ── add ──────────────────────────────────────────────────────────────────────

async function _handleAdd(db, actorUid, organizationId, body, requestId, headers) {
  const { targetUid, login, role, clientRequestId } = body;

  if (!ALLOWED_ROLES.includes(role)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Papel inválido', code: 'invalid_role' }) };
  }
  if (!targetUid && !login) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetUid ou login é obrigatório' }) };
  }

  // Idempotência: verificar requestId anterior
  if (clientRequestId) {
    try {
      const idSnap = await db.ref(`organizations/${organizationId}/idempotency/${clientRequestId}`).once('value');
      if (idSnap.val()) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId, idempotent: true }) };
    } catch { /* continuar sem cache */ }
  }

  // Localizar usuário por uid ou login
  let resolvedUid = null;
  let userData = null;

  if (targetUid && typeof targetUid === 'string') {
    try {
      const snap = await db.ref(`users/${targetUid}`).once('value');
      if (snap.exists()) { resolvedUid = targetUid; userData = snap.val(); }
    } catch { /* continuar */ }
  }

  if (!resolvedUid && login && typeof login === 'string') {
    try {
      const snap = await db.ref('users').orderByChild('login').equalTo(login).limitToFirst(1).once('value');
      const val = snap.val();
      if (val) {
        const entries = Object.entries(val);
        if (entries.length > 0) { [resolvedUid, userData] = entries[0]; }
      }
    } catch { /* continuar */ }
  }

  if (!resolvedUid) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuário não encontrado', code: 'user_not_found' }) };
  }

  // Membership já existe?
  try {
    const existSnap = await db.ref(`organizations/${organizationId}/members/${resolvedUid}`).once('value');
    if (existSnap.val()) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Este usuário já pertence à organização', code: 'membership_already_exists' }) };
    }
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao verificar membership' }) };
  }

  const now = Date.now();
  const permissions = ROLE_PERMISSIONS[role] || [];
  const membership = {
    organizationId, uid: resolvedUid, role,
    status: 'active', permissions,
    createdAt: now, updatedAt: now,
    version: 1, updatedBy: actorUid, _requestId: requestId,
  };

  // Dual-path atômico
  try {
    await db.ref('/').update({
      [`organizations/${organizationId}/members/${resolvedUid}`]: membership,
      [`users/${resolvedUid}/memberships/${organizationId}`]: membership,
    });
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha ao criar membership' }) };
  }

  if (clientRequestId) {
    db.ref(`organizations/${organizationId}/idempotency/${clientRequestId}`)
      .set({ requestId, completedAt: now }).catch(() => {});
  }

  const auditId = `add_${maskUid(resolvedUid)}_${now}`;
  db.ref(`organizations/${organizationId}/auditLog/${auditId}`).set({
    id: auditId, requestId, action: 'member_added', organizationId,
    actorUidMasked: maskUid(actorUid), targetUidMasked: maskUid(resolvedUid),
    newRole: role, newStatus: 'active', createdAt: now, result: 'ok',
  }).catch(() => {});

  const displayName = userData?.displayName || userData?.name || '';
  return {
    statusCode: 200, headers,
    body: JSON.stringify({ ok: true, requestId, data: { uid: resolvedUid, displayName, role, status: 'active', version: 1 } }),
  };
}

// ── update-role ───────────────────────────────────────────────────────────────

async function _handleUpdateRole(db, actorUid, actorRole, organizationId, body, requestId, headers) {
  const { targetUid, newRole, expectedVersion, clientRequestId } = body;

  if (!targetUid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetUid obrigatório' }) };
  if (!ALLOWED_ROLES.includes(newRole)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Papel inválido', code: 'invalid_role' }) };
  }
  if (targetUid === actorUid) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Você não pode alterar o próprio perfil', code: 'self_role_change_forbidden' }) };
  }
  if (newRole === 'owner') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Não é permitido promover para owner nesta operação', code: 'owner_protected' }) };
  }

  let targetM;
  try {
    const snap = await db.ref(`organizations/${organizationId}/members/${targetUid}`).once('value');
    targetM = snap.val();
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao carregar membership do membro' }) };
  }
  if (!targetM) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Membro não encontrado', code: 'user_not_found' }) };
  if (targetM.role === 'owner') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'O proprietário da organização não pode ter o papel alterado', code: 'owner_protected' }) };
  }

  if (clientRequestId) {
    try {
      const idSnap = await db.ref(`organizations/${organizationId}/idempotency/${clientRequestId}`).once('value');
      if (idSnap.val()) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId, idempotent: true }) };
    } catch { /* continuar */ }
  }

  if (typeof expectedVersion === 'number' && targetM.version !== expectedVersion) {
    return { statusCode: 409, headers, body: JSON.stringify({ ok: false, code: 'version_conflict', expectedVersion, currentVersion: targetM.version }) };
  }

  const now = Date.now();
  const previousRole = targetM.role;
  const newVersion = (targetM.version || 0) + 1;
  const permissions = ROLE_PERMISSIONS[newRole] || [];
  const updated = { ...targetM, role: newRole, permissions, updatedAt: now, updatedBy: actorUid, version: newVersion, _requestId: requestId };

  try {
    await db.ref('/').update({
      [`organizations/${organizationId}/members/${targetUid}`]: updated,
      [`users/${targetUid}/memberships/${organizationId}`]: updated,
    });
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha ao atualizar papel' }) };
  }

  if (clientRequestId) {
    db.ref(`organizations/${organizationId}/idempotency/${clientRequestId}`)
      .set({ requestId, completedAt: now }).catch(() => {});
  }

  const auditId = `role_${maskUid(targetUid)}_${now}`;
  db.ref(`organizations/${organizationId}/auditLog/${auditId}`).set({
    id: auditId, requestId, action: 'member_role_updated', organizationId,
    actorUidMasked: maskUid(actorUid), targetUidMasked: maskUid(targetUid),
    previousRole, newRole, createdAt: now, result: 'ok',
  }).catch(() => {});

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId, data: { uid: targetUid, role: newRole, version: newVersion } }) };
}

// ── suspend ───────────────────────────────────────────────────────────────────

async function _handleSuspend(db, actorUid, organizationId, body, requestId, headers) {
  const { targetUid, expectedVersion, clientRequestId } = body;

  if (!targetUid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetUid obrigatório' }) };
  if (targetUid === actorUid) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Você não pode suspender a si mesmo', code: 'self_role_change_forbidden' }) };
  }

  let targetM;
  try {
    const snap = await db.ref(`organizations/${organizationId}/members/${targetUid}`).once('value');
    targetM = snap.val();
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao carregar membership' }) };
  }
  if (!targetM) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Membro não encontrado', code: 'user_not_found' }) };
  if (targetM.role === 'owner') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'O proprietário da organização não pode ser suspenso', code: 'owner_protected' }) };
  }

  if (clientRequestId) {
    try {
      const idSnap = await db.ref(`organizations/${organizationId}/idempotency/${clientRequestId}`).once('value');
      if (idSnap.val()) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId, idempotent: true }) };
    } catch { /* continuar */ }
  }

  if (typeof expectedVersion === 'number' && targetM.version !== expectedVersion) {
    return { statusCode: 409, headers, body: JSON.stringify({ ok: false, code: 'version_conflict', expectedVersion, currentVersion: targetM.version }) };
  }

  const now = Date.now();
  const newVersion = (targetM.version || 0) + 1;
  const updated = { ...targetM, status: 'suspended', updatedAt: now, updatedBy: actorUid, version: newVersion, _requestId: requestId };

  try {
    await db.ref('/').update({
      [`organizations/${organizationId}/members/${targetUid}`]: updated,
      [`users/${targetUid}/memberships/${organizationId}`]: updated,
    });
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha ao suspender membership' }) };
  }

  if (clientRequestId) {
    db.ref(`organizations/${organizationId}/idempotency/${clientRequestId}`)
      .set({ requestId, completedAt: now }).catch(() => {});
  }

  const auditId = `suspend_${maskUid(targetUid)}_${now}`;
  db.ref(`organizations/${organizationId}/auditLog/${auditId}`).set({
    id: auditId, requestId, action: 'member_suspended', organizationId,
    actorUidMasked: maskUid(actorUid), targetUidMasked: maskUid(targetUid),
    previousStatus: targetM.status, newStatus: 'suspended', createdAt: now, result: 'ok',
  }).catch(() => {});

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId, data: { uid: targetUid, status: 'suspended' } }) };
}

// ── reactivate ────────────────────────────────────────────────────────────────

async function _handleReactivate(db, actorUid, organizationId, body, requestId, headers) {
  const { targetUid, expectedVersion, clientRequestId } = body;

  if (!targetUid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetUid obrigatório' }) };

  let targetM;
  try {
    const snap = await db.ref(`organizations/${organizationId}/members/${targetUid}`).once('value');
    targetM = snap.val();
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao carregar membership' }) };
  }
  if (!targetM) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Membro não encontrado', code: 'user_not_found' }) };

  if (clientRequestId) {
    try {
      const idSnap = await db.ref(`organizations/${organizationId}/idempotency/${clientRequestId}`).once('value');
      if (idSnap.val()) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId, idempotent: true }) };
    } catch { /* continuar */ }
  }

  if (typeof expectedVersion === 'number' && targetM.version !== expectedVersion) {
    return { statusCode: 409, headers, body: JSON.stringify({ ok: false, code: 'version_conflict', expectedVersion, currentVersion: targetM.version }) };
  }

  const now = Date.now();
  const newVersion = (targetM.version || 0) + 1;
  const updated = { ...targetM, status: 'active', updatedAt: now, updatedBy: actorUid, version: newVersion, _requestId: requestId };

  try {
    await db.ref('/').update({
      [`organizations/${organizationId}/members/${targetUid}`]: updated,
      [`users/${targetUid}/memberships/${organizationId}`]: updated,
    });
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Falha ao reativar membership' }) };
  }

  if (clientRequestId) {
    db.ref(`organizations/${organizationId}/idempotency/${clientRequestId}`)
      .set({ requestId, completedAt: now }).catch(() => {});
  }

  const auditId = `reactivate_${maskUid(targetUid)}_${now}`;
  db.ref(`organizations/${organizationId}/auditLog/${auditId}`).set({
    id: auditId, requestId, action: 'member_reactivated', organizationId,
    actorUidMasked: maskUid(actorUid), targetUidMasked: maskUid(targetUid),
    previousStatus: targetM.status, newStatus: 'active', createdAt: now, result: 'ok',
  }).catch(() => {});

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, requestId, data: { uid: targetUid, status: 'active' } }) };
}

// ── Produção ──────────────────────────────────────────────────────────────────

exports.handler = _createHandler({ getDatabase, verifyToken });
exports._createHandler = _createHandler;
exports._maskUid = maskUid;
exports._ALLOWED_ROLES = ALLOWED_ROLES;
