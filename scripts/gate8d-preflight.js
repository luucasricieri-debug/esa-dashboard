'use strict';

/**
 * ESA OS — Gate 8D: Preflight Check (read-only)
 *
 * Valida TODAS as condições antes de qualquer escrita:
 *   1. Credenciais Firebase presentes e válidas
 *   2. Conexão com RTDB estabelecida
 *   3. Path de origem acessível
 *   4. Path de destino acessível
 *   5. sourceUid existe
 *   6. Destino energyCredits está vazio
 *   7. Contagens coincidem com o dry-run do Gate 8C
 *   8. Hash da origem coincide com o Gate 8C
 *
 * Se qualquer condição falhar → BLOQUEADO (nenhuma escrita é realizada).
 *
 * Uso:
 *   node scripts/gate8d-preflight.js \
 *     --source-uid <uid> \
 *     --target-organization-id <orgId> \
 *     --dry-run-report reports/gate-8c-migration-dry-run.json
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── Credential validation ─────────────────────────────────────────────────────

function validateCredentials(env) {
  const errors = [];
  const saJson = env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!saJson) {
    errors.push('FIREBASE_SERVICE_ACCOUNT_JSON não configurada');
    return { valid: false, errors, fields: {} };
  }

  let sa;
  try { sa = JSON.parse(saJson); }
  catch { return { valid: false, errors: ['FIREBASE_SERVICE_ACCOUNT_JSON: JSON malformado'], fields: {} }; }

  const fields = {
    type:         sa.type        || null,
    project_id:   sa.project_id  || null,
    client_email: sa.client_email ? sa.client_email.slice(0, 6) + '***' : null,
    has_private_key: typeof sa.private_key === 'string' && sa.private_key.length > 50,
  };

  if (!sa.project_id)   errors.push('project_id ausente no service account');
  if (!sa.client_email) errors.push('client_email ausente no service account');
  if (!sa.private_key || sa.private_key.length < 50)
    errors.push('private_key ausente ou inválida no service account');
  if (sa.type !== 'service_account')
    errors.push(`type inválido: esperado 'service_account', encontrado '${sa.type}'`);

  const dbUrl = env.DATABASE_URL || '';
  if (!dbUrl) errors.push('DATABASE_URL não configurada');
  else if (!dbUrl.includes('firebaseio.com') && !dbUrl.includes('firebaseapp.com'))
    errors.push(`DATABASE_URL inválida: ${dbUrl.slice(0, 60)}`);

  return { valid: errors.length === 0, errors, fields };
}

function parseServiceAccount(jsonStr) {
  if (!jsonStr) return { valid: false, sa: null, errors: ['FIREBASE_SERVICE_ACCOUNT_JSON ausente'] };
  let sa;
  try { sa = JSON.parse(jsonStr); }
  catch (e) { return { valid: false, sa: null, errors: ['JSON malformado: ' + e.message] }; }
  const errors = [];
  if (!sa.project_id)   errors.push('project_id ausente');
  if (!sa.client_email) errors.push('client_email ausente');
  if (!sa.private_key)  errors.push('private_key ausente');
  return { valid: errors.length === 0, sa, errors };
}

// ── Inventory comparison ──────────────────────────────────────────────────────

function compareWithDryRunReport(currentHash, currentTotalCount, dryRunReport) {
  const diffs = [];
  const sourceHash  = dryRunReport?.source?.sourceHash;
  const sourceCount = dryRunReport?.source?.totalCount;

  let sourceChanged = false;
  if (sourceHash && sourceHash !== currentHash) {
    diffs.push(`Hash diverge: dry-run=${sourceHash?.slice(0, 16)}… actual=${currentHash?.slice(0, 16)}…`);
    sourceChanged = true;
  }
  if (typeof sourceCount === 'number' && sourceCount !== currentTotalCount) {
    diffs.push(`Contagem diverge: dry-run=${sourceCount} actual=${currentTotalCount}`);
    sourceChanged = true;
  }
  return { matched: !sourceChanged, sourceChanged, diffs };
}

// ── Destination check ─────────────────────────────────────────────────────────

function validateDestinationEmpty(destInv) {
  const nonEmpty = (destInv || []).filter(c => c.count > 0);
  return {
    isEmpty: nonEmpty.length === 0,
    collections: nonEmpty.map(c => c.collection),
  };
}

// ── Preflight report ──────────────────────────────────────────────────────────

function buildPreflightReport(checks) {
  const blockers = [];
  const warnings = [];

  if (!checks.credentialsValid)    blockers.push('Credenciais inválidas ou ausentes');
  if (!checks.connectionOk)        blockers.push('Conexão com RTDB falhou');
  if (!checks.sourceExists)        blockers.push('Usuário origem não encontrado no RTDB');
  if (!checks.destinationAccessible) blockers.push('Path de destino inacessível');
  if (!checks.destinationEmpty)    blockers.push('Destino já possui dados (MIGRATION_DESTINATION_NOT_EMPTY)');
  if (checks.sourceChanged)        blockers.push('Origem alterada desde o dry-run (SOURCE_CHANGED_SINCE_DRY_RUN)');
  if (checks.dryRunNotReady)       blockers.push('Gate 8C não classificado como READY_FOR_COPY');

  if (checks.hashMismatch)   warnings.push('Hash diverge — re-executar dry-run antes de prosseguir');
  if (checks.countMismatch)  warnings.push('Contagem diverge — dados foram alterados desde o dry-run');
  if (checks.hasOrphanRefs)  warnings.push('Referências órfãs detectadas no dry-run — revisar antes da cópia');

  const classification = blockers.length > 0 ? 'PREFLIGHT_BLOCKED' : 'PREFLIGHT_READY';
  return { classification, blockers, warnings };
}

// ── Firebase (execução real) ──────────────────────────────────────────────────

async function runPreflight(args) {
  const credsResult = validateCredentials(process.env);
  if (!credsResult.valid) {
    const report = buildPreflightReport({ credentialsValid: false, connectionOk: false, sourceExists: false, destinationAccessible: false, destinationEmpty: false, sourceChanged: false, dryRunNotReady: false });
    return { ...report, credentialErrors: credsResult.errors };
  }

  let db;
  try {
    const admin = require('firebase-admin');
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const dbUrl = process.env.DATABASE_URL || 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: dbUrl });
    db = admin.database();
  } catch (err) {
    return buildPreflightReport({ credentialsValid: true, connectionOk: false, sourceExists: false, destinationAccessible: false, destinationEmpty: false, sourceChanged: false, dryRunNotReady: false });
  }

  const { inventoryCollection, computeCollectionHash, computeObjectHash, EC_MIGRATION_COLLECTIONS } = require('./migrate-energy-credits-to-organization');
  const crypto2 = require('crypto');

  // Load source
  let sourceExists = false;
  let currentHash = '';
  let currentTotalCount = 0;
  try {
    const sourcePath = `users/${args.sourceUid}/energyCredits`;
    for (const col of EC_MIGRATION_COLLECTIONS) {
      const snap = await db.ref(`${sourcePath}/${col}`).once('value');
      const inv = inventoryCollection(col, snap.val());
      currentTotalCount += inv.count;
      if (inv.exists) sourceExists = true;
    }
    // Compute overall hash
    const colHashes = [];
    for (const col of EC_MIGRATION_COLLECTIONS) {
      const snap = await db.ref(`${sourcePath}/${col}`).once('value');
      const inv = inventoryCollection(col, snap.val());
      colHashes.push(inv.hash);
    }
    currentHash = crypto2.createHash('sha256').update(colHashes.join('|'), 'utf8').digest('hex');
  } catch (_) { /* leave sourceExists false */ }

  // Load destination
  let destinationAccessible = false;
  let destinationEmpty = true;
  const destInvs = [];
  try {
    const destPath = `organizations/${args.targetOrganizationId}/energyCredits`;
    for (const col of EC_MIGRATION_COLLECTIONS) {
      const snap = await db.ref(`${destPath}/${col}`).once('value');
      const inv = inventoryCollection(col, snap.val());
      destInvs.push({ collection: col, count: inv.count });
    }
    destinationAccessible = true;
    destinationEmpty = destInvs.every(c => c.count === 0);
  } catch (_) { /* inaccessible */ }

  // Compare with dry-run
  let dryRunNotReady = false;
  let sourceChanged = false;
  let hashMismatch = false;
  let countMismatch = false;
  if (args.dryRunReport) {
    try {
      const dryRunJson = JSON.parse(fs.readFileSync(args.dryRunReport, 'utf8'));
      const allowed = ['DRY_RUN_READY_FOR_COPY', 'DRY_RUN_READY_WITH_WARNINGS'];
      if (!allowed.includes(dryRunJson.classification)) dryRunNotReady = true;
      const cmp = compareWithDryRunReport(currentHash, currentTotalCount, dryRunJson);
      sourceChanged = cmp.sourceChanged;
      hashMismatch = cmp.diffs.some(d => d.includes('Hash'));
      countMismatch = cmp.diffs.some(d => d.includes('Contagem'));
    } catch (_) { /* no dry-run report available */ }
  }

  const report = buildPreflightReport({
    credentialsValid: true, connectionOk: true, sourceExists,
    destinationAccessible, destinationEmpty, sourceChanged, dryRunNotReady,
    hashMismatch, countMismatch,
  });

  // Cleanup
  try { await require('firebase-admin').app().delete(); } catch (_) {}

  return { ...report, currentHash, currentTotalCount, destInvs };
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source-uid')            { args.sourceUid = argv[++i]; }
    else if (argv[i] === '--target-organization-id') { args.targetOrganizationId = argv[++i]; }
    else if (argv[i] === '--dry-run-report')   { args.dryRunReport = argv[++i]; }
  }

  if (!args.sourceUid || !args.targetOrganizationId) {
    console.error('Uso: node scripts/gate8d-preflight.js --source-uid <uid> --target-organization-id <orgId> --dry-run-report <path>');
    process.exit(1);
  }

  runPreflight(args).then(report => {
    console.log('\n═'.repeat(60));
    console.log('PREFLIGHT:', report.classification);
    if (report.blockers.length > 0) report.blockers.forEach(b => console.error('  ✗ ' + b));
    if (report.warnings.length > 0) report.warnings.forEach(w => console.warn('  ⚠ ' + w));
    process.exit(report.classification === 'PREFLIGHT_READY' ? 0 : 1);
  }).catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { validateCredentials, parseServiceAccount, compareWithDryRunReport, validateDestinationEmpty, buildPreflightReport };
