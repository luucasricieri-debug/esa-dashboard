#!/usr/bin/env node
'use strict';

/**
 * ESA OS — Script de Criação de Organização Inicial — Gate 8A
 *
 * Uso:
 *   node scripts/create-initial-organization.js \
 *     --name "ESA Energia" \
 *     --slug "esa-energia" \
 *     --owner-uid "uid_do_usuario" \
 *     [--dry-run]
 *
 * Variáveis de ambiente obrigatórias:
 *   FIREBASE_SERVICE_ACCOUNT_JSON — JSON da conta de serviço Firebase
 *   DATABASE_URL — URL do Firebase RTDB (opcional se hardcoded no firebase-admin)
 *
 * Regras:
 *   - Não sobrescreve organização existente com o mesmo slug
 *   - Idempotente: re-executar com o mesmo slug é seguro
 *   - --dry-run imprime o plano sem escrever nada
 *   - Sem uid hardcoded; sem secrets no código
 *   - Gera relatório detalhado ao final
 */

const crypto = require('crypto');
const admin  = require('firebase-admin');

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name')      { args.name = argv[++i]; }
    else if (argv[i] === '--slug') { args.slug = argv[++i]; }
    else if (argv[i] === '--owner-uid') { args.ownerUid = argv[++i]; }
    else if (argv[i] === '--dry-run')   { args.dryRun = true; }
  }
  return args;
}

function validateArgs(args) {
  const errors = [];
  if (!args.name  || typeof args.name  !== 'string') errors.push('--name é obrigatório');
  if (!args.slug  || typeof args.slug  !== 'string') errors.push('--slug é obrigatório');
  if (!args.ownerUid || typeof args.ownerUid !== 'string') errors.push('--owner-uid é obrigatório');
  if (!/^[a-z0-9-]+$/.test(args.slug || '')) errors.push('--slug deve ser lowercase alfanumérico com hífens');
  return errors;
}

// ── Firebase init ─────────────────────────────────────────────────────────────

function initFirebase() {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada');

  let serviceAccount;
  try { serviceAccount = JSON.parse(saJson); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválida (JSON malformado)'); }

  if (!admin.apps.length) {
    const databaseURL = process.env.DATABASE_URL
      || 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL });
  }
  return admin.database();
}

// ── Idempotency check ─────────────────────────────────────────────────────────

async function findOrgBySlug(db, slug) {
  const snap = await db.ref('organizations').orderByChild('slug').equalTo(slug).once('value');
  const val = snap.val();
  if (!val) return null;
  const entries = Object.entries(val);
  return entries.length > 0 ? { id: entries[0][0], ...entries[0][1] } : null;
}

async function findMembership(db, orgId, uid) {
  const snap = await db.ref(`users/${uid}/memberships/${orgId}`).once('value');
  return snap.val();
}

// ── Build records ─────────────────────────────────────────────────────────────

function buildOrganization(args) {
  const id  = crypto.randomUUID();
  const now = Date.now();
  return {
    id, name: args.name, slug: args.slug, status: 'active',
    createdAt: now, updatedAt: now, createdBy: args.ownerUid,
  };
}

function buildMembership(orgId, uid) {
  const now = Date.now();
  return {
    organizationId: orgId, uid, role: 'owner', status: 'active',
    permissions: [], createdAt: now, updatedAt: now,
  };
}

// ── Report ────────────────────────────────────────────────────────────────────

function printReport(dryRun, org, membership, existing) {
  console.log('\n' + '═'.repeat(60));
  console.log('ESA OS — Relatório de Criação de Organização');
  console.log('═'.repeat(60));
  if (existing) {
    console.log('STATUS: Organização já existe — nenhuma ação necessária');
    console.log(`  slug:  ${existing.slug}`);
    console.log(`  id:    ${existing.id}`);
    return;
  }
  if (dryRun) {
    console.log('MODO: DRY-RUN (nenhuma escrita realizada)');
  } else {
    console.log('STATUS: Organização criada com sucesso');
  }
  console.log(`  organizations/${org.id}`);
  console.log(`    name:      ${org.name}`);
  console.log(`    slug:      ${org.slug}`);
  console.log(`    status:    ${org.status}`);
  console.log(`    createdBy: ${org.createdBy}`);
  console.log(`  users/${membership.uid}/memberships/${org.id}`);
  console.log(`    role:   ${membership.role}`);
  console.log(`    status: ${membership.status}`);
  console.log('  organizations/' + org.id + '/members/' + membership.uid);
  console.log(`    role:   ${membership.role}`);
  console.log('═'.repeat(60) + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const errors = validateArgs(args);
  if (errors.length > 0) {
    errors.forEach(e => console.error('ERRO: ' + e));
    console.error('\nUso: node scripts/create-initial-organization.js --name "..." --slug "..." --owner-uid "..." [--dry-run]');
    process.exit(1);
  }

  const db = initFirebase();

  const existing = await findOrgBySlug(db, args.slug);
  if (existing) {
    printReport(false, null, null, existing);
    process.exit(0);
  }

  const org        = buildOrganization(args);
  const membership = buildMembership(org.id, args.ownerUid);

  printReport(args.dryRun, org, membership, null);

  if (args.dryRun) {
    console.log('Dry-run concluído. Nenhuma escrita realizada.\n');
    process.exit(0);
  }

  await db.ref(`organizations/${org.id}`).set(org);
  await db.ref(`users/${args.ownerUid}/memberships/${org.id}`).set(membership);
  await db.ref(`organizations/${org.id}/members/${args.ownerUid}`).set(membership);

  console.log('Organização criada. Reinicie o servidor para aplicar o novo contexto.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
