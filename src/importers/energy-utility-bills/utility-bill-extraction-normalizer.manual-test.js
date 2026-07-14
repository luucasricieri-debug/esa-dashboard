/**
 * ESA OS — Tests / Energy Utility Bills
 * utility-bill-extraction-normalizer.manual-test.js
 */

import { UtilityBillExtractionNormalizer } from './utility-bill-extraction-normalizer.js';

const _norm = new UtilityBillExtractionNormalizer();
function normalizeUtilityBillExtraction(raw) { return _norm.normalize(raw); }

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ── Suite 1: campos básicos ───────────────────────────────────────────────────

console.log('\n[1] Normalização de campos básicos');

{
  const result = normalizeUtilityBillExtraction({
    uc: ' 1234-5 ',
    referenceMonth: '2025-06',
    utilityCompany: 'COPEL',
    monthlyConsumptionKwh: '250,5',
    totalUtilityBillAmount: 'R$ 350,00',
  });
  assert('ok=true para entrada válida', result.ok);
  assert('uc normalizada (sem espaços, sem hífen, maiúsculo)', result.data.uc === '12345');
  assert('ucOriginal preservado com trim', result.data.ucOriginal === '1234-5');
  assert('referenceMonth preservado', result.data.referenceMonth === '2025-06');
  assert('monthlyConsumptionKwh parseado', result.data.monthlyConsumptionKwh === 250.5);
  assert('totalUtilityBillAmount parseado (sem R$)', result.data.totalUtilityBillAmount === 350);
}

// ── Suite 2: normalização de UC ───────────────────────────────────────────────

console.log('\n[2] Normalização de UC');

{
  const cases = [
    [' 123 456 ', '123456'],
    ['AB-CD/EF.GH', 'ABCDEFGH'],
    ['abc-123', 'ABC123'],
    ['  ', ''],
  ];
  for (const [input, expected] of cases) {
    const result = normalizeUtilityBillExtraction({ uc: input, referenceMonth: '2025-01' });
    assert(`UC "${input}" → "${expected}"`, result.ok && result.data.uc === expected);
  }
}

// ── Suite 3: normalização de referenceMonth ───────────────────────────────────

console.log('\n[3] Normalização de referenceMonth');

{
  const cases = [
    ['2025-06', '2025-06'],
    ['06/2025', '2025-06'],
    ['2025/06', '2025-06'],
  ];
  for (const [input, expected] of cases) {
    const result = normalizeUtilityBillExtraction({ uc: 'UC1', referenceMonth: input });
    assert(`referenceMonth "${input}" → "${expected}"`, result.ok && result.data.referenceMonth === expected);
  }
}

// ── Suite 4: customerDocument ─────────────────────────────────────────────────

console.log('\n[4] Normalização de customerDocument');

{
  const result = normalizeUtilityBillExtraction({
    uc: 'UC001',
    referenceMonth: '2025-06',
    customerDocument: '123.456.789-00',
  });
  assert('customerDocument original preservado', result.data.customerDocument === '123.456.789-00');
  assert('customerDocumentDigits somente dígitos', result.data.customerDocumentDigits === '12345678900');
}

// ── Suite 5: ID determinístico ────────────────────────────────────────────────

console.log('\n[5] ID determinístico');

{
  const r1 = normalizeUtilityBillExtraction({ uc: 'UC-001', referenceMonth: '2025-06', utilityCompany: 'COPEL' });
  const r2 = normalizeUtilityBillExtraction({ uc: 'UC-001', referenceMonth: '2025-06', utilityCompany: 'COPEL' });
  assert('ID gerado existe', typeof r1.data.id === 'string' && r1.data.id.length > 0);
  assert('ID determinístico (mesma entrada → mesmo id)', r1.data.id === r2.data.id);
  assert('ID começa com utility-bill-', r1.data.id.startsWith('utility-bill-'));
}

// ── Suite 6: ID fornecido mantido ─────────────────────────────────────────────

console.log('\n[6] ID fornecido pelo caller mantido');

{
  const result = normalizeUtilityBillExtraction({
    id: 'my-custom-id',
    uc: 'UC001',
    referenceMonth: '2025-06',
  });
  assert('ID fornecido preservado', result.data.id === 'my-custom-id');
}

// ── Suite 7: campos sensíveis removidos ──────────────────────────────────────

console.log('\n[7] Campos sensíveis removidos');

{
  const result = normalizeUtilityBillExtraction({
    uc: 'UC001',
    referenceMonth: '2025-06',
    password: 'segredo',
    apiKey: 'abc123',
    fileBase64: 'base64content',
    pdfContent: 'pdfbytes',
    metadata: { secret: 'x', value: 42 },
  });
  assert('password removido', !('password' in result.data));
  assert('apiKey removido', !('apiKey' in result.data));
  assert('fileBase64 removido', !('fileBase64' in result.data));
  assert('pdfContent removido', !('pdfContent' in result.data));
  assert('metadata.secret removido', result.data.metadata && !('secret' in result.data.metadata));
  assert('metadata.value preservado', result.data.metadata && result.data.metadata.value === 42);
}

// ── Suite 8: parseNum formatos ───────────────────────────────────────────────

console.log('\n[8] parseNum — formatos variados');

{
  const cases = [
    { input: '1.234,56', expected: 1234.56 },
    { input: '1,234.56', expected: 1234.56 },
    { input: '350.00',   expected: 350 },
    { input: '350,00',   expected: 350 },
    { input: 'R$ 150,75', expected: 150.75 },
    { input: '200 kWh',   expected: 200 },
    { input: 0,           expected: 0 },
    { input: null,        expected: null },
  ];
  for (const { input, expected } of cases) {
    const result = normalizeUtilityBillExtraction({
      uc: 'UC1',
      referenceMonth: '2025-06',
      totalUtilityBillAmount: input,
    });
    if (expected === null) {
      assert(`parseNum(${JSON.stringify(input)}) → null`, result.data.totalUtilityBillAmount === null);
    } else {
      assert(`parseNum(${JSON.stringify(input)}) → ${expected}`, result.data.totalUtilityBillAmount === expected);
    }
  }
}

// ── Suite 9: components normalizados ─────────────────────────────────────────

console.log('\n[9] Normalização de components');

{
  const result = normalizeUtilityBillExtraction({
    uc: 'UC001',
    referenceMonth: '2025-06',
    components: { te: '50,00', tusd: '30,00', cip: '10,00', bandeira: '0,50' },
  });
  assert('components.te parseado', result.data.components && result.data.components.te === 50);
  assert('components.tusd parseado', result.data.components && result.data.components.tusd === 30);
  assert('components.cip parseado', result.data.components && result.data.components.cip === 10);
  assert('components.bandeira parseado como número', result.data.components && result.data.components.bandeira === 0.5);
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`utility-bill-extraction-normalizer: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
