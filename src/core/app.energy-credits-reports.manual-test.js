/**
 * ESA OS — Core
 * Suite de testes — ESAApplication + Energy Credits Reports
 * 30 cenários
 *
 * Execução: node src/core/app.energy-credits-reports.manual-test.js
 *
 * Sem Firebase (métodos de reports não requerem initialize).
 * Sem Jest. Sem browser. ES Modules nativos.
 */

import { ESA }                    from './app.js';
import { energyCreditsReadModel }  from '../read-models/energy-credits/index.js';

// ── Runner ────────────────────────────────────────────────────────────────────

let total  = 0;
let failed = 0;

function assert(condition, label) {
  total++;
  if (!condition) {
    failed++;
    console.error(`  ✗ FALHOU: ${label}`);
  }
}

function section(n, title) {
  console.log(`\n[${n}] ${title}`);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

energyCreditsReadModel.clear();

const SNAPSHOT = {
  generatingUnits: [
    { id: 'gen-001', name: 'Usina Alpha', ownerName: 'Pedro Costa', ownerDocument: '111.111.111-11',
      uc: 'UC-001', utilityCompany: 'ENEL', operationalStatus: 'active', installedPower: 80 },
  ],
  beneficiaryUnits: [
    { id: 'ben-001', generatingUnitId: 'gen-001', name: 'Consumidor A', uc: 'UB-001', utilityCompany: 'ENEL', subscriptionStatus: 'active' },
  ],
  generatingUnitMonthlyRecords: [
    { id: 'gr-001', generatingUnitId: 'gen-001', referenceMonth: '2024-06',
      purchaseKwhPrice: 0.80, previousAccumulatedKwhBalance: 0,
      monthlyGenerationKwh: 4000, availableKwhBeforeAllocation: 4000,
      consumedAllocatedKwh: 400, currentAccumulatedKwhBalance: 3600,
      monthlyOwnerReturn: 320, accumulatedOwnerReturn: 320, status: 'active' },
  ],
  beneficiaryMonthlyRecords: [
    { id: 'br-001', beneficiaryUnitId: 'ben-001', generatingUnitId: 'gen-001', referenceMonth: '2024-06',
      monthlyConsumptionKwh: 400, allocatedKwh: 400, compensatedKwh: 400, pendingKwh: 0, residualKwh: 0,
      esaKwhPrice: 0.90, utilityReferenceTariff: 1.05, billWithoutEsa: 420, esaInvoiceAmount: 360,
      residualUtilityAmount: 0, billWithEsa: 360, monthlyDiscount: 60,
      previousAccumulatedDiscount: 0, accumulatedDiscountTotal: 60, paymentStatus: 'paid',
      dueDate: 1719446400, paidAt: 1719446400 },
  ],
  ownerSettlements: [
    { id: 'st-001', generatingUnitId: 'gen-001', ownerName: 'Pedro Costa', referenceMonth: '2024-06',
      consumedAllocatedKwh: 400, purchaseKwhPrice: 0.80, grossReturn: 320, adjustments: 0,
      netReturn: 320, paymentStatus: 'paid', dueDate: 1719446400, paidAt: 1719446400 },
  ],
  esaInvoices: [
    { id: 'inv-001', beneficiaryUnitId: 'ben-001', referenceMonth: '2024-06',
      consumedKwh: 400, compensatedKwh: 400, esaKwhPrice: 0.90, invoiceAmount: 360, paymentStatus: 'paid' },
  ],
  monthlyStatements: [
    { generatingUnitId: 'gen-001', referenceMonth: '2024-06',
      totalGenerationKwh: 4000, previousBalanceKwh: 0, availableKwhBeforeAllocation: 4000,
      totalAllocatedKwh: 400, totalCompensatedKwh: 400, totalPendingKwh: 0, totalResidualKwh: 0,
      currentBalanceKwh: 3600, totalOwnerReturn: 320, totalEsaRevenue: 360, grossSpread: 40,
      beneficiaryCount: 1,
      alerts: [{ code: 'ZERO_GENERATION', severity: 'critical', message: 'Atenção', targetType: 'generating', targetId: 'gen-001', metadata: {} }],
      metadata: { status: 'open', source: 'auto' } },
  ],
};

ESA.hydrateEnergyCreditsReadModel(SNAPSHOT, { replace: true, referenceDate: '2024-06' });

// ── 1. buildEnergyCreditsOwnerMonthlyReport ───────────────────────────────────

section(1, 'buildEnergyCreditsOwnerMonthlyReport');

const ownerR = ESA.buildEnergyCreditsOwnerMonthlyReport('gen-001', '2024-06', { referenceDate: '2024-06' });

assert(typeof ownerR === 'object' && ownerR !== null,       '1.1 retorna objeto (toJSON chamado)');
assert(ownerR.data !== null,                                '1.2 data não null');
assert(ownerR.data.reportVersion === '1.0',                '1.3 reportVersion 1.0');
assert(ownerR.data.reportType === 'owner-monthly',         '1.4 reportType');
assert(ownerR.generatedAt === '2024-06',                   '1.5 generatedAt = referenceDate');
assert(ownerR.data.referenceMonth === '2024-06',           '1.6 referenceMonth');
assert(ownerR.data.target.ownerName === 'Pedro Costa',     '1.7 target.ownerName');
assert(ownerR.data.summary.monthlyGenerationKwh === 4000,  '1.8 summary.monthlyGenerationKwh');
assert(ownerR.data.distribution.pdfReady === false,        '1.9 distribution.pdfReady = false');
assert(ownerR.data.metadata.readOnly === true,             '1.10 metadata.readOnly');

// ── 2. buildEnergyCreditsBeneficiaryMonthlyReport ─────────────────────────────

section(2, 'buildEnergyCreditsBeneficiaryMonthlyReport');

const benR = ESA.buildEnergyCreditsBeneficiaryMonthlyReport('ben-001', '2024-06', { referenceDate: '2024-06' });

assert(typeof benR === 'object' && benR !== null,           '2.1 retorna objeto');
assert(benR.data.reportType === 'beneficiary-monthly',      '2.2 reportType');
assert(benR.generatedAt === '2024-06',                      '2.3 generatedAt = referenceDate');
assert(benR.data.target.beneficiaryUnitId === 'ben-001',    '2.4 target.beneficiaryUnitId');
assert(benR.data.summary.compensatedKwh === 400,            '2.5 summary.compensatedKwh');
assert(benR.data.summary.monthlyDiscount === 60,            '2.6 summary.monthlyDiscount');
assert(benR.data.sections.billingComparison.billWithoutEsa === 420, '2.7 billingComparison.billWithoutEsa');

// ── 3. buildEnergyCreditsEsaInternalMonthlyReport ─────────────────────────────

section(3, 'buildEnergyCreditsEsaInternalMonthlyReport');

const intR = ESA.buildEnergyCreditsEsaInternalMonthlyReport('2024-06', { referenceDate: '2024-06' });

assert(typeof intR === 'object' && intR !== null,            '3.1 retorna objeto');
assert(intR.data.reportType === 'esa-internal-monthly',      '3.2 reportType');
assert(intR.generatedAt === '2024-06',                       '3.3 generatedAt = referenceDate');
assert(intR.data.target.targetType === 'esa-internal',       '3.4 target.targetType');
assert(intR.data.summary.generatingUnitCount === 1,          '3.5 summary.generatingUnitCount');
assert(intR.data.summary.totalEsaRevenue === 360,            '3.6 summary.totalEsaRevenue');
assert(typeof intR.data.sections.executiveSummary === 'object', '3.7 sections.executiveSummary');

// ── 4. buildEnergyCreditsEsaFinancialMonthlyReport ────────────────────────────

section(4, 'buildEnergyCreditsEsaFinancialMonthlyReport');

const finR = ESA.buildEnergyCreditsEsaFinancialMonthlyReport('2024-06', { referenceDate: '2024-06' });

assert(typeof finR === 'object' && finR !== null,              '4.1 retorna objeto');
assert(finR.data.reportType === 'esa-financial-monthly',       '4.2 reportType');
assert(finR.generatedAt === '2024-06',                         '4.3 generatedAt = referenceDate');
assert(finR.data.target.targetType === 'esa-financial',        '4.4 target.targetType');
assert(finR.data.summary.totalInvoices === 1,                  '4.5 summary.totalInvoices');
assert(finR.data.summary.totalInvoicedAmount === 360,          '4.6 summary.totalInvoicedAmount');
assert(finR.data.summary.grossSpread === 40,                   '4.7 summary.grossSpread');

// ── 5. Contrato QueryResult e propagação ─────────────────────────────────────

section(5, 'Contrato QueryResult e propagação de referenceDate');

// APIs retornam o resultado de toJSON() que é { data, metadata, generatedAt }
for (const [label, r] of [['owner', ownerR], ['ben', benR], ['int', intR], ['fin', finR]]) {
  assert('data'        in r,  `5. ${label} possui data`);
  assert('metadata'    in r,  `5. ${label} possui metadata`);
  assert('generatedAt' in r,  `5. ${label} possui generatedAt`);
  assert(r.generatedAt === '2024-06', `5. ${label} generatedAt = 2024-06`);
  assert(typeof r.metadata === 'object', `5. ${label} metadata é objeto`);
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
