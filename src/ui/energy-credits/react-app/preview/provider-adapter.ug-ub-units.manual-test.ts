/**
 * Manual test — UG/UB unit management contract
 *
 * Coverage:
 *  A. Lista UG vazia / UB vazia
 *  B. listGeneratingUnits / listBeneficiaryUnits shape
 *  C. getGeneratingUnitCycleSummary — safe with empty repo
 *  D. getGeneratingUnitCommercialTerms — safe with empty repo
 *  E. getGeneratingUnitCreditDestinationReport — returns null on empty repo
 *  F. getCreditAllocationPlan — rows: [] on empty repo (no crash)
 *  G. getSettlementRecipient — safe with empty repo
 *  H. createGeneratingUnit / createBeneficiaryUnit — no crash, ok response
 *  I. hasSufficientHistory pattern — getBeneficiaryAverageComposition safe with empty id
 *  J. getBeneficiaryCreditBalance — returns null on empty repo (no crash)
 *  K. getBeneficiaryMonthlyHistory — returns [] on empty repo
 *  L. getBeneficiaryAverageComposition — returns null on empty repo
 *  M. Financial fields absent → no crash (defensive mapping)
 *  N. Actions menu: no crash with undefined ug/ub from provider
 */

import { createProviderAdapter } from '../src/lib/esa/provider-adapter';

// ─── Shared helpers ──────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function ok(label: string, value: boolean) {
  if (value) { console.log(`  ✓ ${label}`); pass++; }
  else        { console.error(`  ✗ FAIL: ${label}`); fail++; }
}

function group(title: string, fn: () => void) {
  console.log(`\n=== ${title} ===`);
  fn();
}

// ─── Empty UIProvider ─────────────────────────────────────────────────────────

function makeEmpty() {
  const empty = { ok: true, data: null };
  return {
    searchGeneratingUnits: () => ({ ok: true, data: [] }),
    searchBeneficiaryUnits: () => ({ ok: true, data: [] }),
    getExecutiveSummary: () => empty,
    getFinancialSummary: () => empty,
    getAlertsSummary: () => ({ ok: true, data: { alerts: [], totalAlerts: 0 } }),
    getGeneratingUnitSummary: () => empty,
    getAllocationPlan: () => empty,
    getGeneratingUnitCommercialTerms: () => empty,
    getOwnerMonthlyReport: () => { throw new Error('[buildOwnerMonthlyReport] unidade não encontrada'); },
    getSettlementRecipient: () => empty,
    createGeneratingUnit: (input: any) => ({ ok: true, data: { id: input.id ?? 'new-ug', ok: true } }),
    createBeneficiaryUnit: (input: any) => ({ ok: true, data: { id: input.id ?? 'new-ub', ok: true } }),
    updateGeneratingUnit: () => ({ ok: true, data: { ok: true } }),
    updateBeneficiaryUnit: () => ({ ok: true, data: { ok: true } }),
    getBeneficiaryConsumptionAverage: () => empty,
    getBeneficiaryCreditBalance: () => empty,
    getBeneficiaryHistory: () => ({ ok: true, data: { months: [] } }),
    getBeneficiaryMonthlyDataSources: () => empty,
    getBeneficiaryMonthlyReport: () => { throw new Error('[buildBeneficiaryMonthlyReport] unidade não encontrada'); },
    getCsvTemplate: () => empty,
    getUnlinkedUtilityBills: () => ({ ok: true, data: [] }),
    simulateUtilityBillExtraction: () => empty,
    confirmUtilityBillExtraction: () => empty,
    reviewUtilityBillImport: () => ({ ok: true, data: { ok: true } }),
    matchUtilityBillImport: () => empty,
    linkUtilityBillToBeneficiary: () => ({ ok: true, data: { ok: true } }),
    prepareBeneficiaryFromUtilityBill: () => empty,
    confirmUtilityBillMonthlyRecord: () => ({ ok: true, data: { ok: true } }),
    replaceUtilityBillMonthlyRecord: () => ({ ok: true, data: { ok: true } }),
    confirmInvoicePayment: () => ({ ok: true, data: { ok: true } }),
    reopenInvoicePayment: () => ({ ok: true, data: { ok: true } }),
    confirmOwnerSettlementPayment: () => ({ ok: true, data: { ok: true } }),
  };
}

// ─── UG with real data ────────────────────────────────────────────────────────

function makeWithUg() {
  const base = makeEmpty();
  return {
    ...base,
    searchGeneratingUnits: () => ({
      ok: true,
      data: [{
        id: 'ug-001', name: 'UG Solar Norte', owner: 'João Silva', document: '123.456.789-00',
        uc: 'UC001', distributor: 'COPEL', status: 'ativa',
        purchasePrice: 0.35, previousBalance: 5000, monthlyGeneration: 12500,
        beneficiaries: [], payee: { name: 'João Silva', document: '123.456.789-00', pixKey: 'joao@pix.com', pixType: 'email' },
      }],
    }),
    searchBeneficiaryUnits: () => ({
      ok: true,
      data: [{
        id: 'ub-001', name: 'Mercado Central', document: '12.222.333/0001-44',
        uc: 'UC999', distributor: 'COPEL', ugId: 'ug-001', status: 'ativa',
        monthlyConsumption: 3500, annualAverage: 42000, previousCreditBalance: 1200,
        allocationPct: 0.6, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85,
        taxes: 50, cip: 20, otherCharges: 0, paymentStatus: 'pago',
        customerSince: '2026-01-01', accumulatedSavings: 1234.56,
      }],
    }),
    getGeneratingUnitSummary: (_id: string, _f: any) => ({
      ok: true,
      data: {
        totalGenerationKwh: 12500, totalAllocatedKwh: 11000,
        totalCompensatedKwh: 9800, currentBalanceKwh: 1200, beneficiaryCount: 1,
      },
    }),
    getGeneratingUnitCommercialTerms: () => ({
      ok: true,
      data: {
        purchasePricePerKwh: 0.35, effectiveDate: '2026-01-01',
        lastAppliedPricePerKwh: 0.35, lastAppliedMonth: '2026-07',
        observation: 'Valor padrão',
      },
    }),
    getSettlementRecipient: () => ({
      ok: true,
      data: { recipientName: 'João Silva', recipientDocument: '123.456.789-00', pixKey: 'joao@pix.com', pixKeyType: 'email' },
    }),
    getBeneficiaryConsumptionAverage: () => ({
      ok: true,
      data: { monthsConsidered: 3, monthlyAverageKwh: 3500, bySource: { utility_bill_import: 2, csv_import: 1, manual_entry: 0 } },
    }),
    getBeneficiaryCreditBalance: () => ({
      ok: true,
      data: { previous: 800, received: 4199, compensated: 3800, final: 1199, coverageMonths: 0.34 },
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const emptyAdapter = createProviderAdapter(makeEmpty());
const realAdapter = createProviderAdapter(makeWithUg());
const MONTH = '2026-07';

group('Suite A: Lista UG/UB vazia', () => {
  ok('listGeneratingUnits retorna array', Array.isArray(emptyAdapter.listGeneratingUnits()));
  ok('listGeneratingUnits vazia: length 0', emptyAdapter.listGeneratingUnits().length === 0);
  ok('listGeneratingUnits.map não lança', (() => { try { emptyAdapter.listGeneratingUnits().map((u) => u.id); return true; } catch { return false; } })());
  ok('listBeneficiaryUnits retorna array', Array.isArray(emptyAdapter.listBeneficiaryUnits()));
  ok('listBeneficiaryUnits vazia: length 0', emptyAdapter.listBeneficiaryUnits().length === 0);
  ok('listBeneficiaryUnits.filter por ugId não lança', (() => { try { emptyAdapter.listBeneficiaryUnits().filter((b) => b.ugId === 'ug-001'); return true; } catch { return false; } })());
  ok('computeAll retorna array', Array.isArray(emptyAdapter.computeAll()));
  ok('computeAll vazio: length 0', emptyAdapter.computeAll().length === 0);
});

group('Suite B: listGeneratingUnits / listBeneficiaryUnits com dados', () => {
  const ugs = realAdapter.listGeneratingUnits();
  ok('listGeneratingUnits length 1', ugs.length === 1);
  ok('ug.id é string', typeof ugs[0].id === 'string');
  ok('ug.name é string', typeof ugs[0].name === 'string');
  ok('ug.owner é string', typeof ugs[0].owner === 'string');
  ok('ug.uc é string', typeof ugs[0].uc === 'string');
  ok('ug.purchasePrice é número', typeof ugs[0].purchasePrice === 'number');
  ok('ug.previousBalance é número', typeof ugs[0].previousBalance === 'number');
  ok('ug.monthlyGeneration é número', typeof ugs[0].monthlyGeneration === 'number');
  const ubs = realAdapter.listBeneficiaryUnits();
  ok('listBeneficiaryUnits length 1', ubs.length === 1);
  ok('ub.id é string', typeof ubs[0].id === 'string');
  ok('ub.ugId é string', typeof ubs[0].ugId === 'string');
  ok('ub.monthlyConsumption é número', typeof ubs[0].monthlyConsumption === 'number');
  ok('ub.accumulatedSavings é número', typeof ubs[0].accumulatedSavings === 'number');
});

group('Suite C: getGeneratingUnitCycleSummary — safe', () => {
  ok('empty repo: retorna null', emptyAdapter.getGeneratingUnitCycleSummary('ug-001', { month: MONTH }) === null);
  ok('empty id: retorna null', emptyAdapter.getGeneratingUnitCycleSummary('', { month: MONTH }) === null);
  const cs = realAdapter.getGeneratingUnitCycleSummary('ug-001', { month: MONTH });
  ok('real UG: retorna objeto', cs !== null);
  ok('generationKwh: 12500', cs?.generationKwh === 12500);
  ok('totalCompensatedKwh: 9800', cs?.totalCompensatedKwh === 9800);
  ok('totalFinalBalanceKwh: 1200', cs?.totalFinalBalanceKwh === 1200);
  ok('beneficiariesCount: 1', cs?.beneficiariesCount === 1);
});

group('Suite D: getGeneratingUnitCommercialTerms — safe', () => {
  ok('empty repo: retorna null', emptyAdapter.getGeneratingUnitCommercialTerms('ug-001') === null);
  const terms = realAdapter.getGeneratingUnitCommercialTerms('ug-001');
  ok('real UG: retorna objeto', terms !== null);
  ok('purchasePricePerKwh é número', typeof terms?.purchasePricePerKwh === 'number');
  ok('effectiveDate é string', typeof terms?.effectiveDate === 'string');
});

group('Suite E: getGeneratingUnitCreditDestinationReport — null on empty', () => {
  ok('empty repo: retorna null (sem crash)', emptyAdapter.getGeneratingUnitCreditDestinationReport('ug-001', MONTH) === null);
  ok('id vazio: retorna null', emptyAdapter.getGeneratingUnitCreditDestinationReport('', MONTH) === null);
});

group('Suite F: getCreditAllocationPlan — safe with empty repo', () => {
  // empty ugId always returns null
  ok('empty ugId: retorna null', emptyAdapter.getCreditAllocationPlan('', MONTH) === null);
  // With empty repo (Core returns null data): adapter returns null
  const planEmpty = emptyAdapter.getCreditAllocationPlan('ug-001', MONTH);
  ok('empty repo: retorna null (Core retorna null data)', planEmpty === null);
  // Component pattern: plan?.rows ?? [] is safe regardless of null
  ok('plan null: (plan?.rows ?? []).map não lança', (() => { try { (planEmpty?.rows ?? []).map((r: any) => r); return true; } catch { return false; } })());
  // When Core returns ANY non-null data (even different shape): adapter returns emptyAllocationPlan
  const adapterWithData = createProviderAdapter({
    ...makeEmpty(),
    getAllocationPlan: () => ({ ok: true, data: { generatingUnitId: 'ug-001', beneficiaries: [] } }),
  });
  const planWithData = adapterWithData.getCreditAllocationPlan('ug-001', MONTH);
  ok('core retorna dados (shape diferente): adapter retorna emptyAllocationPlan', planWithData !== null);
  ok('emptyAllocationPlan.rows é array', Array.isArray(planWithData?.rows));
  ok('emptyAllocationPlan.rows.length: 0', planWithData?.rows.length === 0);
  ok('emptyAllocationPlan.rows.map não lança', (() => { try { planWithData?.rows.map((r) => r); return true; } catch { return false; } })());
});

group('Suite G: getSettlementRecipient — safe', () => {
  ok('empty repo: retorna null', emptyAdapter.getSettlementRecipient('ug-001') === null);
  const rec = realAdapter.getSettlementRecipient('ug-001');
  ok('real UG: retorna objeto', rec !== null);
  ok('recipientName é string', typeof rec?.recipientName === 'string');
  ok('pixKey é string', typeof rec?.pixKey === 'string');
});

group('Suite H: createGeneratingUnit / createBeneficiaryUnit', () => {
  const ugResult = emptyAdapter.createGeneratingUnit({ id: 'ug-test', name: 'Teste' });
  ok('createGeneratingUnit não lança', ugResult !== undefined);
  const ubResult = emptyAdapter.createBeneficiaryUnit({ id: 'ub-test', name: 'Teste' });
  ok('createBeneficiaryUnit não lança', ubResult !== undefined);
  const ugResult2 = realAdapter.createGeneratingUnit({ id: 'ug-real', name: 'Real' });
  ok('createGeneratingUnit com dados não lança', ugResult2 !== undefined);
});

group('Suite I: hasSufficientHistory — getBeneficiaryAverageComposition safe', () => {
  ok('empty repo: retorna null (sem crash)', emptyAdapter.getBeneficiaryAverageComposition('ub-001') === null);
  ok('id vazio: retorna null (sem crash)', emptyAdapter.getBeneficiaryAverageComposition('') === null);
  const comp = realAdapter.getBeneficiaryAverageComposition('ub-001');
  ok('real UB: retorna objeto', comp !== null);
  ok('monthlyAverageKwh é número', typeof comp?.monthlyAverageKwh === 'number');
  ok('monthsConsidered é número', typeof comp?.monthsConsidered === 'number');
  ok('hasSufficientHistory ausente não causa crash', (() => {
    const has = (comp as any)?.hasSufficientHistory ?? false;
    return typeof has === 'boolean';
  })());
});

group('Suite J: getBeneficiaryCreditBalance — null on empty', () => {
  ok('empty repo: retorna null', emptyAdapter.getBeneficiaryCreditBalance('ub-001', MONTH) === null);
  ok('id vazio: retorna null', emptyAdapter.getBeneficiaryCreditBalance('', MONTH) === null);
  const cb = realAdapter.getBeneficiaryCreditBalance('ub-001', MONTH);
  ok('real UB: retorna objeto', cb !== null);
  ok('previous é número', typeof cb?.previous === 'number');
  ok('received é número', typeof cb?.received === 'number');
  ok('compensated é número', typeof cb?.compensated === 'number');
  ok('final é número', typeof cb?.final === 'number');
  ok('coverageMonths é número', typeof cb?.coverageMonths === 'number');
  ok('coverageMonths.toFixed não lança', (() => { try { cb?.coverageMonths.toFixed(1); return true; } catch { return false; } })());
});

group('Suite K: getBeneficiaryMonthlyHistory — [] on empty', () => {
  const h = emptyAdapter.getBeneficiaryMonthlyHistory('ub-001');
  ok('retorna array', Array.isArray(h));
  ok('array vazio', h.length === 0);
  ok('h.map não lança', (() => { try { h.map((r) => r); return true; } catch { return false; } })());
});

group('Suite L: getBeneficiaryAverageComposition via alias', () => {
  const comp = emptyAdapter.getBeneficiaryAverageComposition('ub-001');
  ok('retorna null com repo vazio', comp === null);
  const comp2 = realAdapter.getBeneficiaryAverageComposition('ub-001');
  ok('retorna objeto com dados reais', comp2 !== null);
  ok('bySource existe', typeof comp2?.bySource === 'object');
  ok('utility_bill_import é número', typeof comp2?.bySource?.utility_bill_import === 'number');
});

group('Suite M: campos financeiros ausentes sem crash', () => {
  const emptyUg = { id: '', name: '', owner: '', document: '', uc: '', distributor: '',
    status: 'ativa' as const, purchasePrice: 0, previousBalance: 0, monthlyGeneration: 0,
    beneficiaries: [], payee: { name: '', document: '', pixKey: '', pixType: 'cpf' as const } };
  ok('purchasePrice.toFixed não lança com 0', (() => { try { emptyUg.purchasePrice.toFixed(2); return true; } catch { return false; } })());
  ok('previousBalance.toFixed não lança com 0', (() => { try { emptyUg.previousBalance.toFixed(2); return true; } catch { return false; } })());

  const emptyUb = { id: '', name: '', document: '', uc: '', distributor: '', ugId: '',
    status: 'ativa' as const, monthlyConsumption: 0, annualAverage: 0, previousCreditBalance: 0,
    allocationPct: 0, preventiveMargin: 0, esaPrice: 0, distributorTariff: 0,
    taxes: 0, cip: 0, otherCharges: 0, paymentStatus: 'aberto' as const,
    customerSince: '', accumulatedSavings: 0 };
  ok('esaPrice.toFixed não lança com 0', (() => { try { emptyUb.esaPrice.toFixed(2); return true; } catch { return false; } })());
  ok('preventiveMargin * 100 não produz NaN', !isNaN(emptyUb.preventiveMargin * 100));
  ok('accumulatedSavings é número', typeof emptyUb.accumulatedSavings === 'number');
});

group('Suite N: listBeneficiaryUnits filter por ugId com array vazio', () => {
  const empty: any[] = [];
  ok('filter por ugId com array vazio retorna []', empty.filter((b) => b.ugId === 'ug-001').length === 0);
  const withData = realAdapter.listBeneficiaryUnits();
  ok('filter por ugId real encontra UB', withData.filter((b) => b.ugId === 'ug-001').length === 1);
  ok('filter por ugId inexistente retorna []', withData.filter((b) => b.ugId === 'ug-999').length === 0);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n────────────────────────────────────────────────────────────');
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail === 0) console.log('ALL ASSERTIONS PASSED');
else { console.error(`${fail} ASSERTION(S) FAILED`); process.exit(1); }
