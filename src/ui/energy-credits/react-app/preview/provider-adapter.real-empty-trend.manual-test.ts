/**
 * Manual contract test — getMonthlyTrend with real (empty) provider
 *
 * Verifies that:
 *  A. Repo vazio: getMonthlyTrend retorna array de zeros — nenhum valor inventado
 *  B. Core com dados reais: valores mapeados corretamente (Receita, Repasse, Spread)
 *  C. Filtro ugId: repassado ao getFinancialSummary subjacente
 *  D. Formato meses: apenas AVAILABLE_MONTHS são retornados (sem fevereiro fictício)
 *
 * Contexto:
 *  Financial.tsx usava const trend = [{ m:'Fev', Receita:18500, ... }, ...] hardcoded.
 *  Após a correção, Financial.tsx chama provider.getMonthlyTrend({}).map(r => ({ m: r.label, ... })).
 *  Este teste garante que o adapter retorna somente dados reais do Core (zeros quando vazio).
 *
 * Run: npx tsx preview/provider-adapter.real-empty-trend.manual-test.ts
 */

import { createProviderAdapter } from '../src/lib/esa/provider-adapter.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Mock UIProvider factory ───────────────────────────────────────────────────

const AVAILABLE_MONTH_VALUES = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

function makeEmptyProvider() {
  return {
    searchGeneratingUnits:  () => ({ ok: true, data: [], errors: [], warnings: [], metadata: {} }),
    searchBeneficiaryUnits: () => ({ ok: true, data: [], errors: [], warnings: [], metadata: {} }),
    getExecutiveSummary: () => ({ ok: true, data: { generatingUnitCount: 0, beneficiaryUnitCount: 0, totalGenerationKwh: 0, totalCompensatedKwh: 0, totalCurrentBalanceKwh: 0, totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0, totalMonthlyDiscount: 0, criticalAlertCount: 0 }, errors: [], warnings: [], metadata: {} }),
    getAlertsSummary: () => ({ ok: true, data: { alerts: [], totalAlerts: 0, bySeverity: {}, byCode: {} }, errors: [], warnings: [], metadata: {} }),
    getFinancialSummary: (_opts: any) => ({ ok: true, data: { totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0 }, errors: [], warnings: [], metadata: {} }),
    getGeneratingUnitSummary: () => ({ ok: true, data: null, errors: [], warnings: [], metadata: {} }),
    getAllocationPlan: () => ({ ok: true, data: null, errors: [], warnings: [], metadata: {} }),
    getGeneratingUnitCommercialTerms: () => ({ ok: true, data: null, errors: [], warnings: [], metadata: {} }),
    getCsvTemplate: () => ({ ok: false, data: null, errors: [{ code: 'UNKNOWN_IMPORT_TYPE', message: 'tipo inválido' }], warnings: [], metadata: {} }),
    getOwnerMonthlyReport: () => ({ ok: true, data: null, errors: [], warnings: [], metadata: {} }),
    getBeneficiaryMonthlyReport: () => ({ ok: true, data: null, errors: [], warnings: [], metadata: {} }),
  };
}

function makeRealDataProvider(revenuePerMonth: number, repayPerMonth: number, spreadPerMonth: number) {
  return {
    ...makeEmptyProvider(),
    getFinancialSummary: (_opts: any) => ({
      ok: true,
      data: { totalEsaRevenue: revenuePerMonth, totalOwnerReturn: repayPerMonth, grossSpread: spreadPerMonth },
      errors: [], warnings: [], metadata: {},
    }),
  };
}

function makeUgFilterCaptureProvider() {
  const capturedUgIds: (string | undefined)[] = [];
  const provider = {
    ...makeEmptyProvider(),
    getFinancialSummary: (opts: any) => {
      capturedUgIds.push(opts?.ugId);
      return { ok: true, data: { totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0 }, errors: [], warnings: [], metadata: {} };
    },
  };
  return { provider, capturedUgIds };
}

// ── Suite A: Repositório vazio — todos os valores são zero ────────────────────

console.log('\n=== Suite A: Repositório vazio — nenhum valor inventado ===');
{
  const adapter = createProviderAdapter(makeEmptyProvider());
  const trend = adapter.getMonthlyTrend({});

  assert('getMonthlyTrend: não lança exceção com repo vazio', true);
  assert('getMonthlyTrend: retorna array', Array.isArray(trend));
  assert('getMonthlyTrend: retorna exatamente 5 meses (AVAILABLE_MONTHS)', trend.length === 5);

  for (const row of trend) {
    assertEq(`${row.label}: Receita === 0 (sem dados inventados)`, row.Receita, 0);
    assertEq(`${row.label}: Repasse === 0 (sem dados inventados)`, row.Repasse, 0);
    assertEq(`${row.label}: Spread === 0 (sem dados inventados)`, row.Spread, 0);
    assertEq(`${row.label}: Geracao === 0`, row.Geracao, 0);
    assertEq(`${row.label}: Consumo === 0`, row.Consumo, 0);
    assert(`${row.label}: month é string não-vazia`, typeof row.month === 'string' && row.month.length > 0);
    assert(`${row.label}: label é string não-vazia (usado como 'm' por Financial.tsx)`, typeof row.label === 'string' && row.label.length > 0);
    assert(`${row.label}: label tem 3 chars (formato curto 'Jul', 'Jun', etc.)`, row.label.length === 3);
  }

  // Fevereiro não deve existir — é mês fictício do dataset demonstrativo removido
  const hasFebruary = trend.some((r) => r.label === 'Fev' || r.month === '2026-02');
  assertEq('Fevereiro fictício (Fev/2026-02) NÃO está no trend', hasFebruary, false);
}

// ── Suite B: Core com dados reais — mapeamento correto ───────────────────────

console.log('\n=== Suite B: Core com dados reais — valores mapeados ===');
{
  const revenue = 23_500;
  const repasse = 14_200;
  const spread  = 9_300;

  const adapter = createProviderAdapter(makeRealDataProvider(revenue, repasse, spread));
  const trend = adapter.getMonthlyTrend({});

  assert('getMonthlyTrend com dados: não lança exceção', true);
  assert('getMonthlyTrend com dados: retorna array', Array.isArray(trend));
  assert('getMonthlyTrend com dados: retorna 5 meses', trend.length === 5);

  for (const row of trend) {
    assertEq(`${row.label}: Receita mapeada de totalEsaRevenue`, row.Receita, revenue);
    assertEq(`${row.label}: Repasse mapeado de totalOwnerReturn`, row.Repasse, repasse);
    assertEq(`${row.label}: Spread mapeado de grossSpread`, row.Spread, spread);
  }

  // Verifica que Financial.tsx pode derivar spreadTrend sem crash
  let spreadTrendCrashed = false;
  try {
    const spreadTrend = trend.map((r) => ({ m: r.label, Spread: r.Receita - r.Repasse }));
    assert('spreadTrend derivado: é array', Array.isArray(spreadTrend));
    for (const st of spreadTrend) {
      assertEq(`${st.m}: Spread derivado (Receita - Repasse)`, st.Spread, revenue - repasse);
    }
  } catch {
    spreadTrendCrashed = true;
  }
  assert('spreadTrend derivado por Financial.tsx: sem crash', !spreadTrendCrashed);
}

// ── Suite C: Filtro ugId repassado ao Core ────────────────────────────────────

console.log('\n=== Suite C: ugId passado para getFinancialSummary ===');
{
  const { provider, capturedUgIds } = makeUgFilterCaptureProvider();
  const adapter = createProviderAdapter(provider);

  adapter.getMonthlyTrend({ ugId: 'ug-test-001' });

  assert('getFinancialSummary chamado 5x (um por mês)', capturedUgIds.length === 5);
  assert('ugId repassado em todas as chamadas', capturedUgIds.every((id) => id === 'ug-test-001'));

  const { capturedUgIds: noUgIds } = makeUgFilterCaptureProvider();
  const { provider: p2 } = makeUgFilterCaptureProvider();
  const a2 = createProviderAdapter({ ...makeEmptyProvider(), getFinancialSummary: (opts: any) => { noUgIds.push(opts?.ugId); return { ok: true, data: { totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0 }, errors: [], warnings: [], metadata: {} }; } });
  a2.getMonthlyTrend({});
  assert('sem ugId: undefined repassado (não ugId inventado)', noUgIds.every((id) => id === undefined));
}

// ── Suite D: Meses retornados são apenas AVAILABLE_MONTHS ─────────────────────

console.log('\n=== Suite D: Apenas AVAILABLE_MONTHS retornados (sem meses fictícios) ===');
{
  const adapter = createProviderAdapter(makeEmptyProvider());
  const trend = adapter.getMonthlyTrend({});

  const returnedMonths = trend.map((r) => r.month);

  for (const expected of AVAILABLE_MONTH_VALUES) {
    assert(`Mês ${expected} está no trend`, returnedMonths.includes(expected));
  }

  // Meses fictícios do dataset demonstrativo NÃO devem estar presentes
  const fictionalMonths = ['2026-02', '2026-01', '2025-12', '2025-11'];
  for (const fictional of fictionalMonths) {
    assertEq(`Mês fictício ${fictional} NÃO está no trend`, returnedMonths.includes(fictional), false);
  }

  // Total: exatamente 5 meses
  assertEq('Total de meses: exatamente 5', trend.length, 5);
}

// ── Suite E: Shape compatível com Financial.tsx ───────────────────────────────

console.log('\n=== Suite E: Shape compatível com Financial.tsx (após correção) ===');
{
  const adapter = createProviderAdapter(makeEmptyProvider());
  const trend = adapter.getMonthlyTrend({});

  // Financial.tsx faz: provider.getMonthlyTrend({}).map(r => ({ m: r.label, Receita: r.Receita, Repasse: r.Repasse }))
  let financialTrendCrashed = false;
  let financialTrend: any[] = [];
  try {
    financialTrend = trend.map((r) => ({ m: r.label, Receita: r.Receita, Repasse: r.Repasse }));
  } catch {
    financialTrendCrashed = true;
  }
  assert('Financial.tsx map: sem crash', !financialTrendCrashed);
  assert('Financial.tsx trend: é array', Array.isArray(financialTrend));
  assert('Financial.tsx trend: 5 entradas', financialTrend.length === 5);

  for (const row of financialTrend) {
    assert(`${row.m}: campo 'm' é string`, typeof row.m === 'string');
    assert(`${row.m}: campo 'Receita' é número`, typeof row.Receita === 'number');
    assert(`${row.m}: campo 'Repasse' é número`, typeof row.Repasse === 'number');
    assertEq(`${row.m}: Receita === 0 (repo vazio, sem dados fictícios)`, row.Receita, 0);
    assertEq(`${row.m}: Repasse === 0 (repo vazio, sem dados fictícios)`, row.Repasse, 0);
  }

  // BarChart e LineChart de Financial.tsx acessam data[i].m, data[i].Receita, data[i].Repasse
  // Spread: derivado por spreadTrend = trend.map(t => ({ m: t.m, Spread: t.Receita - t.Repasse }))
  let spreadTrend: any[] = [];
  try {
    spreadTrend = financialTrend.map((t) => ({ m: t.m, Spread: t.Receita - t.Repasse }));
  } catch {
    assert('spreadTrend: sem crash', false);
  }
  assert('spreadTrend: é array', Array.isArray(spreadTrend));
  assert('spreadTrend: 5 entradas', spreadTrend.length === 5);
  for (const row of spreadTrend) {
    assert(`${row.m}: campo 'm' em spreadTrend`, typeof row.m === 'string');
    assertEq(`${row.m}: Spread === 0 em repo vazio`, row.Spread, 0);
  }
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
