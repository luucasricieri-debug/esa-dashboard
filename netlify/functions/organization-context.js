'use strict';

// ── ESA OS — Organization Context Endpoint — Gate 8A ─────────────────────────
// Responsabilidades:
//   1. Valida token HMAC — uid extraído EXCLUSIVAMENTE do token
//   2. Carrega memberships de users/{uid}/memberships/ no Firebase
//   3. Sem memberships ativos → modo single-user (compatibilidade Gate 7)
//   4. Com memberships → valida org selecionada, status, role
//   5. Permissões calculadas NO BACKEND a partir da role — nunca do browser
//   6. Cross-tenant bloqueado por design (uid do token !== organizationId livre)
//
// Diagnóstico temporário (produção retornando single-user com dados confirmados
// no Firebase): instrumentação segura via console.info + campo `diagnostics`
// opcional no response, habilitado apenas com ORGANIZATION_CONTEXT_DIAGNOSTICS=true.
// Remover esta instrumentação assim que a causa raiz em produção for confirmada.

const crypto = require('crypto');
const { getDatabase, getDatabaseHost, getProjectId } = require('./_shared/firebase-admin');
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

// ── Diagnóstico temporário — helpers seguros (sem PII/segredos) ─────────────

function newRequestId() {
  try { return crypto.randomUUID(); } catch { return `rid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
}

function maskUid(uid) {
  if (!uid) return '(vazio)';
  if (uid.length <= 4) return '*'.repeat(uid.length);
  return `${uid.slice(0, 2)}***${uid.slice(-2)}`;
}

function maskKey(key) {
  if (!key) return '(vazio)';
  return key.length > 8 ? `${key.slice(0, 8)}…` : key;
}

function diagnosticsEnabled() {
  return process.env.ORGANIZATION_CONTEXT_DIAGNOSTICS === 'true';
}

function logDiagnostics(requestId, diag) {
  // Nunca inclui token, private_key, ou payload/uid completo — apenas contadores e chaves mascaradas.
  try {
    console.info('[organization-context][diag]', JSON.stringify({ requestId, ...diag }));
  } catch {
    // logging nunca deve derrubar a request
  }
}

function classifyMembership(key, m) {
  if (!m || typeof m !== 'object') return { organizationId: null, reason: 'invalid_shape' };
  const organizationId = m.organizationId || key;
  if (!organizationId) return { organizationId: null, reason: 'missing_organization_id' };
  if (m.status !== 'active') return { organizationId, reason: 'membership_inactive' };
  return { organizationId, reason: null, membership: { ...m, organizationId } };
}

// Lê users/{uid}/memberships explicitamente; organizationId = membership.organizationId || child.key
// (cobre records criados antes do Gate 8F, quando o campo organizationId não era gravado no valor).
async function loadMembershipsWithDiagnostics(db, uid, diag) {
  const path = `users/${uid}/memberships`;
  diag.membershipPath = 'users/{uid}/memberships'; // path com uid mascarado — nunca o path real completo
  const snap = await db.ref(path).once('value');
  diag.userMembershipsSnapshotExists = snap.exists();
  const raw = snap.val() || {};
  const rawEntries = Object.entries(raw);
  diag.rawMembershipCount = rawEntries.length;

  const normalized = [];
  const discarded = [];
  for (const [key, m] of rawEntries) {
    const c = classifyMembership(key, m);
    if (c.reason) {
      discarded.push({ key: maskKey(key), reason: c.reason });
      continue;
    }
    normalized.push(c.membership);
  }
  diag.normalizedMembershipCount = normalized.length;
  diag.discardedMemberships = discarded;
  return normalized;
}

// Para cada membership normalizado (status ativo), carrega a organização correspondente
// e confirma o caminho reverso organizations/{orgId}/members/{uid}. O caminho reverso é
// só para diagnóstico de inconsistência dual-path — nunca é usado como fallback de autorização.
async function enrichMembershipsWithOrganizations(db, uid, normalized, diag) {
  const results = await Promise.all(normalized.map(async (m) => {
    let orgData = null;
    let orgReadFailed = false;
    try {
      const orgSnap = await db.ref(`organizations/${m.organizationId}`).once('value');
      orgData = orgSnap.val();
    } catch {
      orgReadFailed = true;
    }

    let reverseExists = null;
    try {
      const revSnap = await db.ref(`organizations/${m.organizationId}/members/${uid}`).once('value');
      reverseExists = revSnap.exists();
    } catch {
      reverseExists = null; // leitura reversa falhou — não bloqueia o fluxo principal
    }

    let reason = null;
    if (orgReadFailed) reason = 'organization_context_failed';
    else if (!orgData) reason = 'organization_not_found';
    else if (orgData.status !== 'active') reason = 'organization_inactive';

    return { membership: m, orgData, reverseExists, reason };
  }));

  diag.activeMembershipCount = results.filter((r) => !r.reason).length;
  for (const r of results) {
    if (r.reason) diag.discardedMemberships.push({ key: maskKey(r.membership.organizationId), reason: r.reason });
    // Inconsistência dual-path: users/{uid}/memberships existe mas organizations/{orgId}/members/{uid} não.
    // Registrada apenas como sinal de diagnóstico — nunca usada para autorizar ou negar acesso.
    if (r.reverseExists === false) {
      console.warn('[organization-context][dual_path_inconsistency]', JSON.stringify({
        orgId: maskKey(r.membership.organizationId),
        uid: maskUid(uid),
        note: 'users/{uid}/memberships existe mas organizations/{orgId}/members/{uid} não foi encontrado',
      }));
    }
  }
  return results;
}

exports.handler = async function (event) {
  const requestId = newRequestId();

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

  const diag = {};
  let db;
  try {
    db = getDatabase();
    diag.serviceAccountProjectId = getProjectId();
    diag.databaseHost = getDatabaseHost();
  } catch (e) {
    logDiagnostics(requestId, { ...diag, fatal: 'firebase_init_failed' });
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro de configuração do servidor' }) };
  }

  let activeMemberships;
  try {
    activeMemberships = await loadMembershipsWithDiagnostics(db, uid, diag);
  } catch {
    logDiagnostics(requestId, { ...diag, uid: maskUid(uid), fatal: 'memberships_read_failed' });
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao acessar banco de dados' }) };
  }

  // Sem memberships → fallback single-user (compatibilidade Gate 7)
  if (activeMemberships.length === 0) {
    diag.activeMembershipCount = 0;
    diag.resolvedTenancyMode = 'single-user';
    logDiagnostics(requestId, { ...diag, uid: maskUid(uid) });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        data: buildSingleUserContext(uid),
        ...(diagnosticsEnabled() ? {
          diagnostics: {
            projectId: diag.serviceAccountProjectId,
            databaseHost: diag.databaseHost,
            userMembershipsExists: diag.userMembershipsSnapshotExists,
            rawMembershipCount: diag.rawMembershipCount,
            normalizedMembershipCount: diag.normalizedMembershipCount,
            activeMembershipCount: diag.activeMembershipCount,
          },
        } : {}),
      }),
    };
  }

  // Enriquece com dados de organização (existência/status) + checagem dual-path
  const enriched = await enrichMembershipsWithOrganizations(db, uid, activeMemberships, diag);

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
    diag.resolvedTenancyMode = 'error:organization_invalid';
    logDiagnostics(requestId, { ...diag, uid: maskUid(uid) });
    return { statusCode: 403, body: JSON.stringify({ error: 'Organização não autorizada para este usuário', code: 'organization_invalid' }) };
  }

  const selected = enriched.find(r => r.membership.organizationId === membership.organizationId);
  const org = selected ? selected.orgData : null;

  if (!org) {
    diag.resolvedTenancyMode = 'error:organization_invalid';
    logDiagnostics(requestId, { ...diag, uid: maskUid(uid) });
    return { statusCode: 403, body: JSON.stringify({ error: 'Organização não encontrada', code: 'organization_invalid' }) };
  }
  if (org.status !== 'active') {
    diag.resolvedTenancyMode = 'error:organization_inactive';
    logDiagnostics(requestId, { ...diag, uid: maskUid(uid) });
    return { statusCode: 403, body: JSON.stringify({ error: 'Organização inativa. Contacte o administrador.', code: 'organization_inactive' }) };
  }

  // Permissões calculadas pelo backend a partir da role — nunca do browser
  const role = membership.role;
  const permissions = ROLE_PERMISSIONS[role] || [];

  // availableOrganizations reaproveita os dados já carregados em enrichMembershipsWithOrganizations
  // (evita uma segunda leitura por organização) — mantém o mesmo formato de antes (Gate 8B).
  const availableOrganizations = enriched.map(r => ({
    id: r.membership.organizationId,
    name: r.orgData?.name || '',
    role: r.membership.role,
  }));

  diag.resolvedTenancyMode = 'organization';
  logDiagnostics(requestId, { ...diag, uid: maskUid(uid) });

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
      ...(diagnosticsEnabled() ? {
        diagnostics: {
          projectId: diag.serviceAccountProjectId,
          databaseHost: diag.databaseHost,
          userMembershipsExists: diag.userMembershipsSnapshotExists,
          rawMembershipCount: diag.rawMembershipCount,
          normalizedMembershipCount: diag.normalizedMembershipCount,
          activeMembershipCount: diag.activeMembershipCount,
        },
      } : {}),
    }),
  };
};

// Exportado apenas para testes (funções puras — nenhuma delas expõe segredos).
// exports.handler continua sendo o único ponto de entrada usado pelo Netlify.
module.exports.classifyMembership = classifyMembership;
module.exports.maskUid = maskUid;
module.exports.maskKey = maskKey;
module.exports.diagnosticsEnabled = diagnosticsEnabled;
module.exports.buildSingleUserContext = buildSingleUserContext;
module.exports.loadMembershipsWithDiagnostics = loadMembershipsWithDiagnostics;
module.exports.enrichMembershipsWithOrganizations = enrichMembershipsWithOrganizations;
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
