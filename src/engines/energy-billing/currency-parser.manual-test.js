/**
 * ESA OS — Manual Test: Currency Parser
 * node src/engines/energy-billing/currency-parser.manual-test.js
 */

import { parseCurrency, parseKwhPrice } from './currency-parser.js';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

// ── 1. Formato pt-BR (vírgula decimal) ───────────────────────────────────────
group('1. pt-BR — vírgula como separador decimal');
assert('1.1 0,60 → 0.60',       parseCurrency('0,60')    === 0.60);
assert('1.2 0,60 NÃO é 60.00',  parseCurrency('0,60')    !== 60.00);
assert('1.3 1,50 → 1.50',       parseCurrency('1,50')    === 1.50);
assert('1.4 0,45 → 0.45',       parseCurrency('0,45')    === 0.45);
assert('1.5 1.234,56 → 1234.56', parseCurrency('1.234,56') === 1234.56);
assert('1.6 1.250,50 → 1250.50', parseCurrency('1.250,50') === 1250.50);
assert('1.7 10.000,00 → 10000',  parseCurrency('10.000,00') === 10000.00);

// ── 2. Formato US (ponto decimal) ─────────────────────────────────────────────
group('2. US — ponto como separador decimal');
assert('2.1 0.60 → 0.60',       parseCurrency('0.60')    === 0.60);
assert('2.2 1.50 → 1.50',       parseCurrency('1.50')    === 1.50);
assert('2.3 1,234.56 → 1234.56', parseCurrency('1,234.56') === 1234.56);
assert('2.4 1,250.50 → 1250.50', parseCurrency('1,250.50') === 1250.50);

// ── 3. Prefixo R$ ─────────────────────────────────────────────────────────────
group('3. Prefixo R$');
assert('3.1 R$ 0,60 → 0.60',    parseCurrency('R$ 0,60')   === 0.60);
assert('3.2 R$ 1.234,56',        parseCurrency('R$ 1.234,56') === 1234.56);
assert('3.3 R$0,60 (sem espaço)', parseCurrency('R$0,60')   === 0.60);
assert('3.4 R$ 177,19 → 177.19', parseCurrency('R$ 177,19') === 177.19);
assert('3.5 R$ 0.60 → 0.60',    parseCurrency('R$ 0.60')   === 0.60);

// ── 4. Valores inteiros ────────────────────────────────────────────────────────
group('4. Valores inteiros');
assert('4.1 100 → 100',    parseCurrency('100')   === 100);
assert('4.2 500 → 500',    parseCurrency(500)     === 500);
assert('4.3 0 → 0',        parseCurrency('0')     === 0);

// ── 5. Casos de borda ─────────────────────────────────────────────────────────
group('5. Casos de borda');
assert('5.1 null → null',  parseCurrency(null)    === null);
assert('5.2 "" → null',    parseCurrency('')      === null);
assert('5.3 "abc" → null', parseCurrency('abc')   === null);
assert('5.4 undefined → null', parseCurrency(undefined) === null);

// ── 6. Ponto como milhar (sem vírgula) ────────────────────────────────────────
group('6. Ponto como separador de milhar isolado');
assert('6.1 1.000 → 1000 (3 digits after dot)', parseCurrency('1.000') === 1000);
assert('6.2 10.000 → 10000',                     parseCurrency('10.000') === 10000);
assert('6.3 1.5 → 1.5 (1 digit after dot)',       parseCurrency('1.5')   === 1.5);
assert('6.4 1.50 → 1.50 (2 digits after dot)',    parseCurrency('1.50')  === 1.50);

// ── 7. parseKwhPrice — foco no 0,60 ──────────────────────────────────────────
group('7. parseKwhPrice — regra crítica 0,60 = R$ 0.60/kWh');
assert('7.1 "0,60" → 0.60',    parseKwhPrice('0,60')     === 0.60);
assert('7.2 "0.60" → 0.60',    parseKwhPrice('0.60')     === 0.60);
assert('7.3 "R$ 0,60" → 0.60', parseKwhPrice('R$ 0,60')  === 0.60);
assert('7.4 421 × 0,60 = 252.60', 421 * parseKwhPrice('0,60') === 252.60);
assert('7.5 421 × 0,60 ≠ 25260',  421 * parseKwhPrice('0,60') !== 25260);
assert('7.6 0,558035 → 0.558035', parseKwhPrice('0,558035') === 0.558035);
assert('7.7 0,678724 → 0.678724', parseKwhPrice('0,678724') === 0.678724);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
