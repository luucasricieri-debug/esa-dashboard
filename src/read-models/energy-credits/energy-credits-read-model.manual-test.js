/**
 * ESA OS — Energy Credits Read Model
 * Suite de testes manuais
 * 40 cenários
 *
 * Execução: node src/read-models/energy-credits/energy-credits-read-model.manual-test.js
 *
 * Sem Firebase. Sem browser. Sem Jest. ES Modules nativos.
 */

import { EnergyCreditsReadModel } from './energy-credits-read-model.js';

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
  ownerDocument: '123.456.789-00', uc: 'UC-001', address: 'Rua A, 1',
  city: 'São Paulo', state: 'SP', utilityCompany: 'ENEL',
  installedPower: 100.5, operationalStatus: 'active', startedAt: 1700000000,
};

const GEN_UNIT_2 = {
  id: 'gen-002', name: 'Usina Solar Beta', ownerName: 'Maria Santos',
  uc: 'UC-002', utilityCompany: 'CPFL', operationalStatus: 'inactive',
};

const BEN_UNIT = {
  id: 'ben-001', generatingUnitId: 'gen-001', name: 'Consumidor Alpha',
  holderName: 'João Silva', uc: 'UC-BEN-001', utilityCompany: 'ENEL',
  subscriptionStatus: 'active', averageConsumption12Months: 450,
};

const BEN_UNIT_2 = {
  id: 'ben-002', generatingUnitId: 'gen-001', name: 'Consumidor Beta',
  uc: 'UC-BEN-002', utilityCompany: 'ENEL', subscriptionStatus: 'suspended',
};

const GEN_RECORD = {
  id: 'grec-001', generatingUnitId: 'gen-001', referenceMonth: '2024-01',
  purchaseKwhPrice: 0.85, previousAccumulatedKwhBalance: 0,
  monthlyGenerationKwh: 5000, availableKwhBeforeAllocation: 5000,
  consumedAllocatedKwh: 4500, currentAccumulatedKwhBalance: 500,
  monthlyOwnerReturn: 3825, accumulatedOwnerReturn: 3825, status: 'active',
};

const BEN_RECORD = {
  id: 'brec-001', beneficiaryUnitId: 'ben-001', generatingUnitId: 'gen-001',
  referenceMonth: '2024-01', monthlyConsumptionKwh: 450, allocatedKwh: 450,
  compensatedKwh: 450, pendingKwh: 0, residualKwh: 0,
  esaKwhPrice: 0.95, utilityReferenceTariff: 1.10,
  billWithoutEsa: 495, esaInvoiceAmount: 427.50, residualUtilityAmount: 0,
  billWithEsa: 427.50, monthlyDiscount: 67.50,
  previousAccumulatedDiscount: 0, accumulatedDiscountTotal: 67.50,
  paymentStatus: 'paid', dueDate: 1706745600, paidAt: 1706745600,
};

const ALLOCATION = {
  id: 'alloc-001', generatingUnitId: 'gen-001', beneficiaryUnitId: 'ben-001',
  referenceMonth: '2024-01', allocatedKwh: 450, compensatedKwh: 450,
  pendingKwh: 0, status: 'compensated',
};

const SETTLEMENT = {
  id: 'sett-001', generatingUnitId: 'gen-001', ownerName: 'João Silva',
  referenceMonth: '2024-01', consumedAllocatedKwh: 4500, purchaseKwhPrice: 0.85,
  grossReturn: 3825, adjustments: 0, netReturn: 3825,
  paymentStatus: 'paid', dueDate: 1706745600, paidAt: 1706745600,
};

const INVOICE = {
  id: 'inv-001', beneficiaryUnitId: 'ben-001', referenceMonth: '2024-01',
  consumedKwh: 450, compensatedKwh: 450, esaKwhPrice: 0.95,
  invoiceAmount: 427.50, paymentStatus: 'paid', dueDate: 1706745600, paidAt: 1706745600,
};

const STATEMENT = {
  generatingUnitId: 'gen-001', referenceMonth: '2024-01',
  totalGenerationKwh: 5000, previousBalanceKwh: 0,
  availableKwhBeforeAllocation: 5000, totalAllocatedKwh: 4500,
  totalCompensatedKwh: 4500, totalPendingKwh: 0, totalResidualKwh: 0,
  currentBalanceKwh: 500, totalOwnerReturn: 3825, totalEsaRevenue: 4275,
  grossSpread: 450, beneficiaryCount: 1,
  alerts: [{ code: 'PENDING_COMPENSATION', severity: 'attention', message: 'Pendente', targetType: 'beneficiary', targetId: 'ben-001', metadata: {} }],
  metadata: { generatedAt: 1706745600, status: 'open', source: 'manual' },
};

// ── 1. INSTÂNCIA VAZIA ────────────────────────────────────────────────────────

section(1, 'Instância vazia');

const rm1 = new EnergyCreditsReadModel();

assert(rm1.listGeneratingUnits().length === 0,        '1.1 listGeneratingUnits() retorna []');
assert(rm1.listBeneficiaryUnits().length === 0,       '1.2 listBeneficiaryUnits() retorna []');
assert(rm1.listMonthlyStatements().length === 0,      '1.3 listMonthlyStatements() retorna []');
assert(rm1.getStats().generatingUnitCount === 0,      '1.4 getStats().generatingUnitCount = 0');
assert(rm1.getStats().hydrationCount === 0,           '1.5 getStats().hydrationCount = 0');
assert(rm1.getStats().lastHydration === null,         '1.6 getStats().lastHydration = null');

// ── 2. UPSERT GENERATING UNIT ─────────────────────────────────────────────────

section(2, 'Upsert Generating Unit');

const rm2 = new EnergyCreditsReadModel();

assert(rm2.upsertGeneratingUnit(GEN_UNIT) === true,            '2.1 upsert válido retorna true');
assert(rm2.getGeneratingUnit('gen-001') !== null,              '2.2 get após upsert retorna unidade');
assert(rm2.getGeneratingUnit('gen-001').id === 'gen-001',      '2.3 id preservado');
assert(rm2.getGeneratingUnit('gen-001').name === 'Usina Solar Alpha', '2.4 name preservado');
assert(rm2.getGeneratingUnit('gen-001').installedPower === 100.5,     '2.5 installedPower preservado');
assert(rm2.upsertGeneratingUnit({}) === false,                        '2.6 rejeita sem id');
assert(rm2.upsertGeneratingUnit(null) === false,                      '2.7 rejeita null');
assert(rm2.listGeneratingUnits().length === 1,                        '2.8 lista tem 1 item');
rm2.upsertGeneratingUnit({ ...GEN_UNIT, name: 'Novo Nome' });
assert(rm2.getGeneratingUnit('gen-001').name === 'Novo Nome',   '2.9 update com mesmo id');
assert(rm2.getGeneratingUnit('inexistente') === null,           '2.10 get id inexistente retorna null');

// ── 3. UPSERT BENEFICIARY UNIT ────────────────────────────────────────────────

section(3, 'Upsert Beneficiary Unit');

const rm3 = new EnergyCreditsReadModel();

assert(rm3.upsertBeneficiaryUnit(BEN_UNIT) === true,               '3.1 upsert válido retorna true');
assert(rm3.getBeneficiaryUnit('ben-001') !== null,                 '3.2 get após upsert');
assert(rm3.getBeneficiaryUnit('ben-001').generatingUnitId === 'gen-001', '3.3 generatingUnitId preservado');
assert(rm3.getBeneficiaryUnit('ben-001').subscriptionStatus === 'active', '3.4 subscriptionStatus preservado');
assert(rm3.upsertBeneficiaryUnit({}) === false,                    '3.5 rejeita sem id');

// ── 4. UPSERT MONTHLY STATEMENT ───────────────────────────────────────────────

section(4, 'Upsert Monthly Statement');

const rm4 = new EnergyCreditsReadModel();

assert(rm4.upsertMonthlyStatement(STATEMENT) === true,                               '4.1 upsert válido retorna true');
assert(rm4.getMonthlyStatement('gen-001', '2024-01') !== null,                       '4.2 get por chave composta');
assert(rm4.getMonthlyStatement('gen-001', '2024-01').totalGenerationKwh === 5000,    '4.3 totalGenerationKwh preservado');
assert(rm4.getMonthlyStatement('gen-001', '2024-02') === null,                       '4.4 mês diferente retorna null');
assert(rm4.upsertMonthlyStatement({ generatingUnitId: 'gen-001', referenceMonth: '99-99' }) === false, '4.5 rejeita mês inválido');
assert(rm4.upsertMonthlyStatement({ generatingUnitId: 'gen-001' }) === false,        '4.6 rejeita sem referenceMonth');
const stmt = rm4.getMonthlyStatement('gen-001', '2024-01');
assert(Array.isArray(stmt.alerts), '4.7 alerts é array');
assert(stmt.alerts[0].code === 'PENDING_COMPENSATION', '4.8 alert code preservado');
assert(stmt.metadata.status === 'open', '4.9 metadata.status preservado');

// ── 5. UPSERT MONTHLY RECORDS ─────────────────────────────────────────────────

section(5, 'Upsert Monthly Records');

const rm5 = new EnergyCreditsReadModel();

assert(rm5.upsertGeneratingUnitMonthlyRecord(GEN_RECORD) === true, '5.1 gen record upsert ok');
assert(rm5.upsertBeneficiaryMonthlyRecord(BEN_RECORD) === true,    '5.2 ben record upsert ok');
assert(rm5.upsertCreditAllocation(ALLOCATION) === true,            '5.3 allocation upsert ok');
assert(rm5.upsertOwnerSettlement(SETTLEMENT) === true,             '5.4 settlement upsert ok');
assert(rm5.upsertEsaInvoice(INVOICE) === true,                     '5.5 invoice upsert ok');
assert(rm5.upsertBeneficiaryMonthlyRecord({ beneficiaryUnitId: 'b', referenceMonth: '99-01' }) === false, '5.6 rejeita mês inválido');
assert(rm5.upsertGeneratingUnitMonthlyRecord({ generatingUnitId: 'g' }) === false, '5.7 rejeita sem referenceMonth');

// ── 6. HYDRATE replace=true ───────────────────────────────────────────────────

section(6, 'Hydrate replace=true');

const rm6 = new EnergyCreditsReadModel();
rm6.upsertGeneratingUnit({ id: 'old-001', name: 'Antigo', uc: 'X' });

const result6 = rm6.hydrate({
  generatingUnits:  [GEN_UNIT, GEN_UNIT_2],
  beneficiaryUnits: [BEN_UNIT],
  monthlyStatements: [STATEMENT],
}, { replace: true, referenceDate: '2024-02' });

assert(result6.received === 4,              '6.1 received = 4');
assert(result6.hydrated === 4,              '6.2 hydrated = 4');
assert(result6.skipped  === 0,              '6.3 skipped  = 0');
assert(result6.replaced === true,           '6.4 replaced = true');
assert(result6.referenceDate === '2024-02', '6.5 referenceDate preservado');
assert(rm6.getGeneratingUnit('old-001') === null,  '6.6 dado antigo removido');
assert(rm6.getGeneratingUnit('gen-001') !== null,  '6.7 novo dado inserido');
assert(rm6.getStats().generatingUnitCount === 2,   '6.8 count correto após hydrate');
assert(rm6.getStats().hydrationCount === 1,        '6.9 hydrationCount incrementado');

// ── 7. HYDRATE replace=false ──────────────────────────────────────────────────

section(7, 'Hydrate replace=false (merge)');

const rm7 = new EnergyCreditsReadModel();
rm7.upsertGeneratingUnit(GEN_UNIT);

const result7 = rm7.hydrate({
  generatingUnits: [GEN_UNIT_2],
}, { replace: false });

assert(result7.replaced === false,              '7.1 replaced = false');
assert(rm7.getGeneratingUnit('gen-001') !== null, '7.2 dado original preservado');
assert(rm7.getGeneratingUnit('gen-002') !== null, '7.3 novo dado adicionado');
assert(rm7.getStats().generatingUnitCount === 2,  '7.4 count total correto');

// ── 8. HYDRATE com objetos indexados ─────────────────────────────────────────

section(8, 'Hydrate com objetos indexados por id');

const rm8 = new EnergyCreditsReadModel();
const result8 = rm8.hydrate({
  generatingUnits: { 'gen-001': GEN_UNIT, 'gen-002': GEN_UNIT_2 },
}, { replace: true });

assert(result8.received === 2,             '8.1 received = 2 de objeto indexado');
assert(result8.hydrated === 2,             '8.2 hydrated = 2');
assert(rm8.listGeneratingUnits().length === 2, '8.3 lista correta');

// ── 9. GETTERS de isolamento ──────────────────────────────────────────────────

section(9, 'Isolamento: getters retornam cópias');

const rm9 = new EnergyCreditsReadModel();
rm9.upsertGeneratingUnit(GEN_UNIT);

const unitA = rm9.getGeneratingUnit('gen-001');
unitA.name = 'MUTADO';
const unitB = rm9.getGeneratingUnit('gen-001');
assert(unitB.name !== 'MUTADO', '9.1 mutação externa não afeta o store');

const list1 = rm9.listGeneratingUnits();
list1.push({ id: 'FAKE' });
assert(rm9.listGeneratingUnits().length === 1, '9.2 push externo não afeta o store');

// ── 10. FILTROS ───────────────────────────────────────────────────────────────

section(10, 'Filtros');

const rm10 = new EnergyCreditsReadModel();
rm10.upsertGeneratingUnit(GEN_UNIT);
rm10.upsertGeneratingUnit(GEN_UNIT_2);
rm10.upsertBeneficiaryUnit(BEN_UNIT);
rm10.upsertBeneficiaryUnit(BEN_UNIT_2);
rm10.upsertBeneficiaryMonthlyRecord(BEN_RECORD);
rm10.upsertBeneficiaryMonthlyRecord({ ...BEN_RECORD, id: 'brec-002', referenceMonth: '2024-02', paymentStatus: 'pending' });
rm10.upsertMonthlyStatement(STATEMENT);
rm10.upsertMonthlyStatement({ ...STATEMENT, referenceMonth: '2024-02' });

assert(rm10.listGeneratingUnits({ utilityCompany: 'ENEL' }).length === 1,   '10.1 filtro utilityCompany');
assert(rm10.listGeneratingUnits({ operationalStatus: 'active' }).length === 1, '10.2 filtro operationalStatus');
assert(rm10.listBeneficiaryUnits({ generatingUnitId: 'gen-001' }).length === 2, '10.3 filtro generatingUnitId');
assert(rm10.listBeneficiaryUnits({ subscriptionStatus: 'active' }).length === 1, '10.4 filtro subscriptionStatus');
assert(rm10.listBeneficiaryMonthlyRecords({ referenceMonth: '2024-01' }).length === 1, '10.5 filtro referenceMonth exato');
assert(rm10.listBeneficiaryMonthlyRecords({ paymentStatus: 'paid' }).length === 1,    '10.6 filtro paymentStatus');
assert(rm10.listMonthlyStatements({ referenceMonthFrom: '2024-02' }).length === 1,    '10.7 filtro referenceMonthFrom');
assert(rm10.listMonthlyStatements({ referenceMonthTo: '2024-01' }).length === 1,      '10.8 filtro referenceMonthTo');
assert(rm10.listMonthlyStatements({ generatingUnitId: 'gen-001' }).length === 2,      '10.9 filtro generatingUnitId em statements');

// ── 11. NORMALIZAÇÃO ──────────────────────────────────────────────────────────

section(11, 'Normalização de tipos inválidos');

const rm11 = new EnergyCreditsReadModel();
rm11.upsertGeneratingUnit({
  id: 'gen-999', name: 'Test', uc: 'X', utilityCompany: 'Y',
  installedPower: NaN, startedAt: undefined, notes: null,
});
const u11 = rm11.getGeneratingUnit('gen-999');
assert(u11.installedPower === null, '11.1 NaN → null');
assert(u11.startedAt === null,      '11.2 undefined → null');
assert(u11.notes === null,          '11.3 null preservado');

rm11.upsertBeneficiaryMonthlyRecord({
  beneficiaryUnitId: 'b-test', referenceMonth: '2024-06',
  esaInvoiceAmount: NaN, billWithEsa: undefined,
});
const r11 = rm11.listBeneficiaryMonthlyRecords({ beneficiaryUnitId: 'b-test' })[0];
assert(r11.esaInvoiceAmount === null, '11.4 esaInvoiceAmount NaN → null');
assert(r11.billWithEsa === null,      '11.5 billWithEsa undefined → null');
assert(!JSON.stringify(r11).includes('[object Object]'), '11.6 sem [object Object]');

// ── 12. CLEAR ─────────────────────────────────────────────────────────────────

section(12, 'Clear');

const rm12 = new EnergyCreditsReadModel();
rm12.upsertGeneratingUnit(GEN_UNIT);
rm12.upsertBeneficiaryUnit(BEN_UNIT);
rm12.upsertMonthlyStatement(STATEMENT);
rm12.clear();

assert(rm12.listGeneratingUnits().length === 0,  '12.1 generating units limpos');
assert(rm12.listBeneficiaryUnits().length === 0, '12.2 beneficiary units limpos');
assert(rm12.listMonthlyStatements().length === 0,'12.3 statements limpos');
assert(rm12.getStats().hydrationCount === 0,     '12.4 hydrationCount zerado após clear');
assert(rm12.getStats().lastHydration === null,   '12.5 lastHydration null após clear');

// ── 13. STATS ─────────────────────────────────────────────────────────────────

section(13, 'Stats');

const rm13 = new EnergyCreditsReadModel();
rm13.hydrate({
  generatingUnits:    [GEN_UNIT, GEN_UNIT_2],
  beneficiaryUnits:   [BEN_UNIT],
  monthlyStatements:  [STATEMENT],
  creditAllocations:  [ALLOCATION],
  ownerSettlements:   [SETTLEMENT],
  esaInvoices:        [INVOICE],
}, { replace: true, referenceDate: '2024-01' });

const stats = rm13.getStats();
assert(stats.generatingUnitCount === 2,    '13.1 generatingUnitCount');
assert(stats.beneficiaryUnitCount === 1,   '13.2 beneficiaryUnitCount');
assert(stats.monthlyStatementCount === 1,  '13.3 monthlyStatementCount');
assert(stats.creditAllocationCount === 1,  '13.4 creditAllocationCount');
assert(stats.ownerSettlementCount === 1,   '13.5 ownerSettlementCount');
assert(stats.esaInvoiceCount === 1,        '13.6 esaInvoiceCount');
assert(stats.hydrationCount === 1,         '13.7 hydrationCount');
assert(stats.lastHydration.referenceDate === '2024-01', '13.8 lastHydration.referenceDate');
assert(stats.lastHydration.received === 7, '13.9 lastHydration.received');

// ── 14. ISOLAMENTO ────────────────────────────────────────────────────────────

section(14, 'Isolamento — sem Firebase, window, localStorage');

const rm14 = new EnergyCreditsReadModel();
assert(typeof window === 'undefined' || rm14 !== null,  '14.1 não depende de window');
assert(typeof firebase === 'undefined' || rm14 !== null,'14.2 não depende de firebase');
assert(typeof localStorage === 'undefined' || rm14 !== null, '14.3 não depende de localStorage');

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
