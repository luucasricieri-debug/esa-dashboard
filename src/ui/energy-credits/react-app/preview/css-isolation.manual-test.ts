/**
 * css-isolation.manual-test.ts
 *
 * Testes estruturais de isolamento CSS e modo imersivo.
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
  const abs = path.resolve(__dirname, '../../../../..', relPath);
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
ok('all: unset para .btn', indexCss.includes('#esa-energy-credits-react-root .btn'));
ok('all: unset para .card', indexCss.includes('#esa-energy-credits-react-root .card'));
ok('all: unset para .badge', indexCss.includes('#esa-energy-credits-react-root .badge'));
ok('all: unset para .tab', indexCss.includes('#esa-energy-credits-react-root .tab'));
ok('sem zoom no namespace', !indexCss.includes('zoom:') && !indexCss.includes('zoom :'));
ok('sem transform scale no namespace', !indexCss.includes('transform: scale') && !indexCss.includes('transform:scale'));

// ── Suite B: Shell.tsx layout ─────────────────────────────────────────────────

section('Suite B — Shell.tsx layout fixes');

const shellTsx = readSrc('src/components/esa/Shell.tsx');

ok('Shell aceita prop onExit', shellTsx.includes('onExit?: () => void') || shellTsx.includes('onExit?:') );
ok('container raiz usa h-full (não min-h-screen)', shellTsx.includes('"flex h-full'));
ok('min-h-screen removido do container raiz', !shellTsx.includes('min-h-screen'));
ok('main tem overflow-y-auto', shellTsx.includes('overflow-y-auto'));
ok('botão de volta usa ArrowLeft', shellTsx.includes('ArrowLeft'));
ok('botão de volta chama onExit', shellTsx.includes('onClick={onExit}'));
ok('botão de volta condicional (onExit &&)', shellTsx.includes('{onExit &&'));

// ── Suite C: mountEnergyCreditsReactApp.tsx passa onExit ─────────────────────

section('Suite C — mountEnergyCreditsReactApp passa onExit ao Shell');

const mountTsx = readSrc('src/mountEnergyCreditsReactApp.tsx');

ok('onExit passado ao Shell', mountTsx.includes('onExit={options?.onExit}'));
ok('Shell recebe prop onExit', mountTsx.includes('<Shell onExit='));

// ── Suite D: index.html modo imersivo ────────────────────────────────────────

section('Suite D — index.html modo imersivo');

const indexHtml = readRoot('index.html');

ok('topbar oculto no modo imersivo', indexHtml.includes('esa-energy-credits-active .topbar{display:none!important}') ||
   indexHtml.includes('esa-energy-credits-active .topbar { display:none!important }') ||
   indexHtml.includes('.topbar{display:none!important}'));
ok('host tem overflow:hidden no modo imersivo', indexHtml.includes('#esa-energy-credits-react-root{') && indexHtml.includes('overflow:hidden'));
ok('host tem flex:1 no modo imersivo', indexHtml.includes('flex:1 1 0'));
ok('host tem height:auto!important', indexHtml.includes('height:auto!important'));
ok('.main tem height:100vh no modo imersivo', indexHtml.includes('height:100vh'));
ok('#content oculto no modo imersivo', indexHtml.includes('#content{display:none}'));
ok('#sidebar oculto no modo imersivo', indexHtml.includes('#sidebar{display:none}'));
ok('sem zoom em .main', !(indexHtml.match(/esa-energy-credits-active.*zoom/s)));
ok('sem transform scale em .main', !(indexHtml.match(/esa-energy-credits-active.*transform:scale/s)));

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
  ok(`sem zoom em ${path.basename(f)}`, !content.includes('zoom:') && !content.includes('zoom:'));
  ok(`sem transform scale em ${path.basename(f)}`, !content.includes('scale(') || content.includes('scaleX') || content.includes('scaleY'));
}

// ── Suite F: legacy bridge — onExit já passado ────────────────────────────────

section('Suite F — legacy-bridge.js já passa onExit');

const bridge = readRoot('src/ui/energy-credits/legacy-bridge.js');

ok('bridge passa onExit callback', bridge.includes('onExit:'));
ok('onExit navega para prosp', bridge.includes("goPage('prosp')"));
ok('bridge não foi alterado nesta missão (sem referência a topbar)', !bridge.includes('topbar'));

// ── Suite G: audit doc criado ────────────────────────────────────────────────

section('Suite G — documentação de auditoria');

const auditDocPath = path.resolve(__dirname, '../../../../../docs/design-reference/energy-credits-claude-design/INTEGRATION-CSS-AUDIT.md');
ok('INTEGRATION-CSS-AUDIT.md existe', fs.existsSync(auditDocPath));

const auditDoc = fs.existsSync(auditDocPath) ? fs.readFileSync(auditDocPath, 'utf8') : '';
ok('audit doc cobre conflito de topbar duplo', auditDoc.includes('headers visíveis') || auditDoc.includes('Dois headers'));
ok('audit doc cobre min-h-screen', auditDoc.includes('min-h-screen'));
ok('audit doc cobre namespace CSS', auditDoc.includes('Namespace') || auditDoc.includes('namespace'));
ok('audit doc cobre Tailwind preflight', auditDoc.includes('Tailwind') && auditDoc.includes('preflight') || auditDoc.includes('@layer base'));

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed}  ✓ ${passed}  ✗ ${failed}`);
if (failed > 0) {
  process.exit(1);
}
