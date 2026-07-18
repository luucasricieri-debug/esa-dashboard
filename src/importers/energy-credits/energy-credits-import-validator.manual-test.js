/**
 * ESA OS — Manual Test: Energy Credits Import Validator
 * node src/importers/energy-credits/energy-credits-import-validator.manual-test.js
 */

import { EnergyCreditsImportValidator } from './energy-credits-import-validator.js';
import { ENERGY_CREDITS_IMPORT_TYPE } from './import-types.js';

const T = ENERGY_CREDITS_IMPORT_TYPE;
const validator = new EnergyCreditsImportValidator();

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

// ── 1. Unknown type ───────────────────────────────────────────────────────────
group('1. Unknown type');
const unk = validator.validate('unknown-type', {});
assert('1.1 ok=false', unk.ok === false);
assert('1.2 UNKNOWN_TYPE error', unk.errors[0]?.code === 'UNKNOWN_TYPE');

// ── 2. Generating Unit — valid ────────────────────────────────────────────────
group('2. Generating Unit — valid');
const gu1 = validator.validate(T.GENERATING_UNITS, { id: 'gu-001', name: 'Solar Norte', uc: 'UC001' });
assert('2.1 ok=true', gu1.ok === true);
assert('2.2 no errors', gu1.errors.length === 0);

// ── 3. Generating Unit — warnings ────────────────────────────────────────────
group('3. Generating Unit — warnings');
const gu2 = validator.validate(T.GENERATING_UNITS, { id: 'gu-001' });
assert('3.1 ok=true (has id)', gu2.ok === true);
assert('3.2 MISSING_NAME warning', gu2.warnings.some(w => w.code === 'MISSING_NAME'));

const gu3 = validator.validate(T.GENERATING_UNITS, { uc: 'UC001' });
assert('3.3 ok=true (has uc)', gu3.ok === true);
assert('3.4 MISSING_ID warning', gu3.warnings.some(w => w.code === 'MISSING_ID'));

// ── 4. Generating Unit — errors ───────────────────────────────────────────────
group('4. Generating Unit — errors');
const gu4 = validator.validate(T.GENERATING_UNITS, { name: 'No ID No UC' });
assert('4.1 ok=false (no id, no uc)', gu4.ok === false);
assert('4.2 MISSING_IDENTIFIER error', gu4.errors.some(e => e.code === 'MISSING_IDENTIFIER'));

// ── 5. Beneficiary Unit — valid ───────────────────────────────────────────────
group('5. Beneficiary Unit — valid');
const bu1 = validator.validate(T.BENEFICIARY_UNITS, { id: 'bu-001', name: 'Beneficiário X', uc: 'UC200' });
assert('5.1 ok=true', bu1.ok === true);
assert('5.2 no errors', bu1.errors.length === 0);

// ── 6. Beneficiary Unit — warnings ────────────────────────────────────────────
group('6. Beneficiary Unit — warnings');
const bu2 = validator.validate(T.BENEFICIARY_UNITS, { id: 'bu-001' });
assert('6.1 ok=true (has id)', bu2.ok === true);
assert('6.2 MISSING_NAME warning', bu2.warnings.some(w => w.code === 'MISSING_NAME'));

// ── 7. Beneficiary Unit — errors ──────────────────────────────────────────────
group('7. Beneficiary Unit — errors');
const bu3 = validator.validate(T.BENEFICIARY_UNITS, { name: 'No UC No ID' });
assert('7.1 ok=false', bu3.ok === false);
assert('7.2 MISSING_IDENTIFIER', bu3.errors.some(e => e.code === 'MISSING_IDENTIFIER'));

// ── 8. Generating Unit Monthly — valid ───────────────────────────────────────
group('8. Generating Unit Monthly Record — valid');
const gum1 = validator.validate(T.GENERATING_UNIT_MONTHLY_RECORDS, { generatingUnitId: 'gu-001', referenceMonth: '2025-06', previousBalanceKwh: 1000, monthlyGenerationKwh: 5000, purchasePricePerKwh: 0.45 });
assert('8.1 ok=true', gum1.ok === true);
assert('8.2 no errors', gum1.errors.length === 0);
assert('8.3 no warnings', gum1.warnings.length === 0);

// ── 9. Generating Unit Monthly — invalid month ────────────────────────────────
group('9. Generating Unit Monthly — invalid month');
const gum2 = validator.validate(T.GENERATING_UNIT_MONTHLY_RECORDS, { generatingUnitId: 'gu-001', referenceMonth: 'not-a-month' });
assert('9.1 ok=false', gum2.ok === false);
assert('9.2 INVALID_MONTH error', gum2.errors.some(e => e.code === 'INVALID_MONTH'));

const gum3 = validator.validate(T.GENERATING_UNIT_MONTHLY_RECORDS, { generatingUnitId: 'gu-001', referenceMonth: null });
assert('9.3 null month → INVALID_MONTH', gum3.errors.some(e => e.code === 'INVALID_MONTH'));

// ── 10. Generating Unit Monthly — negative number warning ─────────────────────
group('10. Generating Unit Monthly — negative numbers');
const gum4 = validator.validate(T.GENERATING_UNIT_MONTHLY_RECORDS, { generatingUnitId: 'gu-001', referenceMonth: '2025-06', monthlyGenerationKwh: -100 });
assert('10.1 ok=true (warning, not error)', gum4.ok === true);
assert('10.2 NEGATIVE_NUMBER warning', gum4.warnings.some(w => w.code === 'NEGATIVE_NUMBER'));

// ── 11. Generating Unit Monthly — INVALID_NUMBER ─────────────────────────────
group('11. Generating Unit Monthly — invalid number type');
const gum5 = validator.validate(T.GENERATING_UNIT_MONTHLY_RECORDS, { generatingUnitId: 'gu-001', referenceMonth: '2025-06', previousBalanceKwh: 'not-a-number' });
assert('11.1 ok=false (INVALID_NUMBER)', gum5.ok === false);
assert('11.2 INVALID_NUMBER error', gum5.errors.some(e => e.code === 'INVALID_NUMBER'));

// ── 12. Generating Unit Monthly — missing identifier ─────────────────────────
group('12. Generating Unit Monthly — missing identifier');
const gum6 = validator.validate(T.GENERATING_UNIT_MONTHLY_RECORDS, { referenceMonth: '2025-06' });
assert('12.1 ok=false', gum6.ok === false);
assert('12.2 MISSING_IDENTIFIER', gum6.errors.some(e => e.code === 'MISSING_IDENTIFIER'));

// ── 13. Beneficiary Monthly — valid ──────────────────────────────────────────
group('13. Beneficiary Monthly Record — valid');
const bm1 = validator.validate(T.BENEFICIARY_MONTHLY_RECORDS, { beneficiaryUnitId: 'bu-01', referenceMonth: '2025-06', monthlyConsumptionKwh: 800, allocatedKwh: 700, compensatedKwh: 700, esaPricePerKwh: 0.40, utilityTariffPerKwh: 0.85 });
assert('13.1 ok=true', bm1.ok === true);
assert('13.2 no errors', bm1.errors.length === 0);

// ── 14. Beneficiary Monthly — missing identifier ──────────────────────────────
group('14. Beneficiary Monthly — missing identifier');
const bm2 = validator.validate(T.BENEFICIARY_MONTHLY_RECORDS, { referenceMonth: '2025-06' });
assert('14.1 ok=false', bm2.ok === false);
assert('14.2 MISSING_IDENTIFIER', bm2.errors.some(e => e.code === 'MISSING_IDENTIFIER'));

// ── 15. Beneficiary Monthly — id satisfies identifier requirement ─────────────
group('15. Beneficiary Monthly — id satisfies identifier');
const bm3 = validator.validate(T.BENEFICIARY_MONTHLY_RECORDS, { id: 'ubm-001', referenceMonth: '2025-06' });
assert('15.1 ok=true (has id)', bm3.ok === true);

// ── 16. Row index is propagated ───────────────────────────────────────────────
group('16. Row index in errors');
const ri = validator.validate(T.GENERATING_UNITS, {}, 42);
assert('16.1 error has row=42', ri.errors[0]?.row === 42 || ri.warnings[0]?.row === 42);

// ── 17. Beneficiary Monthly — multiple number fields ──────────────────────────
group('17. Beneficiary Monthly — multiple invalid numbers');
const bm4 = validator.validate(T.BENEFICIARY_MONTHLY_RECORDS, { beneficiaryUnitId: 'bu-01', referenceMonth: '2025-06', monthlyConsumptionKwh: 'X', allocatedKwh: 'Y' });
assert('17.1 ok=false (INVALID_NUMBER)', bm4.ok === false);
assert('17.2 multiple INVALID_NUMBER errors', bm4.errors.filter(e => e.code === 'INVALID_NUMBER').length >= 2);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
