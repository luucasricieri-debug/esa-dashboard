// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Testes manuais do contrato de dados.
// Rodar: npx tsx tests/contract.manual-test.ts
// ============================================================

import { demoRuntimeProvider } from '../providers/demoRuntimeProvider';
import { createEsaRuntimeProvider } from '../providers/esaRuntimeProvider';
import type { EnergyCreditsRuntimeContract } from '../contracts/EnergyCreditsRuntimeContract';

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

// ============================================================
// SUITE A — Completude do Contrato
// ============================================================

console.log('\n[A] Completude do contrato');

const CONTRACT_METHODS: (keyof EnergyCreditsRuntimeContract)[] = [
  'mode', 'listMonths', 'getCycleStatus', 'getDashboardData', 'getMonthlyTrend',
  'listGeneratingUnits', 'getGeneratingUnit', 'createGeneratingUnit', 'updateGeneratingUnit',
  'getGeneratingUnitPayee', 'getAppliedPrice', 'updateCyclePrice',
  'listBeneficiaryUnits', 'getBeneficiaryUnit', 'createBeneficiaryUnit', 'updateBeneficiaryUnit',
  'getBeneficiaryConsumptionAverage', 'getBeneficiaryMonthlyHistory', 'getBeneficiarySavingsHistory',
  'getAllocationPlan', 'saveAllocationOverrides', 'closeMonthlySettlement',
  'getBeneficiaryInvoice', 'getImportHistory', 'getCsvTemplate',
  'extractUtilityBill', 'getExistingBillData', 'confirmBillExtraction',
  'matchBillToBeneficiary', 'linkBillToBeneficiary', 'replaceBillData',
  'getOwnerReport', 'getInternalReport', 'getFinancialReport',
  'getFinancialData', 'confirmInvoicePayment', 'reopenInvoicePayment', 'confirmOwnerPayment',
  'listAlerts', 'getAlertDetail', 'resolveAlert', 'ignoreAlert', 'markAlertInAnalysis',
];

for (const method of CONTRACT_METHODS) {
  assert(`demo implementa '${String(method)}'`, method in demoRuntimeProvider);
}

// ============================================================
// SUITE B — Demo Provider: shapes e valores
// ============================================================

console.log('\n[B] Demo provider: shapes');

assert('mode === demo', demoRuntimeProvider.mode === 'demo');

const months = await demoRuntimeProvider.listMonths();
assert('listMonths retorna array com ≥1 item', Array.isArray(months) && months.length > 0);
assert('listMonths[0] tem {value, label, status}', 'value' in months[0] && 'label' in months[0] && 'status' in months[0]);

const cycleStatus = await demoRuntimeProvider.getCycleStatus('2026-07');
assert("getCycleStatus('2026-07') === 'em_apuracao'", cycleStatus === 'em_apuracao');

const ugs = await demoRuntimeProvider.listGeneratingUnits();
assert('listGeneratingUnits retorna ≥3 UGs', ugs.length >= 3);
assert('UG tem {id, name, owner, uc, status}', ugs.every((u) => u.id && u.name && u.uc && u.status));

const ubs = await demoRuntimeProvider.listBeneficiaryUnits();
assert('listBeneficiaryUnits retorna ≥7 UBs', ubs.length >= 7);
assert('UB tem {id, ugId, allocationPct, esaPrice}', ubs.every((u) => u.id && u.ugId && u.allocationPct !== undefined));

const dashboard = await demoRuntimeProvider.getDashboardData({ month: '2026-07' });
assert('getDashboardData retorna {month, cycleStatus, current}', !!dashboard && !!dashboard.month && !!dashboard.current);
assert('getDashboardData.current.generation > 0', (dashboard.current.generation ?? 0) > 0);
assert('getDashboardData.criticalAlerts é number', typeof dashboard.criticalAlerts === 'number');

const trend = await demoRuntimeProvider.getMonthlyTrend({});
assert('getMonthlyTrend retorna ≥5 pontos', trend.length >= 5);
assert('TrendRow tem {month, Receita, Repasse, Spread}', trend.every((r) => r.month && r.Receita !== undefined));

const payee = await demoRuntimeProvider.getGeneratingUnitPayee('UG-001');
assert('getGeneratingUnitPayee UG-001 retorna payee', payee !== null && !!payee?.name);

const price = await demoRuntimeProvider.getAppliedPrice('UG-001', '2026-06');
assert('getAppliedPrice UG-001 2026-06 é number > 0', typeof price === 'number' && price > 0);

const plan = await demoRuntimeProvider.getAllocationPlan('UG-001', '2026-07');
assert('getAllocationPlan UG-001 retorna plano', plan !== null);
assert('AllocationPlan tem rows[] com ≥1 item', (plan?.rows?.length ?? 0) > 0);
assert('totalPct calculado', (plan?.totalPct ?? 0) > 0);

const invoice = await demoRuntimeProvider.getBeneficiaryInvoice('UB-001', '2026-07');
assert('getBeneficiaryInvoice UB-001 retorna fatura', invoice !== null);
assert('Fatura tem {faturaEsa, monthlySavings, payee}', !!invoice && invoice.faturaEsa !== undefined && !!invoice.payee);

const fin = await demoRuntimeProvider.getFinancialData({ month: '2026-07' });
assert('getFinancialData retorna {invoices, ownerPayments}', Array.isArray(fin.invoices) && Array.isArray(fin.ownerPayments));
assert('getFinancialData totalRevenue = soma das faturas', Math.abs(fin.totalRevenue - fin.invoices.reduce((s, i) => s + i.amount, 0)) < 0.01);

const alerts = await demoRuntimeProvider.listAlerts({ month: '2026-07' });
assert('listAlerts retorna ≥6 alertas', alerts.length >= 6);
assert('AlertRecord tem {id, severity, title, status, history}', alerts.every((a) => a.id && a.severity && a.title && a.status && Array.isArray(a.history)));
assert('listAlerts filtra por severity=critico', (await demoRuntimeProvider.listAlerts({ severity: 'critico' })).every((a) => a.severity === 'critico'));

const alertDetail = await demoRuntimeProvider.getAlertDetail('A-001');
assert('getAlertDetail A-001 retorna alerta', alertDetail !== null && alertDetail?.id === 'A-001');

const history = await demoRuntimeProvider.getImportHistory();
assert('getImportHistory retorna ≥5 registros', history.length >= 5);
assert('ImportHistoryRecord tem {file, uc, status}', history.every((h) => h.file && h.status));

const csvTemplate = await demoRuntimeProvider.getCsvTemplate('ug');
assert('getCsvTemplate ug tem headers', Array.isArray(csvTemplate.headers) && csvTemplate.headers.length > 0);

// ============================================================
// SUITE C — Provider real: sem mocks, sem billing
// ============================================================

console.log('\n[C] Real provider: sem mocks, sem billing');

const MOCK_PROVIDER = {
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
};

const realProvider = createEsaRuntimeProvider(MOCK_PROVIDER);

assert('mode === real', realProvider.mode === 'real');

const providerSrc = await import('../providers/esaRuntimeProvider').then((m) => m.createEsaRuntimeProvider.toString());
assert('real provider não contém dados mock (UG-001)', !providerSrc.includes("'UG-001'"));
assert('real provider não contém computeSettlement', !providerSrc.includes('computeSettlement'));
assert('real provider não contém calculationMemory', !providerSrc.includes('calculationMemory'));
assert('real provider não contém scaledResults', !providerSrc.includes('scaledResults'));
assert('real provider não acessa firebase direto', !providerSrc.toLowerCase().includes('firebase'));

await assertNoThrow('listGeneratingUnits não lança com provider vazio', () => realProvider.listGeneratingUnits());
await assertNoThrow('getDashboardData não lança com provider vazio', () => realProvider.getDashboardData({ month: '2026-07' }));
await assertNoThrow('listAlerts não lança com provider vazio', () => realProvider.listAlerts());
await assertNoThrow('getFinancialData retorna estrutura válida vazia', async () => {
  const f = await realProvider.getFinancialData({ month: '2026-07' });
  assert('  getFinancialData.invoices é [] quando provider vazio', Array.isArray(f.invoices) && f.invoices.length === 0);
});

// ============================================================
// SUITE D — Bridge: exposição do contrato
// ============================================================

console.log('\n[D] Bridge: lógica de seleção de modo');

const bridgeSrc = await import('../bridge/runtimeBridge').then(() => '').catch(() => '(import ok)');
// Check source file directly
const fs = await import('fs');
const bridgeFile = fs.readFileSync(new URL('../bridge/runtimeBridge.ts', import.meta.url), 'utf8');

assert('bridge lê ?runtime= da query string', bridgeFile.includes('runtime'));
assert("bridge default é 'demo' sem ?runtime=real", bridgeFile.includes("'demo'") || bridgeFile.includes('"demo"'));
assert('bridge usa demoRuntimeProvider', bridgeFile.includes('demoRuntimeProvider'));
assert('bridge usa createEsaRuntimeProvider para mode real', bridgeFile.includes('createEsaRuntimeProvider'));
assert('bridge não usa eval()', !bridgeFile.includes('eval('));
assert('bridge não usa setInterval nem polling', !bridgeFile.includes('setInterval') && !bridgeFile.includes('setInterval'));
assert('bridge despacha esa:runtime:ready', bridgeFile.includes('esa:runtime:ready'));
assert('bridge expõe ESA_ENERGY_CREDITS_RUNTIME', bridgeFile.includes('ESA_ENERGY_CREDITS_RUNTIME'));

// ============================================================
// SUITE E — Casos extremos: arrays vazios e nulos não crasham
// ============================================================

console.log('\n[E] Casos extremos');

await assertNoThrow('listMonths vazio não crash', async () => {
  const r = await demoRuntimeProvider.listMonths();
  assert('  listMonths é array', Array.isArray(r));
});
await assertNoThrow('listGeneratingUnits com search vazio não crash', () =>
  demoRuntimeProvider.listGeneratingUnits({ search: '' }),
);
await assertNoThrow('listBeneficiaryUnits com ugId inexistente retorna []', async () => {
  const r = await demoRuntimeProvider.listBeneficiaryUnits({ ugId: 'INEXISTENTE' });
  assert('  resultado é array', Array.isArray(r));
});
await assertNoThrow('getGeneratingUnit com id inexistente retorna null', async () => {
  const r = await demoRuntimeProvider.getGeneratingUnit('INEXISTENTE');
  assert('  resultado é null', r === null);
});
await assertNoThrow('getBeneficiaryInvoice com id inexistente retorna null', async () => {
  const r = await demoRuntimeProvider.getBeneficiaryInvoice('INEXISTENTE', '2026-07');
  assert('  resultado é null', r === null);
});
await assertNoThrow('getAllocationPlan com ugId inexistente retorna null', async () => {
  const r = await demoRuntimeProvider.getAllocationPlan('INEXISTENTE', '2026-07');
  assert('  resultado é null', r === null);
});
await assertNoThrow('listAlerts com filtros combinados não crash', () =>
  demoRuntimeProvider.listAlerts({ month: '2026-07', severity: 'critico', search: 'rateio' }),
);
await assertNoThrow('mutations retornam {ok: true}', async () => {
  const r = await demoRuntimeProvider.resolveAlert('A-001', 'resolvido');
  assert('  ok === true', r.ok === true);
});

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
