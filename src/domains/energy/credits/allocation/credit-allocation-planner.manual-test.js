/**
 * ESA OS — Manual Test: CreditAllocationPlanner
 * node src/domains/energy/credits/allocation/credit-allocation-planner.manual-test.js
 */

import { CreditAllocationPlanner }   from './credit-allocation-planner.js';
import { ALLOCATION_ALERT_CODE }     from './allocation-alert.js';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }
function roundKwh(v) { return Math.round(v * 1000) / 1000; }

const planner = new CreditAllocationPlanner();

const BEN_A = { beneficiaryUnitId: 'bu-aaa', beneficiaryUc: 'UC-A', averageMonthlyConsumptionKwh: 4000, preventiveMarginPercentage: 5, currentBeneficiaryCreditBalanceKwh: 0 };
const BEN_B = { beneficiaryUnitId: 'bu-bbb', beneficiaryUc: 'UC-B', averageMonthlyConsumptionKwh: 2000, preventiveMarginPercentage: 0, currentBeneficiaryCreditBalanceKwh: 0 };
const BEN_C = { beneficiaryUnitId: 'bu-ccc', beneficiaryUc: 'UC-C', averageMonthlyConsumptionKwh: 3000, preventiveMarginPercentage: 10, currentBeneficiaryCreditBalanceKwh: 0 };
const BEN_D = { beneficiaryUnitId: 'bu-ddd', beneficiaryUc: 'UC-D', averageMonthlyConsumptionKwh: 1000, preventiveMarginPercentage: 0, currentBeneficiaryCreditBalanceKwh: 0 };

// ── 1. Automático — 1 beneficiária ────────────────────────────────────────────
group('1. Automático — 1 beneficiária');
const r1 = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 13000, beneficiaries: [BEN_A] });
assert('1.1 ok=true', r1.ok === true);
assert('1.2 mode = auto', r1.data.mode === 'auto');
assert('1.3 1 beneficiária', r1.data.beneficiaries.length === 1);
assert('1.4 allocationPercentage = 100', r1.data.beneficiaries[0].allocationPercentage === 100);
assert('1.5 plannedCreditsReceivedKwh = 13000', r1.data.beneficiaries[0].plannedCreditsReceivedKwh === 13000);
assert('1.6 targetCreditKwh = avg*(1+5%)', r1.data.beneficiaries[0].targetCreditKwh === 4200);

// ── 2. Automático — 4 beneficiárias ──────────────────────────────────────────
group('2. Automático — 4 beneficiárias');
const r2 = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 13000, beneficiaries: [BEN_A, BEN_B, BEN_C, BEN_D] });
assert('2.1 ok=true', r2.ok === true);
assert('2.2 4 beneficiárias no resultado', r2.data.beneficiaries.length === 4);

// ── 3. Soma dos percentuais = 100% ────────────────────────────────────────────
group('3. Soma de percentuais ≈ 100%');
const sumPct = r2.data.beneficiaries.reduce((s, b) => s + b.allocationPercentage, 0);
assert('3.1 soma percentuais = 100%', Math.abs(sumPct - 100) < 0.01, `soma=${sumPct}`);

// ── 4. Soma plannedCreditsReceivedKwh = generationAvailableKwh ────────────────
group('4. Soma de créditos planejados = geração disponível');
const sumPlanned = r2.data.beneficiaries.reduce((s, b) => s + b.plannedCreditsReceivedKwh, 0);
assert('4.1 totalPlannedCreditsKwh correto', r2.data.totalPlannedCreditsKwh === roundKwh(sumPlanned));
assert('4.2 soma planejados = 13000', Math.abs(sumPlanned - 13000) < 0.01, `soma=${sumPlanned}`);

// ── 5. Resíduo determinístico ─────────────────────────────────────────────────
group('5. Reconciliação determinística do resíduo');
const r5a = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 13000, beneficiaries: [BEN_A, BEN_B, BEN_C, BEN_D] });
const r5b = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 13000, beneficiaries: [BEN_A, BEN_B, BEN_C, BEN_D] });
assert('5.1 primeiro planejado idêntico nas duas execuções', r5a.data.beneficiaries[0].plannedCreditsReceivedKwh === r5b.data.beneficiaries[0].plannedCreditsReceivedKwh);
assert('5.2 totalPlannedCreditsKwh idêntico', r5a.data.totalPlannedCreditsKwh === r5b.data.totalPlannedCreditsKwh);

// ── 6. totalRecommended = 0 (saldo > target) ──────────────────────────────────
group('6. Saldo acima do target: recommendedCredits = 0');
const BSAT = { beneficiaryUnitId: 'bu-sat', averageMonthlyConsumptionKwh: 1000, preventiveMarginPercentage: 5, currentBeneficiaryCreditBalanceKwh: 2000 };
const r6 = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 5000, beneficiaries: [BSAT] });
assert('6.1 ok=true', r6.ok === true);
assert('6.2 recommendedCreditsToReceiveKwh = 0', r6.data.beneficiaries[0].recommendedCreditsToReceiveKwh === 0);
assert('6.3 totalRecommendedCreditsKwh = 0', r6.data.totalRecommendedCreditsKwh === 0);
assert('6.4 allocationPercentage = 0', r6.data.beneficiaries[0].allocationPercentage === 0);
assert('6.5 plannedCreditsReceivedKwh = 0', r6.data.beneficiaries[0].plannedCreditsReceivedKwh === 0);

// ── 7. Manual com soma 100% ───────────────────────────────────────────────────
group('7. Modo manual — soma 100%');
const BMAN_A = { ...BEN_A, manualAllocationPercentage: 60 };
const BMAN_B = { ...BEN_B, manualAllocationPercentage: 40 };
const r7 = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 10000, beneficiaries: [BMAN_A, BMAN_B] });
assert('7.1 ok=true', r7.ok === true);
assert('7.2 mode = manual', r7.data.mode === 'manual');
assert('7.3 bu-aaa allocationPercentage = 60', r7.data.beneficiaries.find(b => b.beneficiaryUnitId === 'bu-aaa')?.allocationPercentage === 60);
assert('7.4 bu-bbb plannedCreditsReceivedKwh = 4000', r7.data.beneficiaries.find(b => b.beneficiaryUnitId === 'bu-bbb')?.plannedCreditsReceivedKwh === 4000);
assert('7.5 soma planejados = 10000', Math.abs(r7.data.totalPlannedCreditsKwh - 10000) < 0.01);

// ── 8. Manual com soma inválida ────────────────────────────────────────────────
group('8. Modo manual — soma inválida');
const BMAN_INVALID_A = { ...BEN_A, manualAllocationPercentage: 60 };
const BMAN_INVALID_B = { ...BEN_B, manualAllocationPercentage: 30 };
const r8 = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 10000, beneficiaries: [BMAN_INVALID_A, BMAN_INVALID_B] });
assert('8.1 ok=false', r8.ok === false);
assert('8.2 erro ALLOCATION_PERCENTAGE_TOTAL_INVALID', r8.errors[0]?.code === ALLOCATION_ALERT_CODE.ALLOCATION_PERCENTAGE_TOTAL_INVALID);

// ── 9. Manual parcial bloqueado ────────────────────────────────────────────────
group('9. Manual parcial — bloqueado');
const BPART_A = { ...BEN_A, manualAllocationPercentage: 60 };
const BPART_B = { ...BEN_B }; // sem manualAllocationPercentage
const r9 = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 10000, beneficiaries: [BPART_A, BPART_B] });
assert('9.1 ok=false', r9.ok === false);
assert('9.2 erro PARTIAL_MANUAL_ALLOCATION_NOT_ALLOWED', r9.errors[0]?.code === ALLOCATION_ALERT_CODE.PARTIAL_MANUAL_ALLOCATION_NOT_ALLOWED);

// ── 10. generationAvailableKwh = 0 ───────────────────────────────────────────
group('10. generationAvailableKwh = 0');
const r10 = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 0, beneficiaries: [BEN_A, BEN_B] });
assert('10.1 ok=true', r10.ok === true);
assert('10.2 totalPlannedCreditsKwh = 0', r10.data.totalPlannedCreditsKwh === 0);
assert('10.3 planejado = 0 para cada beneficiária', r10.data.beneficiaries.every(b => b.plannedCreditsReceivedKwh === 0));

// ── 11. Beneficiárias ordenadas por beneficiaryUnitId ─────────────────────────
group('11. Ordenação determinística por beneficiaryUnitId');
const BUNORDERED = [BEN_D, BEN_B, BEN_A, BEN_C];
const r11 = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 12000, beneficiaries: BUNORDERED });
assert('11.1 ok=true', r11.ok === true);
const ids = r11.data.beneficiaries.map(b => b.beneficiaryUnitId);
assert('11.2 ordem: aaa, bbb, ccc, ddd', ids[0] === 'bu-aaa' && ids[1] === 'bu-bbb' && ids[2] === 'bu-ccc' && ids[3] === 'bu-ddd');

// ── 12. Margem acima do limite gera warning ────────────────────────────────────
group('12. Margem preventiva acima do limite → warning');
const BHIGH = { ...BEN_A, preventiveMarginPercentage: 25 };
const r12 = planner.planAllocation({ generatingUnitId: 'gu-01', generationAvailableKwh: 10000, beneficiaries: [BHIGH] });
assert('12.1 ok=true (warning, não erro)', r12.ok === true);
assert('12.2 warnings.length > 0', r12.warnings.length > 0);
assert('12.3 warning MAX_PREVENTIVE_MARGIN_EXCEEDED', r12.warnings[0].code === ALLOCATION_ALERT_CODE.MAX_PREVENTIVE_MARGIN_EXCEEDED);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
