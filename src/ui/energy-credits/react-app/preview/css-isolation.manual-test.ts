/**
 * css-isolation.manual-test.ts
 *
 * Testes estruturais de isolamento CSS, fullscreen e modo imersivo.
 * Executa com: npx tsx preview/css-isolation.manual-test.ts
 *
 * Não requer DOM — verifica propriedades estáticas do código-fonte.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n── ${title} ──`);
}

function readSrc(relPath: string): string {
  const abs = path.resolve(__dirname, '..', relPath);
  return fs.readFileSync(abs, 'utf8');
}

function readRoot(relPath: string): string {
  const abs = path.resolve(__dirname, '../../../../../', relPath);
  return fs.readFileSync(abs, 'utf8');
}

// ── Suite A: index.css namespace ──────────────────────────────────────────────

section('Suite A — CSS Namespace Reset em index.css');

const indexCss = readSrc('src/index.css');

ok('namespace âncora no id do host', indexCss.includes('#esa-energy-credits-react-root'));
ok('font-family definido no namespace', indexCss.includes('font-family: ui-sans-serif') || indexCss.includes('font-family:ui-sans-serif'));
ok('font-size: 14px no namespace', indexCss.includes('font-size: 14px'));
ok('reset de button no namespace', indexCss.includes('#esa-energy-credits-react-root button'));
ok('reset de input no namespace', indexCss.includes('#esa-energy-credits-react-root input'));
ok('reset de select no namespace', indexCss.includes('#esa-energy-credits-react-root select'));
ok('reset de textarea no namespace', indexCss.includes('#esa-energy-credits-react-root textarea'));
ok('box-sizing: border-box no namespace', indexCss.includes('box-sizing: border-box'));
ok('sem all:unset para .btn', !indexCss.includes('#esa-energy-credits-react-root .btn') || !indexCss.includes('all: unset'));
ok('sem all:unset para .card', !indexCss.includes('#esa-energy-credits-react-root .card') || !indexCss.includes('all: unset'));
ok('reset seguro com font:inherit', indexCss.includes('font: inherit'));
ok('sem zoom no namespace', !indexCss.includes('zoom:') && !indexCss.includes('zoom :'));
ok('sem transform scale no namespace', !indexCss.includes('transform: scale') && !indexCss.includes('transform:scale'));
ok('sem height:100% no host (altura gerenciada pelo fullscreen CSS)', !indexCss.includes('height: 100%') && !indexCss.includes('height:100%'));

// ── Suite B: Shell.tsx layout ─────────────────────────────────────────────────

section('Suite B — Shell.tsx layout fixes');

const shellTsx = readSrc('src/components/esa/Shell.tsx');

ok('Shell aceita prop onExit', shellTsx.includes('onExit?: () => void') || shellTsx.includes('onExit?:'));
ok('container raiz usa h-full (não min-h-screen)', shellTsx.includes('"flex h-full'));
ok('min-h-screen removido do container raiz', !shellTsx.includes('min-h-screen'));
ok('painel direito tem min-h-0', shellTsx.includes('flex-col min-w-0 min-h-0'));
ok('main tem overflow-y-auto', shellTsx.includes('overflow-y-auto'));
ok('main tem overflow-x-auto (não hidden)', shellTsx.includes('overflow-x-auto'));
ok('main tem min-h-0 para flex correto', shellTsx.includes('flex-1 min-h-0'));
ok('botão de volta usa ArrowLeft', shellTsx.includes('ArrowLeft'));
ok('botão de volta chama onExit', shellTsx.includes('onClick={onExit}'));
ok('botão de volta condicional (onExit &&)', shellTsx.includes('{onExit &&'));

// ── Suite C: mountEnergyCreditsReactApp.tsx passa onExit ─────────────────────

section('Suite C — mountEnergyCreditsReactApp passa onExit ao Shell');

const mountTsx = readSrc('src/mountEnergyCreditsReactApp.tsx');

ok('onExit passado ao Shell', mountTsx.includes('onExit={options?.onExit}'));
ok('Shell recebe prop onExit', mountTsx.includes('<Shell onExit='));

// ── Suite D: index.html fullscreen ────────────────────────────────────────────

section('Suite D — index.html fullscreen imersivo');

const indexHtml = readRoot('index.html');

ok('sem stray "A" antes do DOCTYPE', !indexHtml.startsWith('A<!DOCTYPE'));
ok('DOCTYPE correto', indexHtml.startsWith('<!DOCTYPE html>') || indexHtml.trimStart().startsWith('<!DOCTYPE html>'));
ok('host tem position:fixed no modo imersivo', indexHtml.includes('position:fixed!important'));
ok('host tem inset:0 no modo imersivo', indexHtml.includes('inset:0!important'));
ok('host tem width:100vw no modo imersivo', indexHtml.includes('width:100vw!important'));
ok('host tem height:100vh no modo imersivo', indexHtml.includes('height:100vh!important'));
ok('host tem z-index alto no modo imersivo', indexHtml.includes('z-index:9000') || indexHtml.includes('z-index: 9000'));
ok('host tem overflow:hidden no modo imersivo', indexHtml.includes('overflow:hidden!important'));
ok('host tem background-color no modo imersivo', indexHtml.includes('background-color:#f6f8f6!important'));
ok('host tem display:block no modo imersivo', indexHtml.includes('display:block!important'));
ok('sem flex:1 em .main (abordagem fullscreen, não flex column)', !indexHtml.includes('flex:1 1 0'));
ok('sem dependência de .topbar para dimensionar host', !indexHtml.includes('esa-energy-credits-active .topbar{flex-shrink'));
ok('sem zoom em CSS imersivo', !(indexHtml.match(/esa-energy-credits-active[^}]*zoom/s)));
ok('sem transform scale em CSS imersivo', !(indexHtml.match(/esa-energy-credits-active[^}]*transform:scale/s)));

// ── Suite E: sem zoom/transform scale em arquivos React ──────────────────────

section('Suite E — sem zoom ou transform scale no código do módulo');

const filesToCheck = [
  'src/components/esa/Shell.tsx',
  'src/components/esa/views/Dashboard.tsx',
  'src/components/esa/views/Financial.tsx',
  'src/components/esa/views/Reports.tsx',
];

for (const f of filesToCheck) {
  const content = readSrc(f);
  ok(`sem zoom em ${path.basename(f)}`, !content.includes('zoom:'));
  ok(`sem transform scale em ${path.basename(f)}`, !content.includes('scale(') || content.includes('scaleX') || content.includes('scaleY'));
}

// ── Suite F: legacy bridge — onExit já passado ────────────────────────────────

section('Suite F — legacy-bridge.js já passa onExit');

const bridge = readRoot('src/ui/energy-credits/legacy-bridge.js');

ok('bridge passa onExit callback', bridge.includes('onExit:'));
ok('onExit navega para prosp', bridge.includes("goPage('prosp')"));
ok('bridge não manipula topbar diretamente', !bridge.includes('topbar') && !bridge.includes('.topbar'));

// ── Suite G: fullscreen — garantias de cobertura ─────────────────────────────

section('Suite G — garantias de cobertura fullscreen');

ok('z-index acima de 1000 no bloco imersivo (cobre modais legados)', (() => {
  const block = indexHtml.match(/esa-energy-credits-active[^{]*#esa-energy-credits-react-root\{([^}]+)\}/s)?.[1] ?? '';
  const match = block.match(/z-index:(\d+)/);
  if (!match) return false;
  return parseInt(match[1], 10) >= 1000;
})());
ok('fullscreen usa inset:0 (cobertura total de 4 cantos)', indexHtml.includes('inset:0!important'));
ok('fullscreen tem background próprio (não transparente)', indexHtml.includes('background-color:#f6f8f6!important'));
ok('fullscreen não depende de .main para posicionar', !indexHtml.match(/esa-energy-credits-active .main.*flex/));

// ── Suite H: audit doc criado ────────────────────────────────────────────────

section('Suite H — documentação de auditoria');

const auditDocPath = path.resolve(__dirname, '../../../../../docs/design-reference/energy-credits-claude-design/INTEGRATION-CSS-AUDIT.md');
ok('INTEGRATION-CSS-AUDIT.md existe', fs.existsSync(auditDocPath));

const auditDoc = fs.existsSync(auditDocPath) ? fs.readFileSync(auditDocPath, 'utf8') : '';
ok('audit doc tem seção fullscreen', auditDoc.includes('fullscreen') || auditDoc.includes('Fullscreen') || auditDoc.includes('fixed'));
ok('audit doc cobre all:unset', auditDoc.includes('all:unset') || auditDoc.includes('all: unset'));
ok('audit doc cobre namespace CSS', auditDoc.includes('Namespace') || auditDoc.includes('namespace'));

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed}  ✓ ${passed}  ✗ ${failed}`);
if (failed > 0) {
  process.exit(1);
}
