// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 3C — persist=false mutation tests
// Verifica que mutações sem persistência real retornam capability
// explícita e nunca afirmam sucesso definitivo.
// Rodar: npx tsx tests/settlement-persist-gate3c.manual-test.ts
// ============================================================

import { demoRuntimeProvider } from '../providers/demoRuntimeProvider';
import { createEsaRuntimeProvider } from '../providers/esaRuntimeProvider';
import type { MutationResult } from '../contracts/types';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

async function assertNoThrow(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${label} — threw: ${(err as Error).message}`);
    failed++;
  }
}

function makeProvider(overrides: Partial<Record<string, (...args: unknown[]) => unknown>> = {}): Parameters<typeof createEsaRuntimeProvider>[0] {
  return {
    searchGeneratingUnits: () => ({ ok: true, data: [] }),
    searchBeneficiaryUnits: () => ({ ok: true, data: [] }),
    getExecutiveSummary: () => null,
    getFinancialSummary: () => null,
    getAlertsSummary: () => null,
    getCsvTemplate: () => null,
    createGeneratingUnit: () => ({ ok: true, data: { id: 'UG-NEW-001', name: 'Nova UG' } }),
    updateGeneratingUnit: () => ({ ok: true, data: { ok: true } }),
    createBeneficiaryUnit: () => ({ ok: true, data: { id: 'UB-NEW-001', name: 'Nova UB' } }),
    updateBeneficiaryUnit: () => ({ ok: true, data: { ok: true } }),
    getSettlementRecipient: () => null,
    getBeneficiaryConsumptionAverage: () => null,
    getBeneficiaryHistory: () => null,
    getBeneficiaryMonthlyReport: () => null,
    getOwnerMonthlyReport: () => null,
    getAllocationPlan: () => null,
    getGeneratingUnitSummary: () => null,
    confirmInvoicePayment: () => ({ ok: true, data: { ok: true } }),
    reopenInvoicePayment: () => ({ ok: true, data: { ok: true } }),
    confirmOwnerSettlementPayment: () => ({ ok: true, data: { ok: true } }),
    createUtilityBillImport: () => null,
    confirmUtilityBillExtraction: () => ({ ok: true, data: { ok: true } }),
    matchUtilityBillToBeneficiary: () => null,
    linkUtilityBillToBeneficiary: () => ({ ok: true, data: { ok: true } }),
    ...overrides,
  } as Parameters<typeof createEsaRuntimeProvider>[0];
}

// ============================================================
// Suite AI — saveAllocationOverrides: sem sucesso definitivo
// ============================================================
async function suiteAI() {
  console.log('\nSuite AI — saveAllocationOverrides: capability explícita');
  const rt = createEsaRuntimeProvider(makeProvider());

  const result: MutationResult = await rt.saveAllocationOverrides('UG-X', '2026-07', {});

  assert('AI1 ok === false (não afirma persistência)', result.ok === false);
  assert('AI2 persisted === false', result.persisted === false);
  assert('AI3 capability === not_available', result.capability === 'not_available');
  assert('AI4 message presente', typeof result.message === 'string' && result.message.length > 0);
  assert('AI5 message menciona "Persistência"', result.message!.includes('Persistência') || result.message!.includes('persist'));
  assert('AI6 message menciona "Prévia"', result.message!.includes('Prévia') || result.message!.includes('prévia') || result.message!.includes('calculada'));
  assert('AI7 error ausente (não é erro de sistema)', !result.error);

  await assertNoThrow('AI8 saveAllocationOverrides não lança', () => rt.saveAllocationOverrides('UG-X', '2026-07', {}));

  const result2 = await rt.saveAllocationOverrides('UG-X', '2026-07', { 'UB-1': { allocationPct: 0.5 } });
  assert('AI9 com overrides também retorna persisted=false', result2.persisted === false);
}

// ============================================================
// Suite AJ — closeMonthlySettlement: sem alterar status
// ============================================================
async function suiteAJ() {
  console.log('\nSuite AJ — closeMonthlySettlement: status preservado');
  const rt = createEsaRuntimeProvider(makeProvider());

  const result: MutationResult = await rt.closeMonthlySettlement('UG-X', '2026-07');

  assert('AJ1 ok === false (fechamento não ocorre)', result.ok === false);
  assert('AJ2 persisted === false', result.persisted === false);
  assert('AJ3 capability === not_available', result.capability === 'not_available');
  assert('AJ4 message presente', typeof result.message === 'string' && result.message.length > 0);
  assert('AJ5 message menciona "Fechamento"', result.message!.includes('Fechamento') || result.message!.includes('fechamento'));
  assert('AJ6 message menciona "indisponível" ou "não habilitada"', result.message!.includes('indisponível') || result.message!.includes('não habilitada'));
  assert('AJ7 error ausente', !result.error);

  await assertNoThrow('AJ8 closeMonthlySettlement não lança', () => rt.closeMonthlySettlement('UG-X', '2026-07'));

  const statusBefore = await rt.getCycleStatus('2026-07');
  await rt.closeMonthlySettlement('UG-X', '2026-07');
  const statusAfter = await rt.getCycleStatus('2026-07');
  assert('AJ9 getCycleStatus inalterado após closeMonthlySettlement', statusBefore === statusAfter);
}

// ============================================================
// Suite AK — updateCyclePrice: sem persistência
// ============================================================
async function suiteAK() {
  console.log('\nSuite AK — updateCyclePrice: simulação sem persistência');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [{ id: 'UG-REAL-001', purchasePrice: 0.38 }] }),
  }));

  const result: MutationResult = await rt.updateCyclePrice('UG-REAL-001', '2026-07', 0.42, 'teste');

  assert('AK1 ok === false (preço não persiste)', result.ok === false);
  assert('AK2 persisted === false', result.persisted === false);
  assert('AK3 capability === not_available', result.capability === 'not_available');
  assert('AK4 message presente', typeof result.message === 'string' && result.message.length > 0);
  assert('AK5 message menciona "simulado" ou "Simulação"', result.message!.includes('simulad') || result.message!.includes('Simulaç'));
  assert('AK6 message menciona "não persistida" ou "persistência"', result.message!.includes('persist'));
  assert('AK7 error ausente', !result.error);

  const priceAfter = await rt.getAppliedPrice('UG-REAL-001', '2026-07');
  assert('AK8 getAppliedPrice ainda retorna purchasePrice real após updateCyclePrice', Math.abs(priceAfter - 0.38) < 0.001);
}

// ============================================================
// Suite AL — Reload restaura dados reais (sem localStorage)
// ============================================================
async function suiteAL() {
  console.log('\nSuite AL — Reload restaura dados reais');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [{ id: 'UG-REAL-001', purchasePrice: 0.38 }] }),
  }));

  // Simulate: updateCyclePrice does not change what getAppliedPrice returns
  await rt.updateCyclePrice('UG-REAL-001', '2026-07', 0.55, 'simulação');
  const priceAfterUpdate = await rt.getAppliedPrice('UG-REAL-001', '2026-07');
  assert('AL1 preço real não alterado após updateCyclePrice', Math.abs(priceAfterUpdate - 0.38) < 0.001);

  // Simulate: closeMonthlySettlement does not change getCycleStatus
  const statusBefore = await rt.getCycleStatus('2026-07');
  await rt.closeMonthlySettlement('UG-REAL-001', '2026-07');
  const statusAfterClose = await rt.getCycleStatus('2026-07');
  assert('AL2 status real não alterado após closeMonthlySettlement', statusBefore === statusAfterClose);

  // Simulate: saveAllocationOverrides does not change any persistent state readable via provider
  const planBefore = await rt.getAllocationPlan('UG-REAL-001', '2026-07', {});
  await rt.saveAllocationOverrides('UG-REAL-001', '2026-07', { 'UB-X': { allocationPct: 0.99 } });
  const planAfter = await rt.getAllocationPlan('UG-REAL-001', '2026-07', {});
  // saveAllocationOverrides não altera estado do provider — planos construídos com overrides={} devem ser equivalentes
  const sameShape = planBefore === null ? planAfter === null : planAfter !== null && planBefore.totalPct === planAfter.totalPct && planBefore.rows.length === planAfter.rows.length;
  assert('AL3 getAllocationPlan inalterado após saveAllocationOverrides', sameShape);
}

// ============================================================
// Suite AM — Nenhum método retorna persisted=true
// ============================================================
async function suiteAM() {
  console.log('\nSuite AM — Nenhum método retorna persisted=true');
  const rt = createEsaRuntimeProvider(makeProvider());

  const r1 = await rt.saveAllocationOverrides('UG-X', '2026-07', {});
  assert('AM1 saveAllocationOverrides.persisted !== true', r1.persisted !== true);

  const r2 = await rt.closeMonthlySettlement('UG-X', '2026-07');
  assert('AM2 closeMonthlySettlement.persisted !== true', r2.persisted !== true);

  const r3 = await rt.updateCyclePrice('UG-X', '2026-07', 0.40, '');
  assert('AM3 updateCyclePrice.persisted !== true', r3.persisted !== true);
}

// ============================================================
// Suite AN — MutationResult: campos adicionais compatíveis com tipo
// ============================================================
async function suiteAN() {
  console.log('\nSuite AN — MutationResult shape retrocompatível');
  const rt = createEsaRuntimeProvider(makeProvider());

  const results = await Promise.all([
    rt.saveAllocationOverrides('UG-X', '2026-07', {}),
    rt.closeMonthlySettlement('UG-X', '2026-07'),
    rt.updateCyclePrice('UG-X', '2026-07', 0.38, ''),
  ]);

  results.forEach((r, i) => {
    assert(`AN${i + 1} resultado tem campo ok (retrocompatível)`, 'ok' in r);
    assert(`AN${i + 4} resultado tem campo persisted`, 'persisted' in r);
    assert(`AN${i + 7} resultado tem campo capability`, 'capability' in r);
    assert(`AN${i + 10} resultado tem campo message`, 'message' in r);
  });
}

// ============================================================
// Suite AO — Demo permanece intacto (retorna ok:true)
// ============================================================
async function suiteAO() {
  console.log('\nSuite AO — Demo preservado: mutações retornam ok:true');
  const demo = demoRuntimeProvider;

  const saveDemo = await demo.saveAllocationOverrides('UG-001', '2026-07', {});
  assert('AO1 demo saveAllocationOverrides ok === true', saveDemo.ok === true);
  assert('AO2 demo saveAllocationOverrides persisted não é false', saveDemo.persisted !== false);

  const closeDemo = await demo.closeMonthlySettlement('UG-001', '2026-07');
  assert('AO3 demo closeMonthlySettlement ok === true', closeDemo.ok === true);
  assert('AO4 demo closeMonthlySettlement persisted não é false', closeDemo.persisted !== false);

  const priceDemo = await demo.updateCyclePrice('UG-001', '2026-07', 0.40, '');
  assert('AO5 demo updateCyclePrice ok === true', priceDemo.ok === true);
  assert('AO6 demo updateCyclePrice persisted não é false', priceDemo.persisted !== false);

  const plan = await demo.getAllocationPlan('UG-001', '2026-07');
  assert('AO7 demo getAllocationPlan intacto após correções', plan !== null && plan!.rows.length > 0);

  const price = await demo.getAppliedPrice('UG-001', '2026-06');
  assert('AO8 demo getAppliedPrice histórico intacto', Math.abs(price - 0.34) < 0.001);
}

// ============================================================
// Suite AP — Mensagens exatas dos toasts
// ============================================================
async function suiteAP() {
  console.log('\nSuite AP — Mensagens exatas das mutações');
  const rt = createEsaRuntimeProvider(makeProvider());

  const saveResult = await rt.saveAllocationOverrides('UG-X', '2026-07', {});
  assert('AP1 saveAllocationOverrides message é exatamente o esperado',
    saveResult.message === 'Prévia calculada. Persistência ainda não habilitada.');

  const closeResult = await rt.closeMonthlySettlement('UG-X', '2026-07');
  assert('AP2 closeMonthlySettlement message é exatamente o esperado',
    closeResult.message === 'Fechamento indisponível: persistência do ciclo ainda não habilitada.');

  const priceResult = await rt.updateCyclePrice('UG-X', '2026-07', 0.42, 'razão');
  assert('AP3 updateCyclePrice message é exatamente o esperado',
    priceResult.message === 'Preço simulado nesta sessão. Alteração ainda não persistida.');
}

// ============================================================
// Suite AQ — Sem computeSettlement nem dados demo no provider real
// ============================================================
async function suiteAQ() {
  console.log('\nSuite AQ — Provider real não usa dados demo nem billing');
  const src = createEsaRuntimeProvider.toString();
  assert('AQ1 provider real não contém computeSettlement', !src.includes('computeSettlement'));
  assert('AQ2 provider real não contém UG-001 hardcoded', !src.includes('"UG-001"') && !src.includes("'UG-001'"));
  assert('AQ3 provider real não contém calculationMemory', !src.includes('calculationMemory'));
  assert('AQ4 provider real não contém scaledResults', !src.includes('scaledResults'));
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Gate 3C — persist=false mutation tests');
  console.log('='.repeat(60));

  await suiteAI();
  await suiteAJ();
  await suiteAK();
  await suiteAL();
  await suiteAM();
  await suiteAN();
  await suiteAO();
  await suiteAP();
  await suiteAQ();

  console.log('\n' + '='.repeat(60));
  console.log(`Gate 3C persist Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
