/**
 * Manual contract test — Reports empty-state contracts
 *
 * Verifies that:
 *  A. Repo vazio: nenhum relatório lança exceção; getOwner/getBeneficiary retornam null
 *  B. UG inexistente: retorno controlado null (Core lança GENERATING_UNIT_NOT_FOUND)
 *  C. UB inexistente: retorno controlado null (Core lança BENEFICIARY_UNIT_NOT_FOUND)
 *  D. Erro inesperado: exception é re-lançada (não mascarada)
 *  E. InternalReport e FinancialReport: sem exceção com repo vazio
 *
 * Run: npx tsx preview/provider-adapter.reports-empty-state.manual-test.ts
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

// ── Shared Core mock data ────────────────────────────────────────────────────

const mkOk = (data: unknown) => ({ ok: true, data, errors: [], warnings: [], metadata: {} });
const mkFail = (code: string, message: string) => ({ ok: false, data: null, errors: [{ code, message, field: null, metadata: {} }], warnings: [], metadata: {} });

// ── Mock UIProvider factory ──────────────────────────────────────────────────

type OwnerBehavior = 'return_null' | 'throw_not_found' | 'throw_unexpected' | 'return_data';
type BenefBehavior = 'return_null' | 'throw_not_found' | 'throw_unexpected' | 'return_data';

function makeMockProvider(ownerBehavior: OwnerBehavior = 'throw_not_found', benefBehavior: BenefBehavior = 'throw_not_found') {
  return {
    searchGeneratingUnits:  () => mkOk([]),
    searchBeneficiaryUnits: () => mkOk([]),
    getExecutiveSummary: () => mkOk({
      generatingUnitCount: 0, beneficiaryUnitCount: 0,
      totalGenerationKwh: 0, totalCompensatedKwh: 0, totalCurrentBalanceKwh: 0,
      totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0,
      totalMonthlyDiscount: 0, criticalAlertCount: 0,
    }),
    getAlertsSummary:     () => mkOk({ alerts: [], totalAlerts: 0, bySeverity: {}, byCode: {} }),
    getFinancialSummary:  () => mkOk({ totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0 }),
    getGeneratingUnitSummary: () => mkOk({ generatingUnit: null, beneficiaryCount: 0, totalGenerationKwh: 0, totalAllocatedKwh: 0, totalCompensatedKwh: 0, currentBalanceKwh: 0, totalOwnerReturn: 0, grossSpread: 0, alerts: [], lastStatement: null }),
    getAllocationPlan:     () => mkOk(null),
    getGeneratingUnitCommercialTerms: () => mkOk(null),
    getCsvTemplate:       () => mkFail('UNKNOWN_IMPORT_TYPE', 'tipo inválido'),

    getOwnerMonthlyReport(_ugId: string, _month: string) {
      switch (ownerBehavior) {
        case 'return_null':
          return mkFail('UNIT_NOT_FOUND', 'unit null');
        case 'throw_not_found':
          throw new Error('[buildOwnerMonthlyReport] Unidade geradora não encontrada: ug-999');
        case 'throw_unexpected':
          throw new Error('Unexpected database connection error');
        case 'return_data':
          return mkOk({ ug: { id: 'ug-01', name: 'UG Real' }, rows: [], generation: 0, totalDistributed: 0, totalCompensated: 0, totalAccumulatedBalance: 0, beneficiariesCount: 0, ownerPayment: 0, totalConsumed: 0 });
      }
    },

    getBeneficiaryMonthlyReport(_ubId: string, _month: string) {
      switch (benefBehavior) {
        case 'return_null':
          return mkFail('UNIT_NOT_FOUND', 'unit null');
        case 'throw_not_found':
          throw new Error('[buildBeneficiaryMonthlyReport] Unidade beneficiária não encontrada: ub-999');
        case 'throw_unexpected':
          throw new Error('Unexpected database connection error');
        case 'return_data':
          return mkOk({ raw: { ub: { id: 'ub-01' }, ug: { name: 'UG Real' } }, billingSnapshot: null, creditBalance: {}, settlementRecipient: {}, beneficiarySavingsHistory: [] });
      }
    },
  };
}

// ── Suite A: Repositório vazio (ugId = '', ubId = '') ─────────────────────────

console.log('\n=== Suite A: Repositório vazio (id = "") ===');
{
  const adapter = createProviderAdapter(makeMockProvider());

  // Empty id guard — must return null WITHOUT calling UIProvider (no throw)
  let ownerThrew = false;
  let ownerResult: any;
  try { ownerResult = adapter.getGeneratingUnitCreditDestinationReport('', '2026-07'); } catch { ownerThrew = true; }
  assert('owner report: empty id does not throw', !ownerThrew);
  assertEq('owner report: empty id returns null', ownerResult, null);

  let benefThrew = false;
  let benefResult: any;
  try { benefResult = adapter.getBeneficiaryInvoice('', '2026-07'); } catch { benefThrew = true; }
  assert('beneficiary report: empty id does not throw', !benefThrew);
  assertEq('beneficiary report: empty id returns null', benefResult, null);

  // Internal/Financial reports — must not throw with empty repo
  let internalThrew = false;
  try {
    adapter.listGeneratingUnits();
    adapter.listBeneficiaryUnits();
    adapter.getFinancialSummary({ month: '2026-07' });
    adapter.getAlertsSummary({ month: '2026-07' });
    adapter.getMonthlyTrend({});
  } catch { internalThrew = true; }
  assert('internal/financial report methods: no throw with empty repo', !internalThrew);
}

// ── Suite B: UG inexistente (Core throws GENERATING_UNIT_NOT_FOUND) ──────────

console.log('\n=== Suite B: UG inexistente — Core lança GENERATING_UNIT_NOT_FOUND ===');
{
  const adapter = createProviderAdapter(makeMockProvider('throw_not_found', 'return_null'));

  let threw = false;
  let result: any;
  try { result = adapter.getGeneratingUnitCreditDestinationReport('ug-999', '2026-07'); } catch { threw = true; }

  assert('owner report: GENERATING_UNIT_NOT_FOUND does not crash React', !threw);
  assertEq('owner report: returns null', result, null);
  assert('owner report: component guard (!report) fires safely', !result);
}

// ── Suite C: UB inexistente (Core throws BENEFICIARY_UNIT_NOT_FOUND) ─────────

console.log('\n=== Suite C: UB inexistente — Core lança BENEFICIARY_UNIT_NOT_FOUND ===');
{
  const adapter = createProviderAdapter(makeMockProvider('return_null', 'throw_not_found'));

  let threw = false;
  let result: any;
  try { result = adapter.getBeneficiaryInvoice('ub-999', '2026-07'); } catch { threw = true; }

  assert('beneficiary report: BENEFICIARY_UNIT_NOT_FOUND does not crash React', !threw);
  assertEq('beneficiary report: returns null', result, null);
  assert('beneficiary report: component guard (!data) fires safely', !result);
}

// ── Suite D: Erro inesperado — deve ser re-lançado (não mascarado) ─────────────

console.log('\n=== Suite D: Erro inesperado — re-lançado, não mascarado ===');
{
  const adapterOwner = createProviderAdapter(makeMockProvider('throw_unexpected', 'return_null'));
  const adapterBenef = createProviderAdapter(makeMockProvider('return_null', 'throw_unexpected'));

  let ownerThrew = false;
  let ownerMsg = '';
  try { adapterOwner.getGeneratingUnitCreditDestinationReport('ug-01', '2026-07'); } catch (e: any) {
    ownerThrew = true;
    ownerMsg = e?.message ?? '';
  }
  assert('unexpected error in owner report: re-thrown', ownerThrew);
  assert('unexpected error in owner report: original message preserved', ownerMsg.includes('Unexpected database connection error'));

  let benefThrew = false;
  let benefMsg = '';
  try { adapterBenef.getBeneficiaryInvoice('ub-01', '2026-07'); } catch (e: any) {
    benefThrew = true;
    benefMsg = e?.message ?? '';
  }
  assert('unexpected error in beneficiary report: re-thrown', benefThrew);
  assert('unexpected error in beneficiary report: original message preserved', benefMsg.includes('Unexpected database connection error'));
}

// ── Suite E: UIProvider retorna ok:false (não lança) → null controlado ────────

console.log('\n=== Suite E: UIProvider retorna ok:false → null via unwrap ===');
{
  const adapter = createProviderAdapter(makeMockProvider('return_null', 'return_null'));

  let ownerThrew = false;
  let ownerResult: any;
  try { ownerResult = adapter.getGeneratingUnitCreditDestinationReport('ug-01', '2026-07'); } catch { ownerThrew = true; }
  assert('owner report: ok:false does not throw', !ownerThrew);
  assertEq('owner report: ok:false returns null', ownerResult, null);

  let benefThrew = false;
  let benefResult: any;
  try { benefResult = adapter.getBeneficiaryInvoice('ub-01', '2026-07'); } catch { benefThrew = true; }
  assert('beneficiary report: ok:false does not throw', !benefThrew);
  assertEq('beneficiary report: ok:false returns null', benefResult, null);
}

// ── Suite F: UG real — Core retorna dados válidos ─────────────────────────────

console.log('\n=== Suite F: UG e UB reais — Core retorna dados (shape pass-through) ===');
{
  const adapter = createProviderAdapter(makeMockProvider('return_data', 'return_data'));

  let ownerThrew = false;
  let ownerResult: any;
  try { ownerResult = adapter.getGeneratingUnitCreditDestinationReport('ug-01', '2026-07'); } catch { ownerThrew = true; }
  assert('owner report (real UG): no throw', !ownerThrew);
  assert('owner report (real UG): returns non-null', ownerResult !== null);

  let benefThrew = false;
  let benefResult: any;
  try { benefResult = adapter.getBeneficiaryInvoice('ub-01', '2026-07'); } catch { benefThrew = true; }
  assert('beneficiary report (real UB): no throw', !benefThrew);
  assert('beneficiary report (real UB): returns non-null', benefResult !== null);
}

// ── Suite G: Error message classification (positive match) ────────────────────

console.log('\n=== Suite G: Error message classification boundaries ===');
{
  // Exactly matching patterns → null (known error)
  const exactOwner = createProviderAdapter({
    ...makeMockProvider(),
    getOwnerMonthlyReport: () => { throw new Error('[buildOwnerMonthlyReport] Unidade geradora não encontrada: ug-abc'); },
  } as any);
  let r1: any;
  try { r1 = exactOwner.getGeneratingUnitCreditDestinationReport('ug-abc', '2026-07'); } catch {}
  assertEq('exact owner msg → null', r1, null);

  // Exactly matching patterns → null (known error)
  const exactBenef = createProviderAdapter({
    ...makeMockProvider(),
    getBeneficiaryMonthlyReport: () => { throw new Error('[buildBeneficiaryMonthlyReport] Unidade beneficiária não encontrada: ub-abc'); },
  } as any);
  let r2: any;
  try { r2 = exactBenef.getBeneficiaryInvoice('ub-abc', '2026-07'); } catch {}
  assertEq('exact beneficiary msg → null', r2, null);

  // Unrelated error → re-thrown
  const unrelated = createProviderAdapter({
    ...makeMockProvider(),
    getOwnerMonthlyReport: () => { throw new Error('Unidade geradora não encontrada sem prefixo'); },
  } as any);
  let unrelatedThrew = false;
  try { unrelated.getGeneratingUnitCreditDestinationReport('ug-01', '2026-07'); } catch { unrelatedThrew = true; }
  assert('msg without [buildOwnerMonthlyReport] prefix → re-thrown', unrelatedThrew);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('SOME ASSERTIONS FAILED');
  process.exit(1);
} else {
  console.log('ALL ASSERTIONS PASSED');
}
