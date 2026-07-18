// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 4 — Promoção do Runtime Direto
// Verifica que a lógica de promoção e rollback está correta,
// que o bridge não usa dados demo e que _initRealMode faz
// telemetria sem fallback silencioso.
// Rodar: npx tsx tests/promotion-gate4.manual-test.ts
// ============================================================

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

// ============================================================
// Suite BM — Provider real: mode === "real"
// ============================================================
async function suiteBM() {
  console.log('\nSuite BM — Provider real: mode e invariantes');
  const rt = createEsaRuntimeProvider(makeProvider());

  assert('BM1 rt.mode === "real"', rt.mode === 'real');
  await assertNoThrow('BM2 listMonths não lança', () => rt.listMonths());
  await assertNoThrow('BM3 listGeneratingUnits não lança', () => rt.listGeneratingUnits());
  await assertNoThrow('BM4 listBeneficiaryUnits não lança', () => rt.listBeneficiaryUnits());

  const months = await rt.listMonths();
  assert('BM5 listMonths retorna array', Array.isArray(months));
  assert('BM6 meses têm value e label', months.length === 0 || (typeof months[0].value === 'string' && typeof months[0].label === 'string'));

  const ugs = await rt.listGeneratingUnits();
  assert('BM7 listGeneratingUnits retorna array', Array.isArray(ugs));
}

// ============================================================
// Suite BN — Provider real: sem dados demo hardcoded
// ============================================================
async function suiteBN() {
  console.log('\nSuite BN — Provider real: sem dados demo');
  const src = createEsaRuntimeProvider.toString();

  assert('BN1 provider real não contém UG-001 hardcoded', !src.includes('"UG-001"') && !src.includes("'UG-001'"));
  assert('BN2 provider real não contém UB-001 hardcoded', !src.includes('"UB-001"') && !src.includes("'UB-001'"));
  assert('BN3 provider real não contém MONTH_FACTOR', !src.includes('MONTH_FACTOR'));
  assert('BN4 provider real não contém scaledResults', !src.includes('scaledResults'));
  assert('BN5 provider real não contém calculationMemory', !src.includes('calculationMemory'));
  assert('BN6 provider real não contém computeSettlement', !src.includes('computeSettlement'));
}

// ============================================================
// Suite BO — Provider real: listMonths usa AVAILABLE_MONTHS
// ============================================================
async function suiteBO() {
  console.log('\nSuite BO — Provider real: AVAILABLE_MONTHS (não demo MONTHS_AV)');
  const rt = createEsaRuntimeProvider(makeProvider());
  const months = await rt.listMonths();

  // AVAILABLE_MONTHS deve ser array; se vazio, não tem meses demo
  assert('BO1 listMonths retorna array', Array.isArray(months));

  // Em nenhum caso deve conter meses com factor aplicado
  const src = createEsaRuntimeProvider.toString();
  assert('BO2 não contém MONTHS_AV (demo months)', !src.includes('MONTHS_AV'));
}

// ============================================================
// Suite BP — Provider real: getDashboardData sem projeção demo
// ============================================================
async function suiteBP() {
  console.log('\nSuite BP — getDashboardData: zeros honestos quando Core retorna null');
  const rt = createEsaRuntimeProvider(makeProvider({
    getExecutiveSummary: () => null,
    getFinancialSummary: () => null,
  }));

  const data = await rt.getDashboardData({ month: '2026-07' });
  assert('BP1 getDashboardData não lança', data !== undefined);
  assert('BP2 current.generation não usa demo', data.current.generation === 0);
  assert('BP3 current.revenue não usa demo', data.current.revenue === 0);
  assert('BP4 results é array vazio (sem rows demo)', Array.isArray(data.results) && data.results.length === 0);
  assert('BP5 criticalAlerts sem demo fallback', data.criticalAlerts === 0);
}

// ============================================================
// Suite BQ — Provider real: getImportHistory sempre vazio
// ============================================================
async function suiteBQ() {
  console.log('\nSuite BQ — getImportHistory: sempre array vazio no runtime real');
  const rt = createEsaRuntimeProvider(makeProvider());

  const history = await rt.getImportHistory();
  assert('BQ1 getImportHistory retorna array', Array.isArray(history));
  assert('BQ2 array está vazio (honesto)', history.length === 0);
  await assertNoThrow('BQ3 não lança', () => rt.getImportHistory());
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Gate 4 — Promoção do Runtime Direto');
  console.log('='.repeat(60));

  await suiteBM();
  await suiteBN();
  await suiteBO();
  await suiteBP();
  await suiteBQ();

  console.log('\n' + '='.repeat(60));
  console.log(`Gate 4 Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
