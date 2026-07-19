'use strict';

// ── ESA OS — Organization Context Endpoint — Gate 8A ─────────────────────────
// Responsabilidades:
//   1. Valida token HMAC — uid extraído EXCLUSIVAMENTE do token
//   2. Carrega memberships de users/{uid}/memberships/ no Firebase
//   3. Sem memberships ativos → modo single-user (compatibilidade Gate 7)
//   4. Com memberships → valida org selecionada, status, role
//   5. Permissões calculadas NO BACKEND a partir da role — nunca do browser
//   6. Cross-tenant bloqueado por design (uid do token !== organizationId livre)

const { getDatabase } = require('./_shared/firebase-admin');
const { verifyToken } = require('./_shared/upload-session');

// Matriz de permissões espelhada do permissionMatrix.ts — fonte de verdade no backend
const ROLE_PERMISSIONS = {
  owner:     ['energyCredits.read','energyCredits.create','energyCredits.update','energyCredits.delete','energyCredits.settlement.read','energyCredits.settlement.write','energyCredits.financial.read','energyCredits.financial.write','energyCredits.import','energyCredits.alerts.manage','organization.members.read','organization.members.manage'],
  admin:     ['energyCredits.read','energyCredits.create','energyCredits.update','energyCredits.delete','energyCredits.settlement.read','energyCredits.settlement.write','energyCredits.financial.read','energyCredits.financial.write','energyCredits.import','energyCredits.alerts.manage','organization.members.read','organization.members.manage'],
  manager:   ['energyCredits.read','energyCredits.create','energyCredits.update','energyCredits.settlement.read','energyCredits.settlement.write','energyCredits.financial.read','energyCredits.import','energyCredits.alerts.manage','organization.members.read'],
  operator:  ['energyCredits.read','energyCredits.create','energyCredits.update','energyCredits.settlement.read','energyCredits.import'],
  financial: ['energyCredits.read','energyCredits.settlement.read','energyCredits.settlement.write','energyCredits.financial.read','energyCredits.financial.write'],
  viewer:    ['energyCredits.read','energyCredits.settlement.read','energyCredits.financial.read'],
};

// Permissões para o modo single-user (compatibilidade com modelo atual)
const SINGLE_USER_PERMISSIONS = [...new Set(Object.values(ROLE_PERMISSIONS).flat())];

function extractBearerToken(headers) {
  const auth = headers?.authorization || headers?.Authorization || '';
  const m = auth.match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}

function buildSingleUserContext(uid) {
  return {
    tenancyMode: 'single-user',
    organizationId: uid,
    organizationName: '',
    uid,
    role: 'single-user',
    permissions: SINGLE_USER_PERMISSIONS,
    availableOrganizations: [],
  };
}

async function loadMemberships(db, uid) {
  const snap = await db.ref(`users/${uid}/memberships`).once('value');
  const raw = snap.val() || {};
  return Object.values(raw).filter(m => m && m.status === 'active' && m.organizationId);
}

async function loadOrganization(db, orgId) {
  const snap = await db.ref(`organizations/${orgId}`).once('value');
  return snap.val();
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const secret = process.env.UPLOAD_SESSION_SECRET;
  if (!secret) return { statusCode: 500, body: JSON.stringify({ error: 'Configuração inválida do servidor' }) };

  const rawToken = extractBearerToken(event.headers);
  if (!rawToken) return { statusCode: 401, body: JSON.stringify({ error: 'Token ausente' }) };

  let payload;
  try {
    payload = verifyToken(rawToken, secret);
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Token inválido ou expirado' }) };
  }

  // uid SOMENTE do token — nunca do body
  const { uid } = payload;

  let db;
  try { db = getDatabase(); } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro de configuração do servidor' }) };
  }

  let activeMemberships;
  try {
    activeMemberships = await loadMemberships(db, uid);
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao acessar banco de dados' }) };
  }

  // Sem memberships → fallback single-user (compatibilidade Gate 7)
  if (activeMemberships.length === 0) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, data: buildSingleUserContext(uid) }),
    };
  }

  // Determinar organização solicitada
  let requestedOrgId = null;
  try {
    const body = JSON.parse(event.body || '{}');
    if (typeof body.organizationId === 'string') requestedOrgId = body.organizationId;
  } catch { /* body malformado — usa primeira org */ }

  const membership = requestedOrgId
    ? activeMemberships.find(m => m.organizationId === requestedOrgId)
    : activeMemberships[0];

  if (!membership) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Organização não autorizada para este usuário' }) };
  }

  let org;
  try {
    org = await loadOrganization(db, membership.organizationId);
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao acessar organização' }) };
  }

  if (!org || org.status !== 'active') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Organização inativa ou inválida' }) };
  }

  // Permissões calculadas pelo backend a partir da role — nunca do browser
  const role = membership.role;
  const permissions = ROLE_PERMISSIONS[role] || [];

  const availableOrganizations = activeMemberships.map(m => ({
    id: m.organizationId,
    name: '',  // nomes carregados em batch no Gate 8B
    role: m.role,
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      data: {
        tenancyMode: 'organization',
        organizationId: membership.organizationId,
        organizationName: org.name || '',
        uid,
        role,
        permissions,
        availableOrganizations,
      },
    }),
  };
};
