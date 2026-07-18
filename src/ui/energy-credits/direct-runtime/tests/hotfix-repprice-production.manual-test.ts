// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Hotfix: repPrice is not defined (produção runtime=real)
// Verifica que repPrice está declarada antes do primeiro uso
// e atribuída corretamente em ambos os modos.
// Rodar: npx tsx tests/hotfix-repprice-production.manual-test.ts
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
// Suite CE — repPrice declarada e atribuída antes do uso
// ============================================================
async function suiteCE() {
  console.log('\nSuite CE — repPrice: escopo correto em renderVals');

  // Must be hoisted with let before the if/else block
  const hoistIdx = html.indexOf('repPrice = 0');
  const ifIdx    = html.indexOf('if (S._rtMode === "real") {', hoistIdx);
  assert('CE1 repPrice = 0 aparece antes do if(_rtMode)',
    hoistIdx !== -1 && ifIdx !== -1 && hoistIdx < ifIdx);

  // Must not be declared with const (would be scoped to a block)
  assert('CE2 sem "const repPrice" no arquivo',
    !html.includes('const repPrice'));

  // Real-mode assignment must exist and reference or.appliedPrice
  assert('CE3 repPrice atribuído no bloco real via or.appliedPrice',
    html.includes('repPrice = or ? (or.appliedPrice'));

  // Demo-mode assignment must exist via appliedPrice() method
  assert('CE4 repPrice atribuído no bloco demo via this.appliedPrice',
    html.includes('repPrice = this.appliedPrice(repUg.id, repMonth)'));

  // Both usage sites still present
  assert('CE5 repPrice usado em repCards (Preço de compra)',
    html.includes('num(repPrice, 2) + "/kWh"'));

  assert('CE6 repPrice usado em repPixRows (Preço aplicado por kWh)',
    html.includes('num(repPrice, 2) }'));

  // repRepasse still uses the same price source in demo (not hardcoded)
  assert('CE7 repRepasse no bloco demo usa this.appliedPrice (sem hardcode)',
    html.includes('repRepasse = repComp * this.appliedPrice(repUg.id, repMonth)'));

  // No new hardcoded price
  assert('CE8 sem novo hardcode financeiro introduzido',
    !html.includes('repPrice = 0.35') && !html.includes('repPrice = 0.34'));
}

// ============================================================
// Suite CF — variáveis irmãs auditadas (sem bug equivalente)
// ============================================================
async function suiteCF() {
  console.log('\nSuite CF — variáveis irmãs: nenhum ReferenceError equivalente');

  // repPix excluded: repPixRows/repPixDiff are legitimate template vars with that prefix
  const siblings = ['repPaid', 'repStatus', 'repOwner', 'repBeneficiaries', 'repSavings', 'repBalance'];
  for (const v of siblings) {
    assert(`CF: ${v} não existe no arquivo (sem bug)`, !html.includes(v));
  }
  // repPix as a standalone token (not repPixRows/repPixDiff) must not exist
  assert('CF: repPix standalone não existe (apenas repPixRows/repPixDiff são legítimos)',
    !html.match(/\brepPix\b(?!Rows|Diff)/)
  );
}

// ============================================================
// Suite CG — runtime real vazio e com relatório não quebram
// ============================================================
async function suiteCG() {
  console.log('\nSuite CG — runtime real: vazio e com relatório válido');

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

  const rtEmpty = createEsaRuntimeProvider(makeProvider());
  assert('CG1 mode === "real"', rtEmpty.mode === 'real');

  let orNullOk = false;
  try { const or = await rtEmpty.getOwnerReport('UG-001', '2026-07'); orNullOk = or === null; } catch {}
  assert('CG2 getOwnerReport null não quebra (or.appliedPrice via guard)', orNullOk);

  // With a real owner report that includes appliedPrice
  const rtReal = createEsaRuntimeProvider(makeProvider({
    getOwnerMonthlyReport: () => ({ ok: true, data: { appliedPrice: 0.35, totalCompensatedKwh: 3000, ownerReturn: 1050, beneficiaries: [] } }),
    getSettlementRecipient: () => ({ ok: true, data: { name: 'Owner', document: '000', pixKey: '000', pixType: 'cpf' } }),
  }));

  let orOk = false;
  try {
    const or = await rtReal.getOwnerReport('UG-001', '2026-07');
    orOk = or !== null && or!.appliedPrice === 0.35 && or!.totalCompensated === 3000;
  } catch {}
  assert('CG3 getOwnerReport com appliedPrice=0.35 retorna corretamente', orOk);
}

// ============================================================
// Suite CH — demo preservado e sem fallback real→demo
// ============================================================
async function suiteCH() {
  console.log('\nSuite CH — demo preservado; sem fallback real → demo');

  const bridgeSrc = path.join(__dirname, '../bridge/runtimeBridge.ts');
  const src = fs.readFileSync(bridgeSrc, 'utf8');

  assert('CH1 bridge: demoRuntimeProvider preservado', src.includes('demoRuntimeProvider'));
  assert('CH2 bridge: sem "falling back to demo"', !src.includes('falling back to demo'));
  assert('CH3 bridge: despacha esa:runtime:error em falha real', src.includes('esa:runtime:error'));
  assert('CH4 html: sem fallback real==>demo (repPrice vem de or.appliedPrice no modo real)',
    html.includes('repPrice = or ? (or.appliedPrice'));
  assert('CH5 html: repPrice no modo demo usa this.appliedPrice (método demo, não hardcode)',
    html.includes('repPrice = this.appliedPrice(repUg.id, repMonth)'));
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Hotfix — repPrice is not defined (runtime=real)');
  console.log('='.repeat(60));

  await suiteCE();
  await suiteCF();
  await suiteCG();
  await suiteCH();

  console.log('\n' + '='.repeat(60));
  console.log(`Hotfix Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
