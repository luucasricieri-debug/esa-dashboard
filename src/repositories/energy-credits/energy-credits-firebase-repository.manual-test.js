/**
 * ESA OS — Repositories / Energy Credits
 * Suite de testes — EnergyCreditsFirebaseRepository (stub)
 * 20 cenários
 *
 * Execução: node src/repositories/energy-credits/energy-credits-firebase-repository.manual-test.js
 *
 * Valida que:
 * - Todos os métodos de dados lançam NOT_IMPLEMENTED
 * - getStats() nunca lança
 * - A mensagem orienta missão futura
 */

import {
  EnergyCreditsFirebaseRepository,
  EC_FIREBASE_NOT_IMPLEMENTED,
} from './energy-credits-firebase-repository.js';

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

function assertThrowsNotImplemented(fn, label) {
  total++;
  try {
    fn();
    failed++;
    console.error(`  ✗ FALHOU (esperava throw NOT_IMPLEMENTED): ${label}`);
  } catch (e) {
    if (!e.message.includes(EC_FIREBASE_NOT_IMPLEMENTED)) {
      failed++;
      console.error(`  ✗ FALHOU (mensagem incorreta): ${label} — got: ${e.message}`);
    }
  }
}

function section(n, title) {
  console.log(`\n[${n}] ${title}`);
}

// ── 1. Instância e getStats ────────────────────────────────────────────────

section(1, 'Instância e getStats');

const fbRepo = new EnergyCreditsFirebaseRepository();
assert(fbRepo instanceof EnergyCreditsFirebaseRepository, '1.1 instancia sem Firebase');

const stats = fbRepo.getStats();
assert(stats.type === 'firebase-stub',           '1.2 type = firebase-stub');
assert(stats.initialized === false,              '1.3 initialized = false sem client');
assert(stats.note === EC_FIREBASE_NOT_IMPLEMENTED, '1.4 note = NOT_IMPLEMENTED');

const fbRepoWithClient = new EnergyCreditsFirebaseRepository({ fake: true });
assert(fbRepoWithClient.getStats().initialized === true, '1.5 initialized = true com client');

// ── 2. Constante exportada ─────────────────────────────────────────────────

section(2, 'Constante EC_FIREBASE_NOT_IMPLEMENTED');

assert(typeof EC_FIREBASE_NOT_IMPLEMENTED === 'string',             '2.1 é string');
assert(EC_FIREBASE_NOT_IMPLEMENTED.length > 0,                      '2.2 não vazio');
assert(EC_FIREBASE_NOT_IMPLEMENTED.includes('FIREBASE'),             '2.3 contém FIREBASE');
assert(EC_FIREBASE_NOT_IMPLEMENTED.includes('NOT_IMPLEMENTED'),      '2.4 contém NOT_IMPLEMENTED');

// ── 3. Métodos de dados lançam NOT_IMPLEMENTED ─────────────────────────────

section(3, 'Todos os métodos de dados lançam NOT_IMPLEMENTED');

const METHODS_THAT_THROW = [
  ['getSnapshot',                   () => fbRepo.getSnapshot()],
  ['hydrateFromSnapshot',           () => fbRepo.hydrateFromSnapshot({})],
  ['saveGeneratingUnit',            () => fbRepo.saveGeneratingUnit({})],
  ['getGeneratingUnit',             () => fbRepo.getGeneratingUnit('id')],
  ['listGeneratingUnits',           () => fbRepo.listGeneratingUnits()],
  ['saveBeneficiaryUnit',           () => fbRepo.saveBeneficiaryUnit({})],
  ['getBeneficiaryUnit',            () => fbRepo.getBeneficiaryUnit('id')],
  ['listBeneficiaryUnits',          () => fbRepo.listBeneficiaryUnits()],
  ['saveGeneratingUnitMonthlyRecord', () => fbRepo.saveGeneratingUnitMonthlyRecord({})],
  ['saveCreditAllocation',          () => fbRepo.saveCreditAllocation({})],
  ['saveOwnerSettlement',           () => fbRepo.saveOwnerSettlement({})],
  ['saveEsaInvoice',                () => fbRepo.saveEsaInvoice({})],
  ['saveMonthlyReport',             () => fbRepo.saveMonthlyReport({})],
  ['saveCreditDocument',            () => fbRepo.saveCreditDocument({})],
  ['appendCreditAuditLog',          () => fbRepo.appendCreditAuditLog({})],
  ['listCreditAuditLog',            () => fbRepo.listCreditAuditLog()],
];

for (const [name, fn] of METHODS_THAT_THROW) {
  assertThrowsNotImplemented(fn, `3. ${name} lança NOT_IMPLEMENTED`);
}

// ── 4. getStats nunca lança ────────────────────────────────────────────────

section(4, 'getStats nunca lança');

total++;
try {
  const s = fbRepo.getStats();
  assert(typeof s === 'object', '4.1 getStats retorna objeto sem throw');
} catch (e) {
  failed++;
  console.error(`  ✗ FALHOU: getStats lançou: ${e.message}`);
}

// ── Resultado ──────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
