/**
 * ESA OS — Tests / Core
 * app.energy-utility-bills.manual-test.js
 *
 * Valida as 14 APIs de utility bill expostas pelo ESAApplication singleton.
 */

import { ESA } from './app.js';

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

// ── Suite 1: getEnergyUtilityBillImportService ────────────────────────────────

console.log('\n[1] getEnergyUtilityBillImportService');

{
  const svc = ESA.getEnergyUtilityBillImportService();
  assert('retorna objeto', svc != null && typeof svc === 'object');
  assert('tem método createImport', typeof svc.createImport === 'function');
  assert('singleton — mesma instância em chamada repetida', ESA.getEnergyUtilityBillImportService() === svc);
}

// ── Suite 2: createEnergyUtilityBillImport ────────────────────────────────────

console.log('\n[2] createEnergyUtilityBillImport');

{
  const result = ESA.createEnergyUtilityBillImport(makeExtraction({ uc: 'UC_APP_1', referenceMonth: '2025-08' }));
  assert('ok=true', result.ok);
  assert('id gerado', typeof result.data.id === 'string');
  assert('status=extracted', result.data.status === 'extracted');
}

// ── Suite 3: matchEnergyUtilityBillImport ─────────────────────────────────────

console.log('\n[3] matchEnergyUtilityBillImport');

{
  const created = ESA.createEnergyUtilityBillImport(makeExtraction({ uc: 'UC001', referenceMonth: '2025-09' }));
  const result  = ESA.matchEnergyUtilityBillImport(created.data.id, units);
  assert('ok=true', result.ok);
  assert('status=matched', result.data.status === 'matched');
  assert('beneficiaryUnitId=ben-001', result.data.beneficiaryUnitId === 'ben-001');
}

// ── Suite 4: linkEnergyUtilityBillToBeneficiary ───────────────────────────────

console.log('\n[4] linkEnergyUtilityBillToBeneficiary');

{
  const created = ESA.createEnergyUtilityBillImport(makeExtraction({ uc: 'UCNENHUMA', referenceMonth: '2025-10' }));
  const result  = ESA.linkEnergyUtilityBillToBeneficiary(created.data.id, 'ben-002', { beneficiaryUnits: units });
  assert('ok=true', result.ok);
  assert('status=matched', result.data.status === 'matched');
  assert('matchType=manual', result.data.match?.matchType === 'manual');
}

// ── Suite 5: prepareEnergyCreditsBeneficiaryFromUtilityBill ───────────────────

console.log('\n[5] prepareEnergyCreditsBeneficiaryFromUtilityBill');

{
  const created = ESA.createEnergyUtilityBillImport(makeExtraction({
    uc: 'UC_PREP', referenceMonth: '2025-11',
    customerName: 'João Silva', customerDocument: '111.222.333-44',
  }));
  const result = ESA.prepareEnergyCreditsBeneficiaryFromUtilityBill(created.data.id);
  assert('ok=true', result.ok);
  assert('name presente', typeof result.data.name === 'string' || result.data.name === 'João Silva');
  assert('uc presente', result.data.uc != null);
}

// ── Suite 6: reviewEnergyUtilityBillImport ────────────────────────────────────

console.log('\n[6] reviewEnergyUtilityBillImport');

{
  const created = ESA.createEnergyUtilityBillImport(makeExtraction({ uc: 'UC_REVIEW', referenceMonth: '2025-12' }));
  const result  = ESA.reviewEnergyUtilityBillImport(created.data.id, { monthlyConsumptionKwh: 999 });
  assert('ok=true', result.ok);
  assert('status=review', result.data.status === 'review');
  assert('correctedData atualizado', result.data.correctedData?.monthlyConsumptionKwh === 999);
}

// ── Suite 7: detectEnergyUtilityBillDuplicate ─────────────────────────────────

console.log('\n[7] detectEnergyUtilityBillDuplicate');

{
  const created = ESA.createEnergyUtilityBillImport(makeExtraction({ uc: 'UC001', referenceMonth: '2024-01' }));
  ESA.matchEnergyUtilityBillImport(created.data.id, units);
  const existing = [{
    id: 'ubm-ben-001-2024-01',
    beneficiaryUnitId: 'ben-001',
    referenceMonth: '2024-01',
    monthlyConsumptionKwh: 250,
  }];
  const result = ESA.detectEnergyUtilityBillDuplicate(created.data.id, existing);
  assert('ok=true', result.ok);
  assert('status=duplicate', result.data.status === 'duplicate');
}

// ── Suite 8: confirmEnergyUtilityBillMonthlyRecord ───────────────────────────

console.log('\n[8] confirmEnergyUtilityBillMonthlyRecord');

{
  const created = ESA.createEnergyUtilityBillImport(makeExtraction({ uc: 'UC001', referenceMonth: '2024-02' }));
  ESA.matchEnergyUtilityBillImport(created.data.id, units);
  const result = ESA.confirmEnergyUtilityBillMonthlyRecord(created.data.id, {
    referenceDate: '2024-02-28',
    confirmedBy: 'test-user',
  });
  assert('ok=true', result.ok);
  assert('status=confirmed', result.data.importRecord.status === 'confirmed');
  assert('monthlyRecord gerado', result.data.monthlyRecord != null);
}

// ── Suite 9: replaceEnergyUtilityBillMonthlyRecord ───────────────────────────

console.log('\n[9] replaceEnergyUtilityBillMonthlyRecord');

{
  const created = ESA.createEnergyUtilityBillImport(makeExtraction({ uc: 'UC001', referenceMonth: '2024-03' }));
  ESA.matchEnergyUtilityBillImport(created.data.id, units);
  const result = ESA.replaceEnergyUtilityBillMonthlyRecord(created.data.id, 'Retificação', {
    referenceDate: '2024-03-31',
  });
  assert('ok=true', result.ok);
  assert('status=replaced', result.data.importRecord.status === 'replaced');
}

// ── Suite 10: discardEnergyUtilityBillImport ──────────────────────────────────

console.log('\n[10] discardEnergyUtilityBillImport');

{
  const created = ESA.createEnergyUtilityBillImport(makeExtraction({ uc: 'UC_DISCARD', referenceMonth: '2024-04' }));
  const result  = ESA.discardEnergyUtilityBillImport(created.data.id);
  assert('ok=true', result.ok);
  assert('status=discarded', result.data.status === 'discarded');
}

// ── Suite 11: getEnergyUtilityBillImport ─────────────────────────────────────

console.log('\n[11] getEnergyUtilityBillImport');

{
  const created = ESA.createEnergyUtilityBillImport(makeExtraction({ uc: 'UC_GET', referenceMonth: '2024-05' }));
  const result  = ESA.getEnergyUtilityBillImport(created.data.id);
  assert('ok=true', result.ok);
  assert('id correto', result.data.id === created.data.id);
}

// ── Suite 12: searchEnergyUtilityBillImports ──────────────────────────────────

console.log('\n[12] searchEnergyUtilityBillImports');

{
  const result = ESA.searchEnergyUtilityBillImports({ referenceMonth: '2025-06' });
  assert('ok=true', result.ok);
  assert('retorna array', Array.isArray(result.data));
}

// ── Suite 13: getUnlinkedEnergyUtilityBills ───────────────────────────────────

console.log('\n[13] getUnlinkedEnergyUtilityBills');

{
  const result = ESA.getUnlinkedEnergyUtilityBills();
  assert('ok=true', result.ok);
  assert('retorna array', Array.isArray(result.data));
  assert('apenas unmatched', result.data.every(r => r.status === 'unmatched'));
}

// ── Suite 14: buildEnergyBillingInputFromUtilityBillMonthlyRecord ─────────────

console.log('\n[14] buildEnergyBillingInputFromUtilityBillMonthlyRecord');

{
  const monthlyRecord = {
    id: 'ubm-ben-001-2024-06',
    beneficiaryUnitId: 'ben-001',
    generatingUnitId: 'gen-001',
    referenceMonth: '2024-06',
    monthlyConsumptionKwh: 250,
    components: { cip: 15 },
    minimumBillableKwh: 100,
  };
  const context = {
    tariffs: {
      te_com: 0.5, te_sem: 0.4, tusd_com: 0.3, tus_sem: 0.25,
      icms_pct: 0.25, cofins_pct: 0.03, pis_pct: 0.015,
    },
    operational: { geracao: 300, uc_prop: 1.0, preco_kwh: 0.85, desc_dist: 0.2, bndv: 0 },
  };
  const result = ESA.buildEnergyBillingInputFromUtilityBillMonthlyRecord(monthlyRecord, context);
  assert('ok=true com contexto completo', result.ok);
  assert('referenceMonth=2024-06', result.data.referenceMonth === '2024-06');
  assert('operational.consumo=250', result.data.operational.consumo === 250);
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`app.energy-utility-bills: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
