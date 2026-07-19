'use strict';

/**
 * ESA OS — Gate 8E: Migration Marker Writer (idempotent, read-safe)
 *
 * Escreve o marker de migração em:
 *   organizations/{organizationId}/energyCredits/_migration
 *
 * Este marker sinaliza que o namespace organizacional está inicializado,
 * permitindo que energy-credits-data.js retorne dataSource:'organization'
 * mesmo quando zero registros operacionais foram copiados.
 *
 * Idempotente: não sobrescreve marker existente.
 * Sem PII: uid mascarado antes de gravar.
 * Sem credenciais hardcoded.
 *
 * Uso:
 *   node scripts/gate8e-write-migration-marker.js \
 *     --organization-id <orgId> \
 *     --source-uid <uid> \
 *     [--gate8d-report <path>]  \
 *     [--dry-run]
 */

const fs   = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskUid(uid) {
  if (!uid || uid.length < 6) return '***';
  return uid.slice(0, 4) + '****' + uid.slice(-4);
}

function loadGate8dReport(reportPath) {
  if (!reportPath) return null;
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return null;
  }
}

function buildMarker(args, gate8dReport) {
  const copiedRecords = gate8dReport?.destInventory?.totalCount ?? 0;
  const classification = gate8dReport?.classification ?? 'COPY_VERIFIED_WITH_WARNINGS';

  return {
    gate:             '8D',
    status:           'verified',
    sourceUidMasked:  maskUid(args.sourceUid),
    copiedRecords,
    classification,
    completedAt:      new Date().toISOString(),
    completedBy:      'migration',
    version:          1,
  };
}

// ── Firebase ──────────────────────────────────────────────────────────────────

async function writeMarker(args) {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.error('[GATE-8E-BLOCKED] FIREBASE_SERVICE_ACCOUNT_JSON não configurada.');
    return { classification: 'MARKER_WRITE_BLOCKED', reason: 'missing_credentials' };
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[GATE-8E-BLOCKED] DATABASE_URL não configurada.');
    return { classification: 'MARKER_WRITE_BLOCKED', reason: 'missing_database_url' };
  }

  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch {
    console.error('[GATE-8E-BLOCKED] FIREBASE_SERVICE_ACCOUNT_JSON: JSON malformado.');
    return { classification: 'MARKER_WRITE_BLOCKED', reason: 'invalid_credentials_json' };
  }

  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: dbUrl });
  }
  const db = admin.database();

  const markerPath = `organizations/${args.organizationId}/energyCredits/_migration`;
  const markerRef  = db.ref(markerPath);

  // Idempotency: não sobrescreve marker existente
  let existing;
  try {
    const snap = await markerRef.once('value');
    existing = snap.val();
  } catch (err) {
    console.error('[GATE-8E-BLOCKED] Erro ao ler marker existente:', err.message);
    try { await admin.app().delete(); } catch (_) {}
    return { classification: 'MARKER_WRITE_BLOCKED', reason: 'read_error' };
  }

  if (existing && existing.status === 'verified') {
    console.log('[GATE-8E] Marker já existe — idempotente. Nenhuma escrita realizada.');
    console.log('  Marker atual:', JSON.stringify({ ...existing, completedAt: existing.completedAt }));
    try { await admin.app().delete(); } catch (_) {}
    return { classification: 'MARKER_ALREADY_EXISTS', existing };
  }

  const gate8dReport = loadGate8dReport(args.gate8dReport);
  const marker       = buildMarker(args, gate8dReport);

  if (args.dryRun) {
    console.log('[GATE-8E] Dry-run — marker NÃO gravado.');
    console.log('  Path:   ', markerPath);
    console.log('  Marker: ', JSON.stringify(marker, null, 2));
    try { await admin.app().delete(); } catch (_) {}
    return { classification: 'MARKER_DRY_RUN', marker };
  }

  try {
    await markerRef.set(marker);
    console.log('[GATE-8E] Marker gravado com sucesso.');
    console.log('  Path:   ', markerPath);
    console.log('  Marker: ', JSON.stringify(marker, null, 2));
  } catch (err) {
    console.error('[GATE-8E-BLOCKED] Erro ao gravar marker:', err.message);
    try { await admin.app().delete(); } catch (_) {}
    return { classification: 'MARKER_WRITE_BLOCKED', reason: 'write_error', error: err.message };
  }

  try { await admin.app().delete(); } catch (_) {}
  return { classification: 'MARKER_WRITE_OK', marker };
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--organization-id') { args.organizationId = argv[++i]; }
    else if (argv[i] === '--source-uid')     { args.sourceUid = argv[++i]; }
    else if (argv[i] === '--gate8d-report')  { args.gate8dReport = argv[++i]; }
    else if (argv[i] === '--dry-run')        { args.dryRun = true; }
  }

  if (!args.organizationId || !args.sourceUid) {
    console.error('Uso: node scripts/gate8e-write-migration-marker.js --organization-id <orgId> --source-uid <uid> [--gate8d-report <path>] [--dry-run]');
    process.exit(1);
  }

  writeMarker(args).then(result => {
    console.log('\n═'.repeat(60));
    console.log('GATE-8E:', result.classification);
    const ok = ['MARKER_WRITE_OK', 'MARKER_ALREADY_EXISTS', 'MARKER_DRY_RUN'].includes(result.classification);
    process.exit(ok ? 0 : 1);
  }).catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { buildMarker, maskUid, loadGate8dReport };
