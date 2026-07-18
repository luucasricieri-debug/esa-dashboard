/**
 * preview-provider.fidelity.ts
 *
 * Testes de fidelidade do preview-provider vs. valores esperados do Lovable original.
 * Execute: npx tsx preview/preview-provider.fidelity.ts
 * (a partir de src/ui/energy-credits/react-app)
 */

// Inline assertion helper — sem dependência de framework
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  PASS  ${message}`);
}

function near(a: number, b: number, tol = 1): boolean {
  return Math.abs(a - b) <= tol;
}

// ------------------------------------------------------------------
// Import estático do provider (EsaProvider type erased at runtime)
// ------------------------------------------------------------------
import { previewProvider as p } from './preview-provider.js';

console.log('\n=== ESA Preview Provider — Fidelity Suite ===\n');

// ──────────────────────────────────────────────────────────────────
// #1  listMonths
// ──────────────────────────────────────────────────────────────────
const months = p.listMonths();
assert(months.length === 5, 'listMonths: retorna 5 meses');
assert(months[0].value === '2026-07', 'listMonths[0].value = 2026-07');
assert(months[0].label === 'Julho de 2026', 'listMonths[0].label = "Julho de 2026"');
assert(months[0].status === 'em_apuracao', 'listMonths[0].status = em_apuracao');

// ──────────────────────────────────────────────────────────────────
// #2  listGeneratingUnits
// ──────────────────────────────────────────────────────────────────
const ugs = p.listGeneratingUnits();
assert(ugs.length === 3, 'listGeneratingUnits: retorna 3 UGs');
assert(ugs[0].id === 'UG-001', 'UG-001 está na posição 0');
assert(ugs[1].id === 'UG-002', 'UG-002 está na posição 1');
assert(ugs[2].id === 'UG-003', 'UG-003 está na posição 2');

// ──────────────────────────────────────────────────────────────────
// #3  listBeneficiaryUnits
// ──────────────────────────────────────────────────────────────────
const ubs = p.listBeneficiaryUnits();
assert(ubs.length === 7, 'listBeneficiaryUnits: retorna 7 UBs');
assert(ubs.some((u) => u.id === 'UB-007'), 'UB-007 (Escola Aprender) presente');

// ──────────────────────────────────────────────────────────────────
// #4  computeAll (base) — valores de Julho/2026
// ──────────────────────────────────────────────────────────────────
const all = p.computeAll();
assert(all.length === 3, 'computeAll: retorna 3 SettlementResult');
const totalGen = all.reduce((s, r) => s + r.generation, 0);
assert(near(totalGen, 26700), `computeAll: geração total ≈ 26700 kWh (got ${totalGen})`);
const totalComp = all.reduce((s, r) => s + r.totalCompensated, 0);
assert(near(totalComp, 20600, 50), `computeAll: compensado total ≈ 20600 kWh (got ${totalComp.toFixed(0)})`);
const totalRev = all.reduce((s, r) => s + r.esaRevenue, 0);
assert(near(totalRev, 11330, 50), `computeAll: receita ESA ≈ R$11330 (got ${totalRev.toFixed(2)})`);
const totalRep = all.reduce((s, r) => s + r.ownerPayment, 0);
assert(near(totalRep, 7180, 50), `computeAll: repasse ≈ R$7180 (got ${totalRep.toFixed(2)})`);

// ──────────────────────────────────────────────────────────────────
// #5  getExecutiveSummary — Julho/2026, Todas UGs
// ──────────────────────────────────────────────────────────────────
const summary = p.getExecutiveSummary({ month: '2026-07' });
assert(summary.operational.generatingUnits.total === 3, 'summary: 3 UGs');
assert(summary.operational.beneficiaryUnits.total === 7, 'summary: 7 UBs');
assert(near(summary.operational.generation, 26700), `summary.generation ≈ 26700 (got ${summary.operational.generation})`);
assert(near(summary.operational.compensated, 20600, 50), `summary.compensated ≈ 20600 (got ${summary.operational.compensated.toFixed(0)})`);
assert(near(summary.financial.revenue, 11330, 50), `summary.revenue ≈ R$11330 (got ${summary.financial.revenue.toFixed(2)})`);
assert(near(summary.financial.ownerPayment, 7180, 50), `summary.ownerPayment ≈ R$7180 (got ${summary.financial.ownerPayment.toFixed(2)})`);
assert(near(summary.financial.spread, 4150, 50), `summary.spread ≈ R$4150 (got ${summary.financial.spread.toFixed(2)})`);
assert(summary.results.length === 3, 'summary.results: 3 SettlementResult (não vazio)');
assert(summary.financial.criticalAlerts === 2, 'summary.criticalAlerts = 2 (2026-07)');

// ──────────────────────────────────────────────────────────────────
// #6  getMonthlyTrend — shape completo
// ──────────────────────────────────────────────────────────────────
const trend = p.getMonthlyTrend({});
assert(trend.length === 5, 'getMonthlyTrend: 5 pontos (5 meses)');
const last = trend[trend.length - 1];
assert(typeof last.month === 'string' && last.month.length > 0, 'TrendRow.month é string');
assert(typeof last.Receita === 'number' && !Number.isNaN(last.Receita), 'TrendRow.Receita é número finito');
assert(typeof last.Spread === 'number' && !Number.isNaN(last.Spread), 'TrendRow.Spread é número finito (sem NaN)');
assert(typeof last.Geracao === 'number' && !Number.isNaN(last.Geracao), 'TrendRow.Geracao é número finito');
assert(typeof last.Consumo === 'number' && !Number.isNaN(last.Consumo), 'TrendRow.Consumo é número finito');

// Julho deve ser o mês com maior Receita (factor=1.0 vs 0.79–0.92 nos demais)
const jul = trend.find((r) => r.month === '2026-07')!;
const receitas = trend.map((r) => r.Receita);
assert(jul.Receita === Math.max(...receitas), 'Julho de 2026 tem maior Receita na trend');

// ──────────────────────────────────────────────────────────────────
// #7  getAlertsSummary — filtro por mês
// ──────────────────────────────────────────────────────────────────
const alerts = p.getAlertsSummary({ month: '2026-07' });
// ALERTS com month=2026-07: A-001..A-005 (5 alertas)
assert(alerts.length === 5, `getAlertsSummary(2026-07): 5 alertas (got ${alerts.length})`);
// Junho: apenas A-006
const alertsJun = p.getAlertsSummary({ month: '2026-06' });
assert(alertsJun.length === 1, `getAlertsSummary(2026-06): 1 alerta (got ${alertsJun.length})`);

// ──────────────────────────────────────────────────────────────────
// #8  getCycleStatus
// ──────────────────────────────────────────────────────────────────
assert(p.getCycleStatus('2026-07') === 'em_apuracao', 'getCycleStatus(2026-07) = em_apuracao');
assert(p.getCycleStatus('2026-06') === 'fechado', 'getCycleStatus(2026-06) = fechado');

// ──────────────────────────────────────────────────────────────────
// #9  getFinancialSummary — saldo atual
// ──────────────────────────────────────────────────────────────────
const fin = p.getFinancialSummary({ month: '2026-07' });
assert(near(fin.balance, 10900, 50), `getFinancialSummary.balance ≈ 10900 kWh (got ${fin.balance.toFixed(0)})`);

// ──────────────────────────────────────────────────────────────────
// #10 Fatores mensais — Junho (0.92) deve ser menor que Julho (1.0)
// ──────────────────────────────────────────────────────────────────
const sumJun = p.getExecutiveSummary({ month: '2026-06' });
assert(sumJun.financial.revenue < summary.financial.revenue, 'Receita Junho < Receita Julho (fator 0.92)');

console.log('\n=== Todos os testes passaram ✓ ===\n');
