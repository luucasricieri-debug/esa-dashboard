'use strict';

/**
 * ESA OS — Reparo do cross-reference dual-path de membership
 *
 * Restaura users/{uid}/memberships/{organizationId} a partir da fonte de verdade
 * organizations/{organizationId}/members/{uid}. Não modifica role/status do
 * membership, não toca em nenhum outro campo do usuário (memberships é o único
 * subtree escrito), e é idempotente — rodar mais de uma vez com o mesmo estado
 * não produz efeito colateral além de atualizar updatedAt.
 *
 * Este script NÃO é executado automaticamente por nenhuma missão — é chamado
 * manualmente, depois do deploy do fix que preserva memberships em users/{uid}.
 *
 * Uso:
 *   node scripts/repair-user-membership-cross-reference.js \
 *     --uid <uid> --organization-id <organizationId> [--dry-run]
 *
 * Variáveis de ambiente obrigatórias:
 *   FIREBASE_SERVICE_ACCOUNT_JSON — JSON da conta de serviço Firebase
 *   DATABASE_URL — URL do Firebase RTDB (mesma variável lida por
 *     netlify/functions/_shared/firebase-admin.js; se ausente, cai no
 *     fallback histórico do projeto)
 */

const DEFAULT_DATABASE_URL = 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';

// ── Helpers seguros (sem PII/segredos) ───────────────────────────────────────

function maskUid(uid) {
  if (!uid) return '(vazio)';
  if (uid.length <= 4) return '*'.repeat(uid.length);
  return `${uid.slice(0, 2)}***${uid.slice(-2)}`;
}

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

// ── Núcleo do reparo (testável sem Firebase real — recebe um `db` com a mesma
//    interface .ref(path).once('value') / .set(value)) ─────────────────────

async function planRepair(db, uid, organizationId) {
  const orgMembershipSnap = await db.ref(`organizations/${organizationId}/members/${uid}`).once('value');
  const orgMembership = orgMembershipSnap.val();
  if (!orgMembership) {
    return { action: 'blocked', reason: 'organization_membership_not_found' };
  }

  const orgSnap = await db.ref(`organizations/${organizationId}`).once('value');
  const org = orgSnap.val();
  if (!org) {
    return { action: 'blocked', reason: 'organization_not_found' };
  }
  if (org.status !== 'active') {
    return { action: 'blocked', reason: 'organization_inactive' };
  }

  const existingSnap = await db.ref(`users/${uid}/memberships/${organizationId}`).once('value');
  const existing = existingSnap.val();

  const alreadyConsistent = !!existing
    && existing.organizationId === organizationId
    && existing.role === orgMembership.role
    && existing.status === orgMembership.status;

  if (alreadyConsistent) {
    return { action: 'noop', reason: 'already_consistent', existing };
  }

  const now = Date.now();
  const normalized = {
    organizationId,
    role: orgMembership.role,     // nunca modificado — copiado da fonte de verdade
    status: orgMembership.status, // nunca modificado — copiado da fonte de verdade
    createdAt: (existing && existing.createdAt) || orgMembership.createdAt || now,
    updatedAt: now,
  };
  if (orgMembership.permissions) normalized.permissions = orgMembership.permissions;
  if (orgMembership.version) normalized.version = orgMembership.version;

  return { action: 'write', targetPath: `users/${uid}/memberships/${organizationId}`, membership: normalized, hadExisting: !!existing };
}

async function repairMembershipCrossReference(db, args) {
  const plan = await planRepair(db, args.uid, args.organizationId);

  const reportBase = {
    uidMasked: maskUid(args.uid),
    organizationId: args.organizationId,
    dryRun: !!args.dryRun,
  };

  if (plan.action === 'blocked') {
    return { classification: 'REPAIR_BLOCKED', reason: plan.reason, ...reportBase };
  }

  if (plan.action === 'noop') {
    return { classification: 'REPAIR_ALREADY_CONSISTENT', ...reportBase };
  }

  if (args.dryRun) {
    return {
      classification: 'REPAIR_DRY_RUN',
      ...reportBase,
      wouldWrite: { path: 'users/{uid}/memberships/{organizationId}', role: plan.membership.role, status: plan.membership.status, hadExisting: plan.hadExisting },
    };
  }

  await db.ref(plan.targetPath).set(plan.membership);
  return {
    classification: 'REPAIR_OK',
    ...reportBase,
    written: { path: 'users/{uid}/memberships/{organizationId}', role: plan.membership.role, status: plan.membership.status, hadExisting: plan.hadExisting },
  };
}

// ── Firebase (produção) ──────────────────────────────────────────────────────

async function runAgainstRealFirebase(args) {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.error('[REPAIR-BLOCKED] FIREBASE_SERVICE_ACCOUNT_JSON não configurada.');
    return { classification: 'REPAIR_BLOCKED', reason: 'missing_credentials' };
  }

  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch {
    console.error('[REPAIR-BLOCKED] FIREBASE_SERVICE_ACCOUNT_JSON: JSON malformado.');
    return { classification: 'REPAIR_BLOCKED', reason: 'invalid_credentials_json' };
  }

  const admin = require('firebase-admin');
  const databaseURL = resolveDatabaseUrl();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL });
  }
  const db = admin.database();

  let result;
  try {
    result = await repairMembershipCrossReference(db, args);
  } catch (err) {
    result = { classification: 'REPAIR_BLOCKED', reason: 'unexpected_error', error: err.message };
  }

  try { await admin.app().delete(); } catch (_) { /* best-effort cleanup */ }
  return result;
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--uid') { args.uid = argv[++i]; }
    else if (argv[i] === '--organization-id') { args.organizationId = argv[++i]; }
    else if (argv[i] === '--dry-run') { args.dryRun = true; }
  }

  if (!args.uid || !args.organizationId) {
    console.error('Uso: node scripts/repair-user-membership-cross-reference.js --uid <uid> --organization-id <organizationId> [--dry-run]');
    process.exit(1);
  }

  runAgainstRealFirebase(args).then((result) => {
    console.log('\n═'.repeat(60));
    console.log('REPAIR:', JSON.stringify(result, null, 2));
    console.log('═'.repeat(60));
    const ok = ['REPAIR_OK', 'REPAIR_DRY_RUN', 'REPAIR_ALREADY_CONSISTENT'].includes(result.classification);
    process.exit(ok ? 0 : 1);
  }).catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { repairMembershipCrossReference, planRepair, maskUid, resolveDatabaseUrl, DEFAULT_DATABASE_URL };
