// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 3B — UG/UB connection tests
// Rodar: npx tsx tests/units-gate3b.manual-test.ts
// ============================================================

import { demoRuntimeProvider } from '../providers/demoRuntimeProvider';
import { createEsaRuntimeProvider } from '../providers/esaRuntimeProvider';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

async function assertNoThrow(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${label} — threw: ${(err as Error).message}`);
    failed++;
  }
}

function makeProvider(overrides: Partial<Record<string, (...args: unknown[]) => unknown>> = {}): Parameters<typeof createEsaRuntimeProvider>[0] {
  return {
    searchGeneratingUnits: () => ({ ok: true, data: [] }),
    searchBeneficiaryUnits: () => ({ ok: true, data: [] }),
    getExecutiveSummary: () => null,
    getFinancialSummary: () => null,
    getAlertsSummary: () => null,
    getCsvTemplate: () => null,
    createGeneratingUnit: () => ({ ok: true, data: { id: 'UG-NEW-001', name: 'Nova UG' } }),
    updateGeneratingUnit: () => ({ ok: true, data: { ok: true } }),
    createBeneficiaryUnit: () => ({ ok: true, data: { id: 'UB-NEW-001', name: 'Nova UB' } }),
    updateBeneficiaryUnit: () => ({ ok: true, data: { ok: true } }),
    getSettlementRecipient: () => null,
    getBeneficiaryConsumptionAverage: () => null,
    getBeneficiaryHistory: () => null,
    getBeneficiaryMonthlyReport: () => null,
    getOwnerMonthlyReport: () => null,
    getAllocationPlan: () => null,
    confirmInvoicePayment: () => ({ ok: true, data: { ok: true } }),
    reopenInvoicePayment: () => ({ ok: true, data: { ok: true } }),
    confirmOwnerSettlementPayment: () => ({ ok: true, data: { ok: true } }),
    createUtilityBillImport: () => null,
    confirmUtilityBillExtraction: () => ({ ok: true, data: { ok: true } }),
    matchUtilityBillToBeneficiary: () => null,
    linkUtilityBillToBeneficiary: () => ({ ok: true, data: { ok: true } }),
    ...overrides,
  } as Parameters<typeof createEsaRuntimeProvider>[0];
}

function makeUgList() {
  return {
    ok: true,
    data: [
      { id: 'UG-REAL-001', name: 'UG Real Solar', owner: 'Proprietário Real', document: '123.000.000-00', uc: '900000001', distributor: 'Copel', status: 'ativa', purchasePrice: 0.37, previousBalance: 3000, monthlyGeneration: 15000 },
      { id: 'UG-REAL-002', name: 'UG Real Norte', owner: 'Empresa Real Ltda', document: '11.222.333/0001-00', uc: '900000002', distributor: 'Copel', status: 'ativa', purchasePrice: 0.36, previousBalance: 1200, monthlyGeneration: 8000 },
    ],
  };
}

function makeUbList() {
  return {
    ok: true,
    data: [
      { id: 'UB-REAL-001', name: 'Beneficiária Real A', uc: '800000001', distributor: 'Copel', ugId: 'UG-REAL-001', monthlyConsumption: 4200, document: '000.111.222-33', status: 'ativa', paymentStatus: 'aberto', preventiveMargin: 0.05, esaPrice: 0.55, previousCreditBalance: 400, allocationPct: 0.4, accumulatedSavings: 1200 },
      { id: 'UB-REAL-002', name: 'Beneficiária Real B', uc: '800000002', distributor: 'Copel', ugId: 'UG-REAL-001', monthlyConsumption: 3100, document: '000.222.333-44', status: 'ativa', paymentStatus: 'pago', preventiveMargin: 0.05, esaPrice: 0.55, previousCreditBalance: 200, allocationPct: 0.3, accumulatedSavings: 800 },
    ],
  };
}

// ============================================================
// SUITE O — Demo provider: UG/UB integridade
// ============================================================

console.log('\n[O] Demo provider: integridade das listas UG/UB');

const demoUgs = await demoRuntimeProvider.listGeneratingUnits();
assert('demo listGeneratingUnits retorna 3 UGs', demoUgs.length === 3);
assert('demo UG-001 existe', demoUgs.some((u) => u.id === 'UG-001'));
assert('demo UG tem name, purchasePrice, monthlyGeneration', demoUgs.every((u) => u.name && u.purchasePrice > 0 && u.monthlyGeneration > 0));

const demoUbs = await demoRuntimeProvider.listBeneficiaryUnits();
assert('demo listBeneficiaryUnits retorna 7 UBs', demoUbs.length === 7);
assert('demo UB-001 existe', demoUbs.some((u) => u.id === 'UB-001'));
assert('demo UB tem ugId, monthlyConsumption', demoUbs.every((u) => u.ugId && u.monthlyConsumption > 0));

const demoUbsOfUg1 = await demoRuntimeProvider.listBeneficiaryUnits({ ugId: 'UG-001' });
assert('demo filtro ugId=UG-001 retorna só UBs dessa UG', demoUbsOfUg1.every((u) => u.ugId === 'UG-001'));
assert('demo filtro ugId=UG-001 retorna 4 UBs', demoUbsOfUg1.length === 4);

const demoUg1 = await demoRuntimeProvider.getGeneratingUnit('UG-001');
assert('demo getGeneratingUnit(UG-001) retorna objeto', demoUg1 !== null && demoUg1 !== undefined);
assert('demo getGeneratingUnit(UG-001).name correto', (demoUg1 as any)?.name === 'UG Solar Assaí');

const demoBenAvg = await demoRuntimeProvider.getBeneficiaryConsumptionAverage('UB-001');
assert('demo getBeneficiaryConsumptionAverage retorna dados', demoBenAvg !== null);
assert('demo hasSufficientHistory é boolean', typeof (demoBenAvg as any)?.hasSufficientHistory === 'boolean');

const demoHist = await demoRuntimeProvider.getBeneficiaryMonthlyHistory('UB-001');
assert('demo getBeneficiaryMonthlyHistory retorna array', Array.isArray(demoHist));
assert('demo histórico tem meses', (demoHist as any[]).length > 0);

const demoInvoice = await demoRuntimeProvider.getBeneficiaryInvoice('UB-001', '2026-07');
assert('demo getBeneficiaryInvoice retorna objeto', demoInvoice !== null);
assert('demo invoice tem finalBalance', typeof (demoInvoice as any)?.finalBalance === 'number');

// ============================================================
// SUITE P — Real provider: listas vazias (sem dados)
// ============================================================

console.log('\n[P] Real provider: listas vazias quando provider sem dados');

const realEmpty = createEsaRuntimeProvider(makeProvider());

await assertNoThrow('listGeneratingUnits não lança com provider vazio', async () => {
  const ugs = await realEmpty.listGeneratingUnits();
  assert('  ugs é array vazio', Array.isArray(ugs) && ugs.length === 0);
});

await assertNoThrow('listBeneficiaryUnits não lança com provider vazio', async () => {
  const ubs = await realEmpty.listBeneficiaryUnits();
  assert('  ubs é array vazio', Array.isArray(ubs) && ubs.length === 0);
});

await assertNoThrow('getGeneratingUnit não lança com provider vazio', async () => {
  const ug = await realEmpty.getGeneratingUnit('UG-X');
  assert('  getGeneratingUnit retorna null', ug === null || ug === undefined);
});

await assertNoThrow('getGeneratingUnitPayee não lança com provider vazio', async () => {
  const payee = await realEmpty.getGeneratingUnitPayee('UG-X');
  assert('  payee é null quando provider vazio', payee === null || payee === undefined);
});

await assertNoThrow('getBeneficiaryUnit não lança com provider vazio', async () => {
  const ub = await realEmpty.getBeneficiaryUnit('UB-X');
  assert('  getBeneficiaryUnit retorna null', ub === null || ub === undefined);
});

await assertNoThrow('getBeneficiaryConsumptionAverage não lança com provider vazio', async () => {
  const avg = await realEmpty.getBeneficiaryConsumptionAverage('UB-X');
  assert('  avg é null quando provider vazio', avg === null || avg === undefined);
});

await assertNoThrow('getBeneficiaryMonthlyHistory não lança com provider vazio', async () => {
  const hist = await realEmpty.getBeneficiaryMonthlyHistory('UB-X');
  assert('  histórico é array vazio quando provider vazio', Array.isArray(hist) && hist.length === 0);
});

await assertNoThrow('getBeneficiaryInvoice não lança com provider vazio', async () => {
  const inv = await realEmpty.getBeneficiaryInvoice('UB-X', '2026-07');
  assert('  invoice é null quando provider vazio', inv === null || inv === undefined);
});

// ============================================================
// SUITE Q — Real provider: dados reais mapeados
// ============================================================

console.log('\n[Q] Real provider: dados reais retornados corretamente');

const realWithData = createEsaRuntimeProvider(makeProvider({
  searchGeneratingUnits: () => makeUgList(),
  searchBeneficiaryUnits: (filter: any) => {
    const all = makeUbList().data;
    if (filter && filter.ugId) {
      return { ok: true, data: all.filter((u: any) => u.ugId === filter.ugId) };
    }
    return makeUbList();
  },
  getSettlementRecipient: () => ({ ok: true, data: { name: 'João Real', document: '000.111.222-33', pixKey: 'joao@real.com', pixType: 'email' } }),
  getBeneficiaryConsumptionAverage: () => ({ ok: true, data: { annualAverage: 50400, monthlyAverage: 4200, hasSufficientHistory: true, months: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'] } }),
  getBeneficiaryHistory: () => ({ ok: true, data: { months: [{ month: '2026-07', consumptionKwh: 4200, origin: 'FATURA IMPORTADA', file: 'fatura-jul.pdf', importedAt: '08/07/2026' }, { month: '2026-06', consumptionKwh: 3900, origin: 'CSV', file: 'ubm-jun.csv', importedAt: '05/06/2026' }] } }),
  getBeneficiaryMonthlyReport: () => ({ ok: true, data: { consumption: 4200, compensated: 4000, previousBalance: 400, receivedCredits: 4100, finalBalance: 500, faturaEsa: 2200, taxes: 420, cip: 52, otherCharges: 0, totalWithEsa: 3000, totalWithoutEsa: 3600, monthlySavings: 600, discountPct: 16.7, paymentStatus: 'aberto' } }),
}));

const realUgs = await realWithData.listGeneratingUnits();
assert('real listGeneratingUnits retorna 2 UGs', realUgs.length === 2);
assert('real UG tem id UG-REAL-001', realUgs.some((u) => u.id === 'UG-REAL-001'));
assert('real UG não contém UG-001 demo', !realUgs.some((u) => u.id === 'UG-001'));
assert('real UG tem purchasePrice mapeado', realUgs.some((u) => u.purchasePrice === 0.37));

const realUbs = await realWithData.listBeneficiaryUnits();
assert('real listBeneficiaryUnits retorna 2 UBs', realUbs.length === 2);
assert('real UB tem id UB-REAL-001', realUbs.some((u) => u.id === 'UB-REAL-001'));
assert('real UB não contém UB-001 demo', !realUbs.some((u) => u.id === 'UB-001'));

const realUbsFiltered = await realWithData.listBeneficiaryUnits({ ugId: 'UG-REAL-001' });
assert('real filtro ugId funciona', realUbsFiltered.every((u) => u.ugId === 'UG-REAL-001'));

const realPayee = await realWithData.getGeneratingUnitPayee('UG-REAL-001');
assert('real getGeneratingUnitPayee retorna payee', realPayee !== null);
assert('real payee.name mapeado', (realPayee as any)?.name === 'João Real');
assert('real payee.pixType mapeado', (realPayee as any)?.pixType === 'email');

const realAvg = await realWithData.getBeneficiaryConsumptionAverage('UB-REAL-001');
assert('real getBeneficiaryConsumptionAverage retorna dados', realAvg !== null);
assert('real hasSufficientHistory = true', (realAvg as any)?.hasSufficientHistory === true);
assert('real monthlyAverage = 4200', (realAvg as any)?.monthlyAverage === 4200);

const realHist = await realWithData.getBeneficiaryMonthlyHistory('UB-REAL-001');
assert('real histórico retorna array', Array.isArray(realHist));
assert('real histórico tem 2 meses', (realHist as any[]).length === 2);
assert('real histórico[0].consumptionKwh = 4200', (realHist as any[])[0]?.consumptionKwh === 4200);
assert('real histórico[0].origin = FATURA IMPORTADA', (realHist as any[])[0]?.origin === 'FATURA IMPORTADA');

const realInvoice = await realWithData.getBeneficiaryInvoice('UB-REAL-001', '2026-07');
assert('real invoice retorna objeto', realInvoice !== null);
assert('real invoice.consumption = 4200', (realInvoice as any)?.consumption === 4200);
assert('real invoice.monthlySavings = 600', (realInvoice as any)?.monthlySavings === 600);

// ============================================================
// SUITE R — Real provider: criação e atualização
// ============================================================

console.log('\n[R] Real provider: criar e atualizar UG/UB');

await assertNoThrow('createGeneratingUnit não lança', async () => {
  const result = await realEmpty.createGeneratingUnit({ name: 'Nova UG', owner: 'Dono', ownerDocument: '111', utilityCode: '999', distributor: 'Copel', purchasePrice: 0.35, status: 'ativa', payee: { name: 'Dono', document: '111', pixType: 'cpf', pixKey: '111' } } as any);
  assert('  createGeneratingUnit retorna resultado', result !== null);
});

await assertNoThrow('updateGeneratingUnit não lança', async () => {
  await realEmpty.updateGeneratingUnit('UG-X', { name: 'UG Editada' } as any);
});

await assertNoThrow('createBeneficiaryUnit não lança', async () => {
  const result = await realEmpty.createBeneficiaryUnit({ name: 'Nova UB', ugId: 'UG-X', utilityCode: '888', distributor: 'Copel', preventiveMargin: 0.05, esaPrice: 0.55, status: 'ativa', initialBalance: 0 } as any);
  assert('  createBeneficiaryUnit retorna resultado', result !== null);
});

await assertNoThrow('updateBeneficiaryUnit não lança', async () => {
  await realEmpty.updateBeneficiaryUnit('UB-X', { name: 'UB Editada' } as any);
});

// ============================================================
// SUITE S — Real provider: ausência de dados demo em modo real
// ============================================================

console.log('\n[S] Real provider: ausência de dados demo');

const providerSrc = await import('../providers/esaRuntimeProvider').then((m) => m.createEsaRuntimeProvider.toString());
assert('real provider não contém UG-001 hardcoded', !providerSrc.includes("'UG-001'"));
assert('real provider não contém UB-001 hardcoded', !providerSrc.includes("'UB-001'"));
assert('real provider não contém this.UGS', !providerSrc.includes('this.UGS'));
assert('real provider não contém this.UBS', !providerSrc.includes('this.UBS'));
assert('real provider não contém MONTH_FACTOR', !providerSrc.includes('MONTH_FACTOR'));
assert('real provider não contém buildInvoice', !providerSrc.includes('buildInvoice'));
assert('real provider não contém computeSettlement', !providerSrc.includes('computeSettlement'));

// ============================================================
// SUITE T — Real provider: erro do provider não propaga
// ============================================================

console.log('\n[T] Real provider: erros de UG/UB tratados com segurança');

const throwingProvider = createEsaRuntimeProvider(makeProvider({
  searchGeneratingUnits: () => { throw new Error('simulated UG error'); },
  searchBeneficiaryUnits: () => { throw new Error('simulated UB error'); },
  getBeneficiaryConsumptionAverage: () => { throw new Error('simulated avg error'); },
  getBeneficiaryHistory: () => { throw new Error('simulated hist error'); },
  getBeneficiaryMonthlyReport: () => { throw new Error('simulated invoice error'); },
}));

await assertNoThrow('listGeneratingUnits não lança quando provider lança', async () => {
  const ugs = await throwingProvider.listGeneratingUnits();
  assert('  retorna array vazio ao invés de crash', Array.isArray(ugs) && ugs.length === 0);
});

await assertNoThrow('listBeneficiaryUnits não lança quando provider lança', async () => {
  const ubs = await throwingProvider.listBeneficiaryUnits();
  assert('  retorna array vazio ao invés de crash', Array.isArray(ubs) && ubs.length === 0);
});

await assertNoThrow('getBeneficiaryConsumptionAverage não lança quando provider lança', async () => {
  const avg = await throwingProvider.getBeneficiaryConsumptionAverage('UB-X');
  assert('  retorna null ao invés de crash', avg === null || avg === undefined);
});

await assertNoThrow('getBeneficiaryMonthlyHistory não lança quando provider lança', async () => {
  const hist = await throwingProvider.getBeneficiaryMonthlyHistory('UB-X');
  assert('  retorna array vazio ao invés de crash', Array.isArray(hist) && hist.length === 0);
});

await assertNoThrow('getBeneficiaryInvoice não lança quando provider lança', async () => {
  const inv = await throwingProvider.getBeneficiaryInvoice('UB-X', '2026-07');
  assert('  retorna null ao invés de crash', inv === null || inv === undefined);
});

// ============================================================
// SUITE U — Demo preservado após Gate 3B
// ============================================================

console.log('\n[U] Demo mode: integridade após Gate 3B');

const demoUgs2 = await demoRuntimeProvider.listGeneratingUnits();
assert('demo ainda tem 3 UGs após Gate 3B', demoUgs2.length === 3);

const demoUbs2 = await demoRuntimeProvider.listBeneficiaryUnits();
assert('demo ainda tem 7 UBs após Gate 3B', demoUbs2.length === 7);

const demoInv2 = await demoRuntimeProvider.getBeneficiaryInvoice('UB-001', '2026-07');
assert('demo invoice UB-001 ainda funciona', demoInv2 !== null);
assert('demo invoice UB-001 finalBalance > 0', (demoInv2 as any)?.finalBalance > 0);

const demoDash2 = await demoRuntimeProvider.getDashboardData({ month: '2026-07' });
assert('demo saldo = 10.900 kWh (canônico Gate 3B)', demoDash2.current.balance === 10900);

// ============================================================
// RESULTADO FINAL
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTADO: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FALHOU');
  process.exit(1);
} else {
  console.log('OK');
}
