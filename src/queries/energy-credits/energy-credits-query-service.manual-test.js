/**
 * ESA OS — Energy Credits Query Service
 * Suite de testes manuais
 * 65 cenários
 *
 * Execução: node src/queries/energy-credits/energy-credits-query-service.manual-test.js
 *
 * Sem Firebase. Sem browser. Sem Jest. ES Modules nativos.
 */

import { EnergyCreditsReadModel }    from '../../read-models/energy-credits/energy-credits-read-model.js';
import { EnergyCreditsQueryService } from './energy-credits-query-service.js';
import { EnergyCreditsQueryResult }  from './energy-credits-query-result.js';

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

const GEN_UNIT_1 = { id: 'gen-001', name: 'Usina Alpha', ownerName: 'João', uc: 'UC1', utilityCompany: 'ENEL', operationalStatus: 'active', installedPower: 100 };
const GEN_UNIT_2 = { id: 'gen-002', name: 'Usina Beta',  ownerName: 'Maria', uc: 'UC2', utilityCompany: 'CPFL', operationalStatus: 'inactive' };

const BEN_UNIT_1 = { id: 'ben-001', generatingUnitId: 'gen-001', name: 'Consumidor A', uc: 'UB1', utilityCompany: 'ENEL', subscriptionStatus: 'active' };
const BEN_UNIT_2 = { id: 'ben-002', generatingUnitId: 'gen-001', name: 'Consumidor B', uc: 'UB2', utilityCompany: 'ENEL', subscriptionStatus: 'active' };
const BEN_UNIT_3 = { id: 'ben-003', generatingUnitId: 'gen-002', name: 'Consumidor C', uc: 'UB3', utilityCompany: 'CPFL', subscriptionStatus: 'suspended' };

const BEN_REC_1A = {
  id: 'br-001-01', beneficiaryUnitId: 'ben-001', generatingUnitId: 'gen-001', referenceMonth: '2024-01',
  monthlyConsumptionKwh: 400, allocatedKwh: 400, compensatedKwh: 400, pendingKwh: 0, residualKwh: 0,
  esaKwhPrice: 0.95, utilityReferenceTariff: 1.10, billWithoutEsa: 440, esaInvoiceAmount: 380,
  residualUtilityAmount: 0, billWithEsa: 380, monthlyDiscount: 60,
  previousAccumulatedDiscount: 0, accumulatedDiscountTotal: 60, paymentStatus: 'paid',
};
const BEN_REC_1B = {
  id: 'br-001-02', beneficiaryUnitId: 'ben-001', generatingUnitId: 'gen-001', referenceMonth: '2024-02',
  monthlyConsumptionKwh: 420, allocatedKwh: 420, compensatedKwh: 420, pendingKwh: 0, residualKwh: 0,
  esaKwhPrice: 0.95, utilityReferenceTariff: 1.10, billWithoutEsa: 462, esaInvoiceAmount: 399,
  residualUtilityAmount: 0, billWithEsa: 399, monthlyDiscount: 63,
  previousAccumulatedDiscount: 60, accumulatedDiscountTotal: 123, paymentStatus: 'pending',
};
const BEN_REC_2A = {
  id: 'br-002-01', beneficiaryUnitId: 'ben-002', generatingUnitId: 'gen-001', referenceMonth: '2024-01',
  monthlyConsumptionKwh: 300, allocatedKwh: 300, compensatedKwh: 300, pendingKwh: 0, residualKwh: 0,
  esaKwhPrice: 0.95, utilityReferenceTariff: 1.10, billWithoutEsa: 330, esaInvoiceAmount: 285,
  residualUtilityAmount: 0, billWithEsa: 285, monthlyDiscount: 45,
  previousAccumulatedDiscount: 0, accumulatedDiscountTotal: 45, paymentStatus: 'overdue',
};

const GEN_REC_1A = {
  id: 'gr-001-01', generatingUnitId: 'gen-001', referenceMonth: '2024-01',
  purchaseKwhPrice: 0.85, previousAccumulatedKwhBalance: 0,
  monthlyGenerationKwh: 5000, availableKwhBeforeAllocation: 5000,
  consumedAllocatedKwh: 700, currentAccumulatedKwhBalance: 4300,
  monthlyOwnerReturn: 595, accumulatedOwnerReturn: 595, status: 'active',
};

const ALLOCATION_1 = { id: 'al-001', generatingUnitId: 'gen-001', beneficiaryUnitId: 'ben-001', referenceMonth: '2024-01', allocatedKwh: 400, compensatedKwh: 400, pendingKwh: 0, status: 'compensated' };
const ALLOCATION_2 = { id: 'al-002', generatingUnitId: 'gen-001', beneficiaryUnitId: 'ben-002', referenceMonth: '2024-01', allocatedKwh: 300, compensatedKwh: 300, pendingKwh: 0, status: 'compensated' };

const SETTLEMENT_1 = { id: 'st-001', generatingUnitId: 'gen-001', ownerName: 'João', referenceMonth: '2024-01', consumedAllocatedKwh: 700, purchaseKwhPrice: 0.85, grossReturn: 595, adjustments: 0, netReturn: 595, paymentStatus: 'paid' };
const SETTLEMENT_2 = { id: 'st-002', generatingUnitId: 'gen-001', ownerName: 'João', referenceMonth: '2024-02', consumedAllocatedKwh: 420, purchaseKwhPrice: 0.85, grossReturn: 357, adjustments: 0, netReturn: 357, paymentStatus: 'pending' };

const INVOICE_1 = { id: 'inv-001', beneficiaryUnitId: 'ben-001', referenceMonth: '2024-01', consumedKwh: 400, compensatedKwh: 400, esaKwhPrice: 0.95, invoiceAmount: 380, paymentStatus: 'paid' };
const INVOICE_2 = { id: 'inv-002', beneficiaryUnitId: 'ben-002', referenceMonth: '2024-01', consumedKwh: 300, compensatedKwh: 300, esaKwhPrice: 0.95, invoiceAmount: 285, paymentStatus: 'overdue' };
const INVOICE_3 = { id: 'inv-003', beneficiaryUnitId: 'ben-001', referenceMonth: '2024-02', consumedKwh: 420, compensatedKwh: 420, esaKwhPrice: 0.95, invoiceAmount: 399, paymentStatus: 'pending' };

const STMT_1 = {
  generatingUnitId: 'gen-001', referenceMonth: '2024-01',
  totalGenerationKwh: 5000, previousBalanceKwh: 0,
  availableKwhBeforeAllocation: 5000, totalAllocatedKwh: 700,
  totalCompensatedKwh: 700, totalPendingKwh: 0, totalResidualKwh: 0,
  currentBalanceKwh: 4300, totalOwnerReturn: 595, totalEsaRevenue: 665, grossSpread: 70,
  beneficiaryCount: 2,
  alerts: [
    { code: 'PENDING_COMPENSATION', severity: 'attention', message: 'Msg1', targetType: 'beneficiary', targetId: 'ben-002', metadata: {} },
    { code: 'NEGATIVE_SAVINGS',     severity: 'risk',      message: 'Msg2', targetType: 'beneficiary', targetId: 'ben-001', metadata: {} },
    { code: 'ZERO_GENERATION',      severity: 'critical',  message: 'Msg3', targetType: 'generating',  targetId: 'gen-001', metadata: {} },
  ],
  metadata: { status: 'open', source: 'auto' },
};
const STMT_2 = {
  generatingUnitId: 'gen-001', referenceMonth: '2024-02',
  totalGenerationKwh: 4800, previousBalanceKwh: 4300,
  availableKwhBeforeAllocation: 9100, totalAllocatedKwh: 420,
  totalCompensatedKwh: 420, totalPendingKwh: 0, totalResidualKwh: 0,
  currentBalanceKwh: 8680, totalOwnerReturn: 357, totalEsaRevenue: 399, grossSpread: 42,
  beneficiaryCount: 1,
  alerts: [
    { code: 'INSUFFICIENT_BALANCE', severity: 'info', message: 'Msg4', targetType: 'generating', targetId: 'gen-001', metadata: {} },
  ],
  metadata: { status: 'review', source: 'auto' },
};

function buildReadModel() {
  const rm = new EnergyCreditsReadModel();
  rm.hydrate({
    generatingUnits:              [GEN_UNIT_1, GEN_UNIT_2],
    beneficiaryUnits:             [BEN_UNIT_1, BEN_UNIT_2, BEN_UNIT_3],
    generatingUnitMonthlyRecords: [GEN_REC_1A],
    beneficiaryMonthlyRecords:    [BEN_REC_1A, BEN_REC_1B, BEN_REC_2A],
    creditAllocations:            [ALLOCATION_1, ALLOCATION_2],
    ownerSettlements:             [SETTLEMENT_1, SETTLEMENT_2],
    esaInvoices:                  [INVOICE_1, INVOICE_2, INVOICE_3],
    monthlyStatements:            [STMT_1, STMT_2],
  }, { replace: true, referenceDate: '2024-02' });
  return rm;
}

// ── 1. QUERY RESULT ───────────────────────────────────────────────────────────

section(1, 'EnergyCreditsQueryResult');

const qr1 = new EnergyCreditsQueryResult([1, 2, 3], { query: 'test' }, '2024-01');
assert(qr1.generatedAt === '2024-01',      '1.1 generatedAt = referenceDate');
assert(Array.isArray(qr1.data),            '1.2 data é array');
const json1 = qr1.toJSON();
assert(Array.isArray(json1.data),          '1.3 toJSON().data é array');
assert(json1.metadata.query === 'test',    '1.4 metadata preservada no toJSON');
assert(json1.generatedAt === '2024-01',    '1.5 generatedAt no toJSON');
json1.data.push(99);
assert(qr1.data.length === 3,             '1.6 mutação do toJSON não afeta original');

const qr2 = new EnergyCreditsQueryResult({ x: 1 }, {}, null);
assert(qr2.generatedAt === null,           '1.7 generatedAt null quando não fornecido');
const json2 = qr2.toJSON();
assert(json2.data.x === 1,                '1.8 objeto no toJSON');
json2.data.x = 999;
assert(qr2.data.x === 1,                  '1.9 mutação do objeto toJSON não afeta original');

const qr3 = new EnergyCreditsQueryResult(null, {}, null);
assert(qr3.toJSON().data === null,         '1.10 null data preservado');

// ── 2. GUARD _requireReadModel ────────────────────────────────────────────────

section(2, 'Guard _requireReadModel');

const qs_noRm = new EnergyCreditsQueryService(null);
let threw = false;
try { qs_noRm.getGeneratingUnit('x'); } catch (e) { threw = true; }
assert(threw, '2.1 lança TypeError sem readModel');

// ── 3. GET ENTIDADE ───────────────────────────────────────────────────────────

section(3, 'getGeneratingUnit / getBeneficiaryUnit');

const rm3 = buildReadModel();
const qs3 = new EnergyCreditsQueryService(rm3);

const r3a = qs3.getGeneratingUnit('gen-001', { referenceDate: '2024-01' });
assert(r3a instanceof EnergyCreditsQueryResult,     '3.1 retorna EnergyCreditsQueryResult');
assert(r3a.data !== null,                           '3.2 gen-001 encontrado');
assert(r3a.data.id === 'gen-001',                   '3.3 id correto');
assert(r3a.generatedAt === '2024-01',               '3.4 generatedAt = referenceDate');
assert(r3a.metadata.query === 'ec.getGeneratingUnit', '3.5 metadata.query');

const r3b = qs3.getGeneratingUnit('inexistente');
assert(r3b.data === null,                           '3.6 id inexistente → data null');

const r3c = qs3.getBeneficiaryUnit('ben-001');
assert(r3c.data !== null,                           '3.7 ben-001 encontrado');
assert(r3c.data.generatingUnitId === 'gen-001',     '3.8 generatingUnitId preservado');

const r3d = qs3.getBeneficiaryUnit('nope');
assert(r3d.data === null,                           '3.9 ben inexistente → data null');

// ── 4. SEARCH ─────────────────────────────────────────────────────────────────

section(4, 'searchGeneratingUnits / searchBeneficiaryUnits');

const rm4 = buildReadModel();
const qs4 = new EnergyCreditsQueryService(rm4);

const r4a = qs4.searchGeneratingUnits({});
assert(Array.isArray(r4a.data),                      '4.1 data é array');
assert(r4a.data.length === 2,                        '4.2 2 generating units');
assert(r4a.metadata.count === 2,                     '4.3 metadata.count correto');
assert(r4a.metadata.query === 'ec.searchGeneratingUnits', '4.4 metadata.query');

const r4b = qs4.searchGeneratingUnits({ utilityCompany: 'CPFL' });
assert(r4b.data.length === 1,                        '4.5 filtro utilityCompany');
assert(r4b.data[0].id === 'gen-002',                 '4.6 resultado correto');

const r4c = qs4.searchBeneficiaryUnits({ generatingUnitId: 'gen-001' });
assert(r4c.data.length === 2,                        '4.7 beneficiárias de gen-001');
assert(r4c.metadata.count === 2,                     '4.8 metadata.count');

const r4d = qs4.searchBeneficiaryUnits({ subscriptionStatus: 'suspended' });
assert(r4d.data.length === 1,                        '4.9 filtro subscriptionStatus');
assert(r4d.data[0].id === 'ben-003',                 '4.10 resultado correto');

// ── 5. MONTHLY STATEMENT ──────────────────────────────────────────────────────

section(5, 'getMonthlyStatement');

const rm5 = buildReadModel();
const qs5 = new EnergyCreditsQueryService(rm5);

const r5a = qs5.getMonthlyStatement('gen-001', '2024-01');
assert(r5a.data !== null,                           '5.1 statement encontrado');
assert(r5a.data.totalGenerationKwh === 5000,        '5.2 totalGenerationKwh correto');
assert(r5a.metadata.generatingUnitId === 'gen-001', '5.3 metadata.generatingUnitId');
assert(r5a.metadata.referenceMonth === '2024-01',   '5.4 metadata.referenceMonth');

const r5b = qs5.getMonthlyStatement('gen-001', '2024-99');
assert(r5b.data === null,                           '5.5 mês inexistente → null');

// ── 6. HISTÓRICO MENSAL ───────────────────────────────────────────────────────

section(6, 'getGeneratingUnitMonthlyHistory / getBeneficiaryMonthlyHistory');

const rm6 = buildReadModel();
const qs6 = new EnergyCreditsQueryService(rm6);

const r6a = qs6.getGeneratingUnitMonthlyHistory('gen-001');
assert(r6a.data.length === 1,               '6.1 1 gen record para gen-001');
assert(r6a.metadata.count === 1,            '6.2 metadata.count');
assert(r6a.data[0].monthlyGenerationKwh === 5000, '6.3 dado correto');

const r6b = qs6.getBeneficiaryMonthlyHistory('ben-001');
assert(r6b.data.length === 2,               '6.4 2 ben records para ben-001');
assert(r6b.metadata.count === 2,            '6.5 metadata.count');

const r6c = qs6.getBeneficiaryMonthlyHistory('ben-001', { referenceMonth: '2024-01' });
assert(r6c.data.length === 1,               '6.6 filtro referenceMonth');
assert(r6c.data[0].compensatedKwh === 400,  '6.7 dado correto');

const r6d = qs6.getBeneficiaryMonthlyHistory('ben-001', { referenceMonthFrom: '2024-02' });
assert(r6d.data.length === 1,               '6.8 filtro referenceMonthFrom');
assert(r6d.data[0].referenceMonth === '2024-02', '6.9 mês correto');

// ── 7. EXECUTIVE SUMMARY ──────────────────────────────────────────────────────

section(7, 'getExecutiveSummary');

const rm7 = buildReadModel();
const qs7 = new EnergyCreditsQueryService(rm7);

const r7 = qs7.getExecutiveSummary({}, { referenceDate: '2024-02' });
const d7  = r7.data;
assert(r7 instanceof EnergyCreditsQueryResult,  '7.1 retorna QueryResult');
assert(d7.generatingUnitCount === 2,            '7.2 generatingUnitCount');
assert(d7.beneficiaryUnitCount === 3,           '7.3 beneficiaryUnitCount');
assert(d7.totalGenerationKwh === 9800,          '7.4 totalGenerationKwh soma');
assert(d7.totalEsaRevenue === 1064,             '7.5 totalEsaRevenue soma');
assert(d7.grossSpread === 112,                  '7.6 grossSpread soma');
assert(d7.alertCount === 4,                     '7.7 alertCount total');
assert(d7.criticalAlertCount === 1,             '7.8 criticalAlertCount');
assert(d7.riskAlertCount === 1,                 '7.9 riskAlertCount');
assert(Array.isArray(d7.referenceMonths),       '7.10 referenceMonths é array');
assert(d7.referenceMonths.length === 2,         '7.11 2 meses únicos');
assert(d7.delinquentInvoiceCount === 1,         '7.12 delinquentInvoiceCount');
assert(r7.generatedAt === '2024-02',            '7.13 generatedAt = referenceDate');

const r7f = qs7.getExecutiveSummary({ referenceMonth: '2024-01' });
assert(r7f.data.referenceMonths.length === 1,   '7.14 filtro por referenceMonth');

// ── 8. GENERATING UNIT SUMMARY ────────────────────────────────────────────────

section(8, 'getGeneratingUnitSummary');

const rm8 = buildReadModel();
const qs8 = new EnergyCreditsQueryService(rm8);

const r8 = qs8.getGeneratingUnitSummary('gen-001');
const d8  = r8.data;
assert(d8.generatingUnit !== null,         '8.1 generatingUnit retornado');
assert(d8.generatingUnit.id === 'gen-001', '8.2 id correto');
assert(d8.beneficiaryCount === 2,          '8.3 beneficiaryCount (apenas gen-001)');
assert(d8.monthlyStatementCount === 2,     '8.4 monthlyStatementCount');
assert(d8.totalGenerationKwh === 9800,     '8.5 totalGenerationKwh');
assert(d8.grossSpread === 112,             '8.6 grossSpread');
assert(d8.lastStatement !== null,          '8.7 lastStatement não null');
assert(d8.lastStatement.referenceMonth === '2024-02', '8.8 lastStatement é o mais recente');

const r8b = qs8.getGeneratingUnitSummary('gen-inexistente');
assert(r8b.data.generatingUnit === null,   '8.9 unidade inexistente → null');
assert(r8b.data.beneficiaryCount === 0,    '8.10 beneficiaryCount = 0');

// ── 9. BENEFICIARY SUMMARY ────────────────────────────────────────────────────

section(9, 'getBeneficiarySummary');

const rm9 = buildReadModel();
const qs9 = new EnergyCreditsQueryService(rm9);

const r9 = qs9.getBeneficiarySummary('ben-001');
const d9  = r9.data;
assert(d9.beneficiaryUnit !== null,               '9.1 beneficiaryUnit retornada');
assert(d9.monthlyRecordCount === 2,               '9.2 monthlyRecordCount');
assert(d9.totalEsaInvoiceAmount === 779,          '9.3 totalEsaInvoiceAmount soma');
assert(d9.accumulatedDiscountTotal === 123,       '9.4 accumulatedDiscountTotal do último registro');
assert(d9.lastMonthlyRecord !== null,             '9.5 lastMonthlyRecord presente');
assert(d9.lastMonthlyRecord.referenceMonth === '2024-02', '9.6 último mês correto');
assert(typeof d9.paymentStatusSummary === 'object', '9.7 paymentStatusSummary é objeto');
assert(d9.paymentStatusSummary.paid === 1,        '9.8 paid count');
assert(d9.paymentStatusSummary.pending === 1,     '9.9 pending count');

// ── 10. FINANCIAL SUMMARY ─────────────────────────────────────────────────────

section(10, 'getFinancialSummary');

const rm10 = buildReadModel();
const qs10 = new EnergyCreditsQueryService(rm10);

const r10 = qs10.getFinancialSummary();
const d10  = r10.data;
assert(d10.totalInvoices === 3,                   '10.1 totalInvoices');
assert(d10.paidInvoices === 1,                    '10.2 paidInvoices');
assert(d10.openInvoices === 1,                    '10.3 openInvoices (pending)');
assert(d10.overdueInvoices === 1,                 '10.4 overdueInvoices');
assert(d10.totalInvoicedAmount === 1064,          '10.5 totalInvoicedAmount soma');
assert(d10.totalOwnerSettlements === 2,           '10.6 totalOwnerSettlements');
assert(d10.paidOwnerSettlements === 1,            '10.7 paidOwnerSettlements');
assert(d10.openOwnerSettlements === 1,            '10.8 openOwnerSettlements');
assert(d10.totalOwnerSettlementAmount === 952,    '10.9 totalOwnerSettlementAmount');
assert(d10.totalOwnerSettlementOpenAmount === 357,'10.10 totalOwnerSettlementOpenAmount');

// ── 11. ALERTS SUMMARY ────────────────────────────────────────────────────────

section(11, 'getAlertsSummary');

const rm11 = buildReadModel();
const qs11 = new EnergyCreditsQueryService(rm11);

const r11 = qs11.getAlertsSummary();
const d11  = r11.data;
assert(d11.totalAlerts === 4,             '11.1 totalAlerts');
assert(typeof d11.bySeverity === 'object','11.2 bySeverity é objeto');
assert(d11.bySeverity.critical === 1,     '11.3 1 critical');
assert(d11.bySeverity.risk === 1,         '11.4 1 risk');
assert(d11.bySeverity.attention === 1,    '11.5 1 attention');
assert(d11.bySeverity.info === 1,         '11.6 1 info');
assert(typeof d11.byCode === 'object',    '11.7 byCode é objeto');
assert(d11.criticalAlerts.length === 1,   '11.8 criticalAlerts');
assert(d11.riskAlerts.length === 1,       '11.9 riskAlerts');
assert(d11.attentionAlerts.length === 1,  '11.10 attentionAlerts');
assert(d11.infoAlerts.length === 1,       '11.11 infoAlerts');

// Verificar ordenação determinística: critical → risk → attention → info
const sortedAlerts = d11.alerts;
assert(sortedAlerts[0].severity === 'critical',  '11.12 1º alert = critical');
assert(sortedAlerts[1].severity === 'risk',      '11.13 2º alert = risk');
assert(sortedAlerts[2].severity === 'attention', '11.14 3º alert = attention');
assert(sortedAlerts[3].severity === 'info',      '11.15 4º alert = info');

// ── 12. FILTROS NOS SUMMARIES ─────────────────────────────────────────────────

section(12, 'Filtros nos summaries');

const rm12 = buildReadModel();
const qs12 = new EnergyCreditsQueryService(rm12);

const r12a = qs12.getAlertsSummary({ referenceMonth: '2024-01' });
assert(r12a.data.totalAlerts === 3,          '12.1 alertsSummary filtrado por referenceMonth');

const r12b = qs12.getFinancialSummary({ referenceMonth: '2024-01' });
assert(r12b.data.totalInvoices === 2,        '12.2 financialSummary filtrado por mês');

const r12c = qs12.getExecutiveSummary({ referenceMonthFrom: '2024-02' });
assert(r12c.data.totalGenerationKwh === 4800,'12.3 executiveSummary filtrado por referenceMonthFrom');

// ── 13. NORMALIZAÇÃO NA SAÍDA ─────────────────────────────────────────────────

section(13, 'Sem undefined / NaN / [object Object] na saída');

const rm13 = new EnergyCreditsReadModel();
rm13.hydrate({
  generatingUnits:  [{ id: 'gen-x', name: 'X', uc: 'Y', utilityCompany: 'Z', installedPower: NaN, startedAt: undefined }],
  monthlyStatements: [{
    generatingUnitId: 'gen-x', referenceMonth: '2024-01',
    totalGenerationKwh: NaN, grossSpread: undefined, alerts: [],
  }],
}, { replace: true });

const qs13 = new EnergyCreditsQueryService(rm13);
const r13a = qs13.getGeneratingUnit('gen-x');
const json13a = JSON.stringify(r13a.toJSON());
assert(!json13a.includes('[object Object]'), '13.1 sem [object Object]');
assert(!json13a.includes('undefined'),        '13.2 sem undefined em toJSON');

const r13b = qs13.getExecutiveSummary();
assert(typeof r13b.data.totalGenerationKwh === 'number', '13.3 totalGenerationKwh é número');
assert(!isNaN(r13b.data.totalGenerationKwh),             '13.4 totalGenerationKwh não é NaN');

// ── 14. ISOLAMENTO ────────────────────────────────────────────────────────────

section(14, 'Isolamento — sem Firebase, window, localStorage');

const rm14 = buildReadModel();
const qs14 = new EnergyCreditsQueryService(rm14);
assert(typeof window    === 'undefined' || qs14 !== null, '14.1 sem window');
assert(typeof firebase  === 'undefined' || qs14 !== null, '14.2 sem firebase');

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
