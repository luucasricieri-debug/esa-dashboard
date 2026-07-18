/**
 * First-Render Contract Test — EsaProvider Adapter
 *
 * Validates all methods called during Dashboard initial render against
 * the real Core shapes returned by EnergyCreditsUIProvider.
 *
 * Core field names differ from Lovable field names — this test ensures
 * the adapter correctly maps between them so no .map() call crashes.
 *
 * Run: npx tsx preview/provider-adapter.first-render.manual-test.ts
 */

import { createProviderAdapter } from '../src/lib/esa/provider-adapter.js';

// ── Minimal UIResult-shaped mock helper ────────────────────────────────────────
const mkOk  = (data: unknown) => ({ ok: true,  data, errors: [], warnings: [], metadata: {} });

// ── Core-shaped mock data (matches real EnergyCreditsUIProvider output) ────────

// searchGeneratingUnits / searchBeneficiaryUnits return the array directly
const CORE_UGS = [
  { id: 'ug-01', name: 'UG Solar Guaratiba', ownerName: 'Proprietário A', utilityCompany: 'COPEL', operationalStatus: 'ativo' },
  { id: 'ug-02', name: 'UG Solar Pontal',    ownerName: 'Proprietário B', utilityCompany: 'COPEL', operationalStatus: 'ativo' },
  { id: 'ug-03', name: 'UG Solar Curitiba',  ownerName: 'Proprietário C', utilityCompany: 'COPEL', operationalStatus: 'ativo' },
];

const CORE_UBS = [
  { id: 'ub-01', name: 'UB 001', generatingUnitId: 'ug-01' },
  { id: 'ub-02', name: 'UB 002', generatingUnitId: 'ug-01' },
  { id: 'ub-03', name: 'UB 003', generatingUnitId: 'ug-02' },
  { id: 'ub-04', name: 'UB 004', generatingUnitId: 'ug-02' },
  { id: 'ub-05', name: 'UB 005', generatingUnitId: 'ug-02' },
  { id: 'ub-06', name: 'UB 006', generatingUnitId: 'ug-03' },
  { id: 'ub-07', name: 'UB 007', generatingUnitId: 'ug-03' },
];

// getExecutiveSummary returns the Core aggregate shape (no 'results', no 'operational')
const CORE_EXEC_SUMMARY = {
  generatingUnitCount:      3,
  beneficiaryUnitCount:     7,
  totalGenerationKwh:       26700,
  totalAllocatedKwh:        21000,
  totalCompensatedKwh:      20600,
  totalPendingKwh:          400,
  totalCurrentBalanceKwh:   10900,
  totalOwnerReturn:         7180,
  totalEsaRevenue:          11330,
  grossSpread:              4150,
  totalMonthlyDiscount:     3200,
  totalAccumulatedDiscount: 14400,
  delinquentInvoiceCount:   0,
  alertCount:               2,
  criticalAlertCount:       2,
  riskAlertCount:           0,
  referenceMonths:          ['2026-07'],
};

// getFinancialSummary returns the Core financial shape (no 'revenue', no 'ownerPayment')
const CORE_FINANCIAL_SUMMARY = {
  totalEsaRevenue:                11330,
  totalOwnerReturn:               7180,
  grossSpread:                    4150,
  totalInvoices:                  7,
  paidInvoices:                   5,
  openInvoices:                   2,
  overdueInvoices:                0,
  totalInvoicedAmount:            11330,
  totalPaidAmount:                8000,
  totalOpenAmount:                3330,
  totalOwnerSettlements:          3,
  paidOwnerSettlements:           2,
  openOwnerSettlements:           1,
  totalOwnerSettlementAmount:     7180,
  totalOwnerSettlementOpenAmount: 2393,
};

// getAlertsSummary returns the Core alerts summary shape
const CORE_ALERTS_SUMMARY = {
  totalAlerts:     2,
  bySeverity:      { critical: 2 },
  byCode:          { LOW_BALANCE: 1, PARTIAL_COMP: 1 },
  criticalAlerts:  [
    { code: 'LOW_BALANCE',  severity: 'critical', targetId: 'ub-01', message: 'Saldo baixo',          metadata: {} },
    { code: 'PARTIAL_COMP', severity: 'critical', targetId: 'ub-02', message: 'Compensação parcial',   metadata: {} },
  ],
  riskAlerts:      [],
  attentionAlerts: [],
  infoAlerts:      [],
  alerts: [
    { code: 'LOW_BALANCE',  severity: 'critical', targetId: 'ub-01', message: 'Saldo baixo',        metadata: {} },
    { code: 'PARTIAL_COMP', severity: 'critical', targetId: 'ub-02', message: 'Compensação parcial', metadata: {} },
  ],
};

// ── Mock UIProvider (simulates EnergyCreditsUIProvider output) ─────────────────
const mockUIProvider = {
  searchGeneratingUnits:  ()                  => mkOk(CORE_UGS),
  searchBeneficiaryUnits: ()                  => mkOk(CORE_UBS),
  getExecutiveSummary:    ()                  => mkOk(CORE_EXEC_SUMMARY),
  getAlertsSummary:       ()                  => mkOk(CORE_ALERTS_SUMMARY),
  getFinancialSummary:    ()                  => mkOk(CORE_FINANCIAL_SUMMARY),
  getAllocationPlan:       ()                  => mkOk(null),
  getOwnerMonthlyReport:  ()                  => mkOk(null),
  getGeneratingUnitSummary: ()                => mkOk(null),
  getGeneratingUnitCommercialTerms: ()        => mkOk(null),
  getBeneficiaryHistory:  ()                  => mkOk(null),
  getBeneficiaryMonthlyDataSources: ()        => mkOk(null),
  getBeneficiaryCreditBalance: ()             => mkOk(null),
  getBeneficiaryConsumptionAverage: ()        => mkOk(null),
  getBeneficiaryMonthlyReport: ()             => mkOk(null),
  getSettlementRecipient: ()                  => mkOk(null),
  createGeneratingUnit:   ()                  => mkOk(null),
  updateGeneratingUnit:   ()                  => mkOk(null),
  createBeneficiaryUnit:  ()                  => mkOk(null),
  updateBeneficiaryUnit:  ()                  => mkOk(null),
  confirmInvoicePayment:  ()                  => mkOk(null),
  reopenInvoicePayment:   ()                  => mkOk(null),
  confirmOwnerSettlementPayment: ()           => mkOk(null),
  getCsvTemplate:         ()                  => mkOk(null),
  createUtilityBillImport: ()                 => mkOk(null),
  reviewUtilityBillImport: ()                 => mkOk(null),
  matchUtilityBillImport:  ()                 => mkOk(null),
  linkUtilityBillToBeneficiary: ()            => mkOk(null),
  prepareBeneficiaryFromUtilityBill: ()       => mkOk(null),
  confirmUtilityBillMonthlyRecord: ()         => mkOk(null),
  replaceUtilityBillMonthlyRecord: ()         => mkOk(null),
  getUnlinkedUtilityBills: ()                 => mkOk([]),
};

const adapter = createProviderAdapter(mockUIProvider);

// ── Assertion helpers ──────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;

function assert(label: string, cond: boolean) {
  if (cond) { console.log(`  PASS  ${label}`); pass++; }
  else       { console.error(`  FAIL  ${label}`); fail++; }
}

function finite(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

function noThrow(fn: () => unknown): boolean {
  try { fn(); return true; } catch { return false; }
}

console.log('\n=== First-Render Contract Test ===\n');

// ── 1. listMonths ─────────────────────────────────────────────────────────────
console.log('--- listMonths ---');
const months = adapter.listMonths();
assert('listMonths returns array',       Array.isArray(months));
assert('listMonths length >= 1',         months.length >= 1);
assert('months[0].value is string',      typeof months[0].value === 'string');
assert('months.map does not crash',      noThrow(() => months.map((m) => m.value)));

// ── 2. listGeneratingUnits ────────────────────────────────────────────────────
console.log('\n--- listGeneratingUnits ---');
const ugs = adapter.listGeneratingUnits();
assert('listGeneratingUnits returns array',  Array.isArray(ugs));
assert('listGeneratingUnits length = 3',     ugs.length === 3);
assert('ugs.map does not crash',             noThrow(() => ugs.map((u: any) => u.id)));

// ── 3. listBeneficiaryUnits ───────────────────────────────────────────────────
console.log('\n--- listBeneficiaryUnits ---');
const ubs = adapter.listBeneficiaryUnits();
assert('listBeneficiaryUnits returns array', Array.isArray(ubs));
assert('listBeneficiaryUnits length = 7',    ubs.length === 7);
assert('ubs.map does not crash',             noThrow(() => ubs.map((u: any) => u.id)));

// ── 4. getExecutiveSummary ────────────────────────────────────────────────────
console.log('\n--- getExecutiveSummary ---');
const summary = adapter.getExecutiveSummary({ month: '2026-07' });
assert('summary is object',                           summary !== null && typeof summary === 'object');
assert('summary.results is array',                    Array.isArray(summary.results));
assert('summary.cycleStatus defined',                 typeof summary.cycleStatus === 'string');
assert('summary.month defined',                       typeof summary.month === 'string');
assert('summary.operational.generation finite',       finite(summary.operational.generation));
assert('summary.operational.compensated finite',      finite(summary.operational.compensated));
assert('summary.operational.balance finite',          finite(summary.operational.balance));
assert('summary.operational.generatingUnits.total finite',  finite(summary.operational.generatingUnits.total));
assert('summary.operational.beneficiaryUnits.total finite', finite(summary.operational.beneficiaryUnits.total));
assert('summary.financial.revenue finite',            finite(summary.financial.revenue));
assert('summary.financial.ownerPayment finite',       finite(summary.financial.ownerPayment));
assert('summary.financial.spread finite',             finite(summary.financial.spread));
assert('summary.financial.savings finite',            finite(summary.financial.savings));
assert('summary.financial.criticalAlerts finite',     finite(summary.financial.criticalAlerts));
assert('summary.deltas.generation defined',           typeof summary.deltas.generation === 'object');
assert('summary.results.map does not crash',          noThrow(() => summary.results.map((r: any) => r)));
assert('[...summary.results].sort does not crash',    noThrow(() => [...summary.results].sort()));
assert('summary.results.flatMap r.rows.map no crash', noThrow(() => summary.results.flatMap((r: any) => (r.rows ?? []).map((row: any) => row))));
assert('every results[i].rows is array',              summary.results.every((r: any) => Array.isArray(r.rows)));

// Values mapped correctly from Core
assert('revenue mapped from totalEsaRevenue',         summary.financial.revenue === 11330);
assert('ownerPayment mapped from totalOwnerReturn',   summary.financial.ownerPayment === 7180);
assert('spread mapped from grossSpread',              summary.financial.spread === 4150);
assert('generation mapped from totalGenerationKwh',   summary.operational.generation === 26700);
assert('compensated mapped from totalCompensatedKwh', summary.operational.compensated === 20600);
assert('balance mapped from totalCurrentBalanceKwh',  summary.operational.balance === 10900);
assert('generatingUnits.total from generatingUnitCount', summary.operational.generatingUnits.total === 3);
assert('beneficiaryUnits.total from beneficiaryUnitCount', summary.operational.beneficiaryUnits.total === 7);
assert('criticalAlerts mapped from criticalAlertCount', summary.financial.criticalAlerts === 2);

// ── 5. computeAll ─────────────────────────────────────────────────────────────
console.log('\n--- computeAll ---');
const all = adapter.computeAll();
assert('computeAll returns array', Array.isArray(all));

// ── 6. getAlertsSummary ───────────────────────────────────────────────────────
console.log('\n--- getAlertsSummary ---');
const alerts = adapter.getAlertsSummary({ month: '2026-07' });
assert('getAlertsSummary returns array',           Array.isArray(alerts));
assert('alerts.slice(0,4).map does not crash',     noThrow(() => alerts.slice(0, 4).map((a: any) => a)));

// ── 7. getMonthlyTrend ────────────────────────────────────────────────────────
console.log('\n--- getMonthlyTrend ---');
const trend = adapter.getMonthlyTrend({});
assert('getMonthlyTrend returns array',            Array.isArray(trend));
assert('trend length = AVAILABLE_MONTHS.length',   trend.length === months.length);
assert('every TrendRow has month string',          trend.every((r: any) => typeof r.month === 'string'));
assert('every TrendRow has label string',          trend.every((r: any) => typeof r.label === 'string'));
assert('every TrendRow Receita is finite',         trend.every((r: any) => finite(r.Receita)));
assert('every TrendRow Repasse is finite',         trend.every((r: any) => finite(r.Repasse)));
assert('every TrendRow Spread is finite',          trend.every((r: any) => finite(r.Spread)));
assert('every TrendRow Geracao is finite',         trend.every((r: any) => finite(r.Geracao)));
assert('every TrendRow Consumo is finite',         trend.every((r: any) => finite(r.Consumo)));
assert('trend.reduce(Spread) no NaN',              Number.isFinite(trend.reduce((s: number, r: any) => s + r.Spread, 0)));
assert('Receita mapped from totalEsaRevenue',      trend.every((r: any) => r.Receita === 11330));
assert('Repasse mapped from totalOwnerReturn',     trend.every((r: any) => r.Repasse === 7180));
assert('Spread mapped from grossSpread',           trend.every((r: any) => r.Spread === 4150));

// ── 8. getFinancialSummary ────────────────────────────────────────────────────
console.log('\n--- getFinancialSummary ---');
const fin = adapter.getFinancialSummary({ month: '2026-07' });
assert('getFinancialSummary.revenue finite',       finite(fin.revenue));
assert('getFinancialSummary.ownerPayment finite',  finite(fin.ownerPayment));
assert('getFinancialSummary.spread finite',        finite(fin.spread));
assert('getFinancialSummary.generation finite',    finite(fin.generation));
assert('getFinancialSummary.compensated finite',   finite(fin.compensated));
assert('getFinancialSummary.balance finite',       finite(fin.balance));
assert('fin.revenue mapped from totalEsaRevenue',  fin.revenue === 11330);
assert('fin.ownerPayment mapped from totalOwnerReturn', fin.ownerPayment === 7180);
assert('fin.spread mapped from grossSpread',       fin.spread === 4150);

// ── 9. Null safety (unknown month returns safe empty object) ──────────────────
console.log('\n--- null safety ---');
const emptySummary = adapter.getExecutiveSummary({ month: '2020-01' });
assert('unknown month returns safe results array', Array.isArray(emptySummary.results));
assert('unknown month summary.results.map no crash', noThrow(() => emptySummary.results.map((r: any) => r)));

const nullProviderTest = createProviderAdapter({
  searchGeneratingUnits:  () => ({ ok: false, data: null, errors: [], warnings: [], metadata: {} }),
  searchBeneficiaryUnits: () => ({ ok: false, data: null, errors: [], warnings: [], metadata: {} }),
  getExecutiveSummary:    () => ({ ok: false, data: null, errors: [], warnings: [], metadata: {} }),
  getAlertsSummary:       () => ({ ok: false, data: null, errors: [], warnings: [], metadata: {} }),
  getFinancialSummary:    () => ({ ok: false, data: null, errors: [], warnings: [], metadata: {} }),
});
assert('failed UIResult → listGeneratingUnits returns []',  Array.isArray(nullProviderTest.listGeneratingUnits()) && nullProviderTest.listGeneratingUnits().length === 0);
assert('failed UIResult → listBeneficiaryUnits returns []', Array.isArray(nullProviderTest.listBeneficiaryUnits()) && nullProviderTest.listBeneficiaryUnits().length === 0);
assert('failed UIResult → getExecutiveSummary safe',        Array.isArray(nullProviderTest.getExecutiveSummary({ month: '2026-07' }).results));
assert('failed UIResult → getAlertsSummary returns []',     Array.isArray(nullProviderTest.getAlertsSummary({ month: '2026-07' })));
assert('failed UIResult → getMonthlyTrend returns array',   Array.isArray(nullProviderTest.getMonthlyTrend({})));

// ── Summary ───────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\n=== ${pass}/${total} testes passando ${fail > 0 ? '— FALHA' : '✓'} ===\n`);
if (fail > 0) process.exit(1);
