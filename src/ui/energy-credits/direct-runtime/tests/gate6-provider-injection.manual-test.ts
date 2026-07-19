// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 6 — Provider Injection (standalone bootstrap)
// Verifica que standaloneProviderBootstrap.ts inicializa o ESA Core
// e expõe EnergyCreditsUIProvider para o bridge.js via window.__ESA_UI_PROVIDER__.
// Rodar: npx tsx tests/gate6-provider-injection.manual-test.ts
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
const ROOT       = path.resolve(__dirname, '../../../../..');
const DRT        = path.resolve(__dirname, '..');

const bootstrapSrc  = fs.readFileSync(path.join(DRT, 'bootstrap/standaloneProviderBootstrap.ts'), 'utf8');
const bootstrapJs   = fs.readFileSync(path.join(ROOT, 'assets/energy-credits-runtime/provider-bootstrap.js'), 'utf8');
const bridgeSrc     = fs.readFileSync(path.join(DRT, 'bridge/runtimeBridge.ts'), 'utf8');
const bridgeJs      = fs.readFileSync(path.join(ROOT, 'assets/energy-credits-runtime/bridge.js'), 'utf8');
const html          = fs.readFileSync(path.join(ROOT, 'energy-credits-v2.html'), 'utf8');

// ============================================================
// Suite CQ — bootstrap source: estrutura e invariantes
// ============================================================
async function suiteCQ() {
  console.log('\nSuite CQ — bootstrap source: estrutura e invariantes');

  assert('CQ1 standaloneProviderBootstrap.ts existe',
    fs.existsSync(path.join(DRT, 'bootstrap/standaloneProviderBootstrap.ts')));

  assert('CQ2 importa ESA de core/app.js',
    bootstrapSrc.includes("from '../../../../core/app.js'"));

  assert('CQ3 importa EnergyCreditsUIProvider de energy-credits-ui-provider.js',
    bootstrapSrc.includes("from '../../energy-credits-ui-provider.js'"));

  assert('CQ4 chama ESA.initialize()',
    bootstrapSrc.includes('.initialize()'));

  assert('CQ5 atribui window.__ESA_UI_PROVIDER__',
    bootstrapSrc.includes('window.__ESA_UI_PROVIDER__ = provider'));

  assert('CQ6 atribui window.ESA_OS',
    bootstrapSrc.includes('window.ESA_OS = ESA'));

  assert('CQ7 dispara esa:ui-provider:ready no sucesso',
    bootstrapSrc.includes("'esa:ui-provider:ready'"));

  assert('CQ8 dispara esa:ui-provider:error na falha',
    bootstrapSrc.includes("'esa:ui-provider:error'"));

  assert('CQ9 grava __ESA_UI_PROVIDER_STATUS__ antes do evento',
    bootstrapSrc.indexOf('__ESA_UI_PROVIDER_STATUS__ = { status:') <
    bootstrapSrc.indexOf("'esa:ui-provider:ready'"));

  assert('CQ10 sem PII em logs (sem nome, documento ou chave)',
    !bootstrapSrc.includes('document') && !bootstrapSrc.includes('pixKey'));

  assert('CQ11 sem hardcode de credenciais',
    !bootstrapSrc.includes('apiKey') && !bootstrapSrc.includes('password') &&
    !bootstrapSrc.includes('token') && !bootstrapSrc.includes('secret'));

  assert('CQ12 não importa Firebase diretamente',
    !bootstrapSrc.includes('firebase') && !bootstrapSrc.includes('firestore'));
}

// ============================================================
// Suite CR — provider-bootstrap.js compilado: bundle correto
// ============================================================
async function suiteCR() {
  console.log('\nSuite CR — provider-bootstrap.js compilado: bundle correto');

  assert('CR1 provider-bootstrap.js existe',
    fs.existsSync(path.join(ROOT, 'assets/energy-credits-runtime/provider-bootstrap.js')));

  assert('CR2 bundle contém __ESA_UI_PROVIDER__',
    bootstrapJs.includes('__ESA_UI_PROVIDER__'));

  assert('CR3 bundle contém esa:ui-provider:ready',
    bootstrapJs.includes('esa:ui-provider:ready'));

  assert('CR4 bundle contém esa:ui-provider:error',
    bootstrapJs.includes('esa:ui-provider:error'));

  assert('CR5 bundle contém provider_initialized (log de sucesso)',
    bootstrapJs.includes('provider_initialized'));

  assert('CR6 bundle contém bootstrap_failed (log de falha)',
    bootstrapJs.includes('bootstrap_failed'));

  // __ESA_UI_PROVIDER_STATUS__ = ready must appear before esa:ui-provider:ready dispatch
  const statusReadyIdx  = bootstrapJs.indexOf('__ESA_UI_PROVIDER_STATUS__ = { status: "ready" }');
  const eventReadyIdx   = bootstrapJs.indexOf('"esa:ui-provider:ready"');
  assert('CR7 bundle: status ready gravado antes do evento ready',
    statusReadyIdx !== -1 && eventReadyIdx !== -1 && statusReadyIdx < eventReadyIdx);

  assert('CR8 bundle não usa demoRuntimeProvider',
    !bootstrapJs.includes('demoRuntimeProvider'));

  assert('CR9 bundle não contém import do Firebase (apenas ESA Core em memória)',
    !bootstrapJs.includes('initializeApp') && !bootstrapJs.includes('getFirestore'));
}

// ============================================================
// Suite CS — bridge.ts: tratamento de eventos de provider
// ============================================================
async function suiteCS() {
  console.log('\nSuite CS — bridge.ts: tratamento de eventos esa:ui-provider:*');

  assert('CS1 interface Window declara __ESA_UI_PROVIDER_STATUS__',
    bridgeSrc.includes("__ESA_UI_PROVIDER_STATUS__?: { status: 'ready' | 'error'; reason?: string }"));

  assert('CS2 interface Window declara __ESA_UI_PROVIDER_ERROR__',
    bridgeSrc.includes("__ESA_UI_PROVIDER_ERROR__?: { code: string; message: string }"));

  assert('CS3 bridge trata esa:ui-provider:ready',
    bridgeSrc.includes("'esa:ui-provider:ready'"));

  assert('CS4 bridge trata esa:ui-provider:error',
    bridgeSrc.includes("'esa:ui-provider:error'"));

  assert('CS5 listener de provider:ready usa { once: true }',
    bridgeSrc.includes("once: true"));

  assert('CS6 bridge verifica window.__ESA_UI_PROVIDER__ antes de chamar initBridge',
    bridgeSrc.includes('if (window.__ESA_UI_PROVIDER__)'));

  assert('CS7 bridge usa handleFatalError (não inline catch)',
    bridgeSrc.includes('handleFatalError'));

  // bridge.js compilado também deve ter os handlers
  assert('CS8 bridge.js compilado contém esa:ui-provider:error listener',
    bridgeJs.includes('esa:ui-provider:error'));

  assert('CS9 bridge.js compilado contém esa:ui-provider:ready listener',
    bridgeJs.includes('esa:ui-provider:ready'));

  assert('CS10 bridge.js compilado usa { once: true }',
    bridgeJs.includes('once: true'));
}

// ============================================================
// Suite CT — HTML: ordem de carregamento correta
// ============================================================
async function suiteCT() {
  console.log('\nSuite CT — HTML: ordem de carregamento support → bootstrap → bridge');

  assert('CT1 HTML carrega support.js',
    html.includes('support.js'));

  assert('CT2 HTML carrega provider-bootstrap.js',
    html.includes('provider-bootstrap.js'));

  assert('CT3 HTML carrega bridge.js',
    html.includes('bridge.js'));

  // Order: support < provider-bootstrap < bridge
  const supportIdx    = html.indexOf('support.js');
  const bootstrapIdx  = html.indexOf('provider-bootstrap.js');
  const bridgeIdx     = html.indexOf('bridge.js');

  assert('CT4 support.js antes de provider-bootstrap.js',
    supportIdx !== -1 && bootstrapIdx !== -1 && supportIdx < bootstrapIdx);

  assert('CT5 provider-bootstrap.js antes de bridge.js',
    bootstrapIdx !== -1 && bridgeIdx !== -1 && bootstrapIdx < bridgeIdx);

  // All three must be synchronous IIFE scripts (no type="module")
  const supportLine    = html.slice(html.lastIndexOf('\n', supportIdx), html.indexOf('>', supportIdx) + 1);
  const bootstrapLine  = html.slice(html.lastIndexOf('\n', bootstrapIdx), html.indexOf('>', bootstrapIdx) + 1);
  const bridgeLine     = html.slice(html.lastIndexOf('\n', bridgeIdx), html.indexOf('>', bridgeIdx) + 1);

  assert('CT6 support.js é script síncrono (sem type=module)',
    !supportLine.includes('type="module"') && !supportLine.includes("type='module'"));

  assert('CT7 provider-bootstrap.js é script síncrono (sem type=module)',
    !bootstrapLine.includes('type="module"') && !bootstrapLine.includes("type='module'"));

  assert('CT8 bridge.js é script síncrono (sem type=module)',
    !bridgeLine.includes('type="module"') && !bridgeLine.includes("type='module'"));
}

// ============================================================
// Suite CU — injeção de provider: end-to-end sem Firebase
// ============================================================
async function suiteCU() {
  console.log('\nSuite CU — injeção de provider: end-to-end com Core em memória');

  function makeUIProvider(): Parameters<typeof createEsaRuntimeProvider>[0] {
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

  // createEsaRuntimeProvider accepts the UIProvider shape (same contract as ESAUIProvider)
  const rt = createEsaRuntimeProvider(makeUIProvider());
  assert('CU1 createEsaRuntimeProvider aceita UIProvider — mode === "real"', rt.mode === 'real');

  let listUgsOk = false;
  try { const ugs = await rt.listGeneratingUnits(); listUgsOk = Array.isArray(ugs); } catch {}
  assert('CU2 listGeneratingUnits retorna array (Core em memória vazio)', listUgsOk);

  let listMonthsOk = false;
  try { const ms = await rt.listMonths(); listMonthsOk = Array.isArray(ms); } catch {}
  assert('CU3 listMonths retorna array (Core em memória vazio)', listMonthsOk);

  let dashOk = false;
  try {
    const d = await rt.getDashboardData({ month: '2026-07' });
    dashOk = d !== undefined && d.current.generation === 0;
  } catch {}
  assert('CU4 getDashboardData retorna zeros (Core vazio, sem dados fictícios)', dashOk);

  assert('CU5 modo "real" ativo — sem fallback para demo',
    rt.mode === 'real');
}

// ============================================================
// Suite CV — invariantes de segurança do bootstrap
// ============================================================
async function suiteCV() {
  console.log('\nSuite CV — invariantes de segurança do bootstrap');

  assert('CV1 bootstrap não contém demoRuntimeProvider',
    !bootstrapSrc.includes('demoRuntimeProvider'));

  assert('CV2 bootstrap não contém calculationMemory',
    !bootstrapSrc.includes('calculationMemory'));

  assert('CV3 bootstrap não contém credenciais hardcoded',
    !bootstrapSrc.match(/apiKey\s*[:=]|password\s*[:=]|secret\s*[:=]/i));

  assert('CV4 bootstrap não cria login paralelo (sem createUserWithEmailAndPassword)',
    !bootstrapSrc.includes('createUserWithEmailAndPassword'));

  assert('CV5 bootstrap não ignora autorização (sem setSecurityRules)',
    !bootstrapSrc.includes('setSecurityRules'));

  assert('CV6 bridge.ts não introduziu demo fallback no modo real',
    !bridgeSrc.match(/mode.*real[\s\S]{0,500}ESA_ENERGY_CREDITS_RUNTIME\s*=\s*demoRuntimeProvider/));

  assert('CV7 bridge.js compilado não introduziu demo fallback no modo real',
    !bridgeJs.match(/resolveMode.*real[\s\S]{0,500}ESA_ENERGY_CREDITS_RUNTIME\s*=\s*demoRuntimeProvider/));
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Gate 6 — Injeção de Provider Real no Runtime Standalone');
  console.log('='.repeat(60));

  await suiteCQ();
  await suiteCR();
  await suiteCS();
  await suiteCT();
  await suiteCU();
  await suiteCV();

  console.log('\n' + '='.repeat(60));
  console.log(`Gate 6 Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
