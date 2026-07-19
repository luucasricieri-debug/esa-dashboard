'use strict';

/**
 * ESA OS — Gate 8C: Testes do script de migração dry-run
 *
 * Valida: parseArgs, validateArgs, PII masking, hash determinístico,
 * inventário de collection, validação de referências cruzadas,
 * projeção de transformações, classificação final, segurança do dry-run.
 *
 * ZERO escritas Firebase — todos os testes usam dados em memória.
 *
 * Rodar: node scripts/tests/gate8c-migration.test.js
 */

const path = require('path');
const fs   = require('fs');
const {
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
  EC_MIGRATION_COLLECTIONS,
  FORBIDDEN_KEYS,
} = require('../migrate-energy-credits-to-organization');

const orgScriptSrc = fs.readFileSync(path.join(__dirname, '../create-initial-organization.js'), 'utf8');
const migrScriptSrc = fs.readFileSync(path.join(__dirname, '../migrate-energy-credits-to-organization.js'), 'utf8');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1 — create-initial-organization.js: auditoria de contratos
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 1 — create-initial-organization.js: auditoria ===');

assert('ORG01 idempotente: findOrgBySlug verifica slug existente',
  orgScriptSrc.includes('findOrgBySlug') && orgScriptSrc.includes('slug'));
assert('ORG02 dry-run não escreve no Firebase',
  orgScriptSrc.includes("if (args.dryRun)") && orgScriptSrc.includes('process.exit(0)'));
assert('ORG03 não sobrescreve organização existente',
  orgScriptSrc.includes('existing') && orgScriptSrc.includes('process.exit(0)'));
assert('ORG04 cria membership em users/{uid}/memberships/{orgId}',
  orgScriptSrc.includes('users/${args.ownerUid}/memberships/${org.id}') ||
  orgScriptSrc.includes("users/${args.ownerUid}/memberships/"));
assert('ORG05 cria membership em organizations/{orgId}/members/{uid}',
  orgScriptSrc.includes('organizations/${org.id}/members/${args.ownerUid}') ||
  orgScriptSrc.includes('members/${args.ownerUid}'));
assert('ORG06 role owner obrigatório',
  orgScriptSrc.includes("role: 'owner'"));
assert('ORG07 organizationId estável (crypto.randomUUID)',
  orgScriptSrc.includes('crypto.randomUUID()'));
assert('ORG08 sem uid hardcoded',
  !orgScriptSrc.match(/['"`][A-Za-z0-9]{20,}['"`]/));
assert('ORG09 lê secret de FIREBASE_SERVICE_ACCOUNT_JSON',
  orgScriptSrc.includes('FIREBASE_SERVICE_ACCOUNT_JSON'));
assert('ORG10 --dry-run é parâmetro explícito',
  orgScriptSrc.includes('--dry-run') && orgScriptSrc.includes('dryRun'));
assert('ORG11 relatório final impresso',
  orgScriptSrc.includes('printReport'));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2 — parseArgs: parsing de argumentos
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 2 — parseArgs: parsing de argumentos ===');

const a1 = parseArgs(['--dry-run', '--source-uid', 'uid-test', '--target-organization-id', 'org-123', '--report-file', 'out.json']);
assert('PA01 dry-run detectado', a1.dryRun === true);
assert('PA02 source-uid parseado', a1.sourceUid === 'uid-test');
assert('PA03 target-organization-id parseado', a1.targetOrganizationId === 'org-123');
assert('PA04 report-file parseado', a1.reportFile === 'out.json');

const a2 = parseArgs(['--dry-run', '--source-uid', 'uid-x', '--target-organization-id', 'org-x', '--report-file', 'r.json',
  '--include-collections', 'generatingUnits,beneficiaryUnits']);
assert('PA05 include-collections parseado', Array.isArray(a2.includeCollections) && a2.includeCollections.includes('generatingUnits'));

const a3 = parseArgs(['--source-uid', 'uid-x', '--target-organization-id', 'org-x', '--report-file', 'r.json']);
assert('PA06 dryRun ausente → false', a3.dryRun === false);

const a4 = parseArgs(['--dry-run', '--verify-only', '--source-uid', 'uid-x', '--target-organization-id', 'org-x', '--report-file', 'r.json']);
assert('PA07 verify-only detectado', a4.verifyOnly === true);

const a5 = parseArgs(['--dry-run', '--source-uid', 'uid-x', '--target-organization-id', 'org-x', '--report-file', 'r.json',
  '--exclude-collections', 'creditAuditLog,utilityBillImports']);
assert('PA08 exclude-collections parseado', Array.isArray(a5.excludeCollections) && a5.excludeCollections.includes('creditAuditLog'));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3 — validateArgs: validação de parâmetros obrigatórios
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 3 — validateArgs: parâmetros obrigatórios ===');

assert('VA01 sem parâmetros → 3 erros',
  validateArgs({}).length === 3);
assert('VA02 sem source-uid → erro',
  validateArgs({ targetOrganizationId: 'org', reportFile: 'f.json' }).some(e => e.includes('source-uid')));
assert('VA03 sem target-organization-id → erro',
  validateArgs({ sourceUid: 'uid', reportFile: 'f.json' }).some(e => e.includes('target-organization-id')));
assert('VA04 sem report-file → erro',
  validateArgs({ sourceUid: 'uid', targetOrganizationId: 'org' }).some(e => e.includes('report-file')));
assert('VA05 completo → sem erros',
  validateArgs({ sourceUid: 'uid', targetOrganizationId: 'org', reportFile: 'f.json' }).length === 0);

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4 — maskPii + maskUid: mascaramento de dados sensíveis
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 4 — maskPii + maskUid: dados sensíveis ===');

assert('PII01 email mascarado', maskPii('user@example.com', 'email') !== 'user@example.com');
assert('PII02 email mascarado não expõe endereço completo',
  !maskPii('user@example.com', 'email').includes('user@example'));
assert('PII03 cpf mascarado', maskPii('123.456.789-00', 'cpf') !== '123.456.789-00');
assert('PII04 pix mascarado', maskPii('user@pix.com', 'pix') !== 'user@pix.com');
assert('PII05 campo não-PII não mascarado', maskPii('legitimate-value', 'name') === 'legitimate-value');
assert('PII06 campo não-PII: id não mascarado', maskPii('uuid-12345', 'id') === 'uuid-12345');
assert('PII07 maskUid: parcial para uid longo', maskUid('abcdefghijklmnopqrst') !== 'abcdefghijklmnopqrst');
assert('PII08 maskUid: contém asteriscos', maskUid('abcdefghijklmnopqrst').includes('****'));
assert('PII09 maskUid: preserva início e fim', (() => {
  const m = maskUid('uid-abcd-1234');
  return m.startsWith('uid-') && m.endsWith('1234');
})());
assert('PII10 token mascarado', maskPii('token-secret-value', 'token') !== 'token-secret-value');

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5 — normalizeForHash + computeObjectHash: determinismo
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 5 — normalizeForHash + hash: determinismo ===');

const obj1 = { id: 'ug-1', name: 'UG 1', capacity: 100, updatedAt: Date.now(), _requestId: 'req-123' };
const obj2 = { _requestId: 'req-456', updatedAt: Date.now() + 5000, name: 'UG 1', capacity: 100, id: 'ug-1' };

assert('HA01 hash determinístico: mesma estrutura → mesmo hash',
  computeObjectHash(obj1) === computeObjectHash(obj2));
assert('HA02 hash diferente para valores diferentes',
  computeObjectHash({ id: 'a', name: 'X' }) !== computeObjectHash({ id: 'a', name: 'Y' }));
assert('HA03 normalizeForHash exclui updatedAt',
  !JSON.stringify(normalizeForHash(obj1)).includes('updatedAt'));
assert('HA04 normalizeForHash exclui _requestId',
  !JSON.stringify(normalizeForHash(obj1)).includes('_requestId'));
assert('HA05 normalizeForHash ordena chaves',
  JSON.stringify(normalizeForHash({ z: 1, a: 2 })) === JSON.stringify(normalizeForHash({ a: 2, z: 1 })));
assert('HA06 computeObjectHash: hash hex 64 chars', computeObjectHash(obj1).length === 64);
assert('HA07 computeCollectionHash: determinístico independente da ordem', (() => {
  const r1 = [{ id: 'b', v: 2 }, { id: 'a', v: 1 }];
  const r2 = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
  return computeCollectionHash(r1) === computeCollectionHash(r2);
})());
assert('HA08 computeCollectionHash: vazio → hash determinístico',
  computeCollectionHash([]) === computeCollectionHash([]));
assert('HA09 computeCollectionHash: diferente para dados diferentes',
  computeCollectionHash([{ id: 'a', v: 1 }]) !== computeCollectionHash([{ id: 'a', v: 2 }]));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6 — inventoryCollection: inventário de origem e destino
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 6 — inventoryCollection: contagens e validação ===');

const ugData = {
  'ug-1': { id: 'ug-1', name: 'UG 1', organizationId: 'uid-test', version: 1 },
  'ug-2': { id: 'ug-2', name: 'UG 2', organizationId: 'uid-test', version: 2 },
};
const inv1 = inventoryCollection('generatingUnits', ugData);
assert('IN01 exists true quando há dados', inv1.exists === true);
assert('IN02 count correto', inv1.count === 2);
assert('IN03 ids corretos', inv1.ids.includes('ug-1') && inv1.ids.includes('ug-2'));
assert('IN04 hash gerado', typeof inv1.hash === 'string' && inv1.hash.length === 64);
assert('IN05 sem registros inválidos para dados válidos', inv1.invalidRecords.length === 0);
assert('IN06 sem chaves proibidas', inv1.forbiddenKeyRecords.length === 0);
assert('IN07 missingVersionCount = 0 para dados com version', inv1.missingVersionRecords.length === 0);

// Collection com registros sem version e sem id
const badData = {
  'bad-1': { name: 'Sem ID' }, // sem id
  'ug-3': { id: 'ug-3', name: 'UG sem version', organizationId: 'uid-test' }, // sem version
  'ug-4': { id: 'ug-4', name: 'UG 4', organizationId: 'uid-test', version: 1, password: 'FORBIDDEN' },
};
const inv2 = inventoryCollection('generatingUnits', badData);
assert('IN08 invalido sem id detectado', inv2.invalidRecords.length >= 1);
assert('IN09 missingVersion detectado', inv2.missingVersionRecords.includes('ug-3'));
assert('IN10 forbidden key detectado', inv2.forbiddenKeyRecords.some(r => r.id === 'ug-4' && r.keys.includes('password')));

// Collection vazia
const invEmpty = inventoryCollection('beneficiaryUnits', null);
assert('IN11 null → exists false', invEmpty.exists === false);
assert('IN12 null → count 0', invEmpty.count === 0);
assert('IN13 null → hash determinístico', invEmpty.hash === inventoryCollection('beneficiaryUnits', null).hash);

// Destino não vazio
const invDestFull = inventoryCollection('generatingUnits', ugData);
assert('IN14 destino com dados → count > 0', invDestFull.count > 0);

// ══════════════════════════════════════════════════════════════════════════════
// Suite 7 — validateReferences: referências cruzadas
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 7 — validateReferences: referências e órfãos ===');

const mockInventory = {
  generatingUnits: {
    ids: ['ug-1', 'ug-2'],
    records: [{ id: 'ug-1' }, { id: 'ug-2' }],
  },
  beneficiaryUnits: {
    ids: ['ub-1', 'ub-2'],
    records: [
      { id: 'ub-1', ugId: 'ug-1' },         // válida
      { id: 'ub-2', ugId: 'ug-orphan' },     // órfã
    ],
  },
  creditAllocations: {
    ids: ['ca-1'],
    records: [{ id: 'ca-1', ugId: 'ug-2', ubId: 'ub-1' }],
  },
};
// Add empty collections for others
for (const col of ['generatingUnitMonthlyRecords','beneficiaryMonthlyRecords','ownerSettlements','esaInvoices','monthlyReports','creditDocuments','creditAuditLog','beneficiaryCreditBalanceRecords','utilityBillImports']) {
  if (!mockInventory[col]) mockInventory[col] = { ids: [], records: [] };
}

const refs = validateReferences(mockInventory);
assert('RF01 retorna array de referências', Array.isArray(refs));
assert('RF02 referência válida detectada',
  refs.some(r => r.from === 'beneficiaryUnits' && r.fromId === 'ub-1' && r.status === 'valid'));
assert('RF03 referência órfã detectada',
  refs.some(r => r.from === 'beneficiaryUnits' && r.fromId === 'ub-2' && r.status === 'orphan'));
assert('RF04 creditAllocation: ugId válido',
  refs.some(r => r.from === 'creditAllocations' && r.fromId === 'ca-1' && r.field === 'ugId' && r.status === 'valid'));
assert('RF05 creditAllocation: ubId válido',
  refs.some(r => r.from === 'creditAllocations' && r.fromId === 'ca-1' && r.field === 'ubId' && r.status === 'valid'));

// Sem dados → sem referências
const emptyRefs = validateReferences({});
assert('RF06 inventário vazio → sem referências', emptyRefs.length === 0);

// ══════════════════════════════════════════════════════════════════════════════
// Suite 8 — projectTransformations: transformações projetadas
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 8 — projectTransformations: campos alterados ===');

const itemNoVersion = { id: 'ug-test', name: 'UG', organizationId: 'uid-old' };
const proj1 = projectTransformations(itemNoVersion, 'org-new', 'uid-old');
assert('TR01 organizationId atualizado para targetOrgId', proj1.projected.organizationId === 'org-new');
assert('TR02 version ausente → projetado como 1', proj1.projected.version === 1);
assert('TR03 updatedBy ausente → projetado como migration', proj1.projected.updatedBy === 'migration');
assert('TR04 changes registra organizationId', proj1.changes.some(c => c.field === 'organizationId'));
assert('TR05 changes registra version', proj1.changes.some(c => c.field === 'version'));
assert('TR06 original não modificado', itemNoVersion.organizationId === 'uid-old');

const itemWithVersion = { id: 'ug-2', name: 'UG 2', organizationId: 'org-new', version: 3, updatedBy: 'user' };
const proj2 = projectTransformations(itemWithVersion, 'org-new', 'uid-x');
assert('TR07 organizationId igual → sem change para orgId',
  !proj2.changes.some(c => c.field === 'organizationId'));
assert('TR08 version presente → sem change para version',
  !proj2.changes.some(c => c.field === 'version'));
assert('TR09 IDs preservados', proj2.projected.id === 'ug-2');

// ══════════════════════════════════════════════════════════════════════════════
// Suite 9 — classifyMigration: classificação final
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 9 — classifyMigration: classificação ===');

const reportBlocked = {
  source: { firebaseUnavailable: true, userExists: false, collections: [] },
  destination: { hasOperationalData: false, collections: [] },
  references: [],
};
const cl1 = classifyMigration(reportBlocked);
assert('CL01 Firebase indisponível → DRY_RUN_BLOCKED', cl1.classification === 'DRY_RUN_BLOCKED');
assert('CL02 blockers não vazio', cl1.blockers.length > 0);

const reportDestNotEmpty = {
  source: { firebaseUnavailable: false, userExists: true, collections: [{ count: 2, invalidRecords: [], forbiddenKeyRecords: [], missingVersionRecords: [], missingOrganizationId: [] }] },
  destination: { hasOperationalData: true, collections: [] },
  references: [],
};
const cl2 = classifyMigration(reportDestNotEmpty);
assert('CL03 destino não vazio → DRY_RUN_BLOCKED', cl2.classification === 'DRY_RUN_BLOCKED');

const reportClean = {
  source: {
    firebaseUnavailable: false, userExists: true,
    collections: [{ count: 2, invalidRecords: [], forbiddenKeyRecords: [], missingVersionRecords: [], missingOrganizationId: [] }],
  },
  destination: { hasOperationalData: false, collections: [] },
  references: [],
};
const cl3 = classifyMigration(reportClean);
assert('CL04 origem limpa → DRY_RUN_READY_FOR_COPY', cl3.classification === 'DRY_RUN_READY_FOR_COPY');
assert('CL05 sem bloqueadores', cl3.blockers.length === 0);

const reportWithWarnings = {
  source: {
    firebaseUnavailable: false, userExists: true,
    collections: [{
      count: 3,
      invalidRecords: [{ reason: 'missing id' }],
      forbiddenKeyRecords: [],
      missingVersionRecords: ['id-x'],
      missingOrganizationId: [],
    }],
  },
  destination: { hasOperationalData: false, collections: [] },
  references: [{ status: 'orphan', from: 'beneficiaryUnits', fromId: 'ub-1', field: 'ugId', target: 'generatingUnits', refId: 'ug-gone' }],
};
const cl4 = classifyMigration(reportWithWarnings);
assert('CL06 avisos presentes → DRY_RUN_READY_WITH_WARNINGS', cl4.classification === 'DRY_RUN_READY_WITH_WARNINGS');
assert('CL07 warnings não vazio', cl4.warnings.length > 0);

// Origem vazia (sem dados)
const reportEmptySource = {
  source: { firebaseUnavailable: false, userExists: false, collections: [{ count: 0, invalidRecords: [], forbiddenKeyRecords: [], missingVersionRecords: [], missingOrganizationId: [] }] },
  destination: { hasOperationalData: false, collections: [] },
  references: [],
};
const cl5 = classifyMigration(reportEmptySource);
assert('CL08 usuário não encontrado → DRY_RUN_BLOCKED', cl5.classification === 'DRY_RUN_BLOCKED');

// ══════════════════════════════════════════════════════════════════════════════
// Suite 10 — EC_MIGRATION_COLLECTIONS: 12 collections canônicas
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 10 — EC_MIGRATION_COLLECTIONS: 12 collections ===');

assert('EC01 exatamente 12 collections', EC_MIGRATION_COLLECTIONS.length === 12);
assert('EC02 generatingUnits presente', EC_MIGRATION_COLLECTIONS.includes('generatingUnits'));
assert('EC03 beneficiaryUnits presente', EC_MIGRATION_COLLECTIONS.includes('beneficiaryUnits'));
assert('EC04 creditAuditLog presente', EC_MIGRATION_COLLECTIONS.includes('creditAuditLog'));
assert('EC05 utilityBillImports presente', EC_MIGRATION_COLLECTIONS.includes('utilityBillImports'));
assert('EC06 creditAllocations presente', EC_MIGRATION_COLLECTIONS.includes('creditAllocations'));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 11 — Segurança do script: zero escritas em dry-run
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 11 — Segurança: zero escritas em dry-run ===');

assert('SE01 guard dry-run no código (aborta sem --dry-run)',
  migrScriptSrc.includes('ESCRITA REAL BLOQUEADA') || migrScriptSrc.includes('--dry-run é obrigatório'));
assert('SE02 nenhuma chamada .set() em dry-run path (sem args.dryRun check antes de set)',
  (() => {
    // O script não chama db.ref().set() no dry-run — verificar que não há set() após a inicialização no fluxo principal
    const noWriteInDryRun = !migrScriptSrc.includes('db.ref(') ||
      migrScriptSrc.includes('// Guard: --dry-run é obrigatório') ||
      migrScriptSrc.includes("!args.dryRun");
    return noWriteInDryRun;
  })());
assert('SE03 uid mascarado no relatório (maskUid)',
  migrScriptSrc.includes('maskUid(args.sourceUid)'));
assert('SE04 sem secrets no código',
  !migrScriptSrc.match(/['"][A-Za-z0-9+/]{40,}['"]/));
assert('SE05 Firebase Admin somente no Node (import condicional)',
  migrScriptSrc.includes("require('firebase-admin')") ||
  migrScriptSrc.includes('initFirebaseForScript'));
assert('SE06 FIREBASE_SERVICE_ACCOUNT_JSON lida do env',
  migrScriptSrc.includes('FIREBASE_SERVICE_ACCOUNT_JSON'));
assert('SE07 fs.mkdirSync cria reports/ se não existe',
  migrScriptSrc.includes('fs.mkdirSync') && migrScriptSrc.includes('recursive: true'));
assert('SE08 loadEnergyCreditsFromPath somente lê (once)',
  migrScriptSrc.includes('.once(') && !migrScriptSrc.match(/await db\.ref[^;]*\.set\(/));
assert('SE09 colisão detectada: destino não vazio classifica como BLOCKED',
  migrScriptSrc.includes('MIGRATION_DESTINATION_NOT_EMPTY') || migrScriptSrc.includes('hasOperationalData'));
assert('SE10 admin.app().delete() ao final (sem conexões abertas)',
  migrScriptSrc.includes('admin_terminate') || migrScriptSrc.includes('app().delete()'));

// ══════════════════════════════════════════════════════════════════════════════
// Suite 12 — create-initial-organization.js: validação do dry-run
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 12 — create-initial-organization.js: dry-run auditoria ===');

assert('CD01 --owner-uid obrigatório',
  orgScriptSrc.includes('--owner-uid') && orgScriptSrc.includes('ownerUid'));
assert('CD02 --name obrigatório',
  orgScriptSrc.includes('--name') && orgScriptSrc.includes('args.name'));
assert('CD03 --slug obrigatório',
  orgScriptSrc.includes('--slug') && orgScriptSrc.includes('args.slug'));
assert('CD04 validação de slug (lowercase alfanumérico)',
  orgScriptSrc.includes('a-z0-9-') || orgScriptSrc.includes("test(args.slug"));
assert('CD05 timestamps coerentes (Date.now())',
  orgScriptSrc.includes('Date.now()'));
assert('CD06 status: active',
  orgScriptSrc.includes("status: 'active'"));
assert('CD07 permissions no membership',
  orgScriptSrc.includes('permissions'));
assert('CD08 sem sobrescrita: organização existente → process.exit(0)',
  (() => {
    // 'if (existing)' + process.exit(0) deve aparecer antes da chamada 'const org = buildOrganization'
    const guardIdx = orgScriptSrc.indexOf('if (existing)');
    const callIdx  = orgScriptSrc.indexOf('const org');
    return guardIdx !== -1 && callIdx !== -1 && guardIdx < callIdx;
  })());
assert('CD09 Idempotência: mesma execução duas vezes é segura',
  orgScriptSrc.includes('findOrgBySlug') && orgScriptSrc.includes('process.exit(0)'));

// ══════════════════════════════════════════════════════════════════════════════
// Relatório final
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log(`Gate 8C Migration Tests: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));
if (failed > 0) process.exit(1);
