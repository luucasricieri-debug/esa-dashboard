/**
 * ESA OS — Tests / Energy Utility Bills
 * utility-bill-import-service.manual-test.js
 */

import { UtilityBillImportService } from './utility-bill-import-service.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function makeExtraction(overrides = {}) {
  return {
    uc: 'UC001',
    referenceMonth: '2025-06',
    utilityCompany: 'COPEL',
    monthlyConsumptionKwh: 250,
    totalUtilityBillAmount: 350,
    ...overrides,
  };
}

const units = [
  { id: 'ben-001', uc: 'UC001', generatingUnitId: 'gen-001', holderDocument: '123.456.789-00' },
  { id: 'ben-002', uc: 'UC002', generatingUnitId: 'gen-001', holderDocument: '987.654.321-00' },
];

// ── Suite 1: createImport ─────────────────────────────────────────────────────

console.log('\n[1] createImport');

{
  const svc = new UtilityBillImportService();
  const result = svc.createImport(makeExtraction());
  assert('ok=true', result.ok);
  assert('id existe', typeof result.data.id === 'string');
  assert('status=extracted', result.data.status === 'extracted');
  assert('dataSource=utility-bill-import', result.data.dataSource === 'utility-bill-import');
  assert('extraction presente', result.data.extraction != null);
}

// ── Suite 2: createImport extraction inválida ──────────────────────────────────

console.log('\n[2] createImport com dados inválidos');

{
  const svc = new UtilityBillImportService();
  const result = svc.createImport({ uc: 'UC1', referenceMonth: 'INVALIDO' });
  assert('ok=false com referenceMonth inválido', !result.ok);
}

// ── Suite 3: matchImport — UC match ───────────────────────────────────────────

console.log('\n[3] matchImport — match por UC');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction());
  const result = svc.matchImport(created.data.id, units);
  assert('ok=true', result.ok);
  assert('status=matched', result.data.status === 'matched');
  assert('beneficiaryUnitId=ben-001', result.data.beneficiaryUnitId === 'ben-001');
  assert('generatingUnitId=gen-001', result.data.generatingUnitId === 'gen-001');
}

// ── Suite 4: matchImport — sem match ─────────────────────────────────────────

console.log('\n[4] matchImport — sem match');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction({ uc: 'UCNENHUMA' }));
  const result = svc.matchImport(created.data.id, units);
  assert('ok=true (sem match não é erro do service)', result.ok);
  assert('status=unmatched', result.data.status === 'unmatched');
}

// ── Suite 5: linkImportToBeneficiary ─────────────────────────────────────────

console.log('\n[5] linkImportToBeneficiary manual');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction({ uc: 'UCNENHUMA' }));
  const result = svc.linkImportToBeneficiary(created.data.id, 'ben-002', {
    beneficiaryUnits: units,
  });
  assert('ok=true', result.ok);
  assert('status=matched', result.data.status === 'matched');
  assert('beneficiaryUnitId=ben-002', result.data.beneficiaryUnitId === 'ben-002');
  assert('matchType=manual', result.data.match?.matchType === 'manual');
}

// ── Suite 6: reviewImport ─────────────────────────────────────────────────────

console.log('\n[6] reviewImport');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction());
  const result = svc.reviewImport(created.data.id, { monthlyConsumptionKwh: 300 });
  assert('ok=true', result.ok);
  assert('status=review', result.data.status === 'review');
  assert('correctedData presente', result.data.correctedData != null);
  assert('correctedData.monthlyConsumptionKwh=300', result.data.correctedData.monthlyConsumptionKwh === 300);
}

// ── Suite 7: confirmMonthlyRecord ────────────────────────────────────────────

console.log('\n[7] confirmMonthlyRecord');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction());
  svc.matchImport(created.data.id, units);
  const result = svc.confirmMonthlyRecord(created.data.id, {
    referenceDate: '2025-06-30',
    confirmedBy: 'operator-1',
  });
  assert('ok=true', result.ok);
  assert('importRecord.status=confirmed', result.data.importRecord.status === 'confirmed');
  assert('importRecord.confirmedBy=operator-1', result.data.importRecord.confirmedBy === 'operator-1');
  assert('monthlyRecord presente', result.data.monthlyRecord != null);
  assert('monthlyRecord.id=ubm-ben-001-2025-06', result.data.monthlyRecord.id === 'ubm-ben-001-2025-06');
}

// ── Suite 8: confirmMonthlyRecord sem beneficiário → falha ───────────────────

console.log('\n[8] confirmMonthlyRecord sem beneficiário');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction());
  const result = svc.confirmMonthlyRecord(created.data.id, {});
  assert('ok=false', !result.ok);
  assert('erro UTILITY_BILL_BENEFICIARY_REQUIRED', result.errors.some(e => e.code === 'UTILITY_BILL_BENEFICIARY_REQUIRED'));
}

// ── Suite 9: replaceMonthlyRecord ────────────────────────────────────────────

console.log('\n[9] replaceMonthlyRecord');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction());
  svc.matchImport(created.data.id, units);
  const result = svc.replaceMonthlyRecord(created.data.id, 'Retificação de leitura', {});
  assert('ok=true', result.ok);
  assert('status=replaced', result.data.importRecord.status === 'replaced');
  assert('replacementReason preservado', result.data.importRecord.replacementReason === 'Retificação de leitura');
}

// ── Suite 10: replaceMonthlyRecord sem reason → falha ────────────────────────

console.log('\n[10] replaceMonthlyRecord sem reason');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction());
  svc.matchImport(created.data.id, units);
  const result = svc.replaceMonthlyRecord(created.data.id, null, {});
  assert('ok=false', !result.ok);
  assert('erro UTILITY_BILL_REPLACEMENT_REASON_REQUIRED', result.errors.some(e => e.code === 'UTILITY_BILL_REPLACEMENT_REASON_REQUIRED'));
}

// ── Suite 11: discardImport ───────────────────────────────────────────────────

console.log('\n[11] discardImport');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction());
  const result = svc.discardImport(created.data.id);
  assert('ok=true', result.ok);
  assert('status=discarded', result.data.status === 'discarded');
}

// ── Suite 12: discardImport → confirmMonthlyRecord bloqueado ─────────────────

console.log('\n[12] Import descartado não pode ser confirmado');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction());
  svc.matchImport(created.data.id, units);
  svc.discardImport(created.data.id);
  const result = svc.confirmMonthlyRecord(created.data.id, {});
  assert('ok=false', !result.ok);
}

// ── Suite 13: detectDuplicate ─────────────────────────────────────────────────

console.log('\n[13] detectDuplicate');

{
  const svc = new UtilityBillImportService();
  const created = svc.createImport(makeExtraction());
  svc.matchImport(created.data.id, units);
  const existing = [{
    id: 'ubm-ben-001-2025-06',
    beneficiaryUnitId: 'ben-001',
    referenceMonth: '2025-06',
    monthlyConsumptionKwh: 250,
  }];
  const result = svc.detectDuplicate(created.data.id, existing);
  assert('ok=true', result.ok);
  assert('status=duplicate', result.data.status === 'duplicate');
  assert('duplicate.duplicate=true', result.data.duplicate?.duplicate === true);
}

// ── Suite 14: listImports com filtros ────────────────────────────────────────

console.log('\n[14] listImports com filtros');

{
  const svc = new UtilityBillImportService();
  svc.createImport(makeExtraction({ uc: 'UC001', referenceMonth: '2025-06' }));
  svc.createImport(makeExtraction({ uc: 'UC002', referenceMonth: '2025-07' }));
  const all = svc.listImports();
  assert('lista 2 imports', all.data.length === 2);
  const filtered = svc.listImports({ referenceMonth: '2025-06' });
  assert('filtrado por referenceMonth=2025-06', filtered.data.length === 1);
}

// ── Suite 15: getImport não encontrado ───────────────────────────────────────

console.log('\n[15] getImport não encontrado');

{
  const svc = new UtilityBillImportService();
  const result = svc.getImport('nao-existe');
  assert('ok=false', !result.ok);
  assert('erro UTILITY_BILL_IMPORT_NOT_FOUND', result.errors.some(e => e.code === 'UTILITY_BILL_IMPORT_NOT_FOUND'));
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`utility-bill-import-service: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
