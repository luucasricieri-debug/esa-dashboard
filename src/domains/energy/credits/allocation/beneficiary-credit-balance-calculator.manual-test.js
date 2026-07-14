/**
 * ESA OS — Manual Test: BeneficiaryCreditBalanceCalculator
 * node src/domains/energy/credits/allocation/beneficiary-credit-balance-calculator.manual-test.js
 */

import { BeneficiaryCreditBalanceCalculator } from './beneficiary-credit-balance-calculator.js';
import { ALLOCATION_ALERT_CODE }              from './allocation-alert.js';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

const calc = new BeneficiaryCreditBalanceCalculator();

const BASE = {
  beneficiaryUnitId:      'bu-001',
  referenceMonth:         '2025-06',
  previousBalanceKwh:     0,
  creditsReceivedKwh:     0,
  creditsCompensatedKwh:  0,
  positiveAdjustmentsKwh: 0,
  negativeAdjustmentsKwh: 0,
};

// ── 1. Saldo anterior zero ────────────────────────────────────────────────────
group('1. Saldo anterior zero, sem movimentações');
const r1 = calc.calculate({ ...BASE });
assert('1.1 ok=true', r1.ok === true);
assert('1.2 currentBalanceKwh = 0', r1.data.currentBalanceKwh === 0);
assert('1.3 id determinístico', r1.data.id === 'beneficiary-credit-balance-bu-001-2025-06');
assert('1.4 status = empty', r1.data.status === 'empty');

// ── 2. Saldo anterior positivo ───────────────────────────────────────────────
group('2. Saldo anterior positivo');
const r2 = calc.calculate({ ...BASE, previousBalanceKwh: 500 });
assert('2.1 currentBalanceKwh = 500', r2.data.currentBalanceKwh === 500);
assert('2.2 status = ok', r2.data.status === 'ok');

// ── 3. Créditos recebidos ────────────────────────────────────────────────────
group('3. Créditos recebidos');
const r3 = calc.calculate({ ...BASE, creditsReceivedKwh: 4000 });
assert('3.1 currentBalanceKwh = 4000', r3.data.currentBalanceKwh === 4000);
assert('3.2 creditsReceivedKwh preservado', r3.data.creditsReceivedKwh === 4000);

// ── 4. Créditos compensados ──────────────────────────────────────────────────
group('4. Créditos compensados');
const r4 = calc.calculate({ ...BASE, creditsReceivedKwh: 4000, creditsCompensatedKwh: 3500 });
assert('4.1 currentBalanceKwh = 500', r4.data.currentBalanceKwh === 500);

// ── 5. Ajustes positivos ──────────────────────────────────────────────────────
group('5. Ajustes positivos');
const r5 = calc.calculate({ ...BASE, creditsReceivedKwh: 1000, positiveAdjustmentsKwh: 200 });
assert('5.1 currentBalanceKwh = 1200', r5.data.currentBalanceKwh === 1200);

// ── 6. Ajustes negativos ──────────────────────────────────────────────────────
group('6. Ajustes negativos');
const r6 = calc.calculate({ ...BASE, creditsReceivedKwh: 1000, negativeAdjustmentsKwh: 100 });
assert('6.1 currentBalanceKwh = 900', r6.data.currentBalanceKwh === 900);

// ── 7. Saldo negativo bloqueado (default) ─────────────────────────────────────
group('7. Saldo negativo bloqueado por padrão');
const r7 = calc.calculate({ ...BASE, creditsCompensatedKwh: 500 });
assert('7.1 ok=false', r7.ok === false);
assert('7.2 erro NEGATIVE_BALANCE_NOT_ALLOWED', r7.errors[0]?.code === 'NEGATIVE_BALANCE_NOT_ALLOWED');

// ── 8. allowNegativeBalance = true ────────────────────────────────────────────
group('8. allowNegativeBalance = true');
const r8 = calc.calculate({ ...BASE, creditsCompensatedKwh: 500, options: { allowNegativeBalance: true } });
assert('8.1 ok=true', r8.ok === true);
assert('8.2 currentBalanceKwh = -500', r8.data.currentBalanceKwh === -500);
assert('8.3 status = negative', r8.data.status === 'negative');
assert('8.4 alerta NEGATIVE_BALANCE presente', r8.data.alerts.some(a => a.code === ALLOCATION_ALERT_CODE.NEGATIVE_BALANCE));

// ── 9. coverageMonths ─────────────────────────────────────────────────────────
group('9. coverageMonths');
const r9 = calc.calculate({ ...BASE, creditsReceivedKwh: 8000, averageMonthlyConsumptionKwh: 4000 });
assert('9.1 coverageMonths = 2.00', r9.data.coverageMonths === 2.00);
assert('9.2 2 casas decimais', String(r9.data.coverageMonths).replace('.', '').length <= 5);

// ── 10. Média zero → coverageMonths null ──────────────────────────────────────
group('10. Média de consumo zero → coverageMonths null');
const r10 = calc.calculate({ ...BASE, creditsReceivedKwh: 500, averageMonthlyConsumptionKwh: 0 });
assert('10.1 coverageMonths = null', r10.data.coverageMonths === null);

// ── 11. Alerta HIGH_BENEFICIARY_CREDIT_BALANCE ────────────────────────────────
group('11. Alerta HIGH_BENEFICIARY_CREDIT_BALANCE (coverage > 1.5)');
const r11 = calc.calculate({ ...BASE, creditsReceivedKwh: 7000, averageMonthlyConsumptionKwh: 4000 });
assert('11.1 ok=true', r11.ok === true);
assert('11.2 status = high', r11.data.status === 'high');
assert('11.3 alerta HIGH presente', r11.data.alerts.some(a => a.code === ALLOCATION_ALERT_CODE.HIGH_BENEFICIARY_CREDIT_BALANCE));
assert('11.4 severity = attention', r11.data.alerts.find(a => a.code === ALLOCATION_ALERT_CODE.HIGH_BENEFICIARY_CREDIT_BALANCE)?.severity === 'attention');

// ── 12. Alerta LOW_BENEFICIARY_CREDIT_BALANCE ─────────────────────────────────
group('12. Alerta LOW_BENEFICIARY_CREDIT_BALANCE (balance + planned < target)');
const r12 = calc.calculate({
  ...BASE,
  creditsReceivedKwh:           200,
  targetCreditKwh:              4200,
  plannedCreditsReceivedKwh:    3000,
  averageMonthlyConsumptionKwh: 4000,
});
assert('12.1 ok=true', r12.ok === true);
assert('12.2 alerta LOW presente (200+3000=3200 < 4200)', r12.data.alerts.some(a => a.code === ALLOCATION_ALERT_CODE.LOW_BENEFICIARY_CREDIT_BALANCE));
assert('12.3 severity = risk', r12.data.alerts.find(a => a.code === ALLOCATION_ALERT_CODE.LOW_BENEFICIARY_CREDIT_BALANCE)?.severity === 'risk');

// ── 13. Alerta CONSUMPTION_ABOVE_AVERAGE ──────────────────────────────────────
group('13. Alerta CONSUMPTION_ABOVE_AVERAGE (consumo > média * 1.10)');
const r13 = calc.calculate({ ...BASE, creditsReceivedKwh: 5000, averageMonthlyConsumptionKwh: 4000, monthlyConsumptionKwh: 4600 });
assert('13.1 ok=true', r13.ok === true);
assert('13.2 alerta CONSUMPTION_ABOVE_AVERAGE presente (4600 > 4400)', r13.data.alerts.some(a => a.code === ALLOCATION_ALERT_CODE.CONSUMPTION_ABOVE_AVERAGE));
assert('13.3 severity = attention', r13.data.alerts.find(a => a.code === ALLOCATION_ALERT_CODE.CONSUMPTION_ABOVE_AVERAGE)?.severity === 'attention');

// ── 14. Input inválido ────────────────────────────────────────────────────────
group('14. Input inválido');
const r14a = calc.calculate(null);
assert('14.1 null → ok=false', r14a.ok === false);
const r14b = calc.calculate({ ...BASE, creditsReceivedKwh: -100 });
assert('14.2 valor negativo → ok=false', r14b.ok === false);
const r14c = calc.calculate({ ...BASE, referenceMonth: '2025-13' });
assert('14.3 mês inválido → ok=false', r14c.ok === false);

// ── 15. Determinismo ──────────────────────────────────────────────────────────
group('15. Determinismo');
const INPUT15 = { ...BASE, previousBalanceKwh: 500, creditsReceivedKwh: 4200, creditsCompensatedKwh: 3800, averageMonthlyConsumptionKwh: 4000 };
const d1 = calc.calculate(INPUT15);
const d2 = calc.calculate(INPUT15);
assert('15.1 currentBalanceKwh idêntico', d1.data.currentBalanceKwh === d2.data.currentBalanceKwh);
assert('15.2 coverageMonths idêntico', d1.data.coverageMonths === d2.data.coverageMonths);
assert('15.3 alerts.length idêntico', d1.data.alerts.length === d2.data.alerts.length);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
