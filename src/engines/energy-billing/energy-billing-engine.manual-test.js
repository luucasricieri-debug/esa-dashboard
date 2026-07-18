/**
 * ESA OS — Manual Test: Energy Billing Engine
 * node src/engines/energy-billing/energy-billing-engine.manual-test.js
 */

import { EnergyBillingEngine } from './energy-billing-engine.js';
import { CALCULATION_SOURCE }  from './energy-billing-snapshot.js';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }
function fmt2(v) { return Math.round(v * 100) / 100; }

const engine = new EnergyBillingEngine();

const BASE_TARIFFS = {
  te_com: 0.558035, te_sem: 0.558035, tusd_com: 0.678724, tus_sem: 0.291481,
  icms_pct: 0.19, cofins_pct: 0.057472, pis_pct: 0.012476,
  bndv: 0, desc_dist: 0, cip: 177.19,
};

const BASE_OPERATIONAL = {
  consumo: 223.085, geracao: 185.93, uc_prop: 0, minimo: 100, preco_kwh: 0.60,
};

// ── 1. Billing básico ─────────────────────────────────────────────────────────
group('1. calculateBeneficiaryBilling — básico');
const r1 = engine.calculateBeneficiaryBilling({ tariffs: BASE_TARIFFS, operational: BASE_OPERATIONAL });
assert('1.1 ok=true', r1.ok === true);
assert('1.2 snapshot não nulo', r1.snapshot !== null);
assert('1.3 calculationSource', r1.snapshot.calculationSource === CALCULATION_SOURCE);
assert('1.4 calculationSource = legacy-copel-calculator', CALCULATION_SOURCE === 'legacy-copel-calculator');

// ── 2. Caso de regressão — 453,09 ─────────────────────────────────────────────
group('2. Regressão Gerador de Propostas — 453,09/438,81/14,28/171,36/3,15%');
const s2 = r1.snapshot;
assert('2.1 contaConcessionaria.total → 453,09', fmt2(s2.contaConcessionaria.total) === 453.09);
assert('2.2 contaEsa.total → 438,81',            fmt2(s2.contaEsa.total)            === 438.81);
assert('2.3 economiaMensal → 14,28',             fmt2(s2.economiaMensal)            === 14.28);
assert('2.4 economiaAnual → 171,36',             fmt2(s2.economiaAnual)             === 171.36);
assert('2.5 economiaPercentual → 3,15',          fmt2(s2.economiaPercentual)        === 3.15);

// ── 3. Snapshot — estrutura completa ──────────────────────────────────────────
group('3. Snapshot — campos obrigatórios');
const s3 = r1.snapshot;
assert('3.1 snapshotVersion',         s3.snapshotVersion  !== undefined);
assert('3.2 calculationSource',       s3.calculationSource !== undefined);
assert('3.3 contaConcessionaria.te',  typeof s3.contaConcessionaria.te   === 'number');
assert('3.4 contaConcessionaria.tusd',typeof s3.contaConcessionaria.tusd === 'number');
assert('3.5 contaConcessionaria.cip', typeof s3.contaConcessionaria.cip  === 'number');
assert('3.6 contaConcessionaria.taxes existe',  s3.contaConcessionaria.taxes !== undefined);
assert('3.7 contaEsa.fioB',           typeof s3.contaEsa.fioB             === 'number');
assert('3.8 contaEsa.vendaKwh',       typeof s3.contaEsa.vendaKwh         === 'number');
assert('3.9 componentesTarifarios',   s3.componentesTarifarios            !== undefined);
assert('3.10 creditos.disponiveis',   s3.creditos.disponiveis             !== undefined);
assert('3.11 calculationMemory',      s3.calculationMemory                !== undefined);
assert('3.12 inputs preservados',     s3.inputs.preco_kwh                 === 0.60);

// ── 4. Snapshot — imutabilidade ───────────────────────────────────────────────
group('4. Snapshot é imutável (frozen)');
const s4 = r1.snapshot;
let mutated = false;
try { s4.calculationSource = 'hack'; } catch(e) { mutated = false; }
assert('4.1 snapshot.calculationSource não mutado', s4.calculationSource === CALCULATION_SOURCE);

// ── 5. Inputs via referenceMonth e IDs ───────────────────────────────────────
group('5. Contexto — referenceMonth, beneficiaryUnitId, generatingUnitId');
const r5 = engine.calculateBeneficiaryBilling({
  referenceMonth: '2025-06', generatingUnitId: 'gu-001', beneficiaryUnitId: 'bu-001',
  tariffs: BASE_TARIFFS, operational: BASE_OPERATIONAL,
});
assert('5.1 ok=true', r5.ok === true);
assert('5.2 referenceMonth no snapshot', r5.snapshot.referenceMonth === '2025-06');
assert('5.3 generatingUnitId no snapshot', r5.snapshot.generatingUnitId === 'gu-001');
assert('5.4 beneficiaryUnitId no snapshot', r5.snapshot.beneficiaryUnitId === 'bu-001');

// ── 6. settlementRecipient / PIX ──────────────────────────────────────────────
group('6. Settlement Recipient / PIX');
const r6 = engine.calculateBeneficiaryBilling({
  tariffs: BASE_TARIFFS, operational: BASE_OPERATIONAL,
  settlementRecipient: { name: 'ESA Energia', document: '12.345.678/0001-90', pixKey: 'esa@esa.com.br', pixKeyType: 'email' },
});
assert('6.1 ok=true', r6.ok === true);
assert('6.2 recipientName', r6.snapshot.settlementRecipient?.recipientName === 'ESA Energia');
assert('6.3 pixKey', r6.snapshot.settlementRecipient?.pixKey === 'esa@esa.com.br');
assert('6.4 pixKeyType', r6.snapshot.settlementRecipient?.pixKeyType === 'email');
assert('6.5 recipientDocument', r6.snapshot.settlementRecipient?.recipientDocument !== undefined);
assert('6.6 password NÃO exposto', r6.snapshot.settlementRecipient?.password === undefined);

// ── 7. Inputs inválidos ────────────────────────────────────────────────────────
group('7. Inputs inválidos');
const r7a = engine.calculateBeneficiaryBilling(null);
assert('7.1 null → ok=false', r7a.ok === false);
assert('7.2 tem errors', r7a.errors.length > 0);
const r7b = engine.calculateBeneficiaryBilling({ tariffs: {}, operational: {} });
assert('7.3 tariffs vazios → ok=false', r7b.ok === false);
assert('7.4 errors com código', r7b.errors[0]?.code !== undefined);

// ── 8. Savings History ────────────────────────────────────────────────────────
group('8. buildSavingsHistory');
const snap1 = { referenceMonth: '2025-01', contaConcessionaria: { total: 450 }, contaEsa: { total: 430 }, economiaMensal: 20, economiaPercentual: 4.44 };
const snap2 = { referenceMonth: '2025-02', contaConcessionaria: { total: 460 }, contaEsa: { total: 435 }, economiaMensal: 25, economiaPercentual: 5.43 };
const hist = engine.buildSavingsHistory([snap1, snap2]);
assert('8.1 2 entradas', hist.length === 2);
assert('8.2 primeiro referenceMonth', hist[0].referenceMonth === '2025-01');
assert('8.3 primeiro monthlySavings=20', hist[0].monthlySavings === 20);
assert('8.4 primeiro accumulatedSavings=20', hist[0].accumulatedSavings === 20);
assert('8.5 segundo accumulatedSavings=45', hist[1].accumulatedSavings === 45);
assert('8.6 billWithoutEsa do snapshot', hist[0].billWithoutEsa === 450);
assert('8.7 billWithEsa do snapshot', hist[0].billWithEsa === 430);

// ── 9. Sem Date.now, Math.random, window ─────────────────────────────────────
group('9. Sem dependências globais de ambiente');
assert('9.1 sem window', typeof window === 'undefined');
assert('9.2 sem localStorage', typeof localStorage === 'undefined');
assert('9.3 metadata.generatedAt = null (sem Date.now)', r5.snapshot.metadata?.generatedAt === null);

// ── 10. Componentes tarifários no snapshot ────────────────────────────────────
group('10. Componentes tarifários no snapshot');
const comp = r1.snapshot.componentesTarifarios;
assert('10.1 te presente', typeof comp.te === 'number');
assert('10.2 tusd presente', typeof comp.tusd === 'number');
assert('10.3 fioB presente', typeof comp.fioB === 'number');
assert('10.4 bandeira=0 (verde)', comp.bandeira === 0);
assert('10.5 cip presente', typeof comp.cip === 'number');
assert('10.6 custoMinimo.semCip presente', typeof comp.custoMinimo?.semCip === 'number');

// ── 11. Caso 421 kWh × 0,60 via engine ───────────────────────────────────────
group('11. Caso 421 kWh cobrados × preço R$ 0,60 via engine');
const r11 = engine.calculateBeneficiaryBilling({
  tariffs: BASE_TARIFFS, operational: { consumo: 400, geracao: 521, uc_prop: 0, minimo: 100, preco_kwh: 0.60 },
});
assert('11.1 ok=true', r11.ok === true);
assert('11.2 vendaKwh = 252,60', fmt2(r11.snapshot.contaEsa.vendaKwh) === 252.60);
assert('11.3 NÃO 25.260,00', r11.snapshot.contaEsa.vendaKwh < 1000);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
