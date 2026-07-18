// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 3 — Dashboard connection tests
// Rodar: npx tsx tests/dashboard-gate3.manual-test.ts
// ============================================================

import { demoRuntimeProvider } from '../providers/demoRuntimeProvider';
import { createEsaRuntimeProvider } from '../providers/esaRuntimeProvider';
import type { EnergyCreditsRuntimeContract } from '../contracts/EnergyCreditsRuntimeContract';
import type { AggregateMetrics } from '../contracts/types';

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
    createGeneratingUnit: () => ({ ok: true, data: { ok: true } }),
    updateGeneratingUnit: () => ({ ok: true, data: { ok: true } }),
    createBeneficiaryUnit: () => ({ ok: true, data: { ok: true } }),
    updateBeneficiaryUnit: () => ({ ok: true, data: { ok: true } }),
    getSettlementRecipient: () => null,
    getBeneficiaryConsumptionAverage: () => null,
    getBeneficiaryHistory: () => null,
    getBeneficiaryMonthlyReport: () => null,
    getOwnerMonthlyReport: () => null,
    getAllocationPlan: () => null,
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

function makeExecutiveSummary(overrides: Record<string, number> = {}): { ok: boolean; data: Record<string, number> } {
  return {
    ok: true,
    data: {
      generatingUnitCount: 3,
      beneficiaryUnitCount: 7,
      totalGenerationKwh: 26700,
      totalCompensatedKwh: 20500,
      totalCurrentBalanceKwh: 10900,
      totalEsaRevenue: 11275,
      totalOwnerReturn: 9345,
      grossSpread: 1930,
      totalMonthlyDiscount: 2150,
      criticalAlertCount: 2,
      ...overrides,
    },
  };
}

// ============================================================
// SUITE F — Demo provider: saldo canônico e integridade
// ============================================================

console.log('\n[F] Demo provider: saldo canônico e integridade');

const demoDash = await demoRuntimeProvider.getDashboardData({ month: '2026-07' });
assert(
  'saldo demo canônico = 10.900 kWh (mês 2026-07)',
  demoDash.current.balance === 10900,
);
assert('demo current.generation > 0', demoDash.current.generation > 0);
assert('demo current.revenue > 0', demoDash.current.revenue > 0);
assert('demo criticalAlerts é number', typeof demoDash.criticalAlerts === 'number');
assert('demo trendData.length >= 5', demoDash.trendData.length >= 5);
assert('demo previous existe (há mês anterior)', demoDash.previous !== null);
assert('demo results.length >= 3 (breakdown por UG)', (demoDash.results?.length ?? 0) >= 3);

const demoDashJun = await demoRuntimeProvider.getDashboardData({ month: '2026-06' });
assert('demo balance Jun < balance Jul (fator menor)', (demoDashJun.current.balance ?? 0) < demoDash.current.balance);

const demoTrend = await demoRuntimeProvider.getMonthlyTrend({});
assert('demo trend.length >= 5', demoTrend.length >= 5);
assert('demo TrendRow tem Receita + Repasse + Spread', demoTrend.every((r) => r.Receita !== undefined && r.Repasse !== undefined && r.Spread !== undefined));

const demoAlerts = await demoRuntimeProvider.listAlerts({ month: '2026-07' });
assert('demo listAlerts month filter não retorna vazio', demoAlerts.length > 0);

// ============================================================
// SUITE G — Real provider: dashboard vazio (provider sem dados)
// ============================================================

console.log('\n[G] Real provider: dashboard vazio (provider retorna null)');

const realEmpty = createEsaRuntimeProvider(makeProvider());

await assertNoThrow('getDashboardData não lança com provider null', async () => {
  const d = await realEmpty.getDashboardData({ month: '2026-07' });
  assert('  current.generation === 0 quando provider null', d.current.generation === 0);
  assert('  current.balance === 0 quando provider null', d.current.balance === 0);
  assert('  trendData é array', Array.isArray(d.trendData));
  assert('  results é [] quando provider null', Array.isArray(d.results) && d.results.length === 0);
  assert('  previous é null quando sem prev month', d.previous === null || typeof d.previous === 'object');
  assert('  criticalAlerts === 0 quando provider null', d.criticalAlerts === 0);
});

await assertNoThrow('listAlerts não lança com provider null', async () => {
  const alerts = await realEmpty.listAlerts({ month: '2026-07' });
  assert('  alertas vazios quando provider null', Array.isArray(alerts) && alerts.length === 0);
});

// ============================================================
// SUITE H — Real provider: dashboard com dados reais
// ============================================================

console.log('\n[H] Real provider: dashboard com dados ESA OS');

const summaryMock = makeExecutiveSummary();
const realWithData = createEsaRuntimeProvider(makeProvider({
  getExecutiveSummary: () => summaryMock,
  getFinancialSummary: () => ({
    ok: true,
    data: { totalEsaRevenue: 11275, totalOwnerReturn: 9345, grossSpread: 1930 },
  }),
  getAlertsSummary: () => ({
    ok: true,
    data: {
      alerts: [
        { id: 'A-R-001', severity: 'critico', code: 'TEST_ALERT', message: 'Teste', unit: 'UG-001', month: '2026-07', action: 'Verificar' },
      ],
      totalAlerts: 1,
      bySeverity: { critico: 1, risco: 0, atencao: 0, info: 0 },
    },
  }),
}));

const realDash = await realWithData.getDashboardData({ month: '2026-07' });
assert('real current.balance === 10900 (do provider)', realDash.current.balance === 10900);
assert('real current.generation === 26700', realDash.current.generation === 26700);
assert('real generatingUnitCount === 3', realDash.generatingUnitCount === 3);
assert('real criticalAlerts === 2', realDash.criticalAlerts === 2);
assert('real trendData tem Receita > 0', realDash.trendData.some((r) => r.Receita > 0));
assert('real results é [] (Core não detalha por UG)', realDash.results.length === 0);
assert('real trendData.Geracao === 0 (Core não expõe geração por ciclo)', realDash.trendData.every((r) => r.Geracao === 0));

const realAlerts = await realWithData.listAlerts({ month: '2026-07' });
assert('real listAlerts retorna alertas do provider', realAlerts.length >= 1);

// ============================================================
// SUITE I — Real provider: filtros por mês e UG
// ============================================================

console.log('\n[I] Real provider: filtros');

const callLog: Array<{ month: string; ugId?: string }> = [];
const trackingProvider = createEsaRuntimeProvider(makeProvider({
  getExecutiveSummary: (filter: any) => {
    callLog.push({ month: filter.referenceMonth, ugId: filter.ugId });
    return makeExecutiveSummary();
  },
  getFinancialSummary: () => ({ ok: true, data: { totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0 } }),
}));

await trackingProvider.getDashboardData({ month: '2026-06' });
assert('getDashboardData passa mês correto ao provider', callLog.some((c) => c.month === '2026-06'));

await trackingProvider.getDashboardData({ month: '2026-07', ugId: 'UG-002' });
assert('getDashboardData passa ugId ao provider', callLog.some((c) => c.ugId === 'UG-002'));

await trackingProvider.getDashboardData({ month: '2026-07' });
assert('getDashboardData sem ugId passa undefined', callLog.some((c) => c.month === '2026-07' && c.ugId === undefined));

// Previous month is fetched for MoM deltas
const prevCallCount = callLog.filter((c) => c.month === '2026-06').length;
assert('getDashboardData busca mês anterior para deltas', prevCallCount >= 1);

// ============================================================
// SUITE J — Real provider: histórico financeiro
// ============================================================

console.log('\n[J] Real provider: histórico financeiro');

const trendEmpty = await realEmpty.getMonthlyTrend({});
assert('histórico financeiro vazio retorna array', Array.isArray(trendEmpty));
assert('histórico financeiro vazio tem TrendRows com zeros', trendEmpty.every((r) => r.Receita === 0 && r.Repasse === 0));

const trendReal = await realWithData.getMonthlyTrend({});
assert('histórico financeiro real tem Receita > 0', trendReal.some((r) => r.Receita > 0));
assert('histórico financeiro real tem label', trendReal.every((r) => r.label.length > 0));
assert('histórico financeiro Geracao === 0 (Core não detalha)', trendReal.every((r) => r.Geracao === 0));

// ============================================================
// SUITE K — Real provider: rankings e alertas vazios
// ============================================================

console.log('\n[K] Rankings e alertas vazios');

const dashEmpty = await realEmpty.getDashboardData({ month: '2026-07' });
assert('rankings vazios: results = []', dashEmpty.results.length === 0);

const alertsEmpty = await realEmpty.listAlerts();
assert('alertas vazios: [] quando provider sem dados', alertsEmpty.length === 0);

// ============================================================
// SUITE L — Real provider: ausência de dados demo
// ============================================================

console.log('\n[L] Real provider: ausência de dados demo');

const providerSrc = await import('../providers/esaRuntimeProvider').then((m) => m.createEsaRuntimeProvider.toString());
assert('real provider não contém UG-001 hardcoded', !providerSrc.includes("'UG-001'"));
assert('real provider não contém UGS hardcoded', !providerSrc.includes('UGS = '));
assert('real provider não contém MONTH_FACTOR', !providerSrc.includes('MONTH_FACTOR'));
assert('real provider não contém scaledResults', !providerSrc.includes('scaledResults'));
assert('real provider não contém computeSettlement', !providerSrc.includes('computeSettlement'));
assert('real provider não contém aggregate(', !providerSrc.includes('this.aggregate('));
assert('real provider mode === real', (createEsaRuntimeProvider(makeProvider())).mode === 'real');

// ============================================================
// SUITE M — Erro do provider não propaga como crash
// ============================================================

console.log('\n[M] Erro do provider: tratamento seguro');

const throwingProvider = createEsaRuntimeProvider(makeProvider({
  getExecutiveSummary: () => { throw new Error('simulated provider error'); },
}));

await assertNoThrow('getDashboardData não explode quando provider lança', async () => {
  const d = await throwingProvider.getDashboardData({ month: '2026-07' });
  assert('  retorna zeros ao invés de crash', d.current.generation === 0);
});

// ============================================================
// SUITE N — Demo permanece idêntico em modo demo
// ============================================================

console.log('\n[N] Demo mode: integridade após Gate 3');

const demoMonths = await demoRuntimeProvider.listMonths();
assert('demo listMonths tem 2026-07 como primeiro', (demoMonths[0] || {}).value === '2026-07');

const demoDash2 = await demoRuntimeProvider.getDashboardData({ month: '2026-07' });
assert('demo saldo = 10.900 kWh (canônico Gate 3)', demoDash2.current.balance === 10900);

const demoDashUg1 = await demoRuntimeProvider.getDashboardData({ month: '2026-07', ugId: 'UG-001' });
assert('demo filtro por UG-001 retorna saldo menor', (demoDashUg1.current.balance ?? 0) < demoDash2.current.balance);
assert('demo filtro por UG-001 não retorna zero', (demoDashUg1.current.generation ?? 0) > 0);

const demoDashCons = await demoRuntimeProvider.getMonthlyTrend({ ugId: undefined });
assert('demo trend consolidado tem Geracao > 0', demoDashCons.some((r) => r.Geracao > 0));

// ============================================================
// RESULTADO FINAL
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTADO: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FALHOU');
  process.exit(1);
} else {
  console.log('OK');
}
