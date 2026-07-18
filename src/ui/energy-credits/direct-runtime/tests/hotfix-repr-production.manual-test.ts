// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Hotfix: repR is not defined (produção runtime=real)
// Verifica que repR e repPlan estão acessíveis em ambos os modos,
// que runtime real vazio não quebra, e que demo permanece intacto.
// Rodar: npx tsx tests/hotfix-repr-production.manual-test.ts
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const html = fs.readFileSync(path.join(ROOT, 'energy-credits-v2.html'), 'utf8');

// ============================================================
// Suite CA — repR e repPlan declarados antes do if/else
// ============================================================
async function suiteCA() {
  console.log('\nSuite CA — repR e repPlan: escopo correto no renderVals');

  // repR and repPlan must be declared with let before the if/else block
  assert('CA1 let repR declarado antes do if(_rtMode)',
    /let repR = null.*repPlan = null/.test(html) || /let repR[\s\S]{0,60}repPlan[\s\S]{0,10}null/.test(html.slice(0, html.indexOf('if (S._rtMode === "real") {')))
  );

  assert('CA2 repR não tem const no escopo do bloco else',
    !html.includes('const repR = this.computeSettlement'));

  assert('CA3 repPlan não tem const no escopo do bloco else',
    !html.includes('const repPlan = this.computeAllocationPlan'));

  // The hoist line must come before the if block
  const hoistIdx = html.indexOf('let repR = null, repPlan = null');
  const ifIdx    = html.indexOf('if (S._rtMode === "real") {', hoistIdx);
  assert('CA4 let repR = null aparece antes do if(_rtMode)',
    hoistIdx !== -1 && ifIdx !== -1 && hoistIdx < ifIdx);

  // Real-mode assignment must exist inside the if block
  assert('CA5 repR atribuído no bloco real (generation)',
    html.includes('repR = { generation:'));

  assert('CA6 repPlan atribuído no bloco real (raPlan)',
    html.includes('repPlan = raPlan ||'));

  // Demo-mode assignments still exist (no const)
  assert('CA7 repR atribuído no bloco demo (computeSettlement)',
    html.includes('repR = this.computeSettlement'));

  assert('CA8 repPlan atribuído no bloco demo (computeAllocationPlan)',
    html.includes('repPlan = this.computeAllocationPlan'));

  // Usage points still present
  assert('CA9 repR.generation ainda usado em repCards',
    html.includes('repR.generation * repF'));

  assert('CA10 repPlan.rows.length ainda usado em repCards',
    html.includes('repPlan.rows.length'));
}

// ============================================================
// Suite CB — runtime real vazio não quebra
// ============================================================
async function suiteCB() {
  console.log('\nSuite CB — runtime real com Core retornando null não quebra');

  function makeProvider(overrides: Partial<Record<string, (...args: unknown[]) => unknown>> = {}): Parameters<typeof createEsaRuntimeProvider>[0] {
    return {
      searchGeneratingUnits: () => ({ ok: true, data: [] }),
      searchBeneficiaryUnits: () => ({ ok: true, data: [] }),
      getExecutiveSummary: () => null,
      getFinancialSummary: () => null,
      getAlertsSummary: () => null,
      getCsvTemplate: () => null,
      createGeneratingUnit: () => ({ ok: true, data: { id: 'UG-X', name: 'X' } }),
      updateGeneratingUnit: () => ({ ok: true, data: { ok: true } }),
      createBeneficiaryUnit: () => ({ ok: true, data: { id: 'UB-X', name: 'X' } }),
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

  const rt = createEsaRuntimeProvider(makeProvider());

  // getDashboardData (real, empty Core)
  let dashOk = false;
  try {
    const d = await rt.getDashboardData({ month: '2026-07' });
    dashOk = d !== undefined && d.current.generation === 0;
  } catch {}
  assert('CB1 getDashboardData real vazio não quebra', dashOk);

  // getOwnerReport null (real, empty Core)
  let orOk = false;
  try {
    const or = await rt.getOwnerReport('UG-001', '2026-07');
    orOk = or === null;
  } catch {}
  assert('CB2 getOwnerReport null não quebra', orOk);

  // getAllocationPlan null (real, empty Core)
  let apOk = false;
  try {
    const ap = await rt.getAllocationPlan('UG-001', '2026-07', {});
    apOk = ap !== undefined;
  } catch {}
  assert('CB3 getAllocationPlan null não quebra', apOk);

  // provider.mode = "real"
  assert('CB4 provider.mode === "real"', rt.mode === 'real');
}

// ============================================================
// Suite CC — runtime real com relatório não quebra
// ============================================================
async function suiteCC() {
  console.log('\nSuite CC — runtime real com relatório válido não quebra');

  function makeProviderWithReport(): Parameters<typeof createEsaRuntimeProvider>[0] {
    // Note: unwrap() requires { ok: true, data: ... } — all returning methods use that shape
    return {
      searchGeneratingUnits: () => ({ ok: true, data: [{ id: 'UG-001', name: 'UG Test', owner: 'Owner', document: '000', uc: '000', distributor: 'Dist', status: 'ativa', purchasePrice: 0.35, previousBalance: 1000, monthlyGeneration: 5000 }] }),
      searchBeneficiaryUnits: () => ({ ok: true, data: [] }),
      getExecutiveSummary: () => ({ ok: true, data: { totalGenerationKwh: 5000, totalCompensatedKwh: 4500, totalCurrentBalanceKwh: 500, totalEsaRevenue: 2475, totalOwnerReturn: 1575, grossSpread: 900, totalMonthlyDiscount: 2250 } }),
      getFinancialSummary: () => null,
      getAlertsSummary: () => null,
      getCsvTemplate: () => null,
      createGeneratingUnit: () => ({ ok: true, data: { id: 'UG-X', name: 'X' } }),
      updateGeneratingUnit: () => ({ ok: true, data: { ok: true } }),
      createBeneficiaryUnit: () => ({ ok: true, data: { id: 'UB-X', name: 'X' } }),
      updateBeneficiaryUnit: () => ({ ok: true, data: { ok: true } }),
      getSettlementRecipient: () => ({ ok: true, data: { name: 'Owner', document: '000', pixKey: '000', pixType: 'cpf' } }),
      getBeneficiaryConsumptionAverage: () => null,
      getBeneficiaryHistory: () => null,
      getBeneficiaryMonthlyReport: () => null,
      getOwnerMonthlyReport: (_ugId: unknown, _month: unknown) => ({ ok: true, data: { totalCompensatedKwh: 4500, ownerReturn: 1575, appliedPrice: 0.35, beneficiaries: [] } }),
      getAllocationPlan: () => ({ ok: true, data: { rows: [] } }),
      getGeneratingUnitSummary: () => ({ ok: true, data: { totalGenerationKwh: 5000, totalCurrentBalanceKwh: 500 } }),
      confirmInvoicePayment: () => ({ ok: true, data: { ok: true } }),
      reopenInvoicePayment: () => ({ ok: true, data: { ok: true } }),
      confirmOwnerSettlementPayment: () => ({ ok: true, data: { ok: true } }),
      createUtilityBillImport: () => null,
      confirmUtilityBillExtraction: () => ({ ok: true, data: { ok: true } }),
      matchUtilityBillToBeneficiary: () => null,
      linkUtilityBillToBeneficiary: () => ({ ok: true, data: { ok: true } }),
    } as Parameters<typeof createEsaRuntimeProvider>[0];
  }

  const rt = createEsaRuntimeProvider(makeProviderWithReport());
  assert('CC1 mode === "real"', rt.mode === 'real');

  let dashOk = false;
  try {
    const d = await rt.getDashboardData({ month: '2026-07' });
    dashOk = d.current.generation === 5000;
  } catch {}
  assert('CC2 getDashboardData retorna generation=5000', dashOk);

  let orOk = false;
  try {
    const or = await rt.getOwnerReport('UG-001', '2026-07');
    orOk = or !== null && or!.totalCompensated === 4500;
  } catch {}
  assert('CC3 getOwnerReport retorna totalCompensated=4500', orOk);

  let apOk = false;
  try {
    const ap = await rt.getAllocationPlan('UG-001', '2026-07', {});
    apOk = ap !== null && Array.isArray((ap as any).rows);
  } catch {}
  assert('CC4 getAllocationPlan retorna rows', apOk);
}

// ============================================================
// Suite CD — demo preservado e sem fallback real→demo
// ============================================================
async function suiteCD() {
  console.log('\nSuite CD — demo preservado; sem fallback real → demo');

  const bridgeSrc = path.join(__dirname, '../bridge/runtimeBridge.ts');
  const src = fs.readFileSync(bridgeSrc, 'utf8');

  assert('CD1 bridge: demoRuntimeProvider existe', src.includes('demoRuntimeProvider'));
  assert('CD2 bridge: sem "falling back to demo"', !src.includes('falling back to demo'));
  assert('CD3 bridge: despacha esa:runtime:error em falha real', src.includes('esa:runtime:error'));
  assert('CD4 bridge: retorna null em falha real (não demoRuntimeProvider)', src.includes('return null'));
  assert('CD5 html: modo demo preservado (demoRuntimeProvider não removido do bridge)',
    src.includes('window.ESA_ENERGY_CREDITS_RUNTIME = demoRuntimeProvider'));
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Hotfix — repR is not defined (runtime=real)');
  console.log('='.repeat(60));

  await suiteCA();
  await suiteCB();
  await suiteCC();
  await suiteCD();

  console.log('\n' + '='.repeat(60));
  console.log(`Hotfix Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
