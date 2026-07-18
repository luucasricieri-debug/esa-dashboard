/**
 * ESA OS — Manual Test: BeneficiaryConsumptionAverageCalculator
 * node src/domains/energy/credits/allocation/consumption-average-calculator.manual-test.js
 */

import { BeneficiaryConsumptionAverageCalculator } from './consumption-average-calculator.js';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

const calc = new BeneficiaryConsumptionAverageCalculator();

function makeHistory(months) {
  return months.map(([ref, kwh]) => ({ referenceMonth: ref, consumptionKwh: kwh }));
}

const H12 = makeHistory([
  ['2024-01', 4000], ['2024-02', 3800], ['2024-03', 4200], ['2024-04', 4100],
  ['2024-05', 3900], ['2024-06', 4300], ['2024-07', 4500], ['2024-08', 4200],
  ['2024-09', 3800], ['2024-10', 4000], ['2024-11', 4100], ['2024-12', 4400],
]);

// ── 1. 12 meses completos ─────────────────────────────────────────────────────
group('1. Janela padrão de 12 meses');
const r1 = calc.calculate({ beneficiaryUnitId: 'bu-001', monthlyConsumptionHistory: H12 });
assert('1.1 ok=true', r1.ok === true);
assert('1.2 monthsConsidered = 12', r1.data.monthsConsidered === 12);
assert('1.3 historyFrom = 2024-01', r1.data.historyFrom === '2024-01');
assert('1.4 historyTo = 2024-12', r1.data.historyTo === '2024-12');
const expectedAvg12 = Math.round((4000+3800+4200+4100+3900+4300+4500+4200+3800+4000+4100+4400) / 12 * 1000) / 1000;
assert('1.5 averageMonthlyConsumptionKwh correto', r1.data.averageMonthlyConsumptionKwh === expectedAvg12);

// ── 2. Janela configurável ────────────────────────────────────────────────────
group('2. Janela configurável (6 meses)');
const r2 = calc.calculate({ beneficiaryUnitId: 'bu-001', monthlyConsumptionHistory: H12, options: { monthWindow: 6 } });
assert('2.1 ok=true', r2.ok === true);
assert('2.2 monthsConsidered = 6', r2.data.monthsConsidered === 6);
assert('2.3 historyFrom = 2024-07', r2.data.historyFrom === '2024-07');
assert('2.4 historyTo = 2024-12', r2.data.historyTo === '2024-12');
const expectedAvg6 = Math.round((4500+4200+3800+4000+4100+4400) / 6 * 1000) / 1000;
assert('2.5 média dos últimos 6 meses', r2.data.averageMonthlyConsumptionKwh === expectedAvg6);

// ── 3. Menos de 12 meses de histórico ────────────────────────────────────────
group('3. Histórico com menos de 12 meses');
const H3 = makeHistory([['2024-10', 500], ['2024-11', 600], ['2024-12', 700]]);
const r3 = calc.calculate({ beneficiaryUnitId: 'bu-002', monthlyConsumptionHistory: H3 });
assert('3.1 ok=true', r3.ok === true);
assert('3.2 monthsConsidered = 3', r3.data.monthsConsidered === 3);
assert('3.3 média de 3 meses', r3.data.averageMonthlyConsumptionKwh === 600);

// ── 4. Meses fora da janela de referência são excluídos ───────────────────────
group('4. referenceMonth exclui meses futuros');
const H4 = makeHistory([['2024-10', 1000], ['2024-11', 2000], ['2024-12', 3000], ['2025-01', 9999]]);
const r4 = calc.calculate({ beneficiaryUnitId: 'bu-003', monthlyConsumptionHistory: H4, options: { referenceMonth: '2024-12' } });
assert('4.1 ok=true', r4.ok === true);
assert('4.2 mês 2025-01 excluído', r4.data.monthsConsidered === 3);
assert('4.3 historyTo = 2024-12', r4.data.historyTo === '2024-12');
assert('4.4 média = 2000 (sem 9999)', r4.data.averageMonthlyConsumptionKwh === 2000);

// ── 5. Histórico desordenado ──────────────────────────────────────────────────
group('5. Histórico desordenado');
const HDES = makeHistory([['2024-12', 1200], ['2024-10', 1000], ['2024-11', 1100]]);
const r5 = calc.calculate({ beneficiaryUnitId: 'bu-004', monthlyConsumptionHistory: HDES });
assert('5.1 ok=true', r5.ok === true);
assert('5.2 historyFrom = 2024-10', r5.data.historyFrom === '2024-10');
assert('5.3 historyTo = 2024-12', r5.data.historyTo === '2024-12');
assert('5.4 média = 1100', r5.data.averageMonthlyConsumptionKwh === 1100);

// ── 6. Registros inválidos ignorados ─────────────────────────────────────────
group('6. Registros inválidos são ignorados');
const HINV = [
  { referenceMonth: '2024-10', consumptionKwh: 1000 },
  { referenceMonth: 'invalid', consumptionKwh: 500 },
  { referenceMonth: '2024-11', consumptionKwh: null },
  { referenceMonth: '2024-12', consumptionKwh: -50 },
  { consumptionKwh: 800 },
  { referenceMonth: '2024-11', consumptionKwh: 1200 },
];
const r6 = calc.calculate({ beneficiaryUnitId: 'bu-005', monthlyConsumptionHistory: HINV });
assert('6.1 ok=true', r6.ok === true);
assert('6.2 apenas registros válidos', r6.data.monthsConsidered === 2);
assert('6.3 média = 1100', r6.data.averageMonthlyConsumptionKwh === 1100);

// ── 7. Histórico vazio ────────────────────────────────────────────────────────
group('7. Histórico vazio');
const r7 = calc.calculate({ beneficiaryUnitId: 'bu-006', monthlyConsumptionHistory: [] });
assert('7.1 ok=true', r7.ok === true);
assert('7.2 monthsConsidered = 0', r7.data.monthsConsidered === 0);
assert('7.3 average = 0', r7.data.averageMonthlyConsumptionKwh === 0);
assert('7.4 historyFrom = null', r7.data.historyFrom === null);

// ── 8. beneficiaryUnitId ausente → fail ───────────────────────────────────────
group('8. beneficiaryUnitId ausente');
const r8 = calc.calculate({ monthlyConsumptionHistory: H12 });
assert('8.1 ok=false', r8.ok === false);
assert('8.2 erro REQUIRED', r8.errors[0]?.code === 'REQUIRED');

// ── 9. roundKwh aplicado ──────────────────────────────────────────────────────
group('9. roundKwh — precisão 3 casas decimais');
const HROUND = makeHistory([['2024-01', 1000], ['2024-02', 1001], ['2024-03', 1002]]);
const r9 = calc.calculate({ beneficiaryUnitId: 'bu-007', monthlyConsumptionHistory: HROUND });
assert('9.1 averageMonthlyConsumptionKwh é number', typeof r9.data.averageMonthlyConsumptionKwh === 'number');
const s9 = String(r9.data.averageMonthlyConsumptionKwh);
const decimals9 = s9.includes('.') ? s9.split('.')[1].length : 0;
assert('9.2 no máximo 3 casas decimais', decimals9 <= 3);

// ── 10. Determinismo ──────────────────────────────────────────────────────────
group('10. Determinismo');
const d1 = calc.calculate({ beneficiaryUnitId: 'bu-008', monthlyConsumptionHistory: H12 });
const d2 = calc.calculate({ beneficiaryUnitId: 'bu-008', monthlyConsumptionHistory: H12 });
assert('10.1 mesma entrada = mesmo resultado', d1.data.averageMonthlyConsumptionKwh === d2.data.averageMonthlyConsumptionKwh);
assert('10.2 monthsConsidered idêntico', d1.data.monthsConsidered === d2.data.monthsConsidered);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
