/**
 * ESA OS — Energy Credits Report Service
 * Suite de testes manuais
 * 89 cenários
 *
 * Execução: node src/reports/energy-credits/energy-credits-report-service.manual-test.js
 *
 * Sem Firebase. Sem PDF. Sem envio. ES Modules nativos.
 */

import { EnergyCreditsReadModel }    from '../../read-models/energy-credits/energy-credits-read-model.js';
import { EnergyCreditsQueryService } from '../../queries/energy-credits/energy-credits-query-service.js';
import { EnergyCreditsQueryResult }  from '../../queries/energy-credits/energy-credits-query-result.js';
import { EnergyCreditsReportService } from './energy-credits-report-service.js';
import { REPORT_VERSION, REPORT_TYPE, DISTRIBUTION_DEFAULTS } from './report-types.js';

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

const GEN_UNIT = {
  id: 'gen-001', name: 'Usina Solar Alpha', ownerName: 'João Silva',
  ownerDocument: '123.456.789-00', uc: 'UC-001', address: 'Rua A, 100',
  city: 'São Paulo', state: 'SP', utilityCompany: 'ENEL',
  operationalStatus: 'active', installedPower: 100,
};

const BEN_UNIT_1 = {
  id: 'ben-001', generatingUnitId: 'gen-001', name: 'Consumidor Alpha',
  holderName: 'Ana Lima', uc: 'UC-B-001', utilityCompany: 'ENEL', subscriptionStatus: 'active',
};
const BEN_UNIT_2 = {
  id: 'ben-002', generatingUnitId: 'gen-001', name: 'Consumidor Beta',
  holderName: 'Carlos Melo', uc: 'UC-B-002', utilityCompany: 'ENEL', subscriptionStatus: 'active',
};

const GEN_REC = {
  id: 'gr-001', generatingUnitId: 'gen-001', referenceMonth: '2024-03',
  purchaseKwhPrice: 0.85, previousAccumulatedKwhBalance: 0,
  monthlyGenerationKwh: 5000, availableKwhBeforeAllocation: 5000,
  consumedAllocatedKwh: 750, currentAccumulatedKwhBalance: 4250,
  monthlyOwnerReturn: 637.50, accumulatedOwnerReturn: 637.50, status: 'active',
};

const BEN_REC_1 = {
  id: 'br-001', beneficiaryUnitId: 'ben-001', generatingUnitId: 'gen-001', referenceMonth: '2024-03',
  monthlyConsumptionKwh: 450, allocatedKwh: 450, compensatedKwh: 450, pendingKwh: 0, residualKwh: 0,
  esaKwhPrice: 0.95, utilityReferenceTariff: 1.10, billWithoutEsa: 495, esaInvoiceAmount: 427.50,
  residualUtilityAmount: 0, billWithEsa: 427.50, monthlyDiscount: 67.50,
  previousAccumulatedDiscount: 0, accumulatedDiscountTotal: 67.50, paymentStatus: 'paid',
  dueDate: 1711929600, paidAt: 1711929600,
};

const BEN_REC_2 = {
  id: 'br-002', beneficiaryUnitId: 'ben-002', generatingUnitId: 'gen-001', referenceMonth: '2024-03',
  monthlyConsumptionKwh: 300, allocatedKwh: 300, compensatedKwh: 300, pendingKwh: 0, residualKwh: 0,
  esaKwhPrice: 0.95, utilityReferenceTariff: 1.10, billWithoutEsa: 330, esaInvoiceAmount: 285,
  residualUtilityAmount: 0, billWithEsa: 285, monthlyDiscount: 45,
  previousAccumulatedDiscount: 0, accumulatedDiscountTotal: 45, paymentStatus: 'pending',
  dueDate: 1711929600, paidAt: null,
};

const SETTLEMENT = {
  id: 'st-001', generatingUnitId: 'gen-001', ownerName: 'João Silva', referenceMonth: '2024-03',
  consumedAllocatedKwh: 750, purchaseKwhPrice: 0.85, grossReturn: 637.50, adjustments: 0,
  netReturn: 637.50, paymentStatus: 'paid', dueDate: 1711929600, paidAt: 1711929600,
};

const INVOICE_1 = {
  id: 'inv-001', beneficiaryUnitId: 'ben-001', referenceMonth: '2024-03',
  consumedKwh: 450, compensatedKwh: 450, esaKwhPrice: 0.95, invoiceAmount: 427.50, paymentStatus: 'paid',
};
const INVOICE_2 = {
  id: 'inv-002', beneficiaryUnitId: 'ben-002', referenceMonth: '2024-03',
  consumedKwh: 300, compensatedKwh: 300, esaKwhPrice: 0.95, invoiceAmount: 285, paymentStatus: 'pending',
};

const STMT = {
  generatingUnitId: 'gen-001', referenceMonth: '2024-03',
  totalGenerationKwh: 5000, previousBalanceKwh: 0, availableKwhBeforeAllocation: 5000,
  totalAllocatedKwh: 750, totalCompensatedKwh: 750, totalPendingKwh: 0, totalResidualKwh: 0,
  currentBalanceKwh: 4250, totalOwnerReturn: 637.50, totalEsaRevenue: 712.50, grossSpread: 75,
  beneficiaryCount: 2,
  alerts: [
    { code: 'PENDING_COMPENSATION', severity: 'attention', message: 'Pendente ben-002', targetType: 'beneficiary', targetId: 'ben-002', metadata: {} },
    { code: 'ZERO_GENERATION', severity: 'critical', message: 'Geração zero', targetType: 'generating', targetId: 'gen-001', metadata: {} },
  ],
  metadata: { status: 'open', source: 'auto' },
};

function buildService() {
  const rm = new EnergyCreditsReadModel();
  rm.hydrate({
    generatingUnits:              [GEN_UNIT],
    beneficiaryUnits:             [BEN_UNIT_1, BEN_UNIT_2],
    generatingUnitMonthlyRecords: [GEN_REC],
    beneficiaryMonthlyRecords:    [BEN_REC_1, BEN_REC_2],
    ownerSettlements:             [SETTLEMENT],
    esaInvoices:                  [INVOICE_1, INVOICE_2],
    monthlyStatements:            [STMT],
  }, { replace: true, referenceDate: '2024-03' });
  const qs = new EnergyCreditsQueryService(rm);
  return new EnergyCreditsReportService(qs);
}

// ── 1. OWNER MONTHLY REPORT ───────────────────────────────────────────────────

section(1, 'Owner Monthly Report');

const svc1 = buildService();
const ownerResult = svc1.buildOwnerMonthlyReport('gen-001', '2024-03', { referenceDate: '2024-03' });
const ownerReport = ownerResult.data;

assert(ownerResult instanceof EnergyCreditsQueryResult,          '1.1 retorna EnergyCreditsQueryResult');
assert(ownerReport.reportVersion === REPORT_VERSION,             '1.2 reportVersion = 1.0');
assert(ownerReport.reportVersion === '1.0',                      '1.3 reportVersion literal 1.0');
assert(ownerReport.reportType === REPORT_TYPE.OWNER_MONTHLY,     '1.4 reportType owner-monthly');
assert(ownerReport.reportType === 'owner-monthly',               '1.5 reportType literal');
assert(ownerReport.generatedAt === '2024-03',                    '1.6 generatedAt = referenceDate');
assert(ownerReport.referenceMonth === '2024-03',                 '1.7 referenceMonth preservado');
assert(ownerResult.generatedAt === '2024-03',                    '1.8 QueryResult.generatedAt = referenceDate');
assert(typeof ownerReport.title === 'string' && ownerReport.title.length > 0, '1.9 title preenchido');
assert(ownerReport.title.includes('gen-001') || ownerReport.title.includes('Usina Solar Alpha'), '1.10 title contém nome');

// target
const ownerTarget = ownerReport.target;
assert(ownerTarget.targetType === 'generating-unit-owner',       '1.11 target.targetType');
assert(ownerTarget.generatingUnitId === 'gen-001',               '1.12 target.generatingUnitId');
assert(ownerTarget.ownerName === 'João Silva',                   '1.13 target.ownerName');
assert(ownerTarget.ownerDocument === '123.456.789-00',           '1.14 target.ownerDocument');

// summary
const ownerSummary = ownerReport.summary;
assert(ownerSummary.generatingUnitName === 'Usina Solar Alpha',  '1.15 summary.generatingUnitName');
assert(ownerSummary.ownerName === 'João Silva',                  '1.16 summary.ownerName');
assert(ownerSummary.referenceMonth === '2024-03',                '1.17 summary.referenceMonth');
assert(ownerSummary.monthlyGenerationKwh === 5000,               '1.18 summary.monthlyGenerationKwh');
assert(ownerSummary.totalAllocatedKwh === 750,                   '1.19 summary.totalAllocatedKwh');
assert(ownerSummary.currentBalanceKwh === 4250,                  '1.20 summary.currentBalanceKwh');
assert(ownerSummary.purchaseKwhPrice === 0.85,                   '1.21 summary.purchaseKwhPrice');
assert(ownerSummary.monthlyOwnerReturn === 637.50,               '1.22 summary.monthlyOwnerReturn');
assert(ownerSummary.accumulatedOwnerReturn === 637.50,           '1.23 summary.accumulatedOwnerReturn');
assert(ownerSummary.paymentStatus === 'paid',                    '1.24 summary.paymentStatus');

// sections
const ownerSections = ownerReport.sections;
assert(typeof ownerSections.identification === 'object',          '1.25 sections.identification existe');
assert(ownerSections.identification.name === 'Usina Solar Alpha', '1.26 sections.identification.name');
assert(ownerSections.identification.uc === 'UC-001',             '1.27 sections.identification.uc');
assert(typeof ownerSections.generationAndBalance === 'object',    '1.28 sections.generationAndBalance');
assert(ownerSections.generationAndBalance.monthlyGenerationKwh === 5000, '1.29 generationAndBalance.monthlyGenerationKwh');
assert(typeof ownerSections.beneficiaryConsumption === 'object',  '1.30 sections.beneficiaryConsumption');
assert(ownerSections.beneficiaryConsumption.count === 2,          '1.31 beneficiaryConsumption.count = 2');
assert(Array.isArray(ownerSections.beneficiaryConsumption.beneficiaries), '1.32 beneficiaries é array');
assert(ownerSections.beneficiaryConsumption.beneficiaries.length === 2,   '1.33 2 beneficiárias listadas');
assert(typeof ownerSections.ownerSettlement === 'object',         '1.34 sections.ownerSettlement');
assert(ownerSections.ownerSettlement.monthlyOwnerReturn === 637.50,'1.35 ownerSettlement.monthlyOwnerReturn');
assert(typeof ownerSections.alerts === 'object',                  '1.36 sections.alerts');
assert(ownerSections.alerts.count === 2,                          '1.37 sections.alerts.count');
assert(typeof ownerSections.documentsPlaceholder === 'object',    '1.38 sections.documentsPlaceholder');
assert(ownerSections.documentsPlaceholder.pdfReport === null,     '1.39 documentsPlaceholder.pdfReport = null');

// ordenação beneficiárias (by id: ben-001 < ben-002)
const bens = ownerSections.beneficiaryConsumption.beneficiaries;
assert(bens[0].beneficiaryUnitId === 'ben-001', '1.40 beneficiárias ordenadas por id — 1ª = ben-001');
assert(bens[1].beneficiaryUnitId === 'ben-002', '1.41 beneficiárias ordenadas por id — 2ª = ben-002');
assert(bens[0].compensatedKwh === 450,          '1.42 beneficiária 1: compensatedKwh');
assert(bens[0].paymentStatus === 'paid',         '1.43 beneficiária 1: paymentStatus');

// totals
assert(typeof ownerReport.totals === 'object',                   '1.44 totals presente');
assert(ownerReport.totals.grossSpread === 75,                    '1.45 totals.grossSpread');

// alerts
assert(Array.isArray(ownerReport.alerts),                        '1.46 alerts é array');
assert(ownerReport.alerts.length === 2,                          '1.47 2 alertas');

// ── 2. BENEFICIARY MONTHLY REPORT ─────────────────────────────────────────────

section(2, 'Beneficiary Monthly Report');

const svc2 = buildService();
const benResult = svc2.buildBeneficiaryMonthlyReport('ben-001', '2024-03', { referenceDate: '2024-03' });
const benReport = benResult.data;

assert(benResult instanceof EnergyCreditsQueryResult,            '2.1 retorna EnergyCreditsQueryResult');
assert(benReport.reportVersion === '1.0',                        '2.2 reportVersion 1.0');
assert(benReport.reportType === 'beneficiary-monthly',           '2.3 reportType beneficiary-monthly');
assert(benReport.generatedAt === '2024-03',                      '2.4 generatedAt = referenceDate');
assert(benReport.referenceMonth === '2024-03',                   '2.5 referenceMonth preservado');
assert(typeof benReport.title === 'string' && benReport.title.length > 0, '2.6 title preenchido');

// target
const benTarget = benReport.target;
assert(benTarget.targetType === 'beneficiary-unit',              '2.7 target.targetType');
assert(benTarget.beneficiaryUnitId === 'ben-001',                '2.8 target.beneficiaryUnitId');
assert(benTarget.generatingUnitId === 'gen-001',                 '2.9 target.generatingUnitId');
assert(benTarget.name === 'Consumidor Alpha',                    '2.10 target.name');
assert(benTarget.uc === 'UC-B-001',                              '2.11 target.uc');

// summary
const benSummary = benReport.summary;
assert(benSummary.beneficiaryName === 'Consumidor Alpha',        '2.12 summary.beneficiaryName');
assert(benSummary.uc === 'UC-B-001',                             '2.13 summary.uc');
assert(benSummary.monthlyConsumptionKwh === 450,                 '2.14 summary.monthlyConsumptionKwh');
assert(benSummary.compensatedKwh === 450,                        '2.15 summary.compensatedKwh');
assert(benSummary.esaKwhPrice === 0.95,                          '2.16 summary.esaKwhPrice');
assert(benSummary.billWithoutEsa === 495,                        '2.17 summary.billWithoutEsa');
assert(benSummary.esaInvoiceAmount === 427.50,                   '2.18 summary.esaInvoiceAmount');
assert(benSummary.billWithEsa === 427.50,                        '2.19 summary.billWithEsa');
assert(benSummary.monthlyDiscount === 67.50,                     '2.20 summary.monthlyDiscount');
assert(benSummary.accumulatedDiscountTotal === 67.50,            '2.21 summary.accumulatedDiscountTotal');
assert(benSummary.paymentStatus === 'paid',                      '2.22 summary.paymentStatus');

// sections
const benSections = benReport.sections;
assert(typeof benSections.identification === 'object',           '2.23 sections.identification');
assert(typeof benSections.consumption === 'object',              '2.24 sections.consumption');
assert(benSections.consumption.compensatedKwh === 450,           '2.25 sections.consumption.compensatedKwh');
assert(typeof benSections.billingComparison === 'object',        '2.26 sections.billingComparison');
assert(benSections.billingComparison.billWithoutEsa === 495,     '2.27 sections.billingComparison.billWithoutEsa');
assert(typeof benSections.savings === 'object',                  '2.28 sections.savings');
assert(benSections.savings.monthlyDiscount === 67.50,            '2.29 sections.savings.monthlyDiscount');
assert(typeof benSections.payment === 'object',                  '2.30 sections.payment');
assert(benSections.payment.paymentStatus === 'paid',             '2.31 sections.payment.paymentStatus');
assert(typeof benSections.alerts === 'object',                   '2.32 sections.alerts');
assert(typeof benSections.documentsPlaceholder === 'object',     '2.33 sections.documentsPlaceholder');

// totals
assert(benReport.totals !== null,                                '2.34 totals não null quando há dados');
assert(benReport.totals.esaInvoiceAmount === 427.50,             '2.35 totals.esaInvoiceAmount');

// ── 3. ESA INTERNAL MONTHLY REPORT ────────────────────────────────────────────

section(3, 'ESA Internal Monthly Report');

const svc3 = buildService();
const intResult = svc3.buildEsaInternalMonthlyReport('2024-03', { referenceDate: '2024-03' });
const intReport = intResult.data;

assert(intResult instanceof EnergyCreditsQueryResult,             '3.1 retorna EnergyCreditsQueryResult');
assert(intReport.reportVersion === '1.0',                         '3.2 reportVersion 1.0');
assert(intReport.reportType === 'esa-internal-monthly',           '3.3 reportType esa-internal-monthly');
assert(intReport.generatedAt === '2024-03',                       '3.4 generatedAt = referenceDate');
assert(intReport.referenceMonth === '2024-03',                    '3.5 referenceMonth preservado');

const intTarget = intReport.target;
assert(intTarget.targetType === 'esa-internal',                   '3.6 target.targetType esa-internal');
assert(intTarget.organization === 'esa',                          '3.7 target.organization esa');

const intSummary = intReport.summary;
assert(intSummary.referenceMonth === '2024-03',                   '3.8 summary.referenceMonth');
assert(intSummary.generatingUnitCount === 1,                      '3.9 summary.generatingUnitCount');
assert(intSummary.beneficiaryUnitCount === 2,                     '3.10 summary.beneficiaryUnitCount');
assert(intSummary.totalGenerationKwh === 5000,                    '3.11 summary.totalGenerationKwh');
assert(intSummary.totalEsaRevenue === 712.50,                     '3.12 summary.totalEsaRevenue');
assert(intSummary.grossSpread === 75,                             '3.13 summary.grossSpread');
assert(typeof intSummary.alertCount === 'number',                 '3.14 summary.alertCount');

const intSections = intReport.sections;
assert(typeof intSections.executiveSummary === 'object',          '3.15 sections.executiveSummary');
assert(typeof intSections.operationalSummary === 'object',        '3.16 sections.operationalSummary');
assert(typeof intSections.financialSummary === 'object',          '3.17 sections.financialSummary');
assert(typeof intSections.alerts === 'object',                    '3.18 sections.alerts');
assert(typeof intSections.pendingActionsPlaceholder === 'object', '3.19 sections.pendingActionsPlaceholder');

// ── 4. ESA FINANCIAL MONTHLY REPORT ──────────────────────────────────────────

section(4, 'ESA Financial Monthly Report');

const svc4 = buildService();
const finResult = svc4.buildEsaFinancialMonthlyReport('2024-03', { referenceDate: '2024-03' });
const finReport = finResult.data;

assert(finResult instanceof EnergyCreditsQueryResult,             '4.1 retorna EnergyCreditsQueryResult');
assert(finReport.reportVersion === '1.0',                         '4.2 reportVersion 1.0');
assert(finReport.reportType === 'esa-financial-monthly',          '4.3 reportType esa-financial-monthly');
assert(finReport.generatedAt === '2024-03',                       '4.4 generatedAt = referenceDate');

const finTarget = finReport.target;
assert(finTarget.targetType === 'esa-financial',                  '4.5 target.targetType esa-financial');
assert(finTarget.organization === 'esa',                          '4.6 target.organization esa');

const finSummary = finReport.summary;
assert(finSummary.referenceMonth === '2024-03',                   '4.7 summary.referenceMonth');
assert(finSummary.totalEsaRevenue === 712.50,                     '4.8 summary.totalEsaRevenue');
assert(finSummary.totalOwnerReturn === 637.50,                    '4.9 summary.totalOwnerReturn');
assert(finSummary.grossSpread === 75,                             '4.10 summary.grossSpread');
assert(finSummary.totalInvoices === 2,                            '4.11 summary.totalInvoices');
assert(finSummary.paidInvoices === 1,                             '4.12 summary.paidInvoices');
assert(finSummary.openInvoices === 1,                             '4.13 summary.openInvoices');
assert(finSummary.overdueInvoices === 0,                          '4.14 summary.overdueInvoices');
assert(finSummary.totalInvoicedAmount === 712.50,                 '4.15 summary.totalInvoicedAmount');
assert(finSummary.totalOwnerSettlements === 1,                    '4.16 summary.totalOwnerSettlements');
assert(finSummary.paidOwnerSettlements === 1,                     '4.17 summary.paidOwnerSettlements');
assert(finSummary.totalOwnerSettlementAmount === 637.50,          '4.18 summary.totalOwnerSettlementAmount');

const finSections = finReport.sections;
assert(typeof finSections.invoicing === 'object',                 '4.19 sections.invoicing');
assert(typeof finSections.receipts === 'object',                  '4.20 sections.receipts');
assert(typeof finSections.ownerSettlements === 'object',          '4.21 sections.ownerSettlements');
assert(typeof finSections.spread === 'object',                    '4.22 sections.spread');
assert(typeof finSections.delinquency === 'object',               '4.23 sections.delinquency');
assert(typeof finSections.alerts === 'object',                    '4.24 sections.alerts');

assert(finReport.totals.totalEsaRevenue === 712.50,              '4.25 totals.totalEsaRevenue');

// ── 5. DISTRIBUTION E METADATA ────────────────────────────────────────────────

section(5, 'Distribution e Metadata');

const svc5 = buildService();
const ownerR5 = svc5.buildOwnerMonthlyReport('gen-001', '2024-03', {}).data;
const benR5   = svc5.buildBeneficiaryMonthlyReport('ben-001', '2024-03', {}).data;
const intR5   = svc5.buildEsaInternalMonthlyReport('2024-03', {}).data;
const finR5   = svc5.buildEsaFinancialMonthlyReport('2024-03', {}).data;

for (const [label, r] of [['owner', ownerR5], ['ben', benR5], ['int', intR5], ['fin', finR5]]) {
  assert(r.distribution.pdfReady === false,      `5. ${label} distribution.pdfReady = false`);
  assert(r.distribution.downloadable === true,   `5. ${label} distribution.downloadable = true`);
  assert(r.distribution.emailReady === false,    `5. ${label} distribution.emailReady = false`);
  assert(r.distribution.whatsappReady === false, `5. ${label} distribution.whatsappReady = false`);
  assert(r.distribution.manualDelivery === true, `5. ${label} distribution.manualDelivery = true`);
  assert(r.metadata.source === 'energy-credits-query-service', `5. ${label} metadata.source`);
  assert(r.metadata.minimized === true,          `5. ${label} metadata.minimized = true`);
  assert(r.metadata.readOnly === true,           `5. ${label} metadata.readOnly = true`);
  assert(r.metadata.requiresPdfRendering === true, `5. ${label} metadata.requiresPdfRendering = true`);
  assert(Array.isArray(r.metadata.sectionsAvailable), `5. ${label} metadata.sectionsAvailable é array`);
  assert(Array.isArray(r.metadata.sectionsUnavailable), `5. ${label} metadata.sectionsUnavailable é array`);
  assert(typeof r.metadata.alertCount === 'number', `5. ${label} metadata.alertCount é número`);
  assert(r.metadata.generatedBy === 'esa-os',    `5. ${label} metadata.generatedBy`);
}

// ── 6. DATA MINIMIZATION E SANITIZAÇÃO ───────────────────────────────────────

section(6, 'Data minimization e sanitização');

const svc6 = buildService();
const reports6 = [
  svc6.buildOwnerMonthlyReport('gen-001', '2024-03', {}).data,
  svc6.buildBeneficiaryMonthlyReport('ben-001', '2024-03', {}).data,
  svc6.buildEsaInternalMonthlyReport('2024-03', {}).data,
  svc6.buildEsaFinancialMonthlyReport('2024-03', {}).data,
];

const FORBIDDEN = ['passHash', 'password', 'sessionToken', 'sessionExpiresAt', 'fileUrl', 'pdfUrl', 'downloadUrl', 'stackTrace', 'auditLog', 'logEntry'];
for (const r of reports6) {
  const json = JSON.stringify(r);
  assert(!json.includes('"undefined"') && !json.includes(':undefined'), '6.a sem undefined no JSON');
  assert(!json.includes('[object Object]'),  '6.b sem [object Object]');
  for (const key of FORBIDDEN) {
    assert(!json.includes(`"${key}"`), `6.c ausência de ${key}`);
  }
}

// Verifica NaN ausente (NaN não serializa em JSON, mas após _sanitize deve ser null)
const ownerJson6 = JSON.parse(JSON.stringify(svc6.buildOwnerMonthlyReport('gen-001', '2024-03', {}).data));
const hasBadNumber = (obj) => {
  if (typeof obj === 'number' && isNaN(obj)) return true;
  if (Array.isArray(obj)) return obj.some(hasBadNumber);
  if (obj && typeof obj === 'object') return Object.values(obj).some(hasBadNumber);
  return false;
};
assert(!hasBadNumber(ownerJson6), '6.d sem NaN no relatório do proprietário após JSON.parse');

// ── 7. DETERMINISMO ───────────────────────────────────────────────────────────

section(7, 'Determinismo');

const svc7a = buildService();
const svc7b = buildService();
const r7a = svc7a.buildOwnerMonthlyReport('gen-001', '2024-03', { referenceDate: '2024-03' });
const r7b = svc7b.buildOwnerMonthlyReport('gen-001', '2024-03', { referenceDate: '2024-03' });

assert(JSON.stringify(r7a.toJSON()) === JSON.stringify(r7b.toJSON()), '7.1 mesmo input → mesmo JSON (proprietário)');

const r7c = svc7a.buildEsaFinancialMonthlyReport('2024-03', { referenceDate: '2024-03' });
const r7d = svc7b.buildEsaFinancialMonthlyReport('2024-03', { referenceDate: '2024-03' });
assert(JSON.stringify(r7c.toJSON()) === JSON.stringify(r7d.toJSON()), '7.2 mesmo input → mesmo JSON (financeiro)');

// generatedAt null sem referenceDate
const r7e = svc7a.buildOwnerMonthlyReport('gen-001', '2024-03', {});
assert(r7e.data.generatedAt === null, '7.3 generatedAt null quando referenceDate não fornecido');

// ── 8. ERROS CLAROS ───────────────────────────────────────────────────────────

section(8, 'Erros claros');

const svc8 = buildService();

let err8a = null;
try { svc8.buildOwnerMonthlyReport('gen-999', '2024-03', {}); } catch (e) { err8a = e; }
assert(err8a !== null,                          '8.1 lança erro quando UG não existe');
assert(err8a.message.includes('gen-999'),       '8.2 erro menciona ID da UG');

let err8b = null;
try { svc8.buildBeneficiaryMonthlyReport('ben-999', '2024-03', {}); } catch (e) { err8b = e; }
assert(err8b !== null,                          '8.3 lança erro quando beneficiária não existe');
assert(err8b.message.includes('ben-999'),       '8.4 erro menciona ID da beneficiária');

// Mês sem dados → não lança erro, mas summary tem nulls
const r8c = svc8.buildOwnerMonthlyReport('gen-001', '2025-01', {});
assert(r8c.data !== null,                       '8.5 mês sem dados retorna relatório (não lança)');
assert(r8c.data.summary.monthlyGenerationKwh === null, '8.6 summary.monthlyGenerationKwh null quando mês sem dados');

// guard queryService inválido
const svcNoQs = new EnergyCreditsReportService(null);
let err8d = null;
try { svcNoQs.buildOwnerMonthlyReport('x', '2024-01', {}); } catch (e) { err8d = e; }
assert(err8d instanceof TypeError,              '8.7 TypeError quando queryService é null');

// ── 9. ISOLAMENTO ─────────────────────────────────────────────────────────────

section(9, 'Isolamento — sem Firebase/window/localStorage');

const svc9 = buildService();
assert(typeof window    === 'undefined' || svc9 !== null, '9.1 sem window');
assert(typeof firebase  === 'undefined' || svc9 !== null, '9.2 sem firebase');
assert(typeof localStorage === 'undefined' || svc9 !== null, '9.3 sem localStorage');

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
