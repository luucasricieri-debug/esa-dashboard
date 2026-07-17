/**
 * Structural assertions that guarantee Tailwind CSS loads correctly in preview mode.
 *
 * Run: npx tsx preview/css-loading.manual-test.ts
 * (from src/ui/energy-credits/design-app/)
 */

import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf-8');
}

let passed = 0;
let failed = 0;

function ok(label: string, value: boolean) {
  if (value) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ── Suite A: preview/main.tsx ──────────────────────────────────────────────
console.log('\nSuite A — preview/main.tsx');
const mainTsx = read('preview/main.tsx');
ok('importa src/styles/index.css', mainTsx.includes("'../src/styles/index.css'"));
ok('aplica classe esa-credits-design-app no root', mainTsx.includes('esa-credits-design-app'));
ok('monta via createRoot', mainTsx.includes('createRoot'));

// ── Suite B: src/styles/index.css ─────────────────────────────────────────
console.log('\nSuite B — src/styles/index.css');
const css = read('src/styles/index.css');
ok('contém @import "tailwindcss"', css.includes('@import "tailwindcss"'));
ok('contém @source "../" para escanear src/', css.includes('@source "../"'));
ok('contém @source "../../preview" para escanear preview/', css.includes('@source "../../preview"'));
ok('define bloco .esa-credits-design-app', css.includes('.esa-credits-design-app'));
ok('aplica position:fixed no host fullscreen', css.includes('position: fixed'));
ok('aplica z-index >= 9000', (() => {
  const m = css.match(/\.esa-credits-design-app\s*\{[^}]+z-index:\s*(\d+)/s);
  return m ? parseInt(m[1], 10) >= 9000 : false;
})());

// ── Suite C: vite.design.config.ts ────────────────────────────────────────
console.log('\nSuite C — vite.design.config.ts');
const viteConfig = read('vite.design.config.ts');
ok('importa @tailwindcss/vite', viteConfig.includes("from '@tailwindcss/vite'"));
ok('inclui tailwindcss() nos plugins', viteConfig.includes('tailwindcss()'));
ok('root em serve mode NÃO aponta para preview/', !viteConfig.includes("root: path.resolve(__dirname, 'preview')"));
ok('serve mode usa root: __dirname', (() => {
  // Extract the if (command === 'serve') { ... } block by matching its closing } at 2-space indent
  const serveIfBlock = viteConfig.match(/if \(command === 'serve'\) \{([^]*?)\n  \}/)?.[1] ?? '';
  return serveIfBlock.includes('__dirname');
})());
ok('define process.env.NODE_ENV apenas no build', (() => {
  const serveIfBlock = viteConfig.match(/if \(command === 'serve'\) \{([^]*?)\n  \}/)?.[1] ?? '';
  return !serveIfBlock.includes('process.env.NODE_ENV');
})());

// ── Suite D: preview/index.html ───────────────────────────────────────────
console.log('\nSuite D — preview/index.html');
const html = read('preview/index.html');
ok('tem div#root', html.includes('id="root"'));
ok('carrega main.tsx como módulo ES', html.includes('src="./main.tsx"') && html.includes('type="module"'));

// ── Resultado ─────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} assertions — ${passed} passou, ${failed} falhou\n`);
if (failed > 0) process.exit(1);
