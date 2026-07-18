/**
 * Manual contract test — MonthlySettlement shape contracts
 *
 * Verifies that:
 *  - getGeneratingUnitCycleSummary returns null when ugId is empty
 *  - getGeneratingUnitCycleSummary maps Core fields to the component-expected shape
 *  - getCreditAllocationPlan returns null when ugId is empty
 *  - getCreditAllocationPlan returns a valid AllocationPlan with rows: [] (never crashes plan.rows.map)
 *  - All KPI fields used by MonthlySettlement are present and numeric
 *
 * Run: npx ts-node --esm preview/provider-adapter.monthly-settlement.manual-test.ts
 */

import { createProviderAdapter } from '../src/lib/esa/provider-adapter.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function assertEq<T>(label: string, actual: T, expected: T) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}: ${JSON.stringify(actual)}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Core shapes (real query service output) ──────────────────────────────────

const CORE_UG_SUMMARY_EMPTY = {
  generatingUnit: null,
  beneficiaryCount: 0,
  monthlyStatementCount: 0,
  totalGenerationKwh: 0,
  totalAllocatedKwh: 0,
  totalCompensatedKwh: 0,
  currentBalanceKwh: 0,
  totalOwnerReturn: 0,
  grossSpread: 0,
  alerts: [],
  lastStatement: null,
};

const CORE_UG_SUMMARY_WITH_DATA = {
  generatingUnit: { id: 'ug-01', name: 'UG Solar Guaratiba' },
  beneficiaryCount: 3,
  monthlyStatementCount: 7,
  totalGenerationKwh: 12500,
  totalAllocatedKwh: 11000,
  totalCompensatedKwh: 9800,
  currentBalanceKwh: 1200,
  totalOwnerReturn: 4200,
  grossSpread: 800,
  alerts: [],
  lastStatement: null,
};

const CORE_PLAN_EMPTY = {
  generatingUnitId: 'ug-01',
  referenceMonth: '2026-07',
  beneficiaryCount: 0,
  totalPlannedCreditsKwh: 0,
  beneficiaries: [],
};

// ── Mock UIProvider ──────────────────────────────────────────────────────────

const mkOk = (data: unknown) => ({ ok: true, data, errors: [], warnings: [], metadata: {} });

function makeMockProvider(ugSummaryData: Record<string, unknown> | null, planData: Record<string, unknown> | null) {
  return {
    searchGeneratingUnits: () => mkOk([{ id: 'ug-01', name: 'UG Solar Guaratiba' }]),
    searchBeneficiaryUnits: () => mkOk([]),
    getExecutiveSummary: () => mkOk({
      generatingUnitCount: 1, beneficiaryUnitCount: 0,
      totalGenerationKwh: 0, totalCompensatedKwh: 0, totalCurrentBalanceKwh: 0,
      totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0,
      totalMonthlyDiscount: 0, criticalAlertCount: 0,
    }),
    getAlertsSummary: () => mkOk({ alerts: [], totalAlerts: 0, bySeverity: {}, byCode: {} }),
    getFinancialSummary: () => mkOk({ totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0 }),
    getGeneratingUnitSummary: () => ugSummaryData ? mkOk(ugSummaryData) : { ok: false, data: null, errors: [], warnings: [], metadata: {} },
    getAllocationPlan: () => planData ? mkOk(planData) : { ok: false, data: null, errors: [], warnings: [], metadata: {} },
    getGeneratingUnitCommercialTerms: () => mkOk(null),
  };
}

// ── Suite 1: Empty ugId (no UGs in system) ───────────────────────────────────

console.log('\n=== Suite 1: Empty ugId (ugId = "") ===');
{
  const adapter = createProviderAdapter(makeMockProvider(CORE_UG_SUMMARY_EMPTY, CORE_PLAN_EMPTY));

  const cycle = adapter.getGeneratingUnitCycleSummary('', { month: '2026-07' });
  const plan = adapter.getCreditAllocationPlan('', '2026-07');

  assertEq('cycle is null for empty ugId', cycle, null);
  assertEq('plan is null for empty ugId', plan, null);
  assert('guard (!plan || !cycle) fires → no crash', !plan || !cycle);
}

// ── Suite 2: Valid ugId, empty Core data ──────────────────────────────────────

console.log('\n=== Suite 2: Valid ugId, Core returns zero data ===');
{
  const adapter = createProviderAdapter(makeMockProvider(CORE_UG_SUMMARY_EMPTY, CORE_PLAN_EMPTY));

  const cycle = adapter.getGeneratingUnitCycleSummary('ug-01', { month: '2026-07' });
  const plan = adapter.getCreditAllocationPlan('ug-01', '2026-07');

  assert('cycle is non-null for valid ugId', cycle !== null);
  assert('plan is non-null for valid ugId', plan !== null);
  assert('guard (!plan || !cycle) does NOT fire', !(!plan || !cycle));

  // cycleStatus
  assert('cycle.cycleStatus is string', typeof cycle!.cycleStatus === 'string');
  assertEq('cycle.cycleStatus for 2026-07', cycle!.cycleStatus, 'em_apuracao');

  // Numeric KPI fields
  assertEq('cycle.generationKwh', cycle!.generationKwh, 0);
  assertEq('cycle.totalRecommendedKwh', cycle!.totalRecommendedKwh, 0);
  assertEq('cycle.totalPlannedKwh', cycle!.totalPlannedKwh, 0);
  assertEq('cycle.totalReceivedKwh', cycle!.totalReceivedKwh, 0);
  assertEq('cycle.totalCompensatedKwh', cycle!.totalCompensatedKwh, 0);
  assertEq('cycle.totalFinalBalanceKwh', cycle!.totalFinalBalanceKwh, 0);
  assertEq('cycle.beneficiariesCount', cycle!.beneficiariesCount, 0);

  // plan.rows must be an array (THE CRASH FIX)
  assert('plan.rows is Array', Array.isArray(plan!.rows));
  assertEq('plan.rows.length', plan!.rows.length, 0);

  // plan.rows.map() must not throw
  let mapThrew = false;
  try { plan!.rows.map((r: unknown) => r); } catch { mapThrew = true; }
  assert('plan.rows.map() does not throw', !mapThrew);

  // plan.rows.some() must not throw
  let someThrew = false;
  try { plan!.rows.some(() => false); } catch { someThrew = true; }
  assert('plan.rows.some() does not throw', !someThrew);

  // plan.ug.purchasePrice
  assert('plan.ug is object', typeof plan!.ug === 'object' && plan!.ug !== null);
  assertEq('plan.ug.purchasePrice', plan!.ug.purchasePrice, 0);
  assert('plan.ug.purchasePrice.toFixed works', plan!.ug.purchasePrice.toFixed(2) === '0.00');

  // Financial KPIs
  assertEq('plan.generation', plan!.generation, 0);
  assertEq('plan.totalConsumption', plan!.totalConsumption, 0);
  assertEq('plan.ownerPayment', plan!.ownerPayment, 0);
  assertEq('plan.esaRevenue', plan!.esaRevenue, 0);
}

// ── Suite 3: Valid ugId, Core returns real data ───────────────────────────────

console.log('\n=== Suite 3: Valid ugId, Core returns non-zero data ===');
{
  const adapter = createProviderAdapter(makeMockProvider(CORE_UG_SUMMARY_WITH_DATA, CORE_PLAN_EMPTY));

  const cycle = adapter.getGeneratingUnitCycleSummary('ug-01', { month: '2026-07' });

  assert('cycle is non-null', cycle !== null);
  assertEq('cycle.generationKwh maps from totalGenerationKwh', cycle!.generationKwh, 12500);
  assertEq('cycle.totalPlannedKwh maps from totalAllocatedKwh', cycle!.totalPlannedKwh, 11000);
  assertEq('cycle.totalReceivedKwh maps from totalAllocatedKwh', cycle!.totalReceivedKwh, 11000);
  assertEq('cycle.totalCompensatedKwh maps from totalCompensatedKwh', cycle!.totalCompensatedKwh, 9800);
  assertEq('cycle.totalFinalBalanceKwh maps from currentBalanceKwh', cycle!.totalFinalBalanceKwh, 1200);
  assertEq('cycle.beneficiariesCount maps from beneficiaryCount', cycle!.beneficiariesCount, 3);
}

// ── Suite 4: Core UIProvider returns null (ok: false) ────────────────────────

console.log('\n=== Suite 4: Core UIProvider returns null/error ===');
{
  const adapter = createProviderAdapter(makeMockProvider(null, null));

  const cycle = adapter.getGeneratingUnitCycleSummary('ug-01', { month: '2026-07' });
  const plan = adapter.getCreditAllocationPlan('ug-01', '2026-07');

  assertEq('cycle is null when Core returns error', cycle, null);
  assertEq('plan is null when Core returns error', plan, null);
  assert('guard fires safely', !plan || !cycle);
}

// ── Suite 5: CycleBadge status values ────────────────────────────────────────

console.log('\n=== Suite 5: cycleStatus per month ===');
{
  const adapter = createProviderAdapter(makeMockProvider(CORE_UG_SUMMARY_EMPTY, CORE_PLAN_EMPTY));

  const cases: Array<[string, string]> = [
    ['2026-07', 'em_apuracao'],
    ['2026-06', 'fechado'],
    ['2026-05', 'fechado'],
  ];

  for (const [month, expectedStatus] of cases) {
    const cycle = adapter.getGeneratingUnitCycleSummary('ug-01', { month });
    assertEq(`cycleStatus for ${month}`, cycle!.cycleStatus, expectedStatus as any);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('SOME ASSERTIONS FAILED');
  process.exit(1);
} else {
  console.log('ALL ASSERTIONS PASSED');
}
