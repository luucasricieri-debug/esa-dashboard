/**
 * ESA OS — Tests / Energy Utility Bills
 * utility-bill-validator.manual-test.js
 */

import { UtilityBillValidator } from './utility-bill-validator.js';
import { UtilityBillExtractionNormalizer } from './utility-bill-extraction-normalizer.js';

const _norm = new UtilityBillExtractionNormalizer();
const _val  = new UtilityBillValidator();
function validateUtilityBillExtraction(raw) {
  const nr = _norm.normalize(raw);
  if (!nr.ok) return nr;
  return _val.validate(nr.data);
}

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

function makeValid() {
  return {
    id: 'utility-bill-copel-uc001-2025-06',
    uc: 'UC001',
    referenceMonth: '2025-06',
    monthlyConsumptionKwh: 250,
    totalUtilityBillAmount: 350,
    utilityCompany: 'COPEL',
  };
}

// ── Suite 1: entrada válida mínima ────────────────────────────────────────────

console.log('\n[1] Entrada válida mínima');

{
  const result = validateUtilityBillExtraction(makeValid());
  assert('ok=true para entrada válida', result.ok);
  assert('sem erros', result.errors.length === 0);
}

// ── Suite 2: uc obrigatória ───────────────────────────────────────────────────

console.log('\n[2] uc obrigatória');

{
  const result = validateUtilityBillExtraction({ ...makeValid(), uc: null });
  assert('ok=false sem uc', !result.ok);
  assert('erro UTILITY_BILL_UC_REQUIRED', result.errors.some(e => e.code === 'UTILITY_BILL_UC_REQUIRED'));
}

// ── Suite 3: referenceMonth formato YYYY-MM ───────────────────────────────────

console.log('\n[3] referenceMonth formato');

{
  const invalid = ['06-2025', '2025', '2025-13', '2025-00', '', null];
  for (const rm of invalid) {
    const result = validateUtilityBillExtraction({ ...makeValid(), referenceMonth: rm });
    assert(`referenceMonth "${rm}" → falha`, !result.ok);
  }
  const valid = validateUtilityBillExtraction({ ...makeValid(), referenceMonth: '2025-12' });
  assert('referenceMonth "2025-12" → ok', valid.ok);
}

// ── Suite 4: valores numéricos >= 0 ──────────────────────────────────────────

console.log('\n[4] Valores numéricos >= 0');

{
  const neg = validateUtilityBillExtraction({ ...makeValid(), monthlyConsumptionKwh: -1 });
  assert('monthlyConsumptionKwh negativo → falha', !neg.ok);

  const zero = validateUtilityBillExtraction({ ...makeValid(), monthlyConsumptionKwh: 0 });
  assert('monthlyConsumptionKwh=0 → ok', zero.ok);

  const negBill = validateUtilityBillExtraction({ ...makeValid(), totalUtilityBillAmount: -0.01 });
  assert('totalUtilityBillAmount negativo → falha', !negBill.ok);
}

// ── Suite 5: components validados ────────────────────────────────────────────

console.log('\n[5] Components validados');

{
  const result = validateUtilityBillExtraction({
    ...makeValid(),
    components: { te: -1, tusd: 0 },
  });
  assert('components.te negativo → falha', !result.ok);

  const ok = validateUtilityBillExtraction({
    ...makeValid(),
    components: { te: 50, tusd: 30, fioB: 10, cip: 5 },
  });
  assert('components válidos → ok', ok.ok);
}

// ── Suite 6: minimumBillableKwh >= 0 ─────────────────────────────────────────

console.log('\n[6] minimumBillableKwh');

{
  const neg = validateUtilityBillExtraction({ ...makeValid(), minimumBillableKwh: -1 });
  assert('minimumBillableKwh negativo → falha', !neg.ok);

  const zero = validateUtilityBillExtraction({ ...makeValid(), minimumBillableKwh: 0 });
  assert('minimumBillableKwh=0 → ok', zero.ok);
}

// ── Suite 7: warning sem utilityCompany ──────────────────────────────────────

console.log('\n[7] Warning: utilityCompany ausente');

{
  const result = validateUtilityBillExtraction({ ...makeValid(), utilityCompany: null });
  assert('ok=true mesmo sem utilityCompany', result.ok);
  assert('warning emitido', result.warnings.length > 0);
}

// ── Suite 8: id gerado quando ausente ────────────────────────────────────────

console.log('\n[8] ID gerado automaticamente quando ausente');

{
  const result = validateUtilityBillExtraction({
    uc: 'UC999',
    referenceMonth: '2025-06',
    utilityCompany: 'ENERGISA',
    monthlyConsumptionKwh: 100,
  });
  assert('ok=true sem id fornecido', result.ok);
  assert('id gerado existe', typeof result.data.id === 'string' && result.data.id.length > 0);
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`utility-bill-validator: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
