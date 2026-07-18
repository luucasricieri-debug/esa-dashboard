// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 3E — Importações e Alertas
// Verifica que mutações de alerta retornam capability explícita,
// que getAlertDetail deriva de listAlerts, e que replaceBillData
// nunca simula sucesso.
// Rodar: npx tsx tests/imports-alerts-gate3e.manual-test.ts
// ============================================================

import { createEsaRuntimeProvider } from '../providers/esaRuntimeProvider';
import { demoRuntimeProvider } from '../providers/demoRuntimeProvider';
import type { MutationResult, AlertRecord } from '../contracts/types';

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
// Suite BA — resolveAlert: capability not_available
// ============================================================
async function suiteBA() {
  console.log('\nSuite BA — resolveAlert: capability not_available');
  const rt = createEsaRuntimeProvider(makeProvider());

  const result: MutationResult = await rt.resolveAlert('A-001', 'nota de teste');

  assert('BA1 ok === false', result.ok === false);
  assert('BA2 persisted === false', result.persisted === false);
  assert('BA3 capability === not_available', result.capability === 'not_available');
  assert('BA4 message presente', typeof result.message === 'string' && result.message.length > 0);
  assert('BA5 message menciona indisponível', result.message!.includes('indisponível') || result.message!.includes('não habilitada'));
  assert('BA6 message menciona persistência', result.message!.includes('persist'));
  await assertNoThrow('BA7 resolveAlert não lança', () => rt.resolveAlert('A-001', 'nota'));
}

// ============================================================
// Suite BB — ignoreAlert: capability not_available
// ============================================================
async function suiteBB() {
  console.log('\nSuite BB — ignoreAlert: capability not_available');
  const rt = createEsaRuntimeProvider(makeProvider());

  const result: MutationResult = await rt.ignoreAlert('A-002', 'justificativa');

  assert('BB1 ok === false', result.ok === false);
  assert('BB2 persisted === false', result.persisted === false);
  assert('BB3 capability === not_available', result.capability === 'not_available');
  assert('BB4 message presente', typeof result.message === 'string' && result.message.length > 0);
  assert('BB5 message menciona indisponível', result.message!.includes('indisponível') || result.message!.includes('não habilitada'));
  await assertNoThrow('BB6 ignoreAlert não lança', () => rt.ignoreAlert('A-002', 'justificativa'));
}

// ============================================================
// Suite BC — markAlertInAnalysis: capability not_available
// ============================================================
async function suiteBC() {
  console.log('\nSuite BC — markAlertInAnalysis: capability not_available');
  const rt = createEsaRuntimeProvider(makeProvider());

  const result: MutationResult = await rt.markAlertInAnalysis('A-003', '');

  assert('BC1 ok === false', result.ok === false);
  assert('BC2 persisted === false', result.persisted === false);
  assert('BC3 capability === not_available', result.capability === 'not_available');
  assert('BC4 message presente', typeof result.message === 'string' && result.message.length > 0);
  assert('BC5 message menciona indisponível', result.message!.includes('indisponível') || result.message!.includes('não habilitada'));
  await assertNoThrow('BC6 markAlertInAnalysis não lança', () => rt.markAlertInAnalysis('A-003', ''));
}

// ============================================================
// Suite BD — replaceBillData: capability not_available
// ============================================================
async function suiteBD() {
  console.log('\nSuite BD — replaceBillData: capability not_available');
  const rt = createEsaRuntimeProvider(makeProvider());

  const result: MutationResult = await rt.replaceBillData('EXT-001', 'motivo de substituição');

  assert('BD1 ok === false', result.ok === false);
  assert('BD2 persisted === false', result.persisted === false);
  assert('BD3 capability === not_available', result.capability === 'not_available');
  assert('BD4 message presente', typeof result.message === 'string' && result.message.length > 0);
  assert('BD5 message menciona não disponível', result.message!.includes('não disponível') || result.message!.includes('indisponível'));
  await assertNoThrow('BD6 replaceBillData não lança', () => rt.replaceBillData('EXT-001', 'motivo'));
}

// ============================================================
// Suite BE — getAlertDetail: deriva de listAlerts quando Core tem dados
// ============================================================
async function suiteBE() {
  console.log('\nSuite BE — getAlertDetail: deriva de listAlerts');
  const mockAlert: AlertRecord = {
    id: 'A-REAL-001', severity: 'critico', code: 'ALLOCATION_PERCENTAGE_TOTAL_INVALID',
    message: 'Percentual inválido', unit: 'UG-REAL-001', month: '2026-07',
    action: 'Revisar rateio', title: 'Percentual de rateio inválido', status: 'ativo',
    history: [{ at: '2026-07-01', label: 'Alerta gerado' }],
  };
  const rt = createEsaRuntimeProvider(makeProvider({
    getAlertsSummary: () => ({ ok: true, data: { alerts: [mockAlert] } }),
  }));

  const found = await rt.getAlertDetail('A-REAL-001');
  assert('BE1 encontra alerta pelo id', found !== null);
  assert('BE2 id correto', found!.id === 'A-REAL-001');
  assert('BE3 severity correto', found!.severity === 'critico');
  assert('BE4 code correto', found!.code === 'ALLOCATION_PERCENTAGE_TOTAL_INVALID');
  assert('BE5 status correto', found!.status === 'ativo');

  const notFound = await rt.getAlertDetail('A-INEXISTENTE-999');
  assert('BE6 retorna null quando id não existe', notFound === null);
  await assertNoThrow('BE7 getAlertDetail não lança', () => rt.getAlertDetail('A-QUALQUER'));
}

// ============================================================
// Suite BF — getAlertDetail: retorna null quando listAlerts retorna vazio
// ============================================================
async function suiteBF() {
  console.log('\nSuite BF — getAlertDetail: null quando listAlerts vazio');
  const rt = createEsaRuntimeProvider(makeProvider({
    getAlertsSummary: () => ({ ok: true, data: { alerts: [] } }),
  }));

  const result = await rt.getAlertDetail('A-001');
  assert('BF1 retorna null quando lista vazia', result === null);

  const rt2 = createEsaRuntimeProvider(makeProvider({
    getAlertsSummary: () => null,
  }));
  const result2 = await rt2.getAlertDetail('A-001');
  assert('BF2 retorna null quando getAlertsSummary retorna null', result2 === null);
}

// ============================================================
// Suite BG — listAlerts: filtra por mês via referenceMonth
// ============================================================
async function suiteBG() {
  console.log('\nSuite BG — listAlerts: passa referenceMonth ao provider');
  let capturedArgs: unknown = null;
  const rt = createEsaRuntimeProvider(makeProvider({
    getAlertsSummary: (args: unknown) => {
      capturedArgs = args;
      return { ok: true, data: { alerts: [] } };
    },
  }));

  await rt.listAlerts({ month: '2026-07' });
  assert('BG1 args capturados', capturedArgs !== null);
  assert('BG2 referenceMonth passado', (capturedArgs as any).referenceMonth === '2026-07');

  await rt.listAlerts({});
  assert('BG3 sem mês: referenceMonth undefined', (capturedArgs as any).referenceMonth === undefined);
}

// ============================================================
// Suite BH — getImportHistory: sempre retorna array vazio no real
// ============================================================
async function suiteBH() {
  console.log('\nSuite BH — getImportHistory: array vazio honesto');
  const rt = createEsaRuntimeProvider(makeProvider());

  const history = await rt.getImportHistory();
  assert('BH1 retorna array', Array.isArray(history));
  assert('BH2 array está vazio (Core não expõe histórico)', history.length === 0);
  await assertNoThrow('BH3 getImportHistory não lança', () => rt.getImportHistory());
}

// ============================================================
// Suite BI — Alert mutations: mensagens exatas
// ============================================================
async function suiteBI() {
  console.log('\nSuite BI — Mensagens exatas das mutações de alerta');
  const rt = createEsaRuntimeProvider(makeProvider());

  const resolve = await rt.resolveAlert('A-001', 'nota');
  assert('BI1 resolveAlert message exata',
    resolve.message === 'Resolução de alerta indisponível: persistência ainda não habilitada.');

  const ignore = await rt.ignoreAlert('A-001', 'nota');
  assert('BI2 ignoreAlert message exata',
    ignore.message === 'Ignorar alerta indisponível: persistência ainda não habilitada.');

  const markAnalise = await rt.markAlertInAnalysis('A-001', '');
  assert('BI3 markAlertInAnalysis message exata',
    markAnalise.message === 'Alteração de status de alerta indisponível: persistência ainda não habilitada.');

  const replace = await rt.replaceBillData('EXT-001', 'motivo');
  assert('BI4 replaceBillData message exata',
    replace.message === 'Substituição de registro não disponível no runtime atual.');
}

// ============================================================
// Suite BJ — Demo preservado: mutações de alerta e importação
// ============================================================
async function suiteBJ() {
  console.log('\nSuite BJ — Demo preservado: alertas e importações intactos');
  const demo = demoRuntimeProvider;

  const resolveDemo = await demo.resolveAlert('A-001', 'nota');
  assert('BJ1 demo resolveAlert ok === true', resolveDemo.ok === true);
  assert('BJ2 demo resolveAlert persisted não é false', resolveDemo.persisted !== false);

  const ignoreDemo = await demo.ignoreAlert('A-001', 'nota');
  assert('BJ3 demo ignoreAlert ok === true', ignoreDemo.ok === true);

  const markDemo = await demo.markAlertInAnalysis('A-001', '');
  assert('BJ4 demo markAlertInAnalysis ok === true', markDemo.ok === true);

  const replaceDemo = await demo.replaceBillData('EXT-001', 'motivo');
  assert('BJ5 demo replaceBillData ok === true', replaceDemo.ok === true);

  const histDemo = await demo.getImportHistory();
  assert('BJ6 demo getImportHistory retorna array', Array.isArray(histDemo));
}

// ============================================================
// Suite BK — Provider real não usa demo data
// ============================================================
async function suiteBK() {
  console.log('\nSuite BK — Provider real não contém dados demo');
  const src = createEsaRuntimeProvider.toString();
  assert('BK1 provider real não contém UG-001 hardcoded', !src.includes('"UG-001"') && !src.includes("'UG-001'"));
  assert('BK2 provider real não contém UB-001 hardcoded', !src.includes('"UB-001"') && !src.includes("'UB-001'"));
  assert('BK3 provider real não contém calculationMemory', !src.includes('calculationMemory'));
  assert('BK4 provider real não contém MONTH_FACTOR', !src.includes('MONTH_FACTOR'));
}

// ============================================================
// Suite BL — Alert mutations: nunca retornam persisted=true
// ============================================================
async function suiteBL() {
  console.log('\nSuite BL — Alert mutations: nunca persisted=true');
  const rt = createEsaRuntimeProvider(makeProvider());

  const r1 = await rt.resolveAlert('A-X', 'nota');
  assert('BL1 resolveAlert.persisted !== true', r1.persisted !== true);

  const r2 = await rt.ignoreAlert('A-X', 'nota');
  assert('BL2 ignoreAlert.persisted !== true', r2.persisted !== true);

  const r3 = await rt.markAlertInAnalysis('A-X', '');
  assert('BL3 markAlertInAnalysis.persisted !== true', r3.persisted !== true);

  const r4 = await rt.replaceBillData('EXT-X', 'motivo');
  assert('BL4 replaceBillData.persisted !== true', r4.persisted !== true);
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Gate 3E — Importações e Alertas');
  console.log('='.repeat(60));

  await suiteBA();
  await suiteBB();
  await suiteBC();
  await suiteBD();
  await suiteBE();
  await suiteBF();
  await suiteBG();
  await suiteBH();
  await suiteBI();
  await suiteBJ();
  await suiteBK();
  await suiteBL();

  console.log('\n' + '='.repeat(60));
  console.log(`Gate 3E Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
