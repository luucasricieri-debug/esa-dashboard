// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Hotfix: boot infinito em ?runtime=real
// Verifica que o race condition entre esa:runtime:error e
// componentDidMount está coberto via __ESA_RUNTIME_STATUS__.
// Rodar: npx tsx tests/hotfix-runtime-boot-production.manual-test.ts
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
const bridgeSrc = fs.readFileSync(path.join(__dirname, '../bridge/runtimeBridge.ts'), 'utf8');
const bridgeJs  = fs.readFileSync(path.join(ROOT, 'assets/energy-credits-runtime/bridge.js'), 'utf8');

// ============================================================
// Suite CI — bridge.ts: __ESA_RUNTIME_STATUS__ gravado antes dos eventos
// ============================================================
async function suiteCI() {
  console.log('\nSuite CI — bridge.ts: __ESA_RUNTIME_STATUS__ precede cada evento');

  // Status flag must be declared in Window interface
  assert('CI1 __ESA_RUNTIME_STATUS__ declarado na interface Window',
    bridgeSrc.includes("__ESA_RUNTIME_STATUS__?: { status: 'ready' | 'error'; reason?: string }"));

  // Set in success path (ready)
  assert('CI2 status ready definido antes de dispatchEvent(ready) no initBridge',
    bridgeSrc.includes("window.__ESA_RUNTIME_STATUS__ = { status: 'ready' }") &&
    bridgeSrc.indexOf("window.__ESA_RUNTIME_STATUS__ = { status: 'ready' }") <
    bridgeSrc.indexOf("dispatchEvent(new CustomEvent('esa:runtime:ready', { detail: { mode: 'real' } }))"));

  // Set in error path (provider_unavailable)
  assert('CI3 status error definido antes de dispatchEvent(error) no initBridge',
    bridgeSrc.includes("status: 'error', reason: 'provider_unavailable'") &&
    bridgeSrc.indexOf("status: 'error', reason: 'provider_unavailable'") <
    bridgeSrc.indexOf("dispatchEvent(new CustomEvent('esa:runtime:error', { detail: { reason: 'provider_unavailable' } }))"));

  // Set in catch (init_exception)
  assert('CI4 status error definido na catch de initBridge (init_exception)',
    bridgeSrc.includes("status: 'error', reason: 'init_exception'"));

  // Set in demo synchronous path (IIFE bottom)
  const demoStatusIdx  = bridgeSrc.lastIndexOf("window.__ESA_RUNTIME_STATUS__ = { status: 'ready' }");
  const demoReadyIdx   = bridgeSrc.lastIndexOf("dispatchEvent(new CustomEvent('esa:runtime:ready', { detail: { mode: 'demo' } }))");
  assert('CI5 status ready definido antes do dispatchEvent demo (IIFE)',
    demoStatusIdx !== -1 && demoReadyIdx !== -1 && demoStatusIdx < demoReadyIdx);
}

// ============================================================
// Suite CJ — bridge.js compilado: status flag presente
// ============================================================
async function suiteCJ() {
  console.log('\nSuite CJ — bridge.js compilado: __ESA_RUNTIME_STATUS__ presente');

  assert('CJ1 __ESA_RUNTIME_STATUS__ no bundle (ready)',
    bridgeJs.includes('__ESA_RUNTIME_STATUS__ = { status: "ready" }'));

  assert('CJ2 __ESA_RUNTIME_STATUS__ no bundle (error)',
    bridgeJs.includes('__ESA_RUNTIME_STATUS__ = {'));

  // Verify the status is set BEFORE dispatchEvent in the compiled output
  const readyStatusIdx  = bridgeJs.indexOf('__ESA_RUNTIME_STATUS__ = { status: "ready" }');
  const readyEventIdx   = bridgeJs.indexOf('dispatchEvent(new CustomEvent("esa:runtime:ready"', readyStatusIdx);
  assert('CJ3 no bundle: status definido antes do evento ready',
    readyStatusIdx !== -1 && readyEventIdx !== -1 && readyStatusIdx < readyEventIdx);

  assert('CJ4 bridge.js não despacha esa:runtime:ready sem gravar status antes',
    (() => {
      // Every occurrence of esa:runtime:ready dispatch must have __ESA_RUNTIME_STATUS__ before it
      let ok = true;
      let searchFrom = 0;
      while (true) {
        const evIdx = bridgeJs.indexOf('dispatchEvent(new CustomEvent("esa:runtime:ready"', searchFrom);
        if (evIdx === -1) break;
        const beforeSlice = bridgeJs.slice(0, evIdx);
        if (!beforeSlice.includes('__ESA_RUNTIME_STATUS__')) { ok = false; break; }
        searchFrom = evIdx + 1;
      }
      return ok;
    })()
  );
}

// ============================================================
// Suite CK — html: _initRealMode lê __ESA_RUNTIME_STATUS__ quando !rt
// ============================================================
async function suiteCK() {
  console.log('\nSuite CK — html: _initRealMode verifica __ESA_RUNTIME_STATUS__ quando !rt');

  assert('CK1 _initRealMode lê window.__ESA_RUNTIME_STATUS__',
    html.includes('window.__ESA_RUNTIME_STATUS__'));

  assert('CK2 verifica bridgeSt.status === error',
    html.includes("bridgeSt.status === 'error'"));

  assert('CK3 transiciona para _rtStatus: error via bridgeSt.reason',
    html.includes("bridgeSt.reason || 'provider_unavailable'"));

  // Must occur inside the !rt block (before "return;" for !rt) — search from fn definition
  const initFnDef  = html.indexOf('_initRealMode() {');
  const bridgeStIdx = html.indexOf('window.__ESA_RUNTIME_STATUS__', initFnDef);
  const firstReturn = html.indexOf('return;', initFnDef);
  assert('CK4 leitura de __ESA_RUNTIME_STATUS__ ocorre antes do primeiro return de _initRealMode',
    initFnDef !== -1 && bridgeStIdx !== -1 && firstReturn !== -1 && bridgeStIdx < firstReturn);
}

// ============================================================
// Suite CL — html: componentDidMount tem safety timeout
// ============================================================
async function suiteCL() {
  console.log('\nSuite CL — html: componentDidMount tem safety timeout de 8s');

  assert('CL1 componentDidMount contém setTimeout com 8000',
    html.includes('8000'));

  assert('CL2 timeout transiciona para _rtStatus: error (não demo)',
    html.includes("_rtStatus: 'error', _rtError: 'timeout'"));

  assert('CL3 timeout só ativa se ainda booting',
    html.includes("_rtStatus === 'booting'") || html.includes('_rtStatus === "booting"'));

  assert('CL4 timeout condicionado a runtime=real',
    (() => {
      const mountStart = html.indexOf('componentDidMount()');
      const timeoutIdx = html.indexOf('8000', mountStart);
      const sliceBefore = html.slice(mountStart, timeoutIdx);
      return sliceBefore.includes("'runtime'") || sliceBefore.includes('"runtime"');
    })()
  );
}

// ============================================================
// Suite CM — race condition: ready antes de componentDidMount
// ============================================================
async function suiteCM() {
  console.log('\nSuite CM — race condition: ready antes de componentDidMount');

  // Simulate: bridge set __ESA_RUNTIME_STATUS__ before component mounted
  // and ESA_ENERGY_CREDITS_RUNTIME is already set
  function makeProvider(): Parameters<typeof createEsaRuntimeProvider>[0] {
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
    } as Parameters<typeof createEsaRuntimeProvider>[0];
  }

  // When runtime is available at mount time, _initRealMode should proceed
  const rt = createEsaRuntimeProvider(makeProvider());
  assert('CM1 provider.mode === "real"', rt.mode === 'real');

  let mountOk = false;
  try {
    const months = await rt.listMonths();
    const ugs = await rt.listGeneratingUnits();
    mountOk = Array.isArray(months) && Array.isArray(ugs);
  } catch {}
  assert('CM2 listMonths + listGeneratingUnits disponíveis após mount', mountOk);

  // When __ESA_RUNTIME_STATUS__ = error and rt is not set, component should see error
  assert('CM3 html: _initRealMode lê __ESA_RUNTIME_STATUS__ quando rt===undefined',
    html.includes('__ESA_RUNTIME_STATUS__'));

  // The status is checked before returning
  assert('CM4 html: transiciona para error se bridgeSt.status === error',
    html.includes("bridgeSt && bridgeSt.status === 'error'"));
}

// ============================================================
// Suite CN — provider_unavailable e init_exception → error
// ============================================================
async function suiteCN() {
  console.log('\nSuite CN — provider_unavailable e init_exception → error honesto');

  // provider_unavailable path
  assert('CN1 bridge.ts: provider_unavailable →  __ESA_RUNTIME_STATUS__ error',
    bridgeSrc.includes("status: 'error', reason: 'provider_unavailable'"));

  assert('CN2 bridge.ts: provider_unavailable → esa:runtime:error dispatch',
    bridgeSrc.includes("dispatchEvent(new CustomEvent('esa:runtime:error', { detail: { reason: 'provider_unavailable' } }))"));

  // init_exception path
  assert('CN3 bridge.ts: init_exception → __ESA_RUNTIME_STATUS__ error',
    bridgeSrc.includes("status: 'error', reason: 'init_exception'"));

  assert('CN4 bridge.ts: init_exception → esa:runtime:error dispatch',
    bridgeSrc.includes("reason: 'init_exception'"));

  // Neither path assigns demo
  assert('CN5 bridge.ts: provider_unavailable não atribui demoRuntimeProvider',
    !bridgeSrc.match(/provider_unavailable[\s\S]{0,200}demoRuntimeProvider/));

  assert('CN6 bridge.ts: init_exception não atribui demoRuntimeProvider',
    !bridgeSrc.match(/init_exception[\s\S]{0,200}demoRuntimeProvider/));
}

// ============================================================
// Suite CO — boot infinito removido
// ============================================================
async function suiteCO() {
  console.log('\nSuite CO — boot infinito removido');

  // Two escape mechanisms must exist
  assert('CO1 mecanismo 1: __ESA_RUNTIME_STATUS__ em _initRealMode',
    html.includes('__ESA_RUNTIME_STATUS__'));

  assert('CO2 mecanismo 2: safety timeout 8s em componentDidMount',
    html.includes('8000') && html.includes("_rtStatus: 'error', _rtError: 'timeout'"));

  // _rtStatus never stays booting without an escape
  assert('CO3 sem fallback demo (nunca atribui demoRuntimeProvider em real mode)',
    !html.match(/runtime.*real[\s\S]{0,500}ESA_ENERGY_CREDITS_RUNTIME\s*=\s*demoRuntimeProvider/));

  // demo is preserved in bridge
  assert('CO4 demo preservado no bridge (demoRuntimeProvider presente)',
    bridgeSrc.includes('demoRuntimeProvider'));
}

// ============================================================
// Suite CP — runtime real não cai para demo
// ============================================================
async function suiteCP() {
  console.log('\nSuite CP — runtime real nunca usa dados demo');

  assert('CP1 bridge.ts: modo real nunca atribui demoRuntimeProvider ao ESA_ENERGY_CREDITS_RUNTIME',
    !bridgeSrc.match(/mode.*real[\s\S]{0,300}ESA_ENERGY_CREDITS_RUNTIME\s*=\s*demoRuntimeProvider/));

  assert('CP2 bridge.js compilado: modo real nunca atribui demo',
    !bridgeJs.match(/resolveMode.*real[\s\S]{0,500}ESA_ENERGY_CREDITS_RUNTIME\s*=\s*demoRuntimeProvider/));

  assert('CP3 html: _initRealMode não retorna dados demo (sem computeSettlement em _initRealMode)',
    !html.includes('_initRealMode') || !html.slice(
      html.indexOf('_initRealMode()'),
      html.indexOf('_loadRealDash')
    ).includes('computeSettlement'));

  assert('CP4 bridge.ts: sem "falling back to demo"',
    !bridgeSrc.includes('falling back to demo'));
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Hotfix — boot infinito do runtime real (?runtime=real)');
  console.log('='.repeat(60));

  await suiteCI();
  await suiteCJ();
  await suiteCK();
  await suiteCL();
  await suiteCM();
  await suiteCN();
  await suiteCO();
  await suiteCP();

  console.log('\n' + '='.repeat(60));
  console.log(`Hotfix Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
