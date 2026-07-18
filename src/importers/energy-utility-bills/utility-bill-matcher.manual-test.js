/**
 * ESA OS — Tests / Energy Utility Bills
 * utility-bill-matcher.manual-test.js
 */

import { UtilityBillMatcher } from './utility-bill-matcher.js';

const _matcher = new UtilityBillMatcher();
function matchUtilityBillToBeneficiary(extraction, units) { return _matcher.match(extraction, units); }

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

const units = [
  { id: 'ben-001', uc: 'UC001', holderDocument: '123.456.789-00' },
  { id: 'ben-002', uc: 'UC002', holderDocument: '987.654.321-00' },
  { id: 'ben-003', uc: 'UC003', holderDocument: '111.222.333-44' },
];

// ── Suite 1: match por UC exato ────────────────────────────────────────────────

console.log('\n[1] Match por UC (uc-exact)');

{
  const result = matchUtilityBillToBeneficiary({ uc: 'UC001' }, units);
  assert('ok=true', result.ok);
  assert('matched=true', result.data.matched);
  assert('matchType=uc-exact', result.data.matchType === 'uc-exact');
  assert('beneficiaryUnitId correto', result.data.beneficiaryUnit?.id === 'ben-001');
}

// ── Suite 2: match por UC — normalização acontece no normalizer upstream ──────

console.log('\n[2] UC já normalizada chega ao matcher');

{
  const unitsFormatted = [
    { id: 'ben-X', uc: 'UC-001', holderDocument: '000' },
  ];
  // O normalizer upstream já converte 'UC-001' → 'UC001' antes de passar ao matcher
  const result = matchUtilityBillToBeneficiary({ uc: 'UC001' }, unitsFormatted);
  assert('match com uc normalizada', result.ok && result.data.matched);
  assert('matchType=uc-exact', result.data.matchType === 'uc-exact');
}

// ── Suite 3: match por documento ─────────────────────────────────────────────

console.log('\n[3] Match por documento (document-exact)');

{
  const extraction = { uc: 'UCINEXISTENTE', customerDocument: '987.654.321-00' };
  const result = matchUtilityBillToBeneficiary(extraction, units);
  assert('ok=true', result.ok);
  assert('matched=true por documento', result.data.matched);
  assert('matchType=document-exact', result.data.matchType === 'document-exact');
  assert('beneficiaryUnit.id correto', result.data.beneficiaryUnit?.id === 'ben-002');
}

// ── Suite 4: sem match ────────────────────────────────────────────────────────

console.log('\n[4] Sem match');

{
  const result = matchUtilityBillToBeneficiary(
    { uc: 'UCXXX', customerDocument: '000.000.000-00' },
    units,
  );
  assert('ok=true (sem match não é erro)', result.ok);
  assert('matched=false', !result.data.matched);
  assert('matchType=none', result.data.matchType === 'none');
  assert('beneficiaryUnit=null', result.data.beneficiaryUnit === null);
}

// ── Suite 5: ambiguidade por UC ───────────────────────────────────────────────

console.log('\n[5] Ambiguidade por UC (múltiplas UCs iguais)');

{
  const ambiguousUnits = [
    { id: 'ben-A', uc: 'UC001', holderDocument: '111' },
    { id: 'ben-B', uc: 'UC001', holderDocument: '222' },
  ];
  const result = matchUtilityBillToBeneficiary({ uc: 'UC001' }, ambiguousUnits);
  assert('ok=false em ambiguidade', !result.ok);
  assert('erro AMBIGUOUS_BENEFICIARY_MATCH', result.errors.some(e => e.code === 'AMBIGUOUS_BENEFICIARY_MATCH'));
}

// ── Suite 6: ambiguidade por documento ───────────────────────────────────────

console.log('\n[6] Ambiguidade por documento');

{
  const ambiguousUnits = [
    { id: 'ben-C', uc: 'UCX', holderDocument: '123.456.789-00' },
    { id: 'ben-D', uc: 'UCY', holderDocument: '123.456.789-00' },
  ];
  const result = matchUtilityBillToBeneficiary(
    { uc: 'UC-NENHUMA', customerDocument: '12345678900' },
    ambiguousUnits,
  );
  assert('ok=false em ambiguidade por documento', !result.ok);
  assert('erro AMBIGUOUS_BENEFICIARY_MATCH', result.errors.some(e => e.code === 'AMBIGUOUS_BENEFICIARY_MATCH'));
}

// ── Suite 7: UC precede documento na prioridade ───────────────────────────────

console.log('\n[7] UC tem prioridade sobre documento');

{
  const mixedUnits = [
    { id: 'by-uc',  uc: 'UC001', holderDocument: '999' },
    { id: 'by-doc', uc: 'UCOTHER', holderDocument: '123.456.789-00' },
  ];
  const result = matchUtilityBillToBeneficiary(
    { uc: 'UC001', customerDocument: '123.456.789-00' },
    mixedUnits,
  );
  assert('match por UC (prioridade)', result.data.matched && result.data.matchType === 'uc-exact');
  assert('beneficiaryUnit.id=by-uc', result.data.beneficiaryUnit?.id === 'by-uc');
}

// ── Suite 8: lista vazia ──────────────────────────────────────────────────────

console.log('\n[8] Lista de beneficiários vazia');

{
  const result = matchUtilityBillToBeneficiary({ uc: 'UC001' }, []);
  assert('ok=true com lista vazia', result.ok);
  assert('matched=false', !result.data.matched);
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`utility-bill-matcher: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
