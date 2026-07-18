// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 3C — Apuração Mensal connection tests
// Rodar: npx tsx tests/settlement-gate3c.manual-test.ts
// ============================================================

import { demoRuntimeProvider } from '../providers/demoRuntimeProvider';
import { createEsaRuntimeProvider } from '../providers/esaRuntimeProvider';

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

const REAL_UG = { id: 'UG-REAL-001', name: 'UG Real Assaí', owner: 'Ana Real', document: '111.222.333-44', uc: '999888777', distributor: 'Copel', status: 'ativa', purchasePrice: 0.38, previousBalance: 1200, monthlyGeneration: 10000 };
const REAL_UB1 = { id: 'UB-REAL-001', name: 'Loja Real 1', document: '11.222.333/0001-44', uc: '111000111', distributor: 'Copel', ugId: 'UG-REAL-001', status: 'ativa', monthlyConsumption: 3000, annualAverage: 36000, previousCreditBalance: 200, allocationPct: 0.6, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 300, cip: 40, otherCharges: 0, paymentStatus: 'aberto' };
const REAL_UB2 = { id: 'UB-REAL-002', name: 'Loja Real 2', document: '22.333.444/0001-55', uc: '222000222', distributor: 'Copel', ugId: 'UG-REAL-001', status: 'ativa', monthlyConsumption: 2000, annualAverage: 24000, previousCreditBalance: 100, allocationPct: 0.4, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 200, cip: 35, otherCharges: 0, paymentStatus: 'aberto' };

// ============================================================
// Suite V — Ciclo vazio (sem UGs no repositório)
// ============================================================
async function suiteV() {
  console.log('\nSuite V — Ciclo vazio (repositório sem UGs)');
  const rt = createEsaRuntimeProvider(makeProvider());

  const plan = await rt.getAllocationPlan('UG-INEXISTENTE', '2026-07');
  assert('V1 plan null quando UG não existe', plan === null);

  const months = await rt.listMonths();
  assert('V2 listMonths não lança com repositório vazio', Array.isArray(months));

  const saveResult = await rt.saveAllocationOverrides('UG-X', '2026-07', {});
  assert('V3 saveAllocationOverrides retorna ok mesmo sem UG', saveResult.ok === true);

  const closeResult = await rt.closeMonthlySettlement('UG-X', '2026-07');
  assert('V4 closeMonthlySettlement retorna ok (NOT_IMPLEMENTED seguro)', closeResult.ok === true);

  const price = await rt.getAppliedPrice('UG-INEXISTENTE', '2026-07');
  assert('V5 getAppliedPrice retorna 0 quando UG não existe', price === 0);

  const updatePrice = await rt.updateCyclePrice('UG-X', '2026-07', 0.4, 'teste');
  assert('V6 updateCyclePrice retorna ok (persist=false)', updatePrice.ok === true);
}

// ============================================================
// Suite W — UG existente sem beneficiárias
// ============================================================
async function suiteW() {
  console.log('\nSuite W — UG existente sem beneficiárias');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: () => ({ ok: true, data: [] }),
    getGeneratingUnitSummary: () => ({ ok: true, data: { totalGenerationKwh: 10000, totalAllocatedKwh: 0, totalCompensatedKwh: 0, currentBalanceKwh: 10000, beneficiaryCount: 0 } }),
  }));

  const plan = await rt.getAllocationPlan('UG-REAL-001', '2026-07');
  assert('W1 plan não null quando UG existe', plan !== null);
  assert('W2 plan.rows vazio quando sem UBs', plan!.rows.length === 0);
  assert('W3 plan.generation > 0 da UG real', plan!.generation > 0);
  assert('W4 plan.totalPct = 0 sem UBs', plan!.totalPct === 0);
  assert('W5 plan.totalCompensated = 0 sem UBs', plan!.totalCompensated === 0);
  assert('W6 plan.ownerPayment = 0 sem UBs', plan!.ownerPayment === 0);
  assert('W7 plan.esaRevenue = 0 sem UBs', plan!.esaRevenue === 0);
  assert('W8 plan.ug.id correto', plan!.ug.id === 'UG-REAL-001');
}

// ============================================================
// Suite X — UG com múltiplas UBs (dados reais mapeados)
// ============================================================
async function suiteX() {
  console.log('\nSuite X — UG com múltiplas UBs — dados reais mapeados');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: (_args: unknown) => {
      const a = _args as { ugId?: string };
      const items = a?.ugId === 'UG-REAL-001' ? [REAL_UB1, REAL_UB2] : [];
      return { ok: true, data: items };
    },
    getGeneratingUnitSummary: () => ({ ok: true, data: { totalGenerationKwh: 10000, totalAllocatedKwh: 5000, totalCompensatedKwh: 5000, currentBalanceKwh: 5000, beneficiaryCount: 2 } }),
  }));

  const plan = await rt.getAllocationPlan('UG-REAL-001', '2026-07');
  assert('X1 plan não null', plan !== null);
  assert('X2 plan.rows.length = 2', plan!.rows.length === 2);
  assert('X3 generation = 10000 (do Core summary)', plan!.generation === 10000);
  assert('X4 UB1 allocationPct = 0.6', plan!.rows[0].allocationPct === 0.6);
  assert('X5 UB2 allocationPct = 0.4', plan!.rows[1].allocationPct === 0.4);
  assert('X6 UB1 planned = generation * 0.6 = 6000', Math.abs(plan!.rows[0].planned - 6000) < 0.001);
  assert('X7 UB2 planned = generation * 0.4 = 4000', Math.abs(plan!.rows[1].planned - 4000) < 0.001);
  assert('X8 totalPct = 1.0', Math.abs(plan!.totalPct - 1.0) < 0.001);
  assert('X9 UB1 monthlyAverage = 36000/12 = 3000', Math.abs(plan!.rows[0].monthlyAverage - 3000) < 0.001);
  assert('X10 UB1 targetCredit = 3000*(1+0.05) = 3150', Math.abs(plan!.rows[0].targetCredit - 3150) < 0.001);
  assert('X11 UB1 currentBalance = 200 (previousCreditBalance)', plan!.rows[0].currentBalance === 200);
  assert('X12 UB1 recommendedAdd = 3150 - 200 = 2950', Math.abs(plan!.rows[0].recommendedAdd - 2950) < 0.001);
  assert('X13 ownerPayment = totalCompensated * purchasePrice', Math.abs(plan!.ownerPayment - plan!.totalCompensated * REAL_UG.purchasePrice) < 0.01);
  assert('X14 esaRevenue usa esaPrice de cada UB', plan!.esaRevenue > 0);
  assert('X15 UB1 ub.name mapeado corretamente', plan!.rows[0].ub.name === 'Loja Real 1');
}

// ============================================================
// Suite Y — Modo automático: recommendedPct como displayPct
// ============================================================
async function suiteY() {
  console.log('\nSuite Y — Modo automático: recommendedPct correto');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: (_args: unknown) => {
      const a = _args as { ugId?: string };
      return { ok: true, data: a?.ugId === 'UG-REAL-001' ? [REAL_UB1, REAL_UB2] : [] };
    },
    getGeneratingUnitSummary: () => ({ ok: true, data: { totalGenerationKwh: 10000, totalAllocatedKwh: 0, totalCompensatedKwh: 0, currentBalanceKwh: 0, beneficiaryCount: 2 } }),
  }));

  const plan = await rt.getAllocationPlan('UG-REAL-001', '2026-07');
  assert('Y1 plan não null', plan !== null);
  const sumRec = plan!.rows.reduce((s, r) => s + r.recommendedAdd, 0);
  assert('Y2 sumNeeds > 0', sumRec > 0);
  const r1 = plan!.rows[0];
  const r2 = plan!.rows[1];
  const expectedPct1 = r1.recommendedAdd / sumRec;
  const expectedPct2 = r2.recommendedAdd / sumRec;
  assert('Y3 UB1 recommendedPct = rec1/sumRec', Math.abs(r1.recommendedPct - expectedPct1) < 0.0001);
  assert('Y4 UB2 recommendedPct = rec2/sumRec', Math.abs(r2.recommendedPct - expectedPct2) < 0.0001);
  assert('Y5 soma recommendedPct = 1.0', Math.abs(r1.recommendedPct + r2.recommendedPct - 1.0) < 0.0001);
}

// ============================================================
// Suite Z — Modo manual: overrides de allocationPct respeitados
// ============================================================
async function suiteZ() {
  console.log('\nSuite Z — Modo manual: overrides de allocationPct');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: (_args: unknown) => {
      const a = _args as { ugId?: string };
      return { ok: true, data: a?.ugId === 'UG-REAL-001' ? [REAL_UB1, REAL_UB2] : [] };
    },
    getGeneratingUnitSummary: () => ({ ok: true, data: { totalGenerationKwh: 10000, totalAllocatedKwh: 0, totalCompensatedKwh: 0, currentBalanceKwh: 0, beneficiaryCount: 2 } }),
  }));

  const overrides = { 'UB-REAL-001': { allocationPct: 0.7 }, 'UB-REAL-002': { allocationPct: 0.3 } };
  const plan = await rt.getAllocationPlan('UG-REAL-001', '2026-07', overrides);
  assert('Z1 plan não null com overrides', plan !== null);
  assert('Z2 UB1 allocationPct = override 0.7', Math.abs(plan!.rows[0].allocationPct - 0.7) < 0.001);
  assert('Z3 UB2 allocationPct = override 0.3', Math.abs(plan!.rows[1].allocationPct - 0.3) < 0.001);
  assert('Z4 UB1 planned = 10000 * 0.7 = 7000', Math.abs(plan!.rows[0].planned - 7000) < 0.001);
  assert('Z5 UB2 planned = 10000 * 0.3 = 3000', Math.abs(plan!.rows[1].planned - 3000) < 0.001);
  assert('Z6 totalPct = 1.0 com overrides', Math.abs(plan!.totalPct - 1.0) < 0.001);
}

// ============================================================
// Suite AA — Validação total rateio 100%
// ============================================================
async function suiteAA() {
  console.log('\nSuite AA — Validação total de rateio');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: (_args: unknown) => {
      const a = _args as { ugId?: string };
      return { ok: true, data: a?.ugId === 'UG-REAL-001' ? [REAL_UB1, REAL_UB2] : [] };
    },
    getGeneratingUnitSummary: () => ({ ok: true, data: { totalGenerationKwh: 10000, totalAllocatedKwh: 0, totalCompensatedKwh: 0, currentBalanceKwh: 0, beneficiaryCount: 2 } }),
  }));

  const planExact = await rt.getAllocationPlan('UG-REAL-001', '2026-07', {});
  assert('AA1 totalPct exato 0.6+0.4=1.0', Math.abs(planExact!.totalPct - 1.0) < 0.0005);

  const planInvalid = await rt.getAllocationPlan('UG-REAL-001', '2026-07', {
    'UB-REAL-001': { allocationPct: 0.5 },
    'UB-REAL-002': { allocationPct: 0.3 },
  });
  assert('AA2 totalPct inválido = 0.8 (< 1.0)', Math.abs(planInvalid!.totalPct - 0.8) < 0.001);
  assert('AA3 totalPct !== 1.0 detectável', Math.abs(planInvalid!.totalPct - 1.0) > 0.0005);
}

// ============================================================
// Suite AB — Preço padrão e preço aplicado
// ============================================================
async function suiteAB() {
  console.log('\nSuite AB — Preço padrão e preço aplicado');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
  }));

  const price = await rt.getAppliedPrice('UG-REAL-001', '2026-07');
  assert('AB1 getAppliedPrice retorna purchasePrice da UG', Math.abs(price - REAL_UG.purchasePrice) < 0.0001);

  const updateResult = await rt.updateCyclePrice('UG-REAL-001', '2026-07', 0.42, 'ajuste ciclo');
  assert('AB2 updateCyclePrice retorna ok (persist=false)', updateResult.ok === true);
}

// ============================================================
// Suite AC — Ciclo fechado: preço histórico preservado
// ============================================================
async function suiteAC() {
  console.log('\nSuite AC — Ciclo fechado e persistência');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: (_args: unknown) => {
      const a = _args as { ugId?: string };
      return { ok: true, data: a?.ugId === 'UG-REAL-001' ? [REAL_UB1] : [] };
    },
    getGeneratingUnitSummary: () => ({ ok: true, data: { totalGenerationKwh: 10000, totalAllocatedKwh: 5000, totalCompensatedKwh: 5000, currentBalanceKwh: 5000, beneficiaryCount: 1 } }),
  }));

  const plan = await rt.getAllocationPlan('UG-REAL-001', '2026-06');
  assert('AC1 plan de mês fechado retorna dados (purchasePrice da UG)', plan !== null);
  assert('AC2 plan usa purchasePrice como appliedPrice base', plan !== null && plan.ug.purchasePrice === REAL_UG.purchasePrice);

  const saveResult = await rt.saveAllocationOverrides('UG-REAL-001', '2026-06', { 'UB-REAL-001': { allocationPct: 0.9 } });
  assert('AC3 saveAllocationOverrides retorna ok (persist=false documentado)', saveResult.ok === true);

  const closeResult = await rt.closeMonthlySettlement('UG-REAL-001', '2026-06');
  assert('AC4 closeMonthlySettlement retorna ok (NOT_IMPLEMENTED)', closeResult.ok === true);
}

// ============================================================
// Suite AD — Erros do provider tratados com segurança
// ============================================================
async function suiteAD() {
  console.log('\nSuite AD — Erros do provider tratados com segurança');

  const rtUgThrows = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => { throw new Error('Core UG search error'); },
  }));
  await assertNoThrow('AD1 getAllocationPlan não lança quando searchGeneratingUnits lança', () => rtUgThrows.getAllocationPlan('UG-X', '2026-07'));
  const planAfterUgThrow = await (async () => {
    try { return await rtUgThrows.getAllocationPlan('UG-X', '2026-07'); } catch { return 'THREW'; }
  })();
  assert('AD2 getAllocationPlan retorna null (não THREW) quando UG search falha', planAfterUgThrow === null);

  const rtUbThrows = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: () => { throw new Error('Core UB search error'); },
  }));
  await assertNoThrow('AD3 getAllocationPlan não lança quando searchBeneficiaryUnits lança', () => rtUbThrows.getAllocationPlan('UG-REAL-001', '2026-07'));

  const rtSumThrows = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: () => ({ ok: true, data: [] }),
    getGeneratingUnitSummary: () => { throw new Error('Core summary error'); },
  }));
  await assertNoThrow('AD4 getAllocationPlan usa monthlyGeneration quando getGeneratingUnitSummary lança', () => rtSumThrows.getAllocationPlan('UG-REAL-001', '2026-07'));
  const planFallback = await rtSumThrows.getAllocationPlan('UG-REAL-001', '2026-07');
  assert('AD5 generation fallback para ug.monthlyGeneration quando summary falha', planFallback !== null && planFallback.generation === REAL_UG.monthlyGeneration);
}

// ============================================================
// Suite AE — Nenhum dado demo em runtime=real
// ============================================================
async function suiteAE() {
  console.log('\nSuite AE — Nenhum dado demo em runtime=real');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [] }),
    searchBeneficiaryUnits: () => ({ ok: true, data: [] }),
  }));

  const plan = await rt.getAllocationPlan('UG-001', '2026-07');
  assert('AE1 UG-001 demo não aparece em runtime=real (plan=null)', plan === null);

  const ugs = await rt.listGeneratingUnits();
  assert('AE2 listGeneratingUnits não retorna UGs demo (array vazio)', ugs.length === 0);

  const ubs = await rt.listBeneficiaryUnits({ ugId: 'UG-001' });
  assert('AE3 listBeneficiaryUnits não retorna UBs demo', ubs.length === 0);

  const price = await rt.getAppliedPrice('UG-001', '2026-07');
  assert('AE4 getAppliedPrice de UG-001 demo retorna 0 (não purchasePrice demo)', price === 0);
}

// ============================================================
// Suite AF — Demo preservado integralmente após Gate 3C
// ============================================================
async function suiteAF() {
  console.log('\nSuite AF — Demo preservado após Gate 3C');
  const demo = demoRuntimeProvider;

  const planUG1 = await demo.getAllocationPlan('UG-001', '2026-07');
  assert('AF1 demo getAllocationPlan UG-001 retorna plan', planUG1 !== null);
  assert('AF2 demo plan tem rows > 0', planUG1!.rows.length > 0);
  assert('AF3 demo plan.generation = 13000', planUG1!.generation === 13000);
  assert('AF4 demo ownerPayment > 0', planUG1!.ownerPayment > 0);
  assert('AF5 demo esaRevenue > 0', planUG1!.esaRevenue > 0);

  const saveDemo = await demo.saveAllocationOverrides('UG-001', '2026-07', {});
  assert('AF6 demo saveAllocationOverrides retorna ok', saveDemo.ok === true);

  const closeDemo = await demo.closeMonthlySettlement('UG-001', '2026-07');
  assert('AF7 demo closeMonthlySettlement retorna ok', closeDemo.ok === true);

  const priceDemo = await demo.getAppliedPrice('UG-001', '2026-06');
  assert('AF8 demo getAppliedPrice retorna valor histórico (0.34)', Math.abs(priceDemo - 0.34) < 0.001);

  const planUG2 = await demo.getAllocationPlan('UG-002', '2026-07');
  assert('AF9 demo plan UG-002 tem rows', planUG2 !== null && planUG2!.rows.length > 0);
}

// ============================================================
// Suite AG — AllocationPlan: cobertura por UB
// ============================================================
async function suiteAG() {
  console.log('\nSuite AG — AllocationPlan: cobertura e saldo final por UB');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: (_args: unknown) => {
      const a = _args as { ugId?: string };
      return { ok: true, data: a?.ugId === 'UG-REAL-001' ? [REAL_UB1, REAL_UB2] : [] };
    },
    getGeneratingUnitSummary: () => ({ ok: true, data: { totalGenerationKwh: 10000, totalAllocatedKwh: 0, totalCompensatedKwh: 0, currentBalanceKwh: 0, beneficiaryCount: 2 } }),
  }));

  const plan = await rt.getAllocationPlan('UG-REAL-001', '2026-07');
  const r1 = plan!.rows[0];
  const r2 = plan!.rows[1];

  // UB1: avail = 200 + 6000 = 6200; consumption = 3000; compensated = min(3000,6200)=3000; final=3200
  assert('AG1 UB1 compensated = min(consumption, avail)', Math.abs(r1.compensated - 3000) < 0.001);
  assert('AG2 UB1 finalBalance = avail - compensated = 3200', Math.abs(r1.finalBalance - 3200) < 0.001);
  assert('AG3 UB1 coverageMonths = finalBalance / monthlyAvg = 3200/3000', Math.abs(r1.coverageMonths - (3200 / 3000)) < 0.001);

  // UB2: avail = 100 + 4000 = 4100; consumption = 2000; compensated = min(2000,4100)=2000; final=2100
  assert('AG4 UB2 compensated = 2000', Math.abs(r2.compensated - 2000) < 0.001);
  assert('AG5 UB2 finalBalance = 2100', Math.abs(r2.finalBalance - 2100) < 0.001);

  assert('AG6 totalFinalBalance = UB1.final + UB2.final = 5300', Math.abs(plan!.totalFinalBalance - 5300) < 0.001);
  assert('AG7 totalConsumption = 3000 + 2000 = 5000', Math.abs(plan!.totalConsumption - 5000) < 0.001);
  assert('AG8 totalCompensated = 3000 + 2000 = 5000', Math.abs(plan!.totalCompensated - 5000) < 0.001);
}

// ============================================================
// Suite AH — Resumo financeiro calculado no provider (não no HTML)
// ============================================================
async function suiteAH() {
  console.log('\nSuite AH — Resumo financeiro no provider');
  const rt = createEsaRuntimeProvider(makeProvider({
    searchGeneratingUnits: () => ({ ok: true, data: [REAL_UG] }),
    searchBeneficiaryUnits: (_args: unknown) => {
      const a = _args as { ugId?: string };
      return { ok: true, data: a?.ugId === 'UG-REAL-001' ? [REAL_UB1, REAL_UB2] : [] };
    },
    getGeneratingUnitSummary: () => ({ ok: true, data: { totalGenerationKwh: 10000, totalAllocatedKwh: 0, totalCompensatedKwh: 0, currentBalanceKwh: 0, beneficiaryCount: 2 } }),
  }));

  const plan = await rt.getAllocationPlan('UG-REAL-001', '2026-07');
  assert('AH1 ownerPayment = totalCompensated * purchasePrice', Math.abs(plan!.ownerPayment - plan!.totalCompensated * REAL_UG.purchasePrice) < 0.01);
  assert('AH2 esaRevenue > 0 (compensado × esaPrice de cada UB)', plan!.esaRevenue > 0);
  // esaRevenue = 3000*0.55 + 2000*0.55 = 1650 + 1100 = 2750
  assert('AH3 esaRevenue = 2750 (UB1=3000×0.55 + UB2=2000×0.55)', Math.abs(plan!.esaRevenue - 2750) < 0.01);
  // ownerPayment = 5000 * 0.38 = 1900
  assert('AH4 ownerPayment = 5000 × 0.38 = 1900', Math.abs(plan!.ownerPayment - 1900) < 0.01);
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Gate 3C — Apuração Mensal Connection Tests');
  console.log('='.repeat(60));

  await suiteV();
  await suiteW();
  await suiteX();
  await suiteY();
  await suiteZ();
  await suiteAA();
  await suiteAB();
  await suiteAC();
  await suiteAD();
  await suiteAE();
  await suiteAF();
  await suiteAG();
  await suiteAH();

  console.log('\n' + '='.repeat(60));
  console.log(`Gate 3C Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
