'use strict';

/**
 * ESA OS — Gate 8D: Backup antes da migração real (read-only)
 *
 * Gera backup local em backups/gate-8d/<timestamp>/
 *   source-energy-credits.json
 *   destination-organization.json
 *   source-hash.json
 *   destination-hash.json
 *   backup-manifest.json
 *
 * REGRAS:
 *   - Backup NUNCA commitado (backups/ no .gitignore)
 *   - PII preservada no backup (necessária para restauração)
 *   - Relatórios versionados usam valores mascarados
 *   - Backup deve ser validado imediatamente após criação
 *   - Qualquer falha na validação → PARAR SEM ESCREVER
 *
 * Uso:
 *   node scripts/gate8d-backup.js \
 *     --source-uid <uid> \
 *     --target-organization-id <orgId> \
 *     --backup-base-dir backups/gate-8d
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const { EC_MIGRATION_COLLECTIONS, maskUid, computeCollectionHash, inventoryCollection } = require('./migrate-energy-credits-to-organization');

// ── Manifest building ─────────────────────────────────────────────────────────

function buildBackupDir(baseDir, timestamp) {
  const ts = timestamp || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(baseDir, ts);
}

function buildBackupManifest(meta, sourceInv, destInv, gitCommit) {
  const now = meta.timestamp || new Date().toISOString();
  const colSummaries = sourceInv.map(inv => ({
    collection: inv.collection,
    count:      inv.count,
    hash:       inv.hash,
    sizeBytes:  inv.sizeBytes || 0,
  }));
  const sourceHash = crypto.createHash('sha256')
    .update(colSummaries.map(c => c.hash).join('|'), 'utf8').digest('hex');

  return {
    version:             '1.0',
    gate:                '8D',
    mode:                'backup-before-copy',
    timestamp:           now,
    gitCommit:           gitCommit || 'unknown',
    maskedSourceUid:     maskUid(meta.sourceUid),
    targetOrganizationId: meta.targetOrganizationId,
    operator:            meta.operator || process.env.USER || 'unknown',
    source: {
      totalCount:    colSummaries.reduce((s, c) => s + c.count, 0),
      totalSizeBytes: colSummaries.reduce((s, c) => s + c.sizeBytes, 0),
      sourceHash,
      collections:   colSummaries,
    },
    destination: {
      totalCount: (destInv || []).reduce((s, c) => s + (c.count || 0), 0),
      collections: (destInv || []).map(c => ({ collection: c.collection, count: c.count || 0 })),
    },
    files: {
      'source-energy-credits.json': null,
      'destination-organization.json': null,
      'source-hash.json': null,
      'destination-hash.json': null,
      'backup-manifest.json': null,
    },
    status: 'PENDING',
  };
}

function validateBackupManifest(manifest) {
  const errors = [];
  if (!manifest) { return { valid: false, errors: ['manifest é null'] }; }
  if (manifest.version !== '1.0') errors.push('version inválida');
  if (manifest.gate !== '8D') errors.push('gate inválido');
  if (!manifest.timestamp) errors.push('timestamp ausente');
  if (!manifest.maskedSourceUid) errors.push('maskedSourceUid ausente');
  if (!manifest.targetOrganizationId) errors.push('targetOrganizationId ausente');
  if (!manifest.source?.sourceHash) errors.push('source.sourceHash ausente');
  if (typeof manifest.source?.totalCount !== 'number') errors.push('source.totalCount inválido');
  if (!Array.isArray(manifest.source?.collections)) errors.push('source.collections inválido');
  if (manifest.source?.collections?.length !== EC_MIGRATION_COLLECTIONS.length)
    errors.push(`collections count: esperado ${EC_MIGRATION_COLLECTIONS.length}, encontrado ${manifest.source?.collections?.length}`);
  // Must NOT contain raw private_key
  const mStr = JSON.stringify(manifest);
  if (mStr.includes('-----BEGIN') || mStr.includes('private_key')) errors.push('manifest contém dados sensíveis (private_key)');
  return { valid: errors.length === 0, errors };
}

function validateBackupFiles(backupDir) {
  const required = [
    'source-energy-credits.json',
    'destination-organization.json',
    'source-hash.json',
    'destination-hash.json',
    'backup-manifest.json',
  ];
  const errors = [];
  const files  = {};

  for (const fname of required) {
    const fpath = path.join(backupDir, fname);
    if (!fs.existsSync(fpath)) {
      errors.push(`Arquivo ausente: ${fname}`);
      files[fname] = { exists: false };
      continue;
    }
    const stat = fs.statSync(fpath);
    if (stat.size === 0) { errors.push(`Arquivo vazio: ${fname}`); }
    try {
      const content = fs.readFileSync(fpath, 'utf8');
      JSON.parse(content); // must be valid JSON
      files[fname] = { exists: true, sizeBytes: stat.size, valid: true };
    } catch (_) {
      errors.push(`JSON inválido: ${fname}`);
      files[fname] = { exists: true, sizeBytes: stat.size, valid: false };
    }
  }

  return { valid: errors.length === 0, errors, files };
}

function sanitizeManifestForReport(manifest) {
  if (!manifest) return null;
  const copy = JSON.parse(JSON.stringify(manifest));
  // Remove any sensitive fields that might have leaked
  delete copy.privateKey;
  delete copy.serviceAccount;
  delete copy.credentials;
  return copy;
}

// ── Firebase I/O (execução real) ──────────────────────────────────────────────

async function createBackup(db, args, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });

  const sourcePath = `users/${args.sourceUid}/energyCredits`;
  const destPath   = `organizations/${args.targetOrganizationId}/energyCredits`;

  // Load source
  const sourceData = {};
  const sourceInventory = [];
  for (const col of EC_MIGRATION_COLLECTIONS) {
    const snap = await db.ref(`${sourcePath}/${col}`).once('value');
    sourceData[col] = snap.val() || null;
    sourceInventory.push(inventoryCollection(col, sourceData[col]));
  }

  // Load destination (expected empty — but snapshot for record)
  const destData = {};
  const destInventory = [];
  for (const col of EC_MIGRATION_COLLECTIONS) {
    const snap = await db.ref(`${destPath}/${col}`).once('value');
    destData[col] = snap.val() || null;
    destInventory.push({ collection: col, count: inventoryCollection(col, destData[col]).count });
  }

  // Source hash per collection
  const sourceHashes = {};
  for (const inv of sourceInventory) {
    sourceHashes[inv.collection] = inv.hash;
  }
  const globalSourceHash = crypto.createHash('sha256')
    .update(sourceInventory.map(i => i.hash).join('|'), 'utf8').digest('hex');

  // Destination hash
  const destHashes = {};
  for (const col of EC_MIGRATION_COLLECTIONS) {
    destHashes[col] = computeCollectionHash([]);
  }

  // Get git commit
  let gitCommit = 'unknown';
  try {
    gitCommit = require('child_process').execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().slice(0, 12);
  } catch (_) {}

  // Write backup files
  fs.writeFileSync(path.join(backupDir, 'source-energy-credits.json'), JSON.stringify(sourceData, null, 2), 'utf8');
  fs.writeFileSync(path.join(backupDir, 'destination-organization.json'), JSON.stringify(destData, null, 2), 'utf8');
  fs.writeFileSync(path.join(backupDir, 'source-hash.json'), JSON.stringify({ globalSourceHash, collections: sourceHashes }, null, 2), 'utf8');
  fs.writeFileSync(path.join(backupDir, 'destination-hash.json'), JSON.stringify({ collections: destHashes }, null, 2), 'utf8');

  const manifest = buildBackupManifest(
    { sourceUid: args.sourceUid, targetOrganizationId: args.targetOrganizationId, timestamp: new Date().toISOString() },
    sourceInventory,
    destInventory,
    gitCommit,
  );

  // Update file sizes in manifest
  for (const fname of Object.keys(manifest.files)) {
    const fpath = path.join(backupDir, fname === 'backup-manifest.json' ? fname : fname);
    if (fs.existsSync(path.join(backupDir, fname))) {
      manifest.files[fname] = { sizeBytes: fs.statSync(path.join(backupDir, fname)).size };
    }
  }
  manifest.status = 'WRITTEN';
  manifest.globalSourceHash = globalSourceHash;

  fs.writeFileSync(path.join(backupDir, 'backup-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  return { manifest, sourceInventory, destInventory, globalSourceHash };
}

async function validateBackup(backupDir, expectedHash) {
  const filesResult = validateBackupFiles(backupDir);
  if (!filesResult.valid) return { valid: false, errors: filesResult.errors };

  const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'backup-manifest.json'), 'utf8'));
  const manifestResult = validateBackupManifest(manifest);
  if (!manifestResult.valid) return { valid: false, errors: manifestResult.errors };

  const hashFile = JSON.parse(fs.readFileSync(path.join(backupDir, 'source-hash.json'), 'utf8'));
  if (expectedHash && hashFile.globalSourceHash !== expectedHash) {
    return { valid: false, errors: [`Hash do backup não confere: esperado ${expectedHash?.slice(0,16)}…`] };
  }

  // Verify source JSON parses and counts match
  const sourceJson = JSON.parse(fs.readFileSync(path.join(backupDir, 'source-energy-credits.json'), 'utf8'));
  const totalRecords = Object.values(sourceJson).reduce((s, v) =>
    s + (v && typeof v === 'object' ? Object.keys(v).length : 0), 0);

  if (totalRecords !== manifest.source.totalCount) {
    return { valid: false, errors: [`Contagem do backup não confere: manifest=${manifest.source.totalCount} arquivo=${totalRecords}`] };
  }

  return { valid: true, errors: [], manifest, totalRecords };
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source-uid')              { args.sourceUid = argv[++i]; }
    else if (argv[i] === '--target-organization-id') { args.targetOrganizationId = argv[++i]; }
    else if (argv[i] === '--backup-base-dir')    { args.backupBaseDir = argv[++i]; }
  }

  if (!args.sourceUid || !args.targetOrganizationId) {
    console.error('Uso: node scripts/gate8d-backup.js --source-uid <uid> --target-organization-id <orgId> --backup-base-dir backups/gate-8d');
    process.exit(1);
  }

  const { validateCredentials } = require('./gate8d-preflight');
  const credsResult = validateCredentials(process.env);
  if (!credsResult.valid) {
    console.error('BLOQUEADO: Credenciais inválidas');
    credsResult.errors.forEach(e => console.error('  ✗ ' + e));
    process.exit(1);
  }

  const admin = require('firebase-admin');
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const dbUrl = process.env.DATABASE_URL || 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: dbUrl });
  const db = admin.database();

  const backupDir = buildBackupDir(args.backupBaseDir || 'backups/gate-8d');

  createBackup(db, args, backupDir).then(async ({ manifest, globalSourceHash }) => {
    const vResult = await validateBackup(backupDir, globalSourceHash);
    if (!vResult.valid) {
      console.error('\nBAKUP INVÁLIDO — PARAR SEM ESCREVER');
      vResult.errors.forEach(e => console.error('  ✗ ' + e));
      process.exit(1);
    }
    console.log('\nBackup validado:', backupDir);
    console.log('Total registros:', manifest.source.totalCount);
    console.log('Hash origem:', globalSourceHash.slice(0, 16) + '…');
    try { await admin.app().delete(); } catch (_) {}
    process.exit(0);
  }).catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { buildBackupDir, buildBackupManifest, validateBackupManifest, validateBackupFiles, sanitizeManifestForReport, createBackup, validateBackup };
