/**
 * ESA OS — Energy Domain / Credits
 * EnergyCreditsService — Teste manual
 *
 * Cobre:
 *   - Constantes exportadas
 *   - Arredondamento centralizado (roundKwh, roundMoney)
 *   - Criação de entidades (GeneratingUnit, BeneficiaryUnit)
 *   - Validação de referenceMonth
 *   - Fórmulas do Calculator (todos os 14 cálculos)
 *   - Validações de alocação e compensação
 *   - Alertas no MonthlyCreditStatement
 *   - OwnerSettlement e EsaInvoice
 *   - MonthlyCreditStatement consolidado
 *   - Mês closed com e sem force
 *   - Result contract (ok, fail, makeError, makeWarning)
 *   - Isolamento (sem Firebase, window, localStorage)
 *   - Determinismo e tipos
 *   - API pública via ESAApplication
 */

import {
  EnergyCreditsService,
  EnergyCreditsCalculator,
  EnergyCreditsValidator,
  EnergyCreditsResult,
  OPERATIONAL_STATUS,
  SUBSCRIPTION_STATUS,
  PAYMENT_STATUS,
  STATEMENT_STATUS,
  CREDIT_ALLOCATION_STATUS,
  ALERT_CODE,
  ALERT_SEVERITY,
  createAlert,
  roundKwh,
  roundMoney,
} from './index.js';

// ── Runner ────────────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;

function section(label) {
  console.log(`\n${label}`);
}

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    _passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${e.message}`);
    _failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion falhou');
}

function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

function deepEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(msg || `Esperado ${b}, recebido ${a}`);
}

function assertContains(arr, code, msg) {
  assert(Array.isArray(arr) && arr.some(x => x.code === code), msg || `Código "${code}" não encontrado em ${JSON.stringify(arr)}`);
}

// ── Service singleton ─────────────────────────────────────────────────────────

const service = new EnergyCreditsService();
const calc    = new EnergyCreditsCalculator();

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GEN_UNIT_BASE = {
  id: 'gen-001', name: 'Usina Solar Alfa', ownerName: 'João Silva',
  uc: '12345678', utilityCompany: 'Copel',
};

const BEN_UNIT_BASE = {
  id: 'ben-001', generatingUnitId: 'gen-001', name: 'Empresa Beta Ltda',
  uc: '87654321', utilityCompany: 'Copel',
};

const BEN_RECORD_BASE = {
  id: 'rec-001', beneficiaryUnitId: 'ben-001', generatingUnitId: 'gen-001',
  referenceMonth: '2024-01',
  monthlyConsumptionKwh: 1000,
  allocatedKwh: 800,
  compensatedKwh: 750,
  pendingKwh: 50,
  esaKwhPrice: 0.55,
  utilityReferenceTariff: 0.80,
  previousAccumulatedDiscount: 100,
};

// ── [1] CONSTANTES — OPERATIONAL_STATUS ──────────────────────────────────────

section('[1] CONSTANTES — OPERATIONAL_STATUS');

test('contém active', () => eq(OPERATIONAL_STATUS.ACTIVE, 'active'));
test('contém inactive', () => eq(OPERATIONAL_STATUS.INACTIVE, 'inactive'));
test('contém maintenance', () => eq(OPERATIONAL_STATUS.MAINTENANCE, 'maintenance'));
test('contém decommissioned', () => eq(OPERATIONAL_STATUS.DECOMMISSIONED, 'decommissioned'));

// ── [2] CONSTANTES — SUBSCRIPTION_STATUS ─────────────────────────────────────

section('[2] CONSTANTES — SUBSCRIPTION_STATUS');

test('contém active', () => eq(SUBSCRIPTION_STATUS.ACTIVE, 'active'));
test('contém suspended', () => eq(SUBSCRIPTION_STATUS.SUSPENDED, 'suspended'));
test('contém cancelled', () => eq(SUBSCRIPTION_STATUS.CANCELLED, 'cancelled'));

// ── [3] CONSTANTES — STATEMENT_STATUS ────────────────────────────────────────

section('[3] CONSTANTES — STATEMENT_STATUS');

test('contém open', () => eq(STATEMENT_STATUS.OPEN, 'open'));
test('contém closed', () => eq(STATEMENT_STATUS.CLOSED, 'closed'));
test('contém review', () => eq(STATEMENT_STATUS.REVIEW, 'review'));
test('contém paid', () => eq(STATEMENT_STATUS.PAID, 'paid'));
test('contém cancelled', () => eq(STATEMENT_STATUS.CANCELLED, 'cancelled'));

// ── [4] CONSTANTES — ALERT_CODE ──────────────────────────────────────────────

section('[4] CONSTANTES — ALERT_CODE');

test('tem 13 códigos', () => eq(Object.keys(ALERT_CODE).length, 13));
test('INSUFFICIENT_BALANCE definido', () => eq(ALERT_CODE.INSUFFICIENT_BALANCE, 'INSUFFICIENT_BALANCE'));
test('MISSING_PRICE definido', () => eq(ALERT_CODE.MISSING_PRICE, 'MISSING_PRICE'));
test('ALERT_SEVERITY tem 4 níveis', () => eq(Object.keys(ALERT_SEVERITY).length, 4));

// ── [5] ARREDONDAMENTO — roundKwh (#25) ──────────────────────────────────────

section('[5] ARREDONDAMENTO — roundKwh');

test('arredonda 1.23456 para 3 casas → 1.235', () => eq(roundKwh(1.23456), 1.235));
test('preserva inteiros como 100.000', () => eq(roundKwh(100), 100));
test('arredonda 0.0005 para 0.001', () => eq(roundKwh(0.0005), 0.001));
test('lança TypeError para string', () => {
  let threw = false;
  try { roundKwh('abc'); } catch (e) { threw = e instanceof TypeError; }
  assert(threw, 'roundKwh deveria lançar TypeError para string');
});

// ── [6] ARREDONDAMENTO — roundMoney (#26) ────────────────────────────────────

section('[6] ARREDONDAMENTO — roundMoney');

test('arredonda 1.235 para 2 casas → 1.24', () => eq(roundMoney(1.235), 1.24));
test('preserva 100.00', () => eq(roundMoney(100), 100));
test('arredonda 0.005 para 0.01', () => eq(roundMoney(0.005), 0.01));
test('lança TypeError para NaN', () => {
  let threw = false;
  try { roundMoney(NaN); } catch (e) { threw = e instanceof TypeError; }
  assert(threw, 'roundMoney deveria lançar TypeError para NaN');
});

// ── [7] GENERATING UNIT — criação válida (#1) ─────────────────────────────────

section('[7] GENERATING UNIT — criação válida');

test('cria Unidade Geradora válida — result.ok=true', () => {
  const r = service.createGeneratingUnit(GEN_UNIT_BASE);
  assert(r.ok === true, 'ok deve ser true');
});

test('data contém id e name', () => {
  const r = service.createGeneratingUnit(GEN_UNIT_BASE);
  eq(r.data.id, 'gen-001');
  eq(r.data.name, 'Usina Solar Alfa');
});

test('operationalStatus padrão é active', () => {
  const r = service.createGeneratingUnit(GEN_UNIT_BASE);
  eq(r.data.operationalStatus, 'active');
});

test('errors está vazio', () => {
  const r = service.createGeneratingUnit(GEN_UNIT_BASE);
  assert(r.errors.length === 0, 'errors deve estar vazio');
});

// ── [8] GENERATING UNIT — rejeição sem id (#2) ───────────────────────────────

section('[8] GENERATING UNIT — rejeição sem id');

test('rejeita sem id — ok=false', () => {
  const r = service.createGeneratingUnit({ ...GEN_UNIT_BASE, id: undefined });
  assert(r.ok === false, 'ok deve ser false');
});

test('errors contém campo id', () => {
  const r = service.createGeneratingUnit({ ...GEN_UNIT_BASE, id: undefined });
  assert(r.errors.some(e => e.field === 'id'), 'error deve referenciar campo id');
});

// ── [9] GENERATING UNIT — status operacional inválido (#3) ───────────────────

section('[9] GENERATING UNIT — status operacional inválido');

test('rejeita operationalStatus desconhecido', () => {
  const r = service.createGeneratingUnit({ ...GEN_UNIT_BASE, operationalStatus: 'flying' });
  assert(r.ok === false, 'ok deve ser false');
});

test('errors referencia operationalStatus', () => {
  const r = service.createGeneratingUnit({ ...GEN_UNIT_BASE, operationalStatus: 'flying' });
  assert(r.errors.some(e => e.field === 'operationalStatus'), 'error deve referenciar operationalStatus');
});

test('aceita operationalStatus maintenance válido', () => {
  const r = service.createGeneratingUnit({ ...GEN_UNIT_BASE, operationalStatus: 'maintenance' });
  assert(r.ok === true, 'maintenance é status válido');
});

// ── [10] BENEFICIARY UNIT — criação válida (#4) ───────────────────────────────

section('[10] BENEFICIARY UNIT — criação válida');

test('cria Unidade Beneficiária válida — ok=true', () => {
  const r = service.createBeneficiaryUnit(BEN_UNIT_BASE);
  assert(r.ok === true, 'ok deve ser true');
});

test('data contém generatingUnitId', () => {
  const r = service.createBeneficiaryUnit(BEN_UNIT_BASE);
  eq(r.data.generatingUnitId, 'gen-001');
});

test('subscriptionStatus padrão é active', () => {
  const r = service.createBeneficiaryUnit(BEN_UNIT_BASE);
  eq(r.data.subscriptionStatus, 'active');
});

// ── [11] BENEFICIARY UNIT — sem generatingUnitId (#5) ────────────────────────

section('[11] BENEFICIARY UNIT — sem generatingUnitId');

test('rejeita sem generatingUnitId — ok=false', () => {
  const r = service.createBeneficiaryUnit({ ...BEN_UNIT_BASE, generatingUnitId: undefined });
  assert(r.ok === false, 'ok deve ser false');
});

test('errors referencia generatingUnitId', () => {
  const r = service.createBeneficiaryUnit({ ...BEN_UNIT_BASE, generatingUnitId: undefined });
  assert(r.errors.some(e => e.field === 'generatingUnitId'), 'error deve referenciar generatingUnitId');
});

// ── [12] BENEFICIARY UNIT — subscriptionStatus inválido (#6) ─────────────────

section('[12] BENEFICIARY UNIT — subscriptionStatus inválido');

test('rejeita subscriptionStatus desconhecido', () => {
  const r = service.createBeneficiaryUnit({ ...BEN_UNIT_BASE, subscriptionStatus: 'invalid' });
  assert(r.ok === false, 'ok deve ser false');
});

test('errors referencia subscriptionStatus', () => {
  const r = service.createBeneficiaryUnit({ ...BEN_UNIT_BASE, subscriptionStatus: 'invalid' });
  assert(r.errors.some(e => e.field === 'subscriptionStatus'), 'error deve referenciar subscriptionStatus');
});

// ── [13] REFERENCE MONTH — válido (#7) ────────────────────────────────────────

section('[13] REFERENCE MONTH — válido');

test('aceita 2024-01', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({ ...BEN_RECORD_BASE, referenceMonth: '2024-01' });
  assert(r.ok === true, '2024-01 é válido');
});

test('aceita 2024-12', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({ ...BEN_RECORD_BASE, referenceMonth: '2024-12' });
  assert(r.ok === true, '2024-12 é válido');
});

// ── [14] REFERENCE MONTH — inválido (#8) ─────────────────────────────────────

section('[14] REFERENCE MONTH — inválido');

test('rejeita formato 01-2024', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({ ...BEN_RECORD_BASE, referenceMonth: '01-2024' });
  assert(r.ok === false, 'formato 01-2024 inválido');
});

test('rejeita mês 13', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({ ...BEN_RECORD_BASE, referenceMonth: '2024-13' });
  assert(r.ok === false, 'mês 13 é inválido');
});

test('rejeita referenceMonth ausente', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({ ...BEN_RECORD_BASE, referenceMonth: undefined });
  assert(r.ok === false, 'referenceMonth ausente é inválido');
});

// ── [15] FÓRMULA 1 — saldo disponível (#9) ────────────────────────────────────

section('[15] FÓRMULA 1 — saldo disponível');

test('availableKwh = previousBalance + monthlyGeneration', () => {
  eq(calc.availableKwhBeforeAllocation(500, 10000), 10500);
});

test('com saldo anterior zero: available = geração', () => {
  eq(calc.availableKwhBeforeAllocation(0, 8000), 8000);
});

// ── [16] FÓRMULA 2 — totalAllocatedKwh (#10) ─────────────────────────────────

section('[16] FÓRMULA 2 — totalAllocatedKwh');

test('soma allocatedKwh de 2 registros', () => {
  eq(calc.totalAllocatedKwh([{ allocatedKwh: 300 }, { allocatedKwh: 500 }]), 800);
});

test('array vazio retorna 0', () => {
  eq(calc.totalAllocatedKwh([]), 0);
});

// ── [17] FÓRMULA 3 — totalCompensatedKwh (#11) ───────────────────────────────

section('[17] FÓRMULA 3 — totalCompensatedKwh');

test('soma compensatedKwh de 2 registros', () => {
  eq(calc.totalCompensatedKwh([{ compensatedKwh: 200 }, { compensatedKwh: 400 }]), 600);
});

// ── [18] FÓRMULA 4 — totalPendingKwh (#12) ───────────────────────────────────

section('[18] FÓRMULA 4 — totalPendingKwh');

test('soma pendingKwh de 2 registros', () => {
  eq(calc.totalPendingKwh([{ pendingKwh: 50 }, { pendingKwh: 100 }]), 150);
});

// ── [19] FÓRMULA 5 — saldo acumulado atual (#13) ─────────────────────────────

section('[19] FÓRMULA 5 — saldo acumulado atual');

test('currentBalance = previous + generation - allocated', () => {
  eq(calc.currentAccumulatedBalance(500, 10000, 800), 9700);
});

test('saldo pode ser calculado quando allocated = 0', () => {
  eq(calc.currentAccumulatedBalance(0, 5000, 0), 5000);
});

// ── [20] FÓRMULA 6 — residualKwh (#14, #15) ──────────────────────────────────

section('[20] FÓRMULA 6 — residualKwh');

test('residualKwh = consumption - compensated', () => {
  eq(calc.residualKwh(1000, 750), 250);
});

test('residualKwh nunca negativo — compensated > consumption → 0 (#15)', () => {
  eq(calc.residualKwh(500, 600), 0);
});

// ── [21] FÓRMULA 7 — billWithoutEsa (#16) ────────────────────────────────────

section('[21] FÓRMULA 7 — billWithoutEsa');

test('billWithoutEsa = consumption × tariff', () => {
  eq(calc.billWithoutEsa(1000, 0.80), 800);
});

test('resultado é arredondado com 2 casas', () => {
  eq(calc.billWithoutEsa(1000, 0.801), 801);
});

// ── [22] FÓRMULA 8 — esaInvoiceAmount (#17) ──────────────────────────────────

section('[22] FÓRMULA 8 — esaInvoiceAmount');

test('esaInvoice = compensated × esaPrice', () => {
  eq(calc.esaInvoiceAmount(750, 0.55), 412.50);
});

// ── [23] FÓRMULA 9 — billWithEsa (#18) ───────────────────────────────────────

section('[23] FÓRMULA 9 — billWithEsa');

test('billWithEsa = esaInvoice + residualUtility', () => {
  eq(calc.billWithEsa(200, 50), 250);
});

// ── [24] FÓRMULA 10 — desconto mensal (#19) ───────────────────────────────────

section('[24] FÓRMULA 10 — desconto mensal');

test('monthlyDiscount = billWithoutEsa - billWithEsa', () => {
  eq(calc.monthlyDiscount(800, 600), 200);
});

// ── [25] FÓRMULA 11 — desconto acumulado (#20) ────────────────────────────────

section('[25] FÓRMULA 11 — desconto acumulado');

test('accumulatedDiscountTotal = previous + monthly', () => {
  eq(calc.accumulatedDiscountTotal(100, 200), 300);
});

// ── [26] ALERTA NEGATIVE_SAVINGS (#21) ────────────────────────────────────────

section('[26] ALERTA NEGATIVE_SAVINGS');

test('desconto negativo gera warning NEGATIVE_SAVINGS na beneficiária', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({
    ...BEN_RECORD_BASE,
    monthlyConsumptionKwh: 1000,
    allocatedKwh: 1000,
    compensatedKwh: 1000,
    pendingKwh: 0,
    esaKwhPrice: 0.90,
    utilityReferenceTariff: 0.50,
  });
  assert(r.ok === true, 'cálculo deve ser ok');
  assertContains(r.warnings, ALERT_CODE.NEGATIVE_SAVINGS, 'NEGATIVE_SAVINGS deve estar em warnings');
});

test('warning NEGATIVE_SAVINGS tem estrutura padronizada', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({
    ...BEN_RECORD_BASE,
    monthlyConsumptionKwh: 500,
    allocatedKwh: 500,
    compensatedKwh: 500,
    pendingKwh: 0,
    esaKwhPrice: 1.00,
    utilityReferenceTariff: 0.40,
  });
  const w = r.warnings.find(x => x.code === ALERT_CODE.NEGATIVE_SAVINGS);
  assert(w && w.message && w.field, 'warning deve ter code, message e field');
});

// ── [27] FÓRMULA 12 — retorno proprietário (#22) ─────────────────────────────

section('[27] FÓRMULA 12 — retorno proprietário');

test('monthlyOwnerReturn = compensated × purchasePrice', () => {
  eq(calc.monthlyOwnerReturn(750, 0.30), 225);
});

// ── [28] FÓRMULA 13 — receita ESA (#23) ──────────────────────────────────────

section('[28] FÓRMULA 13 — receita ESA');

test('totalEsaRevenue soma esaInvoiceAmount dos registros', () => {
  eq(calc.totalEsaRevenue([{ esaInvoiceAmount: 200 }, { esaInvoiceAmount: 300 }]), 500);
});

// ── [29] FÓRMULA 14 — spread bruto (#24) ─────────────────────────────────────

section('[29] FÓRMULA 14 — spread bruto');

test('grossSpread = esaRevenue - ownerReturn', () => {
  eq(calc.grossSpread(500, 225), 275);
});

test('grossSpread pode ser negativo', () => {
  assert(calc.grossSpread(100, 300) < 0, 'spread pode ser negativo');
});

// ── [30] VALIDAÇÃO — allocatedKwh > consumption bloqueado (#27) ───────────────

section('[30] VALIDAÇÃO — allocatedKwh > consumption');

test('bloqueia allocatedKwh > monthlyConsumptionKwh', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({
    ...BEN_RECORD_BASE,
    monthlyConsumptionKwh: 500,
    allocatedKwh: 600,
    compensatedKwh: 500,
    pendingKwh: 0,
  });
  assert(r.ok === false, 'ok deve ser false');
  assert(r.errors.some(e => e.code === 'ALLOCATION_EXCEEDS_CONSUMPTION'), 'erro ALLOCATION_EXCEEDS_CONSUMPTION esperado');
});

// ── [31] VALIDAÇÃO — compensatedKwh > allocatedKwh bloqueado (#28) ────────────

section('[31] VALIDAÇÃO — compensatedKwh > allocatedKwh');

test('bloqueia compensatedKwh > allocatedKwh', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({
    ...BEN_RECORD_BASE,
    monthlyConsumptionKwh: 1000,
    allocatedKwh: 600,
    compensatedKwh: 700,
    pendingKwh: 0,
  });
  assert(r.ok === false, 'ok deve ser false');
  assert(r.errors.some(e => e.code === 'COMPENSATION_EXCEEDS_ALLOCATION'), 'erro COMPENSATION_EXCEEDS_ALLOCATION esperado');
});

// ── [32] VALIDAÇÃO — totalAllocated > saldo bloqueado por padrão (#29) ────────

section('[32] VALIDAÇÃO — totalAllocated > saldo por padrão');

const OVER_STMT_INPUT = {
  generatingUnitId: 'gen-001',
  referenceMonth: '2024-01',
  previousAccumulatedKwhBalance: 0,
  monthlyGenerationKwh: 1000,
  purchaseKwhPrice: 0.30,
  beneficiaryRecords: [
    { beneficiaryUnitId: 'ben-001', allocatedKwh: 1100, compensatedKwh: 1000, pendingKwh: 100, residualKwh: 0, esaInvoiceAmount: 550, monthlyDiscount: 250, monthlyConsumptionKwh: 1100, esaKwhPrice: 0.55, utilityReferenceTariff: 0.80 },
  ],
};

test('bloqueia totalAllocated > saldo disponível por padrão', () => {
  const r = service.calculateMonthlyStatement(OVER_STMT_INPUT);
  assert(r.ok === false, 'deve ser false sem allowOverAllocation');
  assert(r.errors.some(e => e.code === 'OVER_ALLOCATION_BLOCKED'), 'erro OVER_ALLOCATION_BLOCKED esperado');
});

// ── [33] allowOverAllocation=true (#30) ────────────────────────────────────────

section('[33] allowOverAllocation=true permite e gera alerta');

test('allowOverAllocation=true retorna ok=true', () => {
  const r = service.calculateMonthlyStatement(OVER_STMT_INPUT, { allowOverAllocation: true });
  assert(r.ok === true, 'deve ser ok=true com allowOverAllocation');
});

test('allowOverAllocation=true gera alerta INSUFFICIENT_BALANCE (#30, #31)', () => {
  const r = service.calculateMonthlyStatement(OVER_STMT_INPUT, { allowOverAllocation: true });
  assertContains(r.data.alerts, ALERT_CODE.INSUFFICIENT_BALANCE, 'INSUFFICIENT_BALANCE esperado nos alerts');
});

test('alerta INSUFFICIENT_BALANCE tem metadata com totalAllocated e available', () => {
  const r = service.calculateMonthlyStatement(OVER_STMT_INPUT, { allowOverAllocation: true });
  const a = r.data.alerts.find(x => x.code === ALERT_CODE.INSUFFICIENT_BALANCE);
  assert(a && a.metadata.totalAllocated !== undefined, 'metadata.totalAllocated deve existir');
  assert(a && a.metadata.available !== undefined, 'metadata.available deve existir');
});

// ── [34] ALERTAS — PENDING_COMPENSATION (#32) ────────────────────────────────

section('[34] ALERTA PENDING_COMPENSATION');

const PENDING_REC = {
  beneficiaryUnitId: 'ben-001', allocatedKwh: 500, compensatedKwh: 400,
  pendingKwh: 100, residualKwh: 50, esaInvoiceAmount: 220,
  monthlyDiscount: 100, monthlyConsumptionKwh: 450,
  esaKwhPrice: 0.55, utilityReferenceTariff: 0.80,
};

test('PENDING_COMPENSATION gerado quando pendingKwh > 0', () => {
  const r = service.calculateMonthlyStatement({
    generatingUnitId: 'gen-001', referenceMonth: '2024-01',
    previousAccumulatedKwhBalance: 0, monthlyGenerationKwh: 5000,
    purchaseKwhPrice: 0.30, beneficiaryRecords: [PENDING_REC],
  });
  assert(r.ok === true, 'statement ok');
  assertContains(r.data.alerts, ALERT_CODE.PENDING_COMPENSATION, 'PENDING_COMPENSATION esperado');
});

// ── [35] ALERTAS — ZERO_GENERATION (#33) ─────────────────────────────────────

section('[35] ALERTA ZERO_GENERATION');

test('ZERO_GENERATION gerado quando generation = 0', () => {
  const r = service.calculateMonthlyStatement({
    generatingUnitId: 'gen-001', referenceMonth: '2024-01',
    previousAccumulatedKwhBalance: 1000, monthlyGenerationKwh: 0,
    purchaseKwhPrice: 0.30, beneficiaryRecords: [],
  });
  assert(r.ok === true, 'statement ok');
  assertContains(r.data.alerts, ALERT_CODE.ZERO_GENERATION, 'ZERO_GENERATION esperado');
});

// ── [36] ALERTAS — ZERO_CONSUMPTION (#34) ────────────────────────────────────

section('[36] ALERTA ZERO_CONSUMPTION');

test('ZERO_CONSUMPTION gerado quando beneficiária tem consumo zero', () => {
  const zeroRec = {
    beneficiaryUnitId: 'ben-001', allocatedKwh: 0, compensatedKwh: 0,
    pendingKwh: 0, residualKwh: 0, esaInvoiceAmount: 0,
    monthlyDiscount: 0, monthlyConsumptionKwh: 0,
    esaKwhPrice: 0.55, utilityReferenceTariff: 0.80,
  };
  const r = service.calculateMonthlyStatement({
    generatingUnitId: 'gen-001', referenceMonth: '2024-01',
    previousAccumulatedKwhBalance: 0, monthlyGenerationKwh: 5000,
    purchaseKwhPrice: 0.30, beneficiaryRecords: [zeroRec],
  });
  assertContains(r.data.alerts, ALERT_CODE.ZERO_CONSUMPTION, 'ZERO_CONSUMPTION esperado');
});

// ── [37] ALERTAS — MISSING_PRICE (#35) ───────────────────────────────────────

section('[37] ALERTA MISSING_PRICE');

test('MISSING_PRICE gerado quando purchaseKwhPrice ausente no statement', () => {
  const r = service.calculateMonthlyStatement({
    generatingUnitId: 'gen-001', referenceMonth: '2024-01',
    previousAccumulatedKwhBalance: 0, monthlyGenerationKwh: 5000,
    beneficiaryRecords: [],
  });
  assert(r.ok === true, 'statement ok');
  assertContains(r.data.alerts, ALERT_CODE.MISSING_PRICE, 'MISSING_PRICE esperado');
});

test('MISSING_PRICE gerado quando beneficiária tem esaKwhPrice null', () => {
  const rec = { ...PENDING_REC, esaKwhPrice: null };
  const r = service.calculateMonthlyStatement({
    generatingUnitId: 'gen-001', referenceMonth: '2024-01',
    previousAccumulatedKwhBalance: 0, monthlyGenerationKwh: 5000,
    purchaseKwhPrice: 0.30, beneficiaryRecords: [rec],
  });
  assertContains(r.data.alerts, ALERT_CODE.MISSING_PRICE, 'MISSING_PRICE esperado para beneficiária');
});

// ── [38] ALERTAS — MISSING_TARIFF (#36) ──────────────────────────────────────

section('[38] ALERTA MISSING_TARIFF');

test('MISSING_TARIFF gerado quando utilityReferenceTariff null na beneficiária', () => {
  const rec = { ...PENDING_REC, utilityReferenceTariff: null };
  const r = service.calculateMonthlyStatement({
    generatingUnitId: 'gen-001', referenceMonth: '2024-01',
    previousAccumulatedKwhBalance: 0, monthlyGenerationKwh: 5000,
    purchaseKwhPrice: 0.30, beneficiaryRecords: [rec],
  });
  assertContains(r.data.alerts, ALERT_CODE.MISSING_TARIFF, 'MISSING_TARIFF esperado');
});

// ── [39] ALERTAS — NO_BENEFICIARIES (#37) ────────────────────────────────────

section('[39] ALERTA NO_BENEFICIARIES');

test('NO_BENEFICIARIES gerado quando beneficiaryRecords está vazio', () => {
  const r = service.calculateMonthlyStatement({
    generatingUnitId: 'gen-001', referenceMonth: '2024-01',
    previousAccumulatedKwhBalance: 0, monthlyGenerationKwh: 5000,
    purchaseKwhPrice: 0.30, beneficiaryRecords: [],
  });
  assertContains(r.data.alerts, ALERT_CODE.NO_BENEFICIARIES, 'NO_BENEFICIARIES esperado');
});

test('alerta tem campos code, severity, message, targetType, targetId', () => {
  const r = service.calculateMonthlyStatement({
    generatingUnitId: 'gen-001', referenceMonth: '2024-01',
    previousAccumulatedKwhBalance: 0, monthlyGenerationKwh: 5000,
    purchaseKwhPrice: 0.30, beneficiaryRecords: [],
  });
  const a = r.data.alerts.find(x => x.code === ALERT_CODE.NO_BENEFICIARIES);
  assert(a && a.code && a.severity && a.message && a.targetType && a.targetId,
    'alerta deve ter todos os campos do contrato');
});

// ── [40] OWNER SETTLEMENT (#38) ────────────────────────────────────────────

section('[40] OWNER SETTLEMENT');

test('calcula OwnerSettlement com netReturn correto', () => {
  const r = service.calculateOwnerSettlement({
    generatingUnitId: 'gen-001', ownerName: 'João Silva',
    referenceMonth: '2024-01',
    consumedAllocatedKwh: 750, purchaseKwhPrice: 0.30,
    adjustments: -10,
  });
  assert(r.ok === true, 'ok deve ser true');
  eq(r.data.grossReturn, 225);
  eq(r.data.netReturn, 215);
});

test('OwnerSettlement tem paymentStatus padrão pending', () => {
  const r = service.calculateOwnerSettlement({
    generatingUnitId: 'gen-001', ownerName: 'João', referenceMonth: '2024-01',
    consumedAllocatedKwh: 100, purchaseKwhPrice: 0.30,
  });
  eq(r.data.paymentStatus, 'pending');
});

// ── [41] ESA INVOICE (#39) ─────────────────────────────────────────────────

section('[41] ESA INVOICE');

test('calcula EsaInvoice com invoiceAmount correto', () => {
  const r = service.calculateEsaInvoice({
    beneficiaryUnitId: 'ben-001', referenceMonth: '2024-01',
    compensatedKwh: 750, consumedKwh: 1000, esaKwhPrice: 0.55,
  });
  assert(r.ok === true, 'ok deve ser true');
  eq(r.data.invoiceAmount, 412.50);
});

test('EsaInvoice sem esaKwhPrice gera warning MISSING_PRICE', () => {
  const r = service.calculateEsaInvoice({
    beneficiaryUnitId: 'ben-001', referenceMonth: '2024-01',
    compensatedKwh: 750, consumedKwh: 1000,
  });
  assert(r.ok === true, 'ok mesmo sem preço');
  assertContains(r.warnings, ALERT_CODE.MISSING_PRICE, 'MISSING_PRICE em warnings');
});

// ── [42] MONTHLY STATEMENT — consolidado (#40) ────────────────────────────────

section('[42] MONTHLY STATEMENT — consolidado');

const STMT_REC_1 = {
  beneficiaryUnitId: 'ben-001', allocatedKwh: 500, compensatedKwh: 450,
  pendingKwh: 50, residualKwh: 50, esaInvoiceAmount: 247.50,
  monthlyDiscount: 152.50, monthlyConsumptionKwh: 500,
  esaKwhPrice: 0.55, utilityReferenceTariff: 0.80,
};

const STMT_BASE = {
  generatingUnitId: 'gen-001',
  referenceMonth: '2024-01',
  previousAccumulatedKwhBalance: 500,
  monthlyGenerationKwh: 10000,
  purchaseKwhPrice: 0.30,
  beneficiaryRecords: [STMT_REC_1],
  referenceDate: 1700000000000,
};

test('cria MonthlyCreditStatement consolidado — ok=true', () => {
  const r = service.calculateMonthlyStatement(STMT_BASE);
  assert(r.ok === true, 'ok deve ser true');
});

test('totalGenerationKwh = 10000', () => {
  const r = service.calculateMonthlyStatement(STMT_BASE);
  eq(r.data.totalGenerationKwh, 10000);
});

test('availableKwhBeforeAllocation = 10500', () => {
  const r = service.calculateMonthlyStatement(STMT_BASE);
  eq(r.data.availableKwhBeforeAllocation, 10500);
});

test('currentBalanceKwh = 10500 - 500 = 10000', () => {
  const r = service.calculateMonthlyStatement(STMT_BASE);
  eq(r.data.currentBalanceKwh, 10000);
});

test('totalOwnerReturn = 450 × 0.30 = 135', () => {
  const r = service.calculateMonthlyStatement(STMT_BASE);
  eq(r.data.totalOwnerReturn, 135);
});

test('totalEsaRevenue = 247.50', () => {
  const r = service.calculateMonthlyStatement(STMT_BASE);
  eq(r.data.totalEsaRevenue, 247.50);
});

test('grossSpread = 247.50 - 135 = 112.50', () => {
  const r = service.calculateMonthlyStatement(STMT_BASE);
  eq(r.data.grossSpread, 112.50);
});

test('metadata.source = energy-credits-service', () => {
  const r = service.calculateMonthlyStatement(STMT_BASE);
  eq(r.data.metadata.source, 'energy-credits-service');
});

test('metadata presente no resultado', () => {
  const r = service.calculateMonthlyStatement(STMT_BASE);
  assert(r.data.metadata !== null && typeof r.data.metadata === 'object', 'metadata deve existir');
});

// ── [43] MONTHLY STATEMENT — 2 beneficiárias (#41, #42) ─────────────────────

section('[43] MONTHLY STATEMENT — 2 beneficiárias');

const STMT_REC_2 = {
  beneficiaryUnitId: 'ben-002', allocatedKwh: 300, compensatedKwh: 280,
  pendingKwh: 20, residualKwh: 20, esaInvoiceAmount: 154,
  monthlyDiscount: 86, monthlyConsumptionKwh: 300,
  esaKwhPrice: 0.55, utilityReferenceTariff: 0.80,
};

const STMT_2_RECS = { ...STMT_BASE, beneficiaryRecords: [STMT_REC_1, STMT_REC_2] };

test('statement com 2 beneficiárias — beneficiaryCount = 2', () => {
  const r = service.calculateMonthlyStatement(STMT_2_RECS);
  assert(r.ok === true, 'ok deve ser true');
  eq(r.data.beneficiaryCount, 2);
});

test('totalAllocatedKwh soma ambas: 500 + 300 = 800', () => {
  const r = service.calculateMonthlyStatement(STMT_2_RECS);
  eq(r.data.totalAllocatedKwh, 800);
});

test('totalCompensatedKwh = 450 + 280 = 730', () => {
  const r = service.calculateMonthlyStatement(STMT_2_RECS);
  eq(r.data.totalCompensatedKwh, 730);
});

test('totalEsaRevenue = 247.50 + 154 = 401.50 (#41)', () => {
  const r = service.calculateMonthlyStatement(STMT_2_RECS);
  eq(r.data.totalEsaRevenue, 401.50);
});

test('uma geradora com múltiplas beneficiárias — grossSpread correto (#42)', () => {
  const r = service.calculateMonthlyStatement(STMT_2_RECS);
  eq(r.data.totalOwnerReturn, roundMoney(730 * 0.30));
  const expectedSpread = roundMoney(401.50 - roundMoney(730 * 0.30));
  eq(r.data.grossSpread, expectedSpread);
});

// ── [44] VALIDAÇÃO — valores negativos rejeitados (#43) ────────────────────

section('[44] VALIDAÇÃO — valores negativos');

test('monthlyConsumptionKwh negativo é rejeitado', () => {
  const r = service.calculateBeneficiaryMonthlyRecord({
    ...BEN_RECORD_BASE, monthlyConsumptionKwh: -10, allocatedKwh: 0, compensatedKwh: 0,
  });
  assert(r.ok === false, 'negativo deve ser rejeitado');
});

test('installedPower negativo na geradora é rejeitado', () => {
  const r = service.createGeneratingUnit({ ...GEN_UNIT_BASE, installedPower: -5 });
  assert(r.ok === false, 'installedPower negativo deve ser rejeitado');
});

// ── [45] CLOSED MONTH — sem force (#44) ──────────────────────────────────────

section('[45] CLOSED MONTH — sem force');

test('mês closed não recalcula sem force — ok=false', () => {
  const r = service.calculateMonthlyStatement({ ...STMT_BASE, status: 'closed' });
  assert(r.ok === false, 'deve ser false sem force');
});

test('erro tem código MONTH_CLOSED', () => {
  const r = service.calculateMonthlyStatement({ ...STMT_BASE, status: 'closed' });
  assert(r.errors.some(e => e.code === 'MONTH_CLOSED'), 'código MONTH_CLOSED esperado');
});

// ── [46] CLOSED MONTH — com force (#45) ──────────────────────────────────────

section('[46] CLOSED MONTH — com force');

test('mês closed recalcula com force=true — ok=true', () => {
  const r = service.calculateMonthlyStatement({ ...STMT_BASE, status: 'closed' }, { force: true });
  assert(r.ok === true, 'deve ser true com force=true');
});

// ── [47] RESULT CONTRACT — ok=true (#46) ──────────────────────────────────────

section('[47] RESULT CONTRACT');

test('EnergyCreditsResult.ok retorna estrutura correta', () => {
  const r = EnergyCreditsResult.ok({ value: 42 });
  assert(r.ok === true, 'ok deve ser true');
  assert(Array.isArray(r.errors) && r.errors.length === 0, 'errors deve ser array vazio');
  assert(Array.isArray(r.warnings), 'warnings deve ser array');
  assert(r.data.value === 42, 'data deve ser preservado');
});

test('EnergyCreditsResult.fail retorna estrutura correta (#47)', () => {
  const r = EnergyCreditsResult.fail([{ code: 'X', message: 'y', field: null, metadata: {} }]);
  assert(r.ok === false, 'ok deve ser false');
  assert(r.data === null, 'data deve ser null');
  assert(r.errors.length === 1, 'errors deve ter 1 item');
});

test('makeError retorna objeto padronizado (#48)', () => {
  const e = EnergyCreditsResult.makeError('CODE', 'mensagem', 'campo', { extra: true });
  eq(e.code, 'CODE');
  eq(e.field, 'campo');
  assert(e.metadata.extra === true, 'metadata preservado');
});

test('makeWarning retorna objeto padronizado (#49)', () => {
  const w = EnergyCreditsResult.makeWarning('WARN', 'aviso', null);
  eq(w.code, 'WARN');
  assert(w.field === null, 'field pode ser null');
});

// ── [48] ISOLAMENTO — sem Firebase/window/localStorage (#51-#53) ──────────────

section('[48] ISOLAMENTO');

test('service funciona em Node sem window (#52)', () => {
  assert(typeof window === 'undefined', 'window não existe em Node — serviço não depende dela');
  const r = service.createGeneratingUnit(GEN_UNIT_BASE);
  assert(r.ok === true, 'serviço funciona sem window');
});

test('service funciona em Node sem localStorage (#53)', () => {
  assert(typeof localStorage === 'undefined', 'localStorage não existe em Node');
  const r = service.createBeneficiaryUnit(BEN_UNIT_BASE);
  assert(r.ok === true, 'serviço funciona sem localStorage');
});

test('service não expõe referência a firebase (#51)', () => {
  assert(!('firebase' in service), 'service não deve ter propriedade firebase');
  const r = service.calculateMonthlyStatement(STMT_BASE);
  assert(r.ok === true, 'serviço funciona sem Firebase');
});

// ── [49] DETERMINISMO (#54) ────────────────────────────────────────────────

section('[49] DETERMINISMO');

test('mesmo input → mesmo output para beneficiária', () => {
  const a = service.calculateBeneficiaryMonthlyRecord(BEN_RECORD_BASE);
  const b = service.calculateBeneficiaryMonthlyRecord(BEN_RECORD_BASE);
  deepEq(a, b, 'resultados devem ser idênticos');
});

test('mesmo input → mesmo output para statement', () => {
  const a = service.calculateMonthlyStatement(STMT_BASE);
  const b = service.calculateMonthlyStatement(STMT_BASE);
  deepEq(a, b, 'resultados devem ser idênticos');
});

// ── [50] TIPOS — sem undefined / NaN / [object Object] (#55-#58) ─────────────

section('[50] TIPOS PRESERVADOS');

test('resultado da beneficiária não contém undefined (#55)', () => {
  const r = service.calculateBeneficiaryMonthlyRecord(BEN_RECORD_BASE);
  const json = JSON.stringify(r.data);
  assert(!json.includes('"undefined"'), 'undefined não deve aparecer no JSON');
});

test('resultado da beneficiária não contém NaN (#56)', () => {
  const r = service.calculateBeneficiaryMonthlyRecord(BEN_RECORD_BASE);
  const json = JSON.stringify(r.data);
  assert(!json.includes('NaN'), 'NaN não deve aparecer no JSON');
});

test('resultado da beneficiária não contém [object Object] (#57)', () => {
  const r = service.calculateBeneficiaryMonthlyRecord(BEN_RECORD_BASE);
  const json = JSON.stringify(r.data);
  assert(!json.includes('[object Object]'), '[object Object] não deve aparecer no JSON');
});

test('tipos numéricos preservados no resultado (#58)', () => {
  const r = service.calculateBeneficiaryMonthlyRecord(BEN_RECORD_BASE);
  assert(typeof r.data.billWithoutEsa === 'number', 'billWithoutEsa deve ser number');
  assert(typeof r.data.monthlyDiscount === 'number', 'monthlyDiscount deve ser number');
  assert(typeof r.data.residualKwh === 'number', 'residualKwh deve ser number');
});

test('strings preservadas no resultado', () => {
  const r = service.calculateBeneficiaryMonthlyRecord(BEN_RECORD_BASE);
  assert(typeof r.data.referenceMonth === 'string', 'referenceMonth deve ser string');
  assert(typeof r.data.paymentStatus === 'string', 'paymentStatus deve ser string');
});

// ── [51] ESAAPPLICATION — getEnergyCreditsService (#59) ───────────────────────

section('[51] ESAAPPLICATION — getEnergyCreditsService');

test('EnergyCreditsService pode ser instanciado (#59)', () => {
  const svc = new EnergyCreditsService();
  assert(typeof svc.createGeneratingUnit === 'function', 'método createGeneratingUnit deve existir');
  assert(typeof svc.calculateMonthlyStatement === 'function', 'método calculateMonthlyStatement deve existir');
});

test('instância retorna resultados corretos (#60)', () => {
  const svc = new EnergyCreditsService();
  const r = svc.createGeneratingUnit(GEN_UNIT_BASE);
  assert(r.ok === true, 'instância deve funcionar corretamente');
});

// ── RELATÓRIO FINAL ────────────────────────────────────────────────────────────

const total = _passed + _failed;
console.log('\n============================================================');
console.log(`EnergyCreditsService — ${_passed}/${total} cenários`);
console.log(`  Passou: ${_passed}   Falhou: ${_failed}`);
console.log('');
if (_failed === 0) {
  console.log('Todos os cenários passaram.');
} else {
  console.log(`${_failed} cenário(s) falharam.`);
  process.exit(1);
}
