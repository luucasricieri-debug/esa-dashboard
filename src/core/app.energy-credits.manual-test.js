/**
 * ESA OS — Core
 * Suite de testes — ESAApplication + Energy Credits Read Model + Query Service
 * 20 cenários
 *
 * Execução: node src/core/app.energy-credits.manual-test.js
 *
 * Sem Firebase (métodos de EC não requerem initialize).
 * Sem Jest. Sem browser. ES Modules nativos.
 */

import { ESA }                   from './app.js';
import { energyCreditsReadModel } from '../read-models/energy-credits/index.js';

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
    { id: 'gen-001', name: 'Usina Alpha', ownerName: 'João', uc: 'UC1', utilityCompany: 'ENEL', operationalStatus: 'active' },
  ],
  beneficiaryUnits: [
    { id: 'ben-001', generatingUnitId: 'gen-001', name: 'Consumidor A', uc: 'UB1', utilityCompany: 'ENEL', subscriptionStatus: 'active' },
    { id: 'ben-002', generatingUnitId: 'gen-001', name: 'Consumidor B', uc: 'UB2', utilityCompany: 'ENEL', subscriptionStatus: 'active' },
  ],
  beneficiaryMonthlyRecords: [
    {
      id: 'br-001', beneficiaryUnitId: 'ben-001', generatingUnitId: 'gen-001', referenceMonth: '2024-01',
      monthlyConsumptionKwh: 400, allocatedKwh: 400, compensatedKwh: 400, pendingKwh: 0, residualKwh: 0,
      esaKwhPrice: 0.95, utilityReferenceTariff: 1.10, billWithoutEsa: 440, esaInvoiceAmount: 380,
      residualUtilityAmount: 0, billWithEsa: 380, monthlyDiscount: 60,
      previousAccumulatedDiscount: 0, accumulatedDiscountTotal: 60, paymentStatus: 'paid',
    },
  ],
  ownerSettlements: [
    { id: 'st-001', generatingUnitId: 'gen-001', ownerName: 'João', referenceMonth: '2024-01', consumedAllocatedKwh: 400, purchaseKwhPrice: 0.85, grossReturn: 340, adjustments: 0, netReturn: 340, paymentStatus: 'paid' },
  ],
  esaInvoices: [
    { id: 'inv-001', beneficiaryUnitId: 'ben-001', referenceMonth: '2024-01', consumedKwh: 400, compensatedKwh: 400, esaKwhPrice: 0.95, invoiceAmount: 380, paymentStatus: 'paid' },
  ],
  monthlyStatements: [
    {
      generatingUnitId: 'gen-001', referenceMonth: '2024-01',
      totalGenerationKwh: 5000, previousBalanceKwh: 0,
      availableKwhBeforeAllocation: 5000, totalAllocatedKwh: 400,
      totalCompensatedKwh: 400, totalPendingKwh: 0, totalResidualKwh: 0,
      currentBalanceKwh: 4600, totalOwnerReturn: 340, totalEsaRevenue: 380, grossSpread: 40,
      beneficiaryCount: 1,
      alerts: [{ code: 'ZERO_GENERATION', severity: 'critical', message: 'Atenção', targetType: 'generating', targetId: 'gen-001', metadata: {} }],
      metadata: { status: 'open', source: 'auto' },
    },
  ],
};

// ── 1. SERVIÇO DE DOMÍNIO ─────────────────────────────────────────────────────

section(1, 'getEnergyCreditsService (existente)');

const svc = ESA.getEnergyCreditsService();
assert(svc !== null,                         '1.1 getEnergyCreditsService() não null');
assert(typeof svc.createGeneratingUnit === 'function', '1.2 createGeneratingUnit disponível');
assert(ESA.getEnergyCreditsService() === svc,'1.3 retorna mesmo singleton');

// ── 2. HYDRATE ────────────────────────────────────────────────────────────────

section(2, 'hydrateEnergyCreditsReadModel');

const hydrateResult = ESA.hydrateEnergyCreditsReadModel(SNAPSHOT, { replace: true, referenceDate: '2024-01' });
assert(hydrateResult.hydrated > 0,             '2.1 hydrated > 0');
assert(hydrateResult.replaced === true,         '2.2 replaced = true');
assert(hydrateResult.referenceDate === '2024-01','2.3 referenceDate preservado');

// ── 3. STATS ──────────────────────────────────────────────────────────────────

section(3, 'getEnergyCreditsReadModelStats');

const stats = ESA.getEnergyCreditsReadModelStats();
assert(typeof stats === 'object',               '3.1 retorna objeto');
assert(stats.generatingUnitCount === 1,         '3.2 generatingUnitCount');
assert(stats.beneficiaryUnitCount === 2,        '3.3 beneficiaryUnitCount');
assert(stats.monthlyStatementCount === 1,       '3.4 monthlyStatementCount');
assert(stats.hydrationCount >= 1,               '3.5 hydrationCount >= 1');

// ── 4. QUERIES DE ENTIDADE ────────────────────────────────────────────────────

section(4, 'queryEnergyCreditsGeneratingUnit / queryEnergyCreditsBeneficiaryUnit');

const qGen = ESA.queryEnergyCreditsGeneratingUnit('gen-001', { referenceDate: '2024-01' });
assert(typeof qGen === 'object',                '4.1 retorna objeto (toJSON)');
assert(qGen.data !== null,                      '4.2 gen-001 encontrado');
assert(qGen.data.id === 'gen-001',              '4.3 id correto');
assert(qGen.generatedAt === '2024-01',          '4.4 generatedAt = referenceDate');

const qBen = ESA.queryEnergyCreditsBeneficiaryUnit('ben-001');
assert(qBen.data !== null,                      '4.5 ben-001 encontrado');
assert(qBen.data.generatingUnitId === 'gen-001','4.6 generatingUnitId correto');

// ── 5. SEARCH ─────────────────────────────────────────────────────────────────

section(5, 'searchEnergyCreditsGeneratingUnits / searchEnergyCreditsBeneficiaryUnits');

const sGen = ESA.searchEnergyCreditsGeneratingUnits({});
assert(Array.isArray(sGen.data),                '5.1 data é array');
assert(sGen.data.length === 1,                  '5.2 1 generating unit');
assert(sGen.metadata.count === 1,               '5.3 metadata.count');

const sBen = ESA.searchEnergyCreditsBeneficiaryUnits({ generatingUnitId: 'gen-001' });
assert(Array.isArray(sBen.data),                '5.4 data é array');
assert(sBen.data.length === 2,                  '5.5 2 beneficiary units');

// ── 6. MONTHLY STATEMENT ──────────────────────────────────────────────────────

section(6, 'getEnergyCreditsMonthlyStatement');

const qStmt = ESA.getEnergyCreditsMonthlyStatement('gen-001', '2024-01');
assert(qStmt.data !== null,                     '6.1 statement encontrado');
assert(qStmt.data.totalGenerationKwh === 5000,  '6.2 totalGenerationKwh');
assert(Array.isArray(qStmt.data.alerts),        '6.3 alerts é array');

// ── 7. SUMMARIES ──────────────────────────────────────────────────────────────

section(7, 'Summaries executivos');

const exec = ESA.getEnergyCreditsExecutiveSummary({}, { referenceDate: '2024-01' });
assert(exec.data.generatingUnitCount === 1,     '7.1 executiveSummary.generatingUnitCount');
assert(exec.data.beneficiaryUnitCount === 2,    '7.2 executiveSummary.beneficiaryUnitCount');
assert(exec.data.totalEsaRevenue === 380,       '7.3 executiveSummary.totalEsaRevenue');
assert(exec.generatedAt === '2024-01',          '7.4 executiveSummary.generatedAt');

const genSum = ESA.getEnergyCreditsGeneratingUnitSummary('gen-001');
assert(genSum.data.generatingUnit !== null,     '7.5 generatingUnitSummary.generatingUnit');
assert(genSum.data.beneficiaryCount === 2,      '7.6 generatingUnitSummary.beneficiaryCount');

const benSum = ESA.getEnergyCreditsBeneficiarySummary('ben-001');
assert(benSum.data.beneficiaryUnit !== null,    '7.7 beneficiarySummary.beneficiaryUnit');
assert(benSum.data.monthlyRecordCount === 1,    '7.8 beneficiarySummary.monthlyRecordCount');

// ── 8. FINANCIAL + ALERTS ─────────────────────────────────────────────────────

section(8, 'getEnergyCreditsFinancialSummary / getEnergyCreditsAlertsSummary');

const fin = ESA.getEnergyCreditsFinancialSummary();
assert(fin.data.totalInvoices === 1,            '8.1 financialSummary.totalInvoices');
assert(fin.data.paidInvoices === 1,             '8.2 financialSummary.paidInvoices');
assert(fin.data.totalInvoicedAmount === 380,    '8.3 financialSummary.totalInvoicedAmount');

const alr = ESA.getEnergyCreditsAlertsSummary();
assert(alr.data.totalAlerts === 1,              '8.4 alertsSummary.totalAlerts');
assert(alr.data.criticalAlerts.length === 1,    '8.5 alertsSummary.criticalAlerts');
assert(typeof alr.data.bySeverity === 'object', '8.6 alertsSummary.bySeverity');

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
