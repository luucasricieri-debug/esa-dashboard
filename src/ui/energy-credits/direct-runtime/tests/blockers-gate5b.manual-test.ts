// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 5B — Pre-Main Blocker Fixes
// Verifica que os três bloqueadores foram corretamente removidos:
//   BR1 — support.js agora serve de assets/energy-credits-runtime/
//   BR2 — bridge nunca usa demo como fallback silencioso em ?runtime=real
//   BR3 — impRestart reseta impUbId para "" (não "UB-001")
// Rodar: npx tsx tests/blockers-gate5b.manual-test.ts
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// ============================================================
// Suite BR1 — support.js movido para assets de produção
// ============================================================
async function suiteBR1() {
  console.log('\nSuite BR1 — support.js em assets/energy-credits-runtime/');

  const assetPath = path.join(ROOT, 'assets/energy-credits-runtime/support.js');
  const docPath = path.join(ROOT, 'docs/design-reference/energy-credits-claude-design/support.js');

  assert('BR1-1 assets/energy-credits-runtime/support.js existe', fs.existsSync(assetPath));
  assert('BR1-2 docs/support.js original preservado (não removido)', fs.existsSync(docPath));

  if (fs.existsSync(assetPath) && fs.existsSync(docPath)) {
    const assetSize = fs.statSync(assetPath).size;
    const docSize = fs.statSync(docPath).size;
    assert('BR1-3 tamanho idêntico (cópia fiel)', assetSize === docSize);
    assert('BR1-4 arquivo não vazio (>0 bytes)', assetSize > 0);
  }

  const htmlPath = path.join(ROOT, 'energy-credits-v2.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert('BR1-5 energy-credits-v2.html carrega support.js de /assets/', html.includes('/assets/energy-credits-runtime/support.js'));
  assert('BR1-6 energy-credits-v2.html NÃO carrega support.js de /docs/', !html.includes('/docs/design-reference/energy-credits-claude-design/support.js'));
}

// ============================================================
// Suite BR2 — bridge não usa demo como fallback em ?runtime=real
// ============================================================
async function suiteBR2() {
  console.log('\nSuite BR2 — bridge: sem fallback silencioso para demo em modo real');

  const bridgeSrc = path.join(__dirname, '../bridge/runtimeBridge.ts');
  const bridgeDist = path.join(ROOT, 'assets/energy-credits-runtime/bridge.js');

  const src = fs.readFileSync(bridgeSrc, 'utf8');
  const dist = fs.readFileSync(bridgeDist, 'utf8');

  // Source checks
  assert('BR2-1 resolveRealProvider retorna null (não demoRuntimeProvider) quando provider ausente',
    src.includes('return null') && !src.match(/return demoRuntimeProvider/));

  assert('BR2-2 initBridge despacha esa:runtime:error quando provider null',
    src.includes("esa:runtime:error") && src.includes("provider_unavailable"));

  assert('BR2-3 nenhum "falling back to demo" no source',
    !src.includes('falling back to demo'));

  assert('BR2-4 IIFE captura erro e despacha esa:runtime:error (não silencioso)',
    src.includes('esa:runtime:error') && src.includes('init_exception'));

  // Dist checks (compiled output)
  assert('BR2-5 bridge.js compilado não contém "falling back to demo"',
    !dist.includes('falling back to demo'));

  assert('BR2-6 bridge.js compilado contém esa:runtime:error',
    dist.includes('esa:runtime:error'));

  // Contract: no assignment of demoRuntimeProvider when real is requested
  // The IIFE synchronous path assigns demo ONLY when resolveMode() === 'demo'
  const iifeSection = src.slice(src.lastIndexOf('if (resolveMode()'));
  assert('BR2-7 IIFE só atribui demoRuntimeProvider na branch demo',
    iifeSection.includes("resolveMode() === 'demo'") &&
    iifeSection.indexOf('demoRuntimeProvider') < iifeSection.indexOf('else'));
}

// ============================================================
// Suite BR3 — impRestart reseta impUbId para ""
// ============================================================
async function suiteBR3() {
  console.log('\nSuite BR3 — impRestart: impUbId reseta para "" e não "UB-001"');

  const htmlPath = path.join(ROOT, 'energy-credits-v2.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Find the impRestart definition
  const impRestartIdx = html.indexOf('impRestart:');
  assert('BR3-1 impRestart existe no arquivo', impRestartIdx !== -1);

  if (impRestartIdx !== -1) {
    const snippet = html.slice(impRestartIdx, impRestartIdx + 500);
    assert('BR3-2 impRestart define impUbId: ""', snippet.includes('impUbId: ""'));
    assert('BR3-3 impRestart NÃO define impUbId: "UB-001"', !snippet.includes('impUbId: "UB-001"'));
  }
}

// ============================================================
// Suite BR4 — estado _rtStatus e _rtError existem
// ============================================================
async function suiteBR4() {
  console.log('\nSuite BR4 — energy-credits-v2.html: estado _rtStatus/_rtError e handler de erro');

  const htmlPath = path.join(ROOT, 'energy-credits-v2.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert('BR4-1 estado _rtStatus presente', html.includes('_rtStatus'));
  assert('BR4-2 estado _rtError presente', html.includes('_rtError'));
  assert('BR4-3 _rtStatus inicializa como "booting" para ?runtime=real', html.includes("'booting'"));
  assert('BR4-4 _rtStatus inicializa como "ready" para demo', html.includes("'ready'"));

  assert('BR4-5 _handleRuntimeError definido', html.includes('_handleRuntimeError'));
  assert('BR4-6 listener esa:runtime:error registrado no componentDidMount',
    html.includes('"esa:runtime:error"') && html.includes('_handleRuntimeError'));

  assert('BR4-7 isRtBooting definido em renderVals', html.includes('isRtBooting'));
  assert('BR4-8 isRtError definido em renderVals', html.includes('isRtError'));
  assert('BR4-9 isRtOverride gate aplicado em isDashboard',
    html.includes('isRtOverride') && html.includes('!isRtOverride'));

  assert('BR4-10 tela de booting presente no template', html.includes('Inicializando runtime de créditos'));
  assert('BR4-11 tela de erro presente no template', html.includes('Runtime indisponível'));
  assert('BR4-12 botão "Tentar novamente" presente', html.includes('Tentar novamente'));
  assert('BR4-13 botão "← Dashboard ESA" presente no estado de erro', html.includes('← Dashboard ESA'));

  assert('BR4-14 _initRealMode define _rtStatus: "ready" no sucesso',
    html.includes('_rtStatus: "ready"') || html.includes("_rtStatus: 'ready'"));
  assert('BR4-15 _initRealMode define _rtStatus: "error" no catch',
    html.includes('_rtStatus: "error"') || html.includes("_rtStatus: 'error'"));
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Gate 5B — Remoção dos Bloqueadores Pré-Main');
  console.log('='.repeat(60));

  await suiteBR1();
  await suiteBR2();
  await suiteBR3();
  await suiteBR4();

  console.log('\n' + '='.repeat(60));
  console.log(`Gate 5B Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
