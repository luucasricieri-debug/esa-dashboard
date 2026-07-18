/**
 * ESA OS — Tests / Energy Utility Bills
 * utility-bill-duplicate-detector.manual-test.js
 */

import { UtilityBillDuplicateDetector } from './utility-bill-duplicate-detector.js';

const _dup = new UtilityBillDuplicateDetector();
function detectUtilityBillDuplicate({ beneficiaryUnitId, referenceMonth, extraction }, existingRecords) {
  return _dup.detect(beneficiaryUnitId, referenceMonth, existingRecords, extraction);
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

const BENEFICIARY_ID = 'ben-001';
const MONTH = '2025-06';

function makeRecord(overrides = {}) {
  return {
    id: `ubm-${BENEFICIARY_ID}-${MONTH}`,
    beneficiaryUnitId: BENEFICIARY_ID,
    referenceMonth: MONTH,
    monthlyConsumptionKwh: 250,
    utilityBillData: {
      components: { te: 50, tusd: 30, fioB: 10, bandeira: null, cip: 5 },
      minimumBillableKwh: 100,
      totalUtilityBillAmount: 350,
    },
    ...overrides,
  };
}

const existingRecord = makeRecord();

// ── Suite 1: sem duplicata ────────────────────────────────────────────────────

console.log('\n[1] Sem duplicata — mês diferente');

{
  const result = detectUtilityBillDuplicate(
    { beneficiaryUnitId: BENEFICIARY_ID, referenceMonth: '2025-07', extraction: { monthlyConsumptionKwh: 250 } },
    [existingRecord],
  );
  assert('ok=true', result.ok);
  assert('duplicate=false', !result.data.duplicate);
  assert('existingRecord=null', result.data.existingRecord === null);
}

// ── Suite 2: sem duplicata — beneficiário diferente ───────────────────────────

console.log('\n[2] Sem duplicata — beneficiário diferente');

{
  const result = detectUtilityBillDuplicate(
    { beneficiaryUnitId: 'ben-999', referenceMonth: MONTH, extraction: { monthlyConsumptionKwh: 250 } },
    [existingRecord],
  );
  assert('duplicate=false', !result.data.duplicate);
}

// ── Suite 3: duplicata idêntica ───────────────────────────────────────────────

console.log('\n[3] Duplicata idêntica');

{
  const result = detectUtilityBillDuplicate(
    {
      beneficiaryUnitId: BENEFICIARY_ID,
      referenceMonth: MONTH,
      extraction: {
        monthlyConsumptionKwh: 250,
        components: { te: 50, tusd: 30, fioB: 10, bandeira: null, cip: 5 },
        minimumBillableKwh: 100,
        totalUtilityBillAmount: 350,
      },
    },
    [existingRecord],
  );
  assert('duplicate=true', result.data.duplicate);
  assert('existingRecord presente', result.data.existingRecord != null);
  assert('comparison é array', Array.isArray(result.data.comparison));
  assert('nenhum campo changed', result.data.comparison.every(c => !c.changed));
}

// ── Suite 4: duplicata com diferenças ────────────────────────────────────────

console.log('\n[4] Duplicata com diferenças de valor');

{
  const result = detectUtilityBillDuplicate(
    {
      beneficiaryUnitId: BENEFICIARY_ID,
      referenceMonth: MONTH,
      extraction: {
        monthlyConsumptionKwh: 300,
        totalUtilityBillAmount: 400,
      },
    },
    [existingRecord],
  );
  assert('duplicate=true', result.data.duplicate);
  const consumoEntry = result.data.comparison.find(c => c.field === 'monthlyConsumptionKwh');
  assert('comparison tem monthlyConsumptionKwh', consumoEntry != null);
  assert('changed=true para consumo diferente', consumoEntry && consumoEntry.changed);
  assert('currentValue correto', consumoEntry && consumoEntry.currentValue === 250);
  assert('incomingValue correto', consumoEntry && consumoEntry.incomingValue === 300);
}

// ── Suite 5: lista vazia → sem duplicata ─────────────────────────────────────

console.log('\n[5] Lista vazia de registros existentes');

{
  const result = detectUtilityBillDuplicate(
    { beneficiaryUnitId: BENEFICIARY_ID, referenceMonth: MONTH, extraction: {} },
    [],
  );
  assert('duplicate=false com lista vazia', !result.data.duplicate);
}

// ── Suite 6: comparison order determinístico ─────────────────────────────────

console.log('\n[6] Comparison tem ordem determinística dos campos');

{
  const result = detectUtilityBillDuplicate(
    {
      beneficiaryUnitId: BENEFICIARY_ID,
      referenceMonth: MONTH,
      extraction: { monthlyConsumptionKwh: 250 },
    },
    [existingRecord],
  );
  const fields = result.data.comparison.map(c => c.field);
  assert('primeiro campo é monthlyConsumptionKwh', fields[0] === 'monthlyConsumptionKwh');
  assert('contém totalUtilityBillAmount', fields.includes('totalUtilityBillAmount'));
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`utility-bill-duplicate-detector: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
