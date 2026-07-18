// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 3D — Relatórios e Financeiro
// Verifica que getOwnerReport mapeia campos corretamente,
// que mutações de pagamento verificam ok === false do Core,
// e que getGeneratingUnitPayee expõe dados canonicamente.
// Rodar: npx tsx tests/financial-gate3d.manual-test.ts
// ============================================================

import { createEsaRuntimeProvider } from '../providers/esaRuntimeProvider';
import { demoRuntimeProvider } from '../providers/demoRuntimeProvider';

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
    getGeneratingUnitSummary: () => null,
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

// ============================================================
// Suite AR — getOwnerReport: null quando provider retorna null
// ============================================================
async function suiteAR() {
  console.log('\nSuite AR — getOwnerReport: null quando vazio');
  const rt = createEsaRuntimeProvider(makeProvider({
    getOwnerMonthlyReport: () => null,
  }));

  const result = await rt.getOwnerReport('UG-REAL-001', '2026-07');
  assert('AR1 retorna null quando provider retorna null', result === null);
  await assertNoThrow('AR2 não lança ao receber null', () => rt.getOwnerReport('UG-REAL-001', '2026-07'));
}

// ============================================================
// Suite AS — getOwnerReport: mapeamento de campos variantes
// ============================================================
async function suiteAS() {
  console.log('\nSuite AS — getOwnerReport: field mapping com fallback chains');
  const rt = createEsaRuntimeProvider(makeProvider({
    getOwnerMonthlyReport: () => ({
      ok: true,
      data: {
        generatingUnitId: 'UG-REAL-001',
        ugName: 'Fazenda Solar Alpha',
        referenceMonth: '2026-07',
        appliedPrice: 0.38,
        totalCompensatedKwh: 5000,
        ownerReturn: 1900,
        beneficiaries: [
          {
            beneficiaryUnitId: 'UB-REAL-001',
            name: 'Empresa Beta',
            compensatedKwh: 2000,
            allocationPct: 0.4,
            ownerReturn: 760,
            paymentStatus: 'aberto',
          },
        ],
        payee: {
          name: 'João Silva',
          document: '123.456.789-00',
          pixKey: 'joao@email.com',
          pixType: 'email',
        },
      },
    }),
  }));

  const result = await rt.getOwnerReport('UG-REAL-001', '2026-07');
  assert('AS1 resultado não é null', result !== null);
  assert('AS2 ugId mapeado de generatingUnitId', result!.ugId === 'UG-REAL-001');
  assert('AS3 ugName mapeado', result!.ugName === 'Fazenda Solar Alpha');
  assert('AS4 month mapeado de referenceMonth', result!.month === '2026-07');
  assert('AS5 totalCompensated de totalCompensatedKwh', result!.totalCompensated === 5000);
  assert('AS6 ownerPayment de ownerReturn', result!.ownerPayment === 1900);
  assert('AS7 beneficiários mapeados', result!.beneficiaryBreakdown.length === 1);
  assert('AS8 ubId de beneficiaryUnitId', result!.beneficiaryBreakdown[0].ubId === 'UB-REAL-001');
  assert('AS9 compensated de compensatedKwh', result!.beneficiaryBreakdown[0].compensated === 2000);
  assert('AS10 share de allocationPct', Math.abs(result!.beneficiaryBreakdown[0].share - 0.4) < 0.001);
  assert('AS11 repasse de ownerReturn', result!.beneficiaryBreakdown[0].repasse === 760);
  assert('AS12 payee.name mapeado', result!.payee.name === 'João Silva');
  assert('AS13 payee.pixType mapeado', result!.payee.pixType === 'email');
}

// ============================================================
// Suite AT — getOwnerReport: fallback para nomes de campo alternativos
// ============================================================
async function suiteAT() {
  console.log('\nSuite AT — getOwnerReport: fallback field names');
  const rt = createEsaRuntimeProvider(makeProvider({
    getOwnerMonthlyReport: () => ({
      ok: true,
      data: {
        ugId: 'UG-REAL-002',
        month: '2026-06',
        appliedPrice: 0.36,
        totalCompensated: 3000,
        ownerPayment: 1080,
        beneficiaryBreakdown: [
          {
            ubId: 'UB-REAL-002',
            ubName: 'Empresa Gama',
            compensated: 1500,
            share: 0.5,
            repasse: 540,
            status: 'pago',
          },
        ],
        recipient: {
          name: 'Maria Santos',
          cpf: '987.654.321-00',
          pix: 'maria@email.com',
          type: 'email',
        },
      },
    }),
  }));

  const result = await rt.getOwnerReport('UG-REAL-002', '2026-06');
  assert('AT1 resultado não é null', result !== null);
  assert('AT2 ugId fallback (ugId)', result!.ugId === 'UG-REAL-002');
  assert('AT3 totalCompensated fallback', result!.totalCompensated === 3000);
  assert('AT4 ownerPayment fallback', result!.ownerPayment === 1080);
  assert('AT5 ubId fallback (ubId)', result!.beneficiaryBreakdown[0].ubId === 'UB-REAL-002');
  assert('AT6 compensated fallback', result!.beneficiaryBreakdown[0].compensated === 1500);
  assert('AT7 payee usa recipient fallback', result!.payee.name === 'Maria Santos');
  assert('AT8 pixType usa type fallback', result!.payee.pixType === 'email');
}

// ============================================================
// Suite AU — Mutações de pagamento: Core retorna ok:false → provider retorna rejected
// ============================================================
async function suiteAU() {
  console.log('\nSuite AU — Payment mutations: Core ok:false → capability:rejected');
  const rt = createEsaRuntimeProvider(makeProvider({
    confirmInvoicePayment: () => ({ ok: false, data: null, message: 'Fatura já confirmada.' }),
    reopenInvoicePayment: () => ({ ok: false, data: null, message: 'Reabertura não permitida.' }),
    confirmOwnerSettlementPayment: () => ({ ok: false, data: null, message: 'Repasse já realizado.' }),
  }));

  const inv = await rt.confirmInvoicePayment('UB-X', '2026-07', { paidAt: '2026-07-15', amount: 100 });
  assert('AU1 confirmInvoicePayment ok === false quando Core rejeita', inv.ok === false);
  assert('AU2 confirmInvoicePayment persisted === false', inv.persisted === false);
  assert('AU3 confirmInvoicePayment capability === rejected', inv.capability === 'rejected');
  assert('AU4 confirmInvoicePayment message propagada', inv.message === 'Fatura já confirmada.');

  const reopen = await rt.reopenInvoicePayment('UB-X', '2026-07', 'Erro de registro');
  assert('AU5 reopenInvoicePayment ok === false quando Core rejeita', reopen.ok === false);
  assert('AU6 reopenInvoicePayment persisted === false', reopen.persisted === false);
  assert('AU7 reopenInvoicePayment capability === rejected', reopen.capability === 'rejected');
  assert('AU8 reopenInvoicePayment message propagada', reopen.message === 'Reabertura não permitida.');

  const owner = await rt.confirmOwnerPayment('UG-X', '2026-07', { paidAt: '2026-07-15', amount: 500 });
  assert('AU9 confirmOwnerPayment ok === false quando Core rejeita', owner.ok === false);
  assert('AU10 confirmOwnerPayment persisted === false', owner.persisted === false);
  assert('AU11 confirmOwnerPayment capability === rejected', owner.capability === 'rejected');
  assert('AU12 confirmOwnerPayment message propagada', owner.message === 'Repasse já realizado.');
}

// ============================================================
// Suite AV — Mutações de pagamento: Core retorna ok:true → sucesso
// ============================================================
async function suiteAV() {
  console.log('\nSuite AV — Payment mutations: Core ok:true → success');
  const rt = createEsaRuntimeProvider(makeProvider({
    confirmInvoicePayment: () => ({ ok: true, data: { ok: true } }),
    reopenInvoicePayment: () => ({ ok: true, data: { ok: true } }),
    confirmOwnerSettlementPayment: () => ({ ok: true, data: { ok: true } }),
  }));

  const inv = await rt.confirmInvoicePayment('UB-X', '2026-07', { paidAt: '2026-07-15', amount: 100 });
  assert('AV1 confirmInvoicePayment ok === true quando Core aceita', inv.ok === true);

  const reopen = await rt.reopenInvoicePayment('UB-X', '2026-07', 'Correção');
  assert('AV2 reopenInvoicePayment ok === true quando Core aceita', reopen.ok === true);

  const owner = await rt.confirmOwnerPayment('UG-X', '2026-07', { paidAt: '2026-07-15', amount: 500 });
  assert('AV3 confirmOwnerPayment ok === true quando Core aceita', owner.ok === true);
}

// ============================================================
// Suite AW — getGeneratingUnitPayee: mapeamento correto
// ============================================================
async function suiteAW() {
  console.log('\nSuite AW — getGeneratingUnitPayee: mapeamento');
  const rt = createEsaRuntimeProvider(makeProvider({
    getSettlementRecipient: () => ({
      ok: true,
      data: {
        name: 'Carlos Oliveira',
        document: '111.222.333-44',
        pixKey: 'carlos@empresa.com',
        pixType: 'email',
      },
    }),
  }));

  const payee = await rt.getGeneratingUnitPayee('UG-REAL-001');
  assert('AW1 payee não é null', payee !== null);
  assert('AW2 name mapeado', payee!.name === 'Carlos Oliveira');
  assert('AW3 document mapeado', payee!.document === '111.222.333-44');
  assert('AW4 pixKey mapeado', payee!.pixKey === 'carlos@empresa.com');
  assert('AW5 pixType mapeado', payee!.pixType === 'email');

  const rt2 = createEsaRuntimeProvider(makeProvider({
    getSettlementRecipient: () => null,
  }));
  const noPayee = await rt2.getGeneratingUnitPayee('UG-SEM-PAYEE');
  assert('AW6 retorna null quando provider retorna null', noPayee === null);
}

// ============================================================
// Suite AX — Demo preservado: relatórios e pagamentos intactos
// ============================================================
async function suiteAX() {
  console.log('\nSuite AX — Demo preservado: relatórios e pagamentos');
  const demo = demoRuntimeProvider;

  const ownerRep = await demo.getOwnerReport('UG-001', '2026-07');
  assert('AX1 demo getOwnerReport não é null', ownerRep !== null);
  assert('AX2 demo ownerReport.ugId presente', typeof ownerRep!.ugId === 'string' && ownerRep!.ugId.length > 0);
  assert('AX3 demo ownerReport.totalCompensated > 0', ownerRep!.totalCompensated > 0);
  assert('AX4 demo ownerReport.ownerPayment > 0', ownerRep!.ownerPayment > 0);
  assert('AX5 demo ownerReport.beneficiaryBreakdown é array', Array.isArray(ownerRep!.beneficiaryBreakdown));

  const payee = await demo.getGeneratingUnitPayee('UG-001');
  assert('AX6 demo getGeneratingUnitPayee retorna algo', payee !== null);

  const invConf = await demo.confirmInvoicePayment('UB-001', '2026-07', { paidAt: '2026-07-15', amount: 100 });
  assert('AX7 demo confirmInvoicePayment ok === true', invConf.ok === true);

  const ownerConf = await demo.confirmOwnerPayment('UG-001', '2026-07', { paidAt: '2026-07-15', amount: 500 });
  assert('AX8 demo confirmOwnerPayment ok === true', ownerConf.ok === true);

  const reopen = await demo.reopenInvoicePayment('UB-001', '2026-07', 'Erro');
  assert('AX9 demo reopenInvoicePayment ok === true', reopen.ok === true);
}

// ============================================================
// Suite AY — getOwnerReport: sem calculationMemory no provider real
// ============================================================
async function suiteAY() {
  console.log('\nSuite AY — Provider real não expõe calculationMemory');
  const src = createEsaRuntimeProvider.toString();
  assert('AY1 provider real não contém calculationMemory', !src.includes('calculationMemory'));
  assert('AY2 provider real não contém buildInvoice', !src.includes('buildInvoice'));
  assert('AY3 provider real não contém computeSettlement', !src.includes('computeSettlement'));
  assert('AY4 provider real não contém MONTH_FACTOR', !src.includes('MONTH_FACTOR'));
}

// ============================================================
// Suite AZ — getOwnerReport: exceção [buildOwnerMonthlyReport] → null
// ============================================================
async function suiteAZ() {
  console.log('\nSuite AZ — getOwnerReport: exceção conhecida → null');
  const rt = createEsaRuntimeProvider(makeProvider({
    getOwnerMonthlyReport: () => { throw new Error('[buildOwnerMonthlyReport] UG não encontrada'); },
  }));

  const result = await rt.getOwnerReport('UG-INEXISTENTE', '2026-07');
  assert('AZ1 retorna null para exceção buildOwnerMonthlyReport com não encontrada', result === null);
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Gate 3D — Relatórios e Financeiro');
  console.log('='.repeat(60));

  await suiteAR();
  await suiteAS();
  await suiteAT();
  await suiteAU();
  await suiteAV();
  await suiteAW();
  await suiteAX();
  await suiteAY();
  await suiteAZ();

  console.log('\n' + '='.repeat(60));
  console.log(`Gate 3D Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
