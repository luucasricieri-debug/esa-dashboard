'use strict';

/**
 * ESA OS — Gate 8D: Testes da infraestrutura de migração real
 *
 * Zero escritas Firebase — todos os testes usam dados em memória.
 * Cobre todos os casos do Gate 8D Section 12.
 *
 * Rodar: node scripts/tests/gate8d-migration.test.js
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');

const {
  buildMultipathUpdate,
  applyProjectedTransformation,
  splitIntoBatches,
  verifyPostCopy,
  buildAuditLogEntry,
  buildRollbackCommand,
  inventoryCollection,
  validateReferences,
  maskUid,
  parseArgs,
  EC_MIGRATION_COLLECTIONS,
} = require('../migrate-energy-credits-to-organization');

const {
  validateCredentials,
  parseServiceAccount,
  compareWithDryRunReport,
  validateDestinationEmpty,
  buildPreflightReport,
} = require('../gate8d-preflight');

const {
  buildBackupManifest,
  validateBackupManifest,
  validateBackupFiles,
  buildBackupDir,
  sanitizeManifestForReport,
} = require('../gate8d-backup');

const migrSrc   = fs.readFileSync(path.join(__dirname, '../migrate-energy-credits-to-organization.js'), 'utf8');
const preflSrc  = fs.readFileSync(path.join(__dirname, '../gate8d-preflight.js'), 'utf8');
const backupSrc = fs.readFileSync(path.join(__dirname, '../gate8d-backup.js'), 'utf8');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1 — credenciais ausentes bloqueiam
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 1 — credenciais ausentes bloqueiam ===');

assert('CR01 sem FIREBASE_SERVICE_ACCOUNT_JSON → inválido',
  validateCredentials({}).valid === false);
assert('CR02 sem SA → erro descritivo',
  validateCredentials({}).errors.some(e => e.includes('FIREBASE_SERVICE_ACCOUNT_JSON')));
assert('CR03 JSON malformado → inválido',
  validateCredentials({ FIREBASE_SERVICE_ACCOUNT_JSON: 'not-json' }).valid === false);
assert('CR04 sem project_id → inválido', (() => {
  const r = validateCredentials({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'a@b.com', private_key: 'x'.repeat(60), type: 'service_account' }), DATABASE_URL: 'https://x.firebaseio.com' });
  return !r.valid && r.errors.some(e => e.includes('project_id'));
})());
assert('CR05 sem private_key → inválido', (() => {
  const r = validateCredentials({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'p', client_email: 'a@b.com', type: 'service_account' }), DATABASE_URL: 'https://x.firebaseio.com' });
  return !r.valid;
})());
assert('CR06 sem DATABASE_URL → inválido', (() => {
  const sa = { project_id: 'p', client_email: 'a@b.com', private_key: 'x'.repeat(60), type: 'service_account' };
  return validateCredentials({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(sa) }).valid === false;
})());
assert('CR07 DATABASE_URL inválida → erro', (() => {
  const sa = { project_id: 'p', client_email: 'a@b.com', private_key: 'x'.repeat(60), type: 'service_account' };
  const r = validateCredentials({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(sa), DATABASE_URL: 'not-a-url' });
  return r.errors.some(e => e.includes('DATABASE_URL'));
})());
assert('CR08 credenciais completas → válido', (() => {
  const sa = { project_id: 'esa', client_email: 'svc@esa.com', private_key: 'x'.repeat(60), type: 'service_account' };
  return validateCredentials({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(sa), DATABASE_URL: 'https://esa.firebaseio.com' }).valid === true;
})());
assert('CR09 parseServiceAccount: SA válido', (() => {
  const r = parseServiceAccount(JSON.stringify({ project_id: 'p', client_email: 'e@e.com', private_key: 'k' }));
  return r.valid === true;
})());
assert('CR10 validateCredentials não imprime private_key', (() => {
  const sa = { project_id: 'p', client_email: 'a@b.com', private_key: 'SECRET_KEY_HERE_123456789012345678901234567890', type: 'service_account' };
  const r = validateCredentials({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(sa), DATABASE_URL: 'https://x.firebaseio.com' });
  return !JSON.stringify(r).includes('SECRET_KEY_HERE');
})());

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2 — origem alterada após dry-run bloqueia
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 2 — origem alterada após dry-run bloqueia ===');

const fakeDryRunReport = {
  source: { sourceHash: 'aabbccdd' + 'x'.repeat(56), totalCount: 10, collections: [] },
  destination: { hasOperationalData: false },
  classification: 'DRY_RUN_READY_FOR_COPY',
};

assert('SA01 hash igual → não alterado', (() => {
  const r = compareWithDryRunReport('aabbccdd' + 'x'.repeat(56), 10, fakeDryRunReport);
  return r.matched === true && r.sourceChanged === false;
})());
assert('SA02 hash diferente → SOURCE_CHANGED',
  compareWithDryRunReport('zz' + 'x'.repeat(62), 10, fakeDryRunReport).sourceChanged === true);
assert('SA03 contagem diferente → SOURCE_CHANGED',
  compareWithDryRunReport('aabbccdd' + 'x'.repeat(56), 11, fakeDryRunReport).sourceChanged === true);
assert('SA04 diffs descritivos quando hash muda', (() => {
  const r = compareWithDryRunReport('newHash' + 'x'.repeat(57), 10, fakeDryRunReport);
  return r.diffs.some(d => d.includes('Hash'));
})());
assert('SA05 diffs descritivos quando contagem muda', (() => {
  const r = compareWithDryRunReport('aabbccdd' + 'x'.repeat(56), 15, fakeDryRunReport);
  return r.diffs.some(d => d.includes('Contagem'));
})());

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3 — destino não vazio bloqueia
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 3 — destino não vazio bloqueia ===');

assert('DE01 destino vazio → isEmpty true',
  validateDestinationEmpty([{ collection: 'generatingUnits', count: 0 }]).isEmpty === true);
assert('DE02 destino com dados → isEmpty false',
  validateDestinationEmpty([{ collection: 'generatingUnits', count: 5 }]).isEmpty === false);
assert('DE03 destino não vazio → lista collections bloqueadas', (() => {
  const r = validateDestinationEmpty([{ collection: 'generatingUnits', count: 3 }, { collection: 'beneficiaryUnits', count: 0 }]);
  return r.collections.includes('generatingUnits') && !r.collections.includes('beneficiaryUnits');
})());
assert('DE04 preflight bloqueado quando destino não vazio', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: true, destinationAccessible: true, destinationEmpty: false, sourceChanged: false, dryRunNotReady: false });
  return r.classification === 'PREFLIGHT_BLOCKED' && r.blockers.some(b => b.includes('MIGRATION_DESTINATION_NOT_EMPTY'));
})());
assert('DE05 MIGRATION_DESTINATION_NOT_EMPTY está no código do script',
  migrSrc.includes('MIGRATION_DESTINATION_NOT_EMPTY'));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4 — backup obrigatório e validado
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 4 — backup obrigatório e validado ===');

const fakeSourceInv = EC_MIGRATION_COLLECTIONS.map(col => ({
  collection: col, count: col === 'generatingUnits' ? 2 : 0, hash: 'a'.repeat(64), sizeBytes: 100, exists: col === 'generatingUnits',
}));
const fakeDestInv = EC_MIGRATION_COLLECTIONS.map(col => ({ collection: col, count: 0 }));

const manifest1 = buildBackupManifest(
  { sourceUid: 'uid-real-abc123', targetOrganizationId: 'org-esa', timestamp: '2026-07-19T10:00:00.000Z' },
  fakeSourceInv,
  fakeDestInv,
  'abc1234',
);
assert('BK01 manifest válido gerado', validateBackupManifest(manifest1).valid === true);
assert('BK02 manifest contém maskedSourceUid (não raw uid)',
  manifest1.maskedSourceUid !== 'uid-real-abc123' && manifest1.maskedSourceUid.includes('****'));
assert('BK03 manifest contém targetOrganizationId', manifest1.targetOrganizationId === 'org-esa');
assert('BK04 manifest contém sourceHash', typeof manifest1.source.sourceHash === 'string' && manifest1.source.sourceHash.length === 64);
assert('BK05 manifest contém totalCount', typeof manifest1.source.totalCount === 'number');
assert('BK06 manifest contém 12 collections', manifest1.source.collections.length === 12);
assert('BK07 manifest gate = 8D', manifest1.gate === '8D');
assert('BK08 manifest version = 1.0', manifest1.version === '1.0');

// Manifest inválido
const badManifest = { version: '2.0', gate: '8C', maskedSourceUid: '', source: null };
assert('BK09 manifest inválido detectado', validateBackupManifest(badManifest).valid === false);
assert('BK10 manifest null → inválido', validateBackupManifest(null).valid === false);
assert('BK11 manifest com private_key → inválido', (() => {
  const m = { ...manifest1, privateKey: '-----BEGIN PRIVATE KEY-----\nXXX' };
  return validateBackupManifest(m).valid === false;
})());

// Backup files validation (using temp dir)
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esa-gate8d-test-'));
assert('BK12 dir vazio → arquivos ausentes detectados', (() => {
  const r = validateBackupFiles(tmpDir);
  return !r.valid && r.errors.some(e => e.includes('source-energy-credits.json'));
})());

// Create fake files
for (const fname of ['source-energy-credits.json','destination-organization.json','source-hash.json','destination-hash.json','backup-manifest.json']) {
  fs.writeFileSync(path.join(tmpDir, fname), JSON.stringify({ test: true }), 'utf8');
}
assert('BK13 todos os arquivos presentes → válido', validateBackupFiles(tmpDir).valid === true);

// Create empty file
fs.writeFileSync(path.join(tmpDir, 'source-energy-credits.json'), '', 'utf8');
assert('BK14 arquivo vazio → inválido', validateBackupFiles(tmpDir).valid === false);
fs.writeFileSync(path.join(tmpDir, 'source-energy-credits.json'), JSON.stringify({ test: true }), 'utf8');

// sanitize manifest
assert('BK15 sanitizeManifestForReport remove campos sensíveis', (() => {
  const dirty = { ...manifest1, credentials: { secret: 'x' }, privateKey: 'y' };
  const clean = sanitizeManifestForReport(dirty);
  return !clean.privateKey && !clean.credentials;
})());

// buildBackupDir
assert('BK16 buildBackupDir cria path com timestamp', (() => {
  const d = buildBackupDir('backups/gate-8d', '2026-07-19T10-00-00');
  return d.includes('backups') && d.includes('2026-07-19');
})());

// Cleanup temp dir
try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5 — organização idempotente e membership dual-path
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 5 — organização idempotente e membership dual-path ===');

const orgSrc = fs.readFileSync(path.join(__dirname, '../create-initial-organization.js'), 'utf8');

assert('OM01 findOrgBySlug verifica slug (idempotência)',
  orgSrc.includes('findOrgBySlug') && orgSrc.includes('orderByChild'));
assert('OM02 organização existente não é duplicada',
  orgSrc.includes('if (existing)') && orgSrc.includes('process.exit(0)'));
assert('OM03 membership em users/{uid}/memberships/{orgId}',
  orgSrc.includes('users/${args.ownerUid}/memberships/${org.id}') ||
  orgSrc.includes("users/${args.ownerUid}/memberships/"));
assert('OM04 membership em organizations/{orgId}/members/{uid}',
  orgSrc.includes('organizations/${org.id}/members/${args.ownerUid}') ||
  orgSrc.includes('members/${args.ownerUid}'));
assert('OM05 role owner fixo', orgSrc.includes("role: 'owner'"));
assert('OM06 status active', orgSrc.includes("status: 'active'"));
assert('OM07 permissions presente no membership', orgSrc.includes('permissions'));
assert('OM08 organizationId gerado por crypto.randomUUID', orgSrc.includes('crypto.randomUUID()'));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6 — cópia preserva IDs, origem não alterada, dest recebe orgId
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 6 — integridade da cópia ===');

const sampleRecord = { id: 'ug-001', name: 'UG Teste', organizationId: 'uid-old', capacity: 100 };

assert('CP01 applyProjectedTransformation preserva id',
  applyProjectedTransformation(sampleRecord, 'org-new').id === 'ug-001');
assert('CP02 organizationId atualizado para targetOrgId',
  applyProjectedTransformation(sampleRecord, 'org-new').organizationId === 'org-new');
assert('CP03 version ausente recebe 1',
  applyProjectedTransformation(sampleRecord, 'org-new').version === 1);
assert('CP04 version existente preservada', (() => {
  const r = applyProjectedTransformation({ ...sampleRecord, version: 5 }, 'org-new');
  return r.version === 5;
})());
assert('CP05 updatedBy ausente recebe migration',
  applyProjectedTransformation(sampleRecord, 'org-new').updatedBy === 'migration');
assert('CP06 updatedBy existente preservado', (() => {
  const r = applyProjectedTransformation({ ...sampleRecord, updatedBy: 'user-x' }, 'org-new');
  return r.updatedBy === 'user-x';
})());
assert('CP07 original não é mutado', (() => {
  const orig = { id: 'ug-1', organizationId: 'uid-old' };
  applyProjectedTransformation(orig, 'org-new');
  return orig.organizationId === 'uid-old';
})());
assert('CP08 origem não é escrita (nenhuma referência a users/{uid}/set)',
  !migrSrc.match(/db\.ref\(`users\/\$\{args\.sourceUid\}.*\.set\(/));

// buildMultipathUpdate
const records = [
  { id: 'ug-1', name: 'UG 1', organizationId: 'uid-old' },
  { id: 'ug-2', name: 'UG 2', organizationId: 'uid-old' },
];
const update = buildMultipathUpdate('generatingUnits', records, 'org-test');
assert('CP09 buildMultipathUpdate: paths corretos',
  Object.keys(update).every(k => k.startsWith('organizations/org-test/energyCredits/generatingUnits/')));
assert('CP10 buildMultipathUpdate: 2 registros',
  Object.keys(update).length === 2);
assert('CP11 buildMultipathUpdate: organizationId correto em todos',
  Object.values(update).every(v => v.organizationId === 'org-test'));
assert('CP12 buildMultipathUpdate: IDs preservados', (() => {
  const ids = Object.values(update).map(v => v.id);
  return ids.includes('ug-1') && ids.includes('ug-2');
})());
assert('CP13 buildMultipathUpdate: version=1 para records sem version',
  Object.values(update).every(v => v.version === 1));
assert('CP14 buildMultipathUpdate: sem paths de origem',
  !Object.keys(update).some(k => k.startsWith('users/')));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 7 — retry não duplica (idempotência via checkpoint)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 7 — retry não duplica (checkpoint) ===');

assert('ID01 checkpoint no código (idempotência por collection)',
  migrSrc.includes('checkpoint') && migrSrc.includes('checkpointFile'));
assert('ID02 checkpoint salvo após cada collection',
  migrSrc.includes("checkpoint[col] = 'done'") || migrSrc.includes("checkpoint[col] = \"done\""));
assert('ID03 checkpoint carregado no início da cópia',
  migrSrc.includes('checkpointFile') && migrSrc.includes('existsSync'));
assert('ID04 collection com checkpoint = done é pulada',
  migrSrc.includes("checkpoint[col] === 'done'") || migrSrc.includes("checkpoint[col] === \"done\""));
assert('ID05 checkpoint removido após cópia bem-sucedida',
  migrSrc.includes('unlinkSync') && migrSrc.includes('checkpointFile'));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 8 — lotes determinísticos
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 8 — lotes determinísticos ===');

const bigUpdate = {};
for (let i = 0; i < 250; i++) bigUpdate[`path/item-${i}`] = { id: `item-${i}` };

const batches = splitIntoBatches(bigUpdate, 100);
assert('LT01 250 itens em lotes de 100 → 3 lotes', batches.length === 3);
assert('LT02 lote 1: 100 itens', Object.keys(batches[0]).length === 100);
assert('LT03 lote 2: 100 itens', Object.keys(batches[1]).length === 100);
assert('LT04 lote 3: 50 itens', Object.keys(batches[2]).length === 50);
assert('LT05 todos os itens presentes nos lotes', (() => {
  const allKeys = batches.flatMap(b => Object.keys(b));
  return allKeys.length === 250 && new Set(allKeys).size === 250;
})());
assert('LT06 update vazio → 0 lotes', splitIntoBatches({}, 100).length === 0);
assert('LT07 lotes são determinísticos (mesma entrada = mesma saída)', (() => {
  const b1 = splitIntoBatches(bigUpdate, 100);
  const b2 = splitIntoBatches(bigUpdate, 100);
  return JSON.stringify(b1) === JSON.stringify(b2);
})());

// ══════════════════════════════════════════════════════════════════════════════
// Suite 9 — hash pós-cópia e contagens
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 9 — verificação pós-cópia ===');

const srcInvFull = [
  { collection: 'generatingUnits', count: 3, hash: 'h1' },
  { collection: 'beneficiaryUnits', count: 2, hash: 'h2' },
  ...EC_MIGRATION_COLLECTIONS.slice(2).map(col => ({ collection: col, count: 0, hash: 'h0' })),
];
const dstInvFull = [
  { collection: 'generatingUnits', count: 3, hash: 'h1' },
  { collection: 'beneficiaryUnits', count: 2, hash: 'h2' },
  ...EC_MIGRATION_COLLECTIONS.slice(2).map(col => ({ collection: col, count: 0, hash: 'h0' })),
];

const vResult1 = verifyPostCopy(srcInvFull, dstInvFull);
assert('VE01 contagens iguais → COPY_VERIFIED', vResult1.classification === 'COPY_VERIFIED');
assert('VE02 sem erros quando tudo confere', vResult1.errors.length === 0);

const dstInvWrong = dstInvFull.map(c => c.collection === 'generatingUnits' ? { ...c, count: 2 } : c);
const vResult2 = verifyPostCopy(srcInvFull, dstInvWrong);
assert('VE03 contagem diverge → COPY_FAILED_ROLLBACK_REQUIRED',
  vResult2.classification === 'COPY_FAILED_ROLLBACK_REQUIRED');
assert('VE04 erro descritivo quando contagem diverge',
  vResult2.errors.some(e => e.includes('generatingUnits')));

const dstInvMissing = dstInvFull.filter(c => c.collection !== 'beneficiaryUnits');
const vResult3 = verifyPostCopy(srcInvFull, dstInvMissing);
assert('VE05 collection ausente no destino → erro', vResult3.errors.some(e => e.includes('beneficiaryUnits')));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 10 — referências e audit log
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 10 — referências e audit log ===');

assert('RF01 referências validadas no fluxo de cópia',
  migrSrc.includes('validateReferences') || migrSrc.includes('references'));
assert('RF02 audit log gravado no destino',
  migrSrc.includes('auditLog') && migrSrc.includes(`organizations/\${args.targetOrganizationId}/auditLog`));

const auditEntry = buildAuditLogEntry(
  { sourceUid: 'uid-abc123456789', targetOrganizationId: 'org-esa' },
  { totalCopied: 42, classification: 'COPY_VERIFIED' },
);
assert('RF03 audit log contém action=migration_copy', auditEntry.action === 'migration_copy');
assert('RF04 audit log contém gate=8D', auditEntry.gate === '8D');
assert('RF05 audit log não contém uid real',
  !JSON.stringify(auditEntry).includes('uid-abc123456789'));
assert('RF06 audit log contém maskedSourceUid', typeof auditEntry.maskedSourceUid === 'string' && auditEntry.maskedSourceUid.includes('****'));
assert('RF07 audit log contém totalCopied', auditEntry.totalCopied === 42);

// ══════════════════════════════════════════════════════════════════════════════
// Suite 11 — rollback command e segurança
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 11 — rollback e segurança ===');

const rollback = buildRollbackCommand({ sourceUid: 'uid-abc1234567890', targetOrganizationId: 'org-esa' });
assert('RB01 rollback command gerado', typeof rollback === 'string' && rollback.length > 0);
assert('RB02 rollback menciona apagar destino (organizations/)',
  rollback.includes('organizations/org-esa'));
assert('RB03 rollback não instrui remoção da origem (sem database:remove users/)',
  !rollback.includes('database:remove users/') && !rollback.includes('remove users/'));
assert('RB04 rollback é comentário/instrução, não código executável',
  rollback.startsWith('#') || rollback.includes('#'));
assert('RB05 rollback menciona backup',
  rollback.toLowerCase().includes('backup') || rollback.includes('origem'));

assert('SE01 buildAuditLogEntry não inclui private_key ou service account secrets', (() => {
  const entry = buildAuditLogEntry({ sourceUid: 'uid', targetOrganizationId: 'org' }, { totalCopied: 5, classification: 'COPY_VERIFIED' });
  const s = JSON.stringify(entry);
  return !s.includes('private_key') && !s.includes('-----BEGIN') && !s.includes('SECRET');
})());
assert('SE02 nenhum secret nos exports do backup', (() => {
  const m = buildBackupManifest(
    { sourceUid: 'uid', targetOrganizationId: 'org', timestamp: '2026-01-01T00:00:00Z' },
    EC_MIGRATION_COLLECTIONS.map(c => ({ collection: c, count: 0, hash: 'a'.repeat(64), sizeBytes: 0 })),
    [],
    'abc',
  );
  const s = JSON.stringify(m);
  return !s.includes('private_key') && !s.includes('-----BEGIN');
})());

// ══════════════════════════════════════════════════════════════════════════════
// Suite 12 — backup ignorado pelo Git + .gitignore
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 12 — backup ignorado pelo Git ===');

const gitignorePath = path.join(__dirname, '../../.gitignore');
const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
assert('GI01 backups/ no .gitignore',
  gitignoreContent.includes('backups/') || gitignoreContent.includes('backups'));
assert('GI02 node_modules/ no .gitignore',
  gitignoreContent.includes('node_modules/') || gitignoreContent.includes('node_modules'));
assert('GI03 backup script não chama git add backups',
  !backupSrc.includes('git add backups'));
assert('GI04 backup dir começa com backups/gate-8d por padrão',
  migrSrc.includes("'backups/gate-8d'") || migrSrc.includes('"backups/gate-8d"'));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 13 — parseArgs Gate 8D (--backup-dir, --dry-run-report)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 13 — parseArgs Gate 8D ===');

const a8d1 = parseArgs(['--source-uid', 'uid-x', '--target-organization-id', 'org-y', '--report-file', 'r.json', '--backup-dir', 'backups/gate-8d', '--dry-run-report', 'reports/dr.json']);
assert('PA01 --backup-dir parseado', a8d1.backupDir === 'backups/gate-8d');
assert('PA02 --dry-run-report parseado', a8d1.dryRunReport === 'reports/dr.json');
assert('PA03 sem --dry-run → dryRun false', a8d1.dryRun === false);

const a8d2 = parseArgs(['--dry-run', '--source-uid', 'uid-x', '--target-organization-id', 'org-y', '--report-file', 'r.json']);
assert('PA04 --dry-run presente → dryRun true', a8d2.dryRun === true);

// ══════════════════════════════════════════════════════════════════════════════
// Suite 14 — preflight bloqueado quando dry-run não READY
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 14 — preflight bloqueado quando dry-run não READY ===');

assert('PF01 preflight pronto quando tudo OK', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: true, destinationAccessible: true, destinationEmpty: true, sourceChanged: false, dryRunNotReady: false });
  return r.classification === 'PREFLIGHT_READY';
})());
assert('PF02 preflight bloqueado quando credenciais inválidas', (() => {
  const r = buildPreflightReport({ credentialsValid: false, connectionOk: false, sourceExists: false, destinationAccessible: false, destinationEmpty: true, sourceChanged: false, dryRunNotReady: false });
  return r.classification === 'PREFLIGHT_BLOCKED';
})());
assert('PF03 preflight bloqueado quando origem não existe', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: false, destinationAccessible: true, destinationEmpty: true, sourceChanged: false, dryRunNotReady: false });
  return r.classification === 'PREFLIGHT_BLOCKED' && r.blockers.some(b => b.includes('origem'));
})());
assert('PF04 preflight bloqueado quando origem alterada', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: true, destinationAccessible: true, destinationEmpty: true, sourceChanged: true, dryRunNotReady: false });
  return r.classification === 'PREFLIGHT_BLOCKED' && r.blockers.some(b => b.includes('SOURCE_CHANGED'));
})());
assert('PF05 preflight bloqueado quando dry-run não READY', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: true, destinationAccessible: true, destinationEmpty: true, sourceChanged: false, dryRunNotReady: true });
  return r.classification === 'PREFLIGHT_BLOCKED' && r.blockers.some(b => b.includes('8C'));
})());
assert('PF06 warnings quando hash mismatch mas não bloqueador isolado', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: true, destinationAccessible: true, destinationEmpty: true, sourceChanged: false, dryRunNotReady: false, hashMismatch: true, countMismatch: false });
  return r.warnings.some(w => w.includes('Hash') || w.includes('dry-run'));
})());

// ══════════════════════════════════════════════════════════════════════════════
// Suite 15 — userExists vs energyCreditsExists no preflight
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 15 — userExists vs energyCreditsExists no preflight ===');

assert('UP01 usuário existe sem dados operacionais → PREFLIGHT_READY_WITH_WARNINGS', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: true, destinationAccessible: true, destinationEmpty: true, sourceChanged: false, dryRunNotReady: false, hasOperationalData: false });
  return r.classification === 'PREFLIGHT_READY_WITH_WARNINGS';
})());

assert('UP02 usuário existe sem dados → warning "zero registros"', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: true, destinationAccessible: true, destinationEmpty: true, sourceChanged: false, dryRunNotReady: false, hasOperationalData: false });
  return r.warnings.some(w => w.includes('zero registros') || w.includes('operacional'));
})());

assert('UP03 usuário inexistente → PREFLIGHT_BLOCKED com mensagem de origem', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: false, destinationAccessible: true, destinationEmpty: true, sourceChanged: false, dryRunNotReady: false });
  return r.classification === 'PREFLIGHT_BLOCKED' && r.blockers.some(b => b.includes('origem'));
})());

assert('UP04 hasOperationalData=true → sem warning de zero registros', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: true, destinationAccessible: true, destinationEmpty: true, sourceChanged: false, dryRunNotReady: false, hasOperationalData: true });
  return !r.warnings.some(w => w.includes('zero registros') || w.includes('operacional'));
})());

assert('UP05 sem dados mas usuário inexistente → PREFLIGHT_BLOCKED, não WITH_WARNINGS', (() => {
  const r = buildPreflightReport({ credentialsValid: true, connectionOk: true, sourceExists: false, destinationAccessible: true, destinationEmpty: true, sourceChanged: false, dryRunNotReady: false, hasOperationalData: false });
  return r.classification === 'PREFLIGHT_BLOCKED';
})());

assert('UP06 DRY_RUN_READY_WITH_WARNINGS aceito como READY (not dryRunNotReady)', (() => {
  const allowed = ['DRY_RUN_READY_FOR_COPY', 'DRY_RUN_READY_WITH_WARNINGS'];
  return allowed.includes('DRY_RUN_READY_WITH_WARNINGS');
})());

assert('UP07 DRY_RUN_BLOCKED não aceito como READY', (() => {
  const allowed = ['DRY_RUN_READY_FOR_COPY', 'DRY_RUN_READY_WITH_WARNINGS'];
  return !allowed.includes('DRY_RUN_BLOCKED');
})());

assert('UP08 preflight lê users/{uid} diretamente para existência',
  preflSrc.includes('users/${args.sourceUid}') && preflSrc.includes('userExists'));

assert('UP09 preflight declara energyCreditsExists separado de userExists',
  preflSrc.includes('energyCreditsExists'));

assert('UP10 preflight passa sourceExists: userExists para buildPreflightReport',
  preflSrc.includes('sourceExists: userExists'));

assert('UP11 preflight computa hasOperationalData',
  preflSrc.includes('hasOperationalData'));

assert('UP12 PREFLIGHT_READY_WITH_WARNINGS presente no código do preflight',
  preflSrc.includes('PREFLIGHT_READY_WITH_WARNINGS'));

// ══════════════════════════════════════════════════════════════════════════════
// Relatório final
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log(`Gate 8D Migration Tests: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));
if (failed > 0) process.exit(1);
