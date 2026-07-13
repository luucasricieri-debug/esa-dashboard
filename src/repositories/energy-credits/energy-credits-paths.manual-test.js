/**
 * ESA OS — Repositories / Energy Credits
 * Suite de testes — ec-paths
 * 30 cenários
 *
 * Execução: node src/repositories/energy-credits/energy-credits-paths.manual-test.js
 */

import {
  EC_COLLECTIONS,
  EC_ROOT,
  EC_PATHS,
  buildEnergyCreditsPath,
} from './energy-credits-paths.js';

// ── Runner ─────────────────────────────────────────────────────────────────

let total  = 0;
let failed = 0;

function assert(condition, label) {
  total++;
  if (!condition) {
    failed++;
    console.error(`  ✗ FALHOU: ${label}`);
  }
}

function assertThrows(fn, label) {
  total++;
  try {
    fn();
    failed++;
    console.error(`  ✗ FALHOU (esperava throw): ${label}`);
  } catch (_) {
    // ok
  }
}

function section(n, title) {
  console.log(`\n[${n}] ${title}`);
}

// ── 1. EC_COLLECTIONS ───────────────────────────────────────────────────────

section(1, 'EC_COLLECTIONS');

assert(Array.isArray(EC_COLLECTIONS),                    '1.1 EC_COLLECTIONS é array');
assert(EC_COLLECTIONS.length === 10,                     '1.2 10 coleções');
assert(EC_COLLECTIONS.includes('generatingUnits'),       '1.3 generatingUnits presente');
assert(EC_COLLECTIONS.includes('beneficiaryUnits'),      '1.4 beneficiaryUnits presente');
assert(EC_COLLECTIONS.includes('creditAllocations'),     '1.5 creditAllocations presente');
assert(EC_COLLECTIONS.includes('ownerSettlements'),      '1.6 ownerSettlements presente');
assert(EC_COLLECTIONS.includes('esaInvoices'),           '1.7 esaInvoices presente');
assert(EC_COLLECTIONS.includes('monthlyReports'),        '1.8 monthlyReports presente');
assert(EC_COLLECTIONS.includes('creditDocuments'),       '1.9 creditDocuments presente');
assert(EC_COLLECTIONS.includes('creditAuditLog'),        '1.10 creditAuditLog presente');
assert(EC_COLLECTIONS.includes('generatingUnitMonthlyRecords'), '1.11 generatingUnitMonthlyRecords presente');
assert(EC_COLLECTIONS.includes('beneficiaryMonthlyRecords'),    '1.12 beneficiaryMonthlyRecords presente');

// ── 2. EC_ROOT e EC_PATHS ──────────────────────────────────────────────────

section(2, 'EC_ROOT e EC_PATHS');

assert(EC_ROOT === 'energyCredits', '2.1 EC_ROOT = energyCredits');
assert(typeof EC_PATHS === 'object' && EC_PATHS !== null, '2.2 EC_PATHS é objeto');
assert(EC_PATHS.generatingUnits === 'energyCredits/generatingUnits',       '2.3 path generatingUnits');
assert(EC_PATHS.creditAuditLog  === 'energyCredits/creditAuditLog',         '2.4 path creditAuditLog');
assert(EC_PATHS.monthlyReports  === 'energyCredits/monthlyReports',         '2.5 path monthlyReports');
assert(Object.keys(EC_PATHS).length === 10, '2.6 EC_PATHS tem 10 entradas');

// ── 3. buildEnergyCreditsPath — caminho válido ─────────────────────────────

section(3, 'buildEnergyCreditsPath — paths válidos');

assert(
  buildEnergyCreditsPath('generatingUnits', 'gen-001') === 'energyCredits/generatingUnits/gen-001',
  '3.1 path padrão',
);
assert(
  buildEnergyCreditsPath('creditAuditLog', 'audit-001') === 'energyCredits/creditAuditLog/audit-001',
  '3.2 creditAuditLog path',
);
assert(
  buildEnergyCreditsPath('monthlyReports', '2024-01::rep-abc') === 'energyCredits/monthlyReports/2024-01::rep-abc',
  '3.3 id com :: (permitido)',
);
assert(
  buildEnergyCreditsPath('creditDocuments', 'doc_001') === 'energyCredits/creditDocuments/doc_001',
  '3.4 id com underline',
);

// Determinismo — mesmo input → mesmo output
const p1 = buildEnergyCreditsPath('esaInvoices', 'inv-xyz');
const p2 = buildEnergyCreditsPath('esaInvoices', 'inv-xyz');
assert(p1 === p2, '3.5 determinismo');

// Todas as collections produzem path com prefixo correto
for (const col of EC_COLLECTIONS) {
  assert(
    buildEnergyCreditsPath(col, 'item-1').startsWith('energyCredits/'),
    `3.6 prefixo correto para ${col}`,
  );
}

// ── 4. buildEnergyCreditsPath — collection inválida ────────────────────────

section(4, 'buildEnergyCreditsPath — collection inválida');

assertThrows(() => buildEnergyCreditsPath('creditos',      'id-1'), '4.1 collection desconhecida');
assertThrows(() => buildEnergyCreditsPath('',              'id-1'), '4.2 collection vazia');
assertThrows(() => buildEnergyCreditsPath(null,            'id-1'), '4.3 collection null');
assertThrows(() => buildEnergyCreditsPath(undefined,       'id-1'), '4.4 collection undefined');
assertThrows(() => buildEnergyCreditsPath('GeneratingUnits','id-1'), '4.5 case-sensitive');

// ── 5. buildEnergyCreditsPath — id inválido ────────────────────────────────

section(5, 'buildEnergyCreditsPath — id inválido (path traversal e caracteres proibidos)');

assertThrows(() => buildEnergyCreditsPath('generatingUnits', ''),          '5.1 id vazio');
assertThrows(() => buildEnergyCreditsPath('generatingUnits', null),        '5.2 id null');
assertThrows(() => buildEnergyCreditsPath('generatingUnits', undefined),   '5.3 id undefined');
assertThrows(() => buildEnergyCreditsPath('generatingUnits', 'a/b'),       '5.4 barra');
assertThrows(() => buildEnergyCreditsPath('generatingUnits', '../etc'),    '5.5 path traversal ..');
assertThrows(() => buildEnergyCreditsPath('generatingUnits', 'a#b'),       '5.6 hash');
assertThrows(() => buildEnergyCreditsPath('generatingUnits', 'a$b'),       '5.7 cifrão');
assertThrows(() => buildEnergyCreditsPath('generatingUnits', 'a[b'),       '5.8 abre colchete');
assertThrows(() => buildEnergyCreditsPath('generatingUnits', 'a]b'),       '5.9 fecha colchete');
assertThrows(() => buildEnergyCreditsPath('generatingUnits', '  '),        '5.10 apenas espaços');

// ── Resultado ─────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
