/**
 * ESA OS — Manual Test: Allocation sections in Owner + Beneficiary Reports
 * node src/reports/energy-credits/energy-credits-allocation-reports.manual-test.js
 */

import { EnergyCreditsReadModel }        from '../../read-models/energy-credits/energy-credits-read-model.js';
import { EnergyCreditsQueryService }     from '../../queries/energy-credits/energy-credits-query-service.js';
import { EnergyCreditsReportService }    from './energy-credits-report-service.js';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

const rm = new EnergyCreditsReadModel();
const qs = new EnergyCreditsQueryService(rm);
const rs = new EnergyCreditsReportService(qs);

// ── Dados de suporte ──────────────────────────────────────────────────────────
const GU = { id: 'gu-001', name: 'Usina Teste', ownerName: 'Proprietário A', ownerDocument: '123', uc: 'UC-G01', utilityCompany: 'COPEL', operationalStatus: 'active', installedPower: 100 };
const BU1 = { id: 'bu-001', generatingUnitId: 'gu-001', name: 'Beneficiária Alpha', holderName: 'Titular A', uc: 'UC-B01', utilityCompany: 'COPEL', subscriptionStatus: 'active' };
const BU2 = { id: 'bu-002', generatingUnitId: 'gu-001', name: 'Beneficiária Beta',  holderName: 'Titular B', uc: 'UC-B02', utilityCompany: 'COPEL', subscriptionStatus: 'active' };

const BMR1 = { id: 'bmr-bu-001-2025-06', beneficiaryUnitId: 'bu-001', generatingUnitId: 'gu-001', referenceMonth: '2025-06', monthlyConsumptionKwh: 3800, allocatedKwh: 4000, compensatedKwh: 3800, pendingKwh: 200, residualKwh: 0 };
const BMR2 = { id: 'bmr-bu-002-2025-06', beneficiaryUnitId: 'bu-002', generatingUnitId: 'gu-001', referenceMonth: '2025-06', monthlyConsumptionKwh: 2000, allocatedKwh: 2100, compensatedKwh: 2000, pendingKwh: 100, residualKwh: 0 };

const BAL1 = { id: 'beneficiary-credit-balance-bu-001-2025-06', beneficiaryUnitId: 'bu-001', generatingUnitId: 'gu-001', beneficiaryUc: 'UC-B01', referenceMonth: '2025-06', previousBalanceKwh: 200, creditsReceivedKwh: 4000, creditsCompensatedKwh: 3800, positiveAdjustmentsKwh: 0, negativeAdjustmentsKwh: 0, currentBalanceKwh: 400, averageMonthlyConsumptionKwh: 3800, preventiveMarginPercentage: 5, targetCreditKwh: 3990, allocationPercentage: 65.57, coverageMonths: 0.11, status: 'ok', alerts: [] };
const BAL2 = { id: 'beneficiary-credit-balance-bu-002-2025-06', beneficiaryUnitId: 'bu-002', generatingUnitId: 'gu-001', beneficiaryUc: 'UC-B02', referenceMonth: '2025-06', previousBalanceKwh: 0, creditsReceivedKwh: 2100, creditsCompensatedKwh: 2000, positiveAdjustmentsKwh: 0, negativeAdjustmentsKwh: 0, currentBalanceKwh: 100, averageMonthlyConsumptionKwh: 2000, preventiveMarginPercentage: 0, targetCreditKwh: 2000, allocationPercentage: 34.43, coverageMonths: 0.05, status: 'ok', alerts: [] };

const GUMR = { id: 'gumr-001-06', generatingUnitId: 'gu-001', referenceMonth: '2025-06', monthlyGenerationKwh: 6100, purchaseKwhPrice: 0.35, monthlyOwnerReturn: 2135, accumulatedOwnerReturn: 12800, consumedAllocatedKwh: 6100, previousAccumulatedKwhBalance: 0, currentAccumulatedKwhBalance: 0 };
const STMT = { referenceMonth: '2025-06', generatingUnitId: 'gu-001', totalGenerationKwh: 6100, previousBalanceKwh: 0, availableKwhBeforeAllocation: 6100, totalAllocatedKwh: 6100, totalCompensatedKwh: 5800, totalPendingKwh: 300, totalResidualKwh: 0, currentBalanceKwh: 0, totalOwnerReturn: 2135, totalEsaRevenue: 3050, grossSpread: 915, beneficiaryCount: 2, alerts: [], metadata: { status: 'closed' } };

rm.upsertGeneratingUnit(GU);
rm.upsertBeneficiaryUnit(BU1);
rm.upsertBeneficiaryUnit(BU2);
rm.upsertBeneficiaryMonthlyRecord(BMR1);
rm.upsertBeneficiaryMonthlyRecord(BMR2);
rm.upsertBeneficiaryCreditBalanceRecord(BAL1);
rm.upsertBeneficiaryCreditBalanceRecord(BAL2);
rm.upsertGeneratingUnitMonthlyRecord(GUMR);
rm.upsertMonthlyStatement(STMT);

// ── 1. Owner Report — creditDestinations presente ─────────────────────────────
group('1. Owner Report — seção creditDestinations');
const ownerReport = rs.buildOwnerMonthlyReport('gu-001', '2025-06').data;
const cd = ownerReport.sections.creditDestinations;
assert('1.1 creditDestinations existe', cd !== undefined);
assert('1.2 items.length = 2', cd.items.length === 2);
assert('1.3 summary presente', cd.summary !== undefined);

// ── 2. creditDestinations — campos de cada UC ─────────────────────────────────
group('2. Owner Report — campos por UC em creditDestinations');
const item1 = cd.items.find(i => i.beneficiaryUnitId === 'bu-001');
const item2 = cd.items.find(i => i.beneficiaryUnitId === 'bu-002');
assert('2.1 bu-001 presente', item1 !== undefined);
assert('2.2 bu-002 presente', item2 !== undefined);
assert('2.3 allocationPercentage bu-001', item1?.allocationPercentage === 65.57);
assert('2.4 creditsReceivedKwh bu-001', item1?.creditsReceivedKwh === 4000);
assert('2.5 monthlyConsumptionKwh bu-001', item1?.monthlyConsumptionKwh === 3800);
assert('2.6 currentBalanceKwh bu-001', item1?.currentBalanceKwh === 400);
assert('2.7 coverageMonths bu-001', item1?.coverageMonths === 0.11);

// ── 3. Owner Report — summary totals ──────────────────────────────────────────
group('3. Owner Report — summary de creditDestinations');
const sum = cd.summary;
assert('3.1 beneficiaryCount = 2', sum.beneficiaryCount === 2);
assert('3.2 totalCreditsDistributedKwh = 6100', sum.totalCreditsDistributedKwh === 6100);
assert('3.3 totalBeneficiaryConsumptionKwh = 5800', sum.totalBeneficiaryConsumptionKwh === 5800);
assert('3.4 totalCreditsCompensatedKwh = 5800', sum.totalCreditsCompensatedKwh === 5800);
assert('3.5 totalBeneficiaryCreditBalanceKwh = 500', sum.totalBeneficiaryCreditBalanceKwh === 500);

// ── 4. Owner Report — ordenação determinística ────────────────────────────────
group('4. Owner Report — ordenação por beneficiaryUnitId');
const ids = cd.items.map(i => i.beneficiaryUnitId);
assert('4.1 bu-001 antes de bu-002', ids.indexOf('bu-001') < ids.indexOf('bu-002'));

// ── 5. Beneficiary Report — seção creditBalance ────────────────────────────────
group('5. Beneficiary Report — seção creditBalance');
const benReport = rs.buildBeneficiaryMonthlyReport('bu-001', '2025-06').data;
const cb = benReport.sections.creditBalance;
assert('5.1 creditBalance existe', cb !== undefined);
assert('5.2 source = beneficiary-credit-balance-record', cb.source === 'beneficiary-credit-balance-record');
assert('5.3 previousBalanceKwh = 200', cb.previousBalanceKwh === 200);
assert('5.4 creditsReceivedKwh = 4000', cb.creditsReceivedKwh === 4000);
assert('5.5 currentBalanceKwh = 400', cb.currentBalanceKwh === 400);
assert('5.6 allocationPercentage = 65.57', cb.allocationPercentage === 65.57);
assert('5.7 coverageMonths = 0.11', cb.coverageMonths === 0.11);
assert('5.8 targetCreditKwh = 3990', cb.targetCreditKwh === 3990);

// ── 6. Beneficiary Report — billingComparison sem snapshot → unavailable ───────
group('6. Beneficiary Report — sem billingSnapshot → financeiro unavailable');
const bs6 = benReport.sections.billingComparison;
assert('6.1 billingComparison source = operational-record (rec existe)', ['operational-record', 'unavailable'].includes(bs6.source));

// ── 7. Beneficiary Report — com billingSnapshot ────────────────────────────────
group('7. Beneficiary Report — com billingSnapshot');
const SNAP = {
  calculationSource: 'legacy-copel-calculator',
  contaConcessionaria: { total: 453.09 },
  contaEsa: { total: 438.81, fioB: 77.45, vendaKwh: 112.8 },
  economiaMensal: 14.28, economiaAnual: 171.36, economiaPercentual: 3.15,
  inputs: { preco_kwh: 0.60, te_com: 0.558035 },
  settlementRecipient: { recipientName: 'ESA Energia', recipientDocument: '12.345.678/0001-90', pixKey: 'esa@esa.com', pixKeyType: 'email' },
};
const benWithSnap = rs.buildBeneficiaryMonthlyReport('bu-001', '2025-06', { billingSnapshot: SNAP }).data;
const bc7 = benWithSnap.sections.billingComparison;
assert('7.1 source = billing-snapshot', bc7.source === 'billing-snapshot');
assert('7.2 billWithoutEsa = 453.09', bc7.billWithoutEsa === 453.09);
assert('7.3 billWithEsa = 438.81', bc7.billWithEsa === 438.81);
const sav7 = benWithSnap.sections.savings;
assert('7.4 savings source = billing-snapshot', sav7.source === 'billing-snapshot');
assert('7.5 monthlySavings = 14.28', sav7.monthlySavings === 14.28);

// ── 8. Beneficiary Report — settlement / PIX ──────────────────────────────────
group('8. Beneficiary Report — seção settlement (PIX)');
const set8 = benWithSnap.sections.settlement;
assert('8.1 settlement existe', set8 !== undefined);
assert('8.2 source = billing-snapshot', set8.source === 'billing-snapshot');
assert('8.3 recipientName', set8.recipientName === 'ESA Energia');
assert('8.4 pixKey', set8.pixKey === 'esa@esa.com');
assert('8.5 pixKeyType = email', set8.pixKeyType === 'email');
assert('8.6 sem snapshot → settlement unavailable', rs.buildBeneficiaryMonthlyReport('bu-001', '2025-06').data.sections.settlement.source === 'unavailable');

// ── 9. Beneficiary Report — savingsHistory ────────────────────────────────────
group('9. Beneficiary Report — savingsHistory');
const SHIST = [
  { referenceMonth: '2025-04', monthlySavings: 10, billWithoutEsa: 450, billWithEsa: 440 },
  { referenceMonth: '2025-05', monthlySavings: 12, billWithoutEsa: 455, billWithEsa: 443 },
  { referenceMonth: '2025-06', monthlySavings: 14.28, billWithoutEsa: 453.09, billWithEsa: 438.81 },
];
const benWithHist = rs.buildBeneficiaryMonthlyReport('bu-001', '2025-06', { beneficiarySavingsHistory: SHIST }).data;
const sh9 = benWithHist.sections.savingsHistory;
assert('9.1 source = savings-history', sh9.source === 'savings-history');
assert('9.2 monthsAsCustomer = 3', sh9.monthsAsCustomer === 3);
assert('9.3 customerSinceReferenceMonth = 2025-04', sh9.customerSinceReferenceMonth === '2025-04');
assert('9.4 accumulatedSavings = 36.28', Math.abs(sh9.accumulatedSavings - 36.28) < 0.01);
assert('9.5 currentMonthSavings = 14.28', sh9.currentMonthSavings === 14.28);

// ── 10. Owner Report — seção creditBalance ausente (sem UC no read model) ──────
group('10. Beneficiary Report — creditBalance unavailable sem registro');
const rm2 = new EnergyCreditsReadModel();
const qs2 = new EnergyCreditsQueryService(rm2);
const rs2 = new EnergyCreditsReportService(qs2);
rm2.upsertGeneratingUnit(GU);
rm2.upsertBeneficiaryUnit(BU1);
rm2.upsertBeneficiaryMonthlyRecord(BMR1);
const benNoBal = rs2.buildBeneficiaryMonthlyReport('bu-001', '2025-06').data;
assert('10.1 creditBalance.source = unavailable quando não há registro', benNoBal.sections.creditBalance.source === 'unavailable');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
