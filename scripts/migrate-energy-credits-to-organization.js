#!/usr/bin/env node
'use strict';

/**
 * ESA OS — Dry-Run de Migração de energyCredits — Gate 8C
 *
 * MODO DRY-RUN EXCLUSIVO nesta missão.
 * Escritas estão BLOQUEADAS. Gate 8D desbloqueará após backup verificado.
 *
 * Uso:
 *   node scripts/migrate-energy-credits-to-organization.js \
 *     --source-uid <uid>          UID do usuário no path users/{uid}/energyCredits/
 *     --target-organization-id <id>  ID da organização destino
 *     --dry-run                   OBRIGATÓRIO
 *     --report-file <path>        Caminho para o JSON de saída
 *     [--verify-only]             Apenas verifica; não projeta transformações
 *     [--include-collections c1,c2]  Apenas essas collections
 *     [--exclude-collections c1,c2]  Excluir essas collections
 *
 * Variáveis de ambiente:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — JSON da conta de serviço
 *   DATABASE_URL                   — URL do RTDB (opcional)
 *
 * Segurança:
 *   - Zero escritas no Firebase em dry-run
 *   - PII mascarada no relatório
 *   - Sem secrets em log
 *   - Firebase Admin exclusivo no script (nunca no browser)
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── Collections canônicas (espelho de energy-credits-validators.js) ────────────

const EC_MIGRATION_COLLECTIONS = [
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

// Campos proibidos espelhados dos validators
const FORBIDDEN_KEYS = new Set([
  'password', 'passHash', 'sessionToken', 'sessionExpiresAt',
  'serviceAccount', 'firebaseConfig', 'apiKey', 'secret',
  'stack', 'stackTrace', 'internalLog', 'downloadUrl',
]);

// Campos efêmeros excluídos do hash (não devem afetar equivalência)
const EPHEMERAL_FIELDS = new Set([
  '_requestId', '_migrationTimestamp', '_migrationBatch',
  'updatedAt', 'createdAt', // timestamps preservados mas excluídos do hash de identidade
]);

// Campos PII (mascarados no relatório)
const PII_FIELD_NAMES = new Set([
  'email', 'document', 'cpf', 'cnpj', 'phone', 'tel', 'cellphone',
  'pix', 'pixKey', 'token', 'sessionToken', 'bankAccount', 'iban',
]);

// Mapeamentos de referência cruzada conhecidos
const REFERENCE_MAP = {
  beneficiaryUnits:                  [{ field: 'ugId',              target: 'generatingUnits' },
                                      { field: 'generatingUnitId',   target: 'generatingUnits' }],
  generatingUnitMonthlyRecords:      [{ field: 'ugId',              target: 'generatingUnits' },
                                      { field: 'generatingUnitId',   target: 'generatingUnits' }],
  beneficiaryMonthlyRecords:         [{ field: 'ubId',              target: 'beneficiaryUnits' },
                                      { field: 'beneficiaryUnitId',  target: 'beneficiaryUnits' }],
  creditAllocations:                 [{ field: 'ugId',              target: 'generatingUnits' },
                                      { field: 'ubId',              target: 'beneficiaryUnits' }],
  ownerSettlements:                  [{ field: 'ugId',              target: 'generatingUnits' },
                                      { field: 'generatingUnitId',   target: 'generatingUnits' }],
  esaInvoices:                       [{ field: 'ubId',              target: 'beneficiaryUnits' },
                                      { field: 'beneficiaryUnitId',  target: 'beneficiaryUnits' }],
  beneficiaryCreditBalanceRecords:   [{ field: 'ubId',              target: 'beneficiaryUnits' },
                                      { field: 'beneficiaryUnitId',  target: 'beneficiaryUnits' }],
};

// ── Arg parsing ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dryRun: false, verifyOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run')     { args.dryRun = true; continue; }
    if (a === '--verify-only') { args.verifyOnly = true; continue; }
    if (a === '--source-uid')            { args.sourceUid = argv[++i]; continue; }
    if (a === '--target-organization-id'){ args.targetOrganizationId = argv[++i]; continue; }
    if (a === '--report-file')           { args.reportFile = argv[++i]; continue; }
    if (a === '--include-collections')   { args.includeCollections = (argv[++i] || '').split(',').filter(Boolean); continue; }
    if (a === '--exclude-collections')   { args.excludeCollections = (argv[++i] || '').split(',').filter(Boolean); continue; }
    if (a === '--backup-dir')            { args.backupDir = argv[++i]; continue; }
    if (a === '--dry-run-report')        { args.dryRunReport = argv[++i]; continue; }
  }
  return args;
}

function validateArgs(args) {
  const errors = [];
  if (!args.sourceUid || typeof args.sourceUid !== 'string') errors.push('--source-uid é obrigatório');
  if (!args.targetOrganizationId || typeof args.targetOrganizationId !== 'string') errors.push('--target-organization-id é obrigatório');
  if (!args.reportFile || typeof args.reportFile !== 'string') errors.push('--report-file é obrigatório');
  return errors;
}

// ── PII masking ────────────────────────────────────────────────────────────────

function maskPii(value, fieldName) {
  const name = (fieldName || '').toLowerCase();
  if (!PII_FIELD_NAMES.has(name)) return value;
  if (typeof value !== 'string') return '[REDACTED]';
  if (name === 'email') {
    const at = value.indexOf('@');
    if (at <= 0) return '[REDACTED]';
    return `${value[0]}***@${value.slice(at + 1, at + 2)}***.${value.split('.').pop()}`;
  }
  if (name === 'cpf' || name === 'document') {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 6) return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
  }
  if (name === 'pix' || name === 'pixKey') {
    if (value.length <= 8) return '[PIX_REDACTED]';
    return `${value.slice(0, 3)}***${value.slice(-3)}`;
  }
  if (typeof value === 'string' && value.length > 0) {
    return `${value[0]}${'*'.repeat(Math.min(value.length - 1, 6))}`;
  }
  return '[REDACTED]';
}

function maskUid(uid) {
  if (!uid || uid.length <= 8) return '****';
  return `${uid.slice(0, 4)}****${uid.slice(-4)}`;
}

// ── Hash computation ───────────────────────────────────────────────────────────

function normalizeForHash(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 15) return null;
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) {
    if (EPHEMERAL_FIELDS.has(k)) continue;
    if (obj[k] !== undefined && obj[k] !== null) {
      out[k] = normalizeForHash(obj[k], depth + 1);
    }
  }
  return out;
}

function computeObjectHash(obj) {
  const normalized = normalizeForHash(obj);
  const canonical = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function computeCollectionHash(records) {
  if (!Array.isArray(records) || records.length === 0) return crypto.createHash('sha256').update('empty', 'utf8').digest('hex');
  const sorted = [...records].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  const combined = sorted.map(r => computeObjectHash(r)).join('|');
  return crypto.createHash('sha256').update(combined, 'utf8').digest('hex');
}

// ── Inventory ─────────────────────────────────────────────────────────────────

function inventoryCollection(colName, rawData) {
  if (!rawData || typeof rawData !== 'object') {
    return {
      collection: colName,
      exists: false,
      count: 0,
      records: [],
      ids: [],
      sizeBytes: 0,
      hash: computeCollectionHash([]),
      invalidRecords: [],
      forbiddenKeyRecords: [],
      missingVersionRecords: [],
      missingOrganizationId: [],
    };
  }

  const entries = Array.isArray(rawData)
    ? rawData.filter(Boolean)
    : Object.values(rawData).filter(Boolean);

  const records = [];
  const ids = [];
  const invalidRecords = [];
  const forbiddenKeyRecords = [];
  const missingVersionRecords = [];
  const missingOrganizationId = [];

  for (const item of entries) {
    if (!item || typeof item !== 'object') {
      invalidRecords.push({ reason: 'null or non-object', item: String(item).slice(0, 50) });
      continue;
    }
    if (!item.id || typeof item.id !== 'string') {
      invalidRecords.push({ reason: 'missing or invalid id', id: item.id });
      continue;
    }
    ids.push(item.id);
    records.push(item);
    const forbiddenFound = Object.keys(item).filter(k => FORBIDDEN_KEYS.has(k));
    if (forbiddenFound.length > 0) forbiddenKeyRecords.push({ id: item.id, keys: forbiddenFound });
    if (item.version === undefined || item.version === null) missingVersionRecords.push(item.id);
    if (!item.organizationId) missingOrganizationId.push(item.id);
  }

  const sizeBytes = Buffer.byteLength(JSON.stringify(rawData || {}), 'utf8');

  return {
    collection: colName,
    exists: true,
    count: records.length,
    records, // only used internally for reference validation
    ids,
    sizeBytes,
    hash: computeCollectionHash(records),
    invalidRecords,
    forbiddenKeyRecords,
    missingVersionRecords,
    missingOrganizationId,
  };
}

// ── Reference validation ───────────────────────────────────────────────────────

function validateReferences(inventoryByCollection) {
  const idIndex = {};
  for (const [col, inv] of Object.entries(inventoryByCollection)) {
    idIndex[col] = new Set(inv.ids || []);
  }

  const results = [];
  for (const [col, patterns] of Object.entries(REFERENCE_MAP)) {
    const inv = inventoryByCollection[col];
    if (!inv || !inv.records) continue;
    for (const record of inv.records) {
      for (const { field, target } of patterns) {
        const refId = record[field];
        if (!refId || typeof refId !== 'string') continue;
        const targetSet = idIndex[target];
        if (!targetSet) {
          results.push({ from: col, fromId: record.id, field, target, refId, status: 'ambiguous' });
          continue;
        }
        const found = targetSet.has(refId);
        results.push({
          from: col, fromId: record.id, field, target, refId,
          status: found ? 'valid' : 'orphan',
        });
      }
    }
  }
  return results;
}

// ── Transformation projection ──────────────────────────────────────────────────

function projectTransformations(item, targetOrgId, sourceUid) {
  const projected = { ...item };
  const changes = [];

  if (projected.organizationId !== targetOrgId) {
    changes.push({ field: 'organizationId', from: projected.organizationId, to: targetOrgId });
    projected.organizationId = targetOrgId;
  }

  if (projected.version === undefined || projected.version === null) {
    changes.push({ field: 'version', from: undefined, to: 1 });
    projected.version = 1;
  }

  if (projected.updatedBy === undefined || projected.updatedBy === null) {
    changes.push({ field: 'updatedBy', from: undefined, to: 'migration' });
    projected.updatedBy = 'migration';
  }

  return { original: item, projected, changes };
}

// ── Classification ─────────────────────────────────────────────────────────────

function classifyMigration(report) {
  const blockers = [];
  const warnings = [];

  if (report.source.firebaseUnavailable) blockers.push('Firebase indisponível');
  if (!report.source.userExists) blockers.push(`Usuário origem não encontrado: ${report.source.maskedUid}`);
  if (report.destination.hasOperationalData) blockers.push('Destino já possui dados operacionais (MIGRATION_DESTINATION_NOT_EMPTY)');

  const totalInvalid = report.source.collections.reduce((s, c) => s + (c.invalidRecords?.length || 0), 0);
  const totalForbidden = report.source.collections.reduce((s, c) => s + (c.forbiddenKeyRecords?.length || 0), 0);
  const orphans = (report.references || []).filter(r => r.status === 'orphan');
  const totalCount = report.source.collections.reduce((s, c) => s + (c.count || 0), 0);

  if (totalInvalid > 0) warnings.push(`${totalInvalid} registro(s) inválido(s) na origem`);
  if (totalForbidden > 0) warnings.push(`${totalForbidden} registro(s) com chaves proibidas`);
  if (orphans.length > 0) warnings.push(`${orphans.length} referência(s) órfã(s) detectada(s)`);
  if (totalCount === 0) warnings.push('Origem não possui dados operacionais');

  const classification = blockers.length > 0
    ? 'DRY_RUN_BLOCKED'
    : warnings.length > 0
      ? 'DRY_RUN_READY_WITH_WARNINGS'
      : 'DRY_RUN_READY_FOR_COPY';

  return { classification, blockers, warnings };
}

// ── Firebase I/O ───────────────────────────────────────────────────────────────

function initFirebaseForScript() {
  const admin = require('firebase-admin');
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada');
  let serviceAccount;
  try { serviceAccount = JSON.parse(saJson); } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválida (JSON malformado)');
  }
  const databaseURL = process.env.DATABASE_URL || 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL });
  }
  return admin.database();
}

async function loadEnergyCreditsFromPath(db, basePath, collectionsToLoad) {
  const result = {};
  for (const col of collectionsToLoad) {
    try {
      const snap = await db.ref(`${basePath}/${col}`).once('value');
      result[col] = snap.val();
    } catch (err) {
      result[col] = null;
      result[`_err_${col}`] = err.message;
    }
  }
  return result;
}

// ── Report generation ─────────────────────────────────────────────────────────

function buildCollectionSummary(inv) {
  return {
    collection: inv.collection,
    exists: inv.exists,
    count: inv.count,
    ids: inv.ids,
    sizeBytes: inv.sizeBytes,
    hash: inv.hash,
    invalidRecords: inv.invalidRecords,
    forbiddenKeyRecords: inv.forbiddenKeyRecords.map(r => ({ id: r.id, keys: r.keys })),
    missingVersionCount: inv.missingVersionRecords.length,
    missingOrganizationIdCount: inv.missingOrganizationId.length,
  };
}

// ── Real-write helpers (Gate 8D) ───────────────────────────────────────────────

/**
 * Constrói o objeto de update multipath para uma collection.
 * Apenas leituras de `records`; nunca toca no path de origem.
 */
function buildMultipathUpdate(collection, records, targetOrgId) {
  const update = {};
  for (const record of records) {
    if (!record || !record.id) continue;
    const projected = applyProjectedTransformation(record, targetOrgId);
    update[`organizations/${targetOrgId}/energyCredits/${collection}/${record.id}`] = projected;
  }
  return update;
}

/**
 * Aplica transformação projetada a um registro: organizationId, version, updatedBy.
 * Não altera createdAt nem updatedAt originais.
 */
function applyProjectedTransformation(record, targetOrgId) {
  const projected = { ...record, organizationId: targetOrgId };
  if (projected.version === undefined || projected.version === null) projected.version = 1;
  if (projected.updatedBy === undefined || projected.updatedBy === null) projected.updatedBy = 'migration';
  return projected;
}

/**
 * Divide um objeto de update multipath em lotes de tamanho máximo `maxPaths`.
 * Cada lote é uma fatia determinística do update total.
 */
function splitIntoBatches(multipathUpdate, maxPaths) {
  const entries = Object.entries(multipathUpdate);
  if (entries.length === 0) return [];
  const batches = [];
  for (let i = 0; i < entries.length; i += maxPaths) {
    const batch = {};
    for (const [k, v] of entries.slice(i, i + maxPaths)) batch[k] = v;
    batches.push(batch);
  }
  return batches;
}

/**
 * Verifica post-cópia: contagens e hashes de origem vs. destino.
 */
function verifyPostCopy(sourceInv, destInv, expectedSourceHash) {
  const errors = [];
  const warnings = [];

  const srcTotal = sourceInv.reduce((s, c) => s + c.count, 0);
  const dstTotal = destInv.reduce((s, c) => s + c.count, 0);
  if (srcTotal !== dstTotal) errors.push(`Contagem total diverge: origem=${srcTotal} destino=${dstTotal}`);

  for (const srcCol of sourceInv) {
    const dstCol = destInv.find(c => c.collection === srcCol.collection);
    if (!dstCol) { errors.push(`Collection ausente no destino: ${srcCol.collection}`); continue; }
    if (srcCol.count !== dstCol.count) {
      errors.push(`${srcCol.collection}: origem=${srcCol.count} destino=${dstCol.count}`);
    }
  }

  const classification = errors.length > 0
    ? 'COPY_FAILED_ROLLBACK_REQUIRED'
    : warnings.length > 0
      ? 'COPY_VERIFIED_WITH_WARNINGS'
      : 'COPY_VERIFIED';

  return { classification, errors, warnings };
}

/**
 * Constrói entrada de audit log para a migração.
 */
function buildAuditLogEntry(args, result) {
  return {
    id:                 `migration_${Date.now()}`,
    action:             'migration_copy',
    gate:               '8D',
    maskedSourceUid:    maskUid(args.sourceUid),
    targetOrganizationId: args.targetOrganizationId,
    totalCopied:        result.totalCopied || 0,
    classification:     result.classification || 'unknown',
    timestamp:          new Date().toISOString(),
    mode:               'copy',
  };
}

/**
 * Gera o comando de rollback (não o executa).
 */
function buildRollbackCommand(args) {
  return `# Rollback Gate 8D — executar SOMENTE se COPY_FAILED_ROLLBACK_REQUIRED\n` +
    `# Origem preservada em users/${maskUid(args.sourceUid)}/energyCredits/ — intacta\n` +
    `# Apagar APENAS o destino criado pelo script:\n` +
    `firebase database:remove organizations/${args.targetOrganizationId}/energyCredits/ --project <PROJECT_ID>\n` +
    `# Verificar que origem ainda intacta antes de qualquer re-tentativa.\n` +
    `# NÃO apagar a organização se ela já existia antes da migração.`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Gate 8D: escrita real permitida quando --dry-run ausente
  if (!args.dryRun) {
    return mainCopy(args);
  }

  const argErrors = validateArgs(args);
  if (argErrors.length > 0) {
    argErrors.forEach(e => console.error('ERRO: ' + e));
    console.error('\nUso: node scripts/migrate-energy-credits-to-organization.js \\');
    console.error('  --source-uid <uid> --target-organization-id <id> \\');
    console.error('  --dry-run --report-file <path>');
    process.exit(1);
  }

  // Resolver collections ativas
  const allCollections = EC_MIGRATION_COLLECTIONS;
  let collectionsToProcess = allCollections;
  if (args.includeCollections && args.includeCollections.length > 0) {
    collectionsToProcess = allCollections.filter(c => args.includeCollections.includes(c));
  }
  if (args.excludeCollections && args.excludeCollections.length > 0) {
    collectionsToProcess = collectionsToProcess.filter(c => !args.excludeCollections.includes(c));
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('ESA OS — Dry-Run de Migração Organizacional — Gate 8C');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`MODO: DRY-RUN — nenhuma escrita será realizada`);
  console.log(`Origem: users/${maskUid(args.sourceUid)}/energyCredits/`);
  console.log(`Destino: organizations/${args.targetOrganizationId}/energyCredits/`);
  console.log(`Collections: ${collectionsToProcess.join(', ')}`);
  console.log('');

  const reportTimestamp = new Date().toISOString();
  const report = {
    meta: {
      tool: 'migrate-energy-credits-to-organization.js',
      gate: '8C',
      mode: 'dry-run',
      timestamp: reportTimestamp,
      maskedSourceUid: maskUid(args.sourceUid),
      targetOrganizationId: args.targetOrganizationId,
      collectionsProcessed: collectionsToProcess,
    },
    source: {
      maskedUid: maskUid(args.sourceUid),
      userExists: false,
      firebaseUnavailable: false,
      collections: [],
      totalCount: 0,
      totalSizeBytes: 0,
      sourceHash: '',
    },
    destination: {
      organizationId: args.targetOrganizationId,
      hasOperationalData: false,
      collections: [],
      totalCount: 0,
    },
    references: [],
    projectedTransformations: [],
    classification: 'DRY_RUN_BLOCKED',
    blockers: [],
    warnings: [],
    risks: [
      'Dados legados sem campo version serão criados com version=1 na org path',
      'organizationId será sobrescrito pelo targetOrganizationId',
      'Timestamps originais serão preservados',
      'IDs preservados — sem risco de colisão se destino estiver vazio',
    ],
    backupPlan: {
      note: 'Backup será executado no Gate 8D antes da cópia real',
      sourcePath: `users/${maskUid(args.sourceUid)}/energyCredits/`,
      destinationPath: `organizations/${args.targetOrganizationId}/energyCredits/`,
      retentionDays: 30,
      verificationCommand: 'node scripts/verify-migration-backup.js --hash-file backup-hashes.json',
    },
    recommendation: '',
  };

  // Conectar Firebase
  let db;
  try {
    db = initFirebaseForScript();
    console.log('Firebase conectado.');
  } catch (err) {
    console.error('Firebase indisponível:', err.message);
    report.source.firebaseUnavailable = true;
    report.blockers.push('Firebase indisponível: ' + err.message);
    report.classification = 'DRY_RUN_BLOCKED';
    report.recommendation = 'Configure FIREBASE_SERVICE_ACCOUNT_JSON e re-execute o dry-run.';
    writeReport(args.reportFile, report);
    process.exit(0);
  }

  // ── Inventário da ORIGEM ──────────────────────────────────────────────────────
  console.log('\n[1/4] Inventariando origem...');
  const sourceBasePath = `users/${args.sourceUid}/energyCredits`;
  const sourceRaw = await loadEnergyCreditsFromPath(db, sourceBasePath, collectionsToProcess);

  // Verificar se o usuário existe (ao menos uma collection com dados)
  const hasAnySource = collectionsToProcess.some(c => sourceRaw[c] !== null);
  report.source.userExists = hasAnySource;

  const inventoryByCollection = {};
  for (const col of collectionsToProcess) {
    const inv = inventoryCollection(col, sourceRaw[col]);
    inventoryByCollection[col] = inv;
    report.source.collections.push(buildCollectionSummary(inv));
    if (inv.count > 0) {
      console.log(`  ✓ ${col}: ${inv.count} registro(s), ${(inv.sizeBytes / 1024).toFixed(1)} KB`);
    } else {
      console.log(`  – ${col}: vazia`);
    }
  }

  report.source.totalCount = report.source.collections.reduce((s, c) => s + c.count, 0);
  report.source.totalSizeBytes = report.source.collections.reduce((s, c) => s + c.sizeBytes, 0);

  // Hash da origem (todas as collections combinadas)
  const sourceHashes = report.source.collections.map(c => c.hash).join('|');
  report.source.sourceHash = crypto.createHash('sha256').update(sourceHashes, 'utf8').digest('hex');

  // ── Inventário do DESTINO ─────────────────────────────────────────────────────
  console.log('\n[2/4] Inventariando destino...');
  const destBasePath = `organizations/${args.targetOrganizationId}/energyCredits`;
  const destRaw = await loadEnergyCreditsFromPath(db, destBasePath, collectionsToProcess);

  for (const col of collectionsToProcess) {
    const inv = inventoryCollection(col, destRaw[col]);
    report.destination.collections.push(buildCollectionSummary(inv));
    if (inv.count > 0) {
      console.log(`  ! ${col}: ${inv.count} registro(s) JÁ NO DESTINO`);
    } else {
      console.log(`  ✓ ${col}: vazia`);
    }
  }

  report.destination.totalCount = report.destination.collections.reduce((s, c) => s + c.count, 0);
  report.destination.hasOperationalData = report.destination.totalCount > 0;
  if (report.destination.hasOperationalData) {
    console.log('\n  ⚠ ATENÇÃO: Destino não está vazio → MIGRATION_DESTINATION_NOT_EMPTY');
  }

  // ── Validação de referências cruzadas ─────────────────────────────────────────
  console.log('\n[3/4] Validando referências cruzadas...');
  report.references = validateReferences(inventoryByCollection);
  const orphans = report.references.filter(r => r.status === 'orphan');
  const valid   = report.references.filter(r => r.status === 'valid');
  console.log(`  Referências válidas: ${valid.length}`);
  if (orphans.length > 0) {
    console.log(`  Referências órfãs: ${orphans.length}`);
    orphans.slice(0, 10).forEach(o =>
      console.log(`    – ${o.from}[${o.fromId}].${o.field} → ${o.target}[${o.refId}] AUSENTE`)
    );
  }

  // ── Transformações projetadas ─────────────────────────────────────────────────
  if (!args.verifyOnly) {
    console.log('\n[4/4] Projetando transformações...');
    for (const col of collectionsToProcess) {
      const inv = inventoryByCollection[col];
      if (!inv || inv.count === 0) continue;
      for (const record of inv.records.slice(0, 3)) { // Amostra de 3 por collection
        const proj = projectTransformations(record, args.targetOrganizationId, args.sourceUid);
        if (proj.changes.length > 0) {
          report.projectedTransformations.push({
            collection: col,
            id: record.id,
            changes: proj.changes,
          });
        }
      }
    }
    const totalChanged = report.projectedTransformations.length;
    console.log(`  ${totalChanged} registro(s) amostrados com transformações projetadas`);
  }

  // ── Classificação ─────────────────────────────────────────────────────────────
  const { classification, blockers, warnings } = classifyMigration(report);
  report.classification = classification;
  report.blockers = blockers;
  report.warnings = warnings;

  if (classification === 'DRY_RUN_READY_FOR_COPY') {
    report.recommendation = 'Origine está pronta para migração. Execute backup verificado no Gate 8D antes da cópia real.';
  } else if (classification === 'DRY_RUN_READY_WITH_WARNINGS') {
    report.recommendation = 'Revise os warnings antes de prosseguir. Origem tem dados mas há inconsistências menores. Backup obrigatório antes da cópia real.';
  } else {
    report.recommendation = 'Bloqueadores encontrados. Resolva antes de tentar migração real.';
  }

  // ── Salvar relatório ──────────────────────────────────────────────────────────
  writeReport(args.reportFile, report);

  // ── Sumário final ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('RELATÓRIO FINAL DO DRY-RUN');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Classificação: ${classification}`);
  console.log(`Registros na origem: ${report.source.totalCount}`);
  console.log(`Tamanho da origem: ${(report.source.totalSizeBytes / 1024).toFixed(1)} KB`);
  console.log(`Hash da origem: ${report.source.sourceHash.slice(0, 16)}...`);
  console.log(`Registros no destino: ${report.destination.totalCount}`);
  console.log(`Referências órfãs: ${orphans.length}`);
  if (blockers.length > 0) {
    console.log('\nBloqueadores:');
    blockers.forEach(b => console.log(`  ✗ ${b}`));
  }
  if (warnings.length > 0) {
    console.log('\nAlertas:');
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }
  console.log(`\nRecomendação: ${report.recommendation}`);
  console.log(`\nRelatório salvo em: ${args.reportFile}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await admin_terminate();
  process.exit(0);
}

// ── Copy execution (Gate 8D real path) ────────────────────────────────────────

async function mainCopy(args) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('ESA OS — Migração Real para Organização — Gate 8D');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`MODO: CÓPIA REAL`);
  console.log(`Origem: users/${maskUid(args.sourceUid)}/energyCredits/`);
  console.log(`Destino: organizations/${args.targetOrganizationId}/energyCredits/`);

  const argErrors = validateArgs(args);
  if (argErrors.length > 0) {
    argErrors.forEach(e => console.error('ERRO: ' + e));
    process.exit(1);
  }

  // ── 0. Validar credenciais ────────────────────────────────────────────────────
  const { validateCredentials } = require('./gate8d-preflight');
  const credsResult = validateCredentials(process.env);
  if (!credsResult.valid) {
    console.error('\n[GATE-8D-BLOCKED] Credenciais inválidas:');
    credsResult.errors.forEach(e => console.error('  ✗ ' + e));
    process.exit(1);
  }

  // ── 1. Conectar Firebase ──────────────────────────────────────────────────────
  let db;
  try {
    db = initFirebaseForScript();
    console.log('\n[1/8] Firebase conectado.');
  } catch (err) {
    console.error('[GATE-8D-BLOCKED] Firebase indisponível:', err.message);
    process.exit(1);
  }

  // ── 2. Preflight ──────────────────────────────────────────────────────────────
  console.log('[2/8] Verificando pré-condições...');

  // Source inventory
  const sourceBasePath = `users/${args.sourceUid}/energyCredits`;
  const sourceRaw = await loadEnergyCreditsFromPath(db, sourceBasePath, EC_MIGRATION_COLLECTIONS);
  const sourceInvs = EC_MIGRATION_COLLECTIONS.map(col => inventoryCollection(col, sourceRaw[col]));
  const srcTotal = sourceInvs.reduce((s, c) => s + c.count, 0);

  if (srcTotal === 0) {
    console.error('[GATE-8D-BLOCKED] Origem vazia — usuário não encontrado ou sem dados.');
    process.exit(1);
  }

  // Destination check
  const destBasePath = `organizations/${args.targetOrganizationId}/energyCredits`;
  const destRaw = await loadEnergyCreditsFromPath(db, destBasePath, EC_MIGRATION_COLLECTIONS);
  const destInvs = EC_MIGRATION_COLLECTIONS.map(col => inventoryCollection(col, destRaw[col]));
  const dstTotal = destInvs.reduce((s, c) => s + c.count, 0);

  if (dstTotal > 0) {
    console.error(`[GATE-8D-BLOCKED] Destino não está vazio (${dstTotal} registros) — MIGRATION_DESTINATION_NOT_EMPTY`);
    process.exit(1);
  }

  // Dry-run report check
  if (args.dryRunReport) {
    try {
      const { compareWithDryRunReport } = require('./gate8d-preflight');
      const dryRunJson = JSON.parse(require('fs').readFileSync(args.dryRunReport, 'utf8'));
      const allowed = ['DRY_RUN_READY_FOR_COPY', 'DRY_RUN_READY_WITH_WARNINGS'];
      if (!allowed.includes(dryRunJson.classification)) {
        console.error(`[GATE-8D-BLOCKED] Gate 8C classificado como ${dryRunJson.classification} — deve ser READY_FOR_COPY`);
        process.exit(1);
      }
      const srcHashes = sourceInvs.map(i => i.hash).join('|');
      const currentHash = require('crypto').createHash('sha256').update(srcHashes, 'utf8').digest('hex');
      const cmp = compareWithDryRunReport(currentHash, srcTotal, dryRunJson);
      if (cmp.sourceChanged) {
        console.error('[GATE-8D-BLOCKED] SOURCE_CHANGED_SINCE_DRY_RUN:');
        cmp.diffs.forEach(d => console.error('  ✗ ' + d));
        process.exit(1);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') { console.error('[GATE-8D-BLOCKED]', err.message); process.exit(1); }
    }
  }

  console.log(`  Origem: ${srcTotal} registros | Destino: ${dstTotal} registros (vazio ✓)`);

  // ── 3. Backup obrigatório ─────────────────────────────────────────────────────
  console.log('[3/8] Criando backup...');
  const { createBackup, validateBackup, buildBackupDir } = require('./gate8d-backup');
  const backupBaseDir = args.backupDir || 'backups/gate-8d';
  const backupDir = buildBackupDir(backupBaseDir, new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  const { manifest: backupManifest, globalSourceHash } = await createBackup(db, args, backupDir);
  const backupValidation = await validateBackup(backupDir, globalSourceHash);
  if (!backupValidation.valid) {
    console.error('[GATE-8D-BLOCKED] Backup inválido:');
    backupValidation.errors.forEach(e => console.error('  ✗ ' + e));
    process.exit(1);
  }
  console.log(`  Backup válido: ${backupDir}`);
  console.log(`  Hash origem: ${globalSourceHash.slice(0, 16)}…`);

  // ── 4. Copiar dados em lotes ──────────────────────────────────────────────────
  console.log('[4/8] Copiando dados...');
  const BATCH_SIZE = 100;
  const checkpointFile = `${args.reportFile}.checkpoint.json`;
  let checkpoint = {};
  if (require('fs').existsSync(checkpointFile)) {
    try { checkpoint = JSON.parse(require('fs').readFileSync(checkpointFile, 'utf8')); } catch (_) {}
  }

  let totalCopied = 0;
  let batchIndex = 0;
  const copyErrors = [];

  for (const col of EC_MIGRATION_COLLECTIONS) {
    if (checkpoint[col] === 'done') {
      totalCopied += sourceInvs.find(i => i.collection === col)?.count || 0;
      console.log(`  ✓ ${col}: já copiado (checkpoint)`);
      continue;
    }
    const inv = sourceInvs.find(i => i.collection === col);
    if (!inv || inv.count === 0) { console.log(`  – ${col}: vazia`); continue; }

    const update = buildMultipathUpdate(col, inv.records, args.targetOrganizationId);
    const batches = splitIntoBatches(update, BATCH_SIZE);

    try {
      for (const batch of batches) {
        await db.ref('/').update(batch);
        batchIndex++;
      }
      checkpoint[col] = 'done';
      require('fs').writeFileSync(checkpointFile, JSON.stringify(checkpoint), 'utf8');
      totalCopied += inv.count;
      console.log(`  ✓ ${col}: ${inv.count} registro(s) copiados`);
    } catch (err) {
      copyErrors.push(`${col}: ${err.message}`);
      console.error(`  ✗ ${col}: FALHA — ${err.message}`);
    }
  }

  if (copyErrors.length > 0) {
    console.error('[GATE-8D-BLOCKED] Falhas na cópia — ver rollback abaixo');
    const rollbackCmd = buildRollbackCommand(args);
    console.error('\nROLLBACK:\n' + rollbackCmd);
    process.exit(1);
  }

  // ── 5. Audit log de migração ──────────────────────────────────────────────────
  const auditEntry = buildAuditLogEntry(args, { totalCopied, classification: 'pending-verification' });
  try {
    await db.ref(`organizations/${args.targetOrganizationId}/auditLog/${auditEntry.id}`).set(auditEntry);
    console.log('[5/8] Audit log registrado.');
  } catch (_) { console.warn('[5/8] Audit log falhou (best-effort).'); }

  // ── 6. Verificação pós-cópia ──────────────────────────────────────────────────
  console.log('[6/8] Verificando destino...');
  const destRawPost = await loadEnergyCreditsFromPath(db, destBasePath, EC_MIGRATION_COLLECTIONS);
  const destInvsPost = EC_MIGRATION_COLLECTIONS.map(col => inventoryCollection(col, destRawPost[col]));
  const verification = verifyPostCopy(sourceInvs, destInvsPost, globalSourceHash);
  console.log(`  Classificação: ${verification.classification}`);
  if (verification.errors.length > 0) verification.errors.forEach(e => console.error('  ✗ ' + e));

  // ── 7. Verificar que origem não foi alterada ───────────────────────────────────
  console.log('[7/8] Confirmando integridade da origem...');
  const sourceRawPost = await loadEnergyCreditsFromPath(db, sourceBasePath, EC_MIGRATION_COLLECTIONS);
  const sourceInvsPost = EC_MIGRATION_COLLECTIONS.map(col => inventoryCollection(col, sourceRawPost[col]));
  const srcTotalPost = sourceInvsPost.reduce((s, c) => s + c.count, 0);
  if (srcTotalPost !== srcTotal) {
    console.error(`[GATE-8D-CRITICAL] Origem alterada: antes=${srcTotal} depois=${srcTotalPost}`);
  } else {
    console.log(`  Origem intacta: ${srcTotal} registros (✓)`);
  }

  // ── 8. Gerar relatório final ──────────────────────────────────────────────────
  console.log('[8/8] Gerando relatório...');
  const report = {
    meta: { tool: 'migrate-energy-credits-to-organization.js', gate: '8D', mode: 'copy', timestamp: new Date().toISOString(),
      maskedSourceUid: maskUid(args.sourceUid), targetOrganizationId: args.targetOrganizationId },
    preflight:  { srcTotal, dstTotal: 0, credentialsValid: true, destinationEmpty: true },
    backup:     { dir: backupDir, valid: true, globalSourceHash },
    copy:       { totalCopied, batchCount: batchIndex, errors: copyErrors },
    verification,
    auditLog:   { id: auditEntry.id, recorded: true },
    classification: verification.classification,
    rollbackCommand: buildRollbackCommand(args),
    originIntact: srcTotalPost === srcTotal,
    source: {
      maskedUid: maskUid(args.sourceUid),
      totalCount: srcTotal,
      collections: sourceInvs.map(i => ({ collection: i.collection, count: i.count, hash: i.hash })),
    },
    destination: {
      organizationId: args.targetOrganizationId,
      totalCount: destInvsPost.reduce((s, c) => s + c.count, 0),
      collections: destInvsPost.map(i => ({ collection: i.collection, count: i.count, hash: i.hash })),
    },
  };

  writeReport(args.reportFile, report);
  console.log(`\nRelatório: ${args.reportFile}`);
  console.log(`Classificação: ${verification.classification}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Remove checkpoint on success
  if (verification.classification !== 'COPY_FAILED_ROLLBACK_REQUIRED') {
    try { require('fs').unlinkSync(checkpointFile); } catch (_) {}
  }

  await admin_terminate();
  process.exit(verification.classification === 'COPY_FAILED_ROLLBACK_REQUIRED' ? 1 : 0);
}

function writeReport(reportFile, report) {
  const dir = path.dirname(path.resolve(reportFile));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
}

async function admin_terminate() {
  try {
    const admin = require('firebase-admin');
    if (admin.apps.length > 0) await admin.app().delete();
  } catch (_) { /* best-effort */ }
}

// ── Exports para testabilidade ────────────────────────────────────────────────

module.exports = {
  parseArgs,
  validateArgs,
  maskPii,
  maskUid,
  normalizeForHash,
  computeObjectHash,
  computeCollectionHash,
  inventoryCollection,
  validateReferences,
  projectTransformations,
  classifyMigration,
  buildMultipathUpdate,
  applyProjectedTransformation,
  splitIntoBatches,
  verifyPostCopy,
  buildAuditLogEntry,
  buildRollbackCommand,
  EC_MIGRATION_COLLECTIONS,
  FORBIDDEN_KEYS,
  PII_FIELD_NAMES,
};

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  main().catch(err => {
    console.error('FATAL:', err.message || String(err));
    process.exit(1);
  });
}
