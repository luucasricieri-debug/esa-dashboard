/**
 * ESA OS — Tests / Energy Utility Bills
 * utility-bill-billing-input-adapter.manual-test.js
 */

import { buildBillingInputFromUtilityBillMonthlyRecord } from './utility-bill-billing-input-adapter.js';

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

function makeMonthlyRecord(overrides = {}) {
  return {
    id: 'ubm-ben001-2025-06',
    beneficiaryUnitId: 'ben-001',
    generatingUnitId: 'gen-001',
    referenceMonth: '2025-06',
    monthlyConsumptionKwh: 250,
    utilityBillData: {
      components: { cip: 15 },
      minimumBillableKwh: 100,
    },
    ...overrides,
  };
}

function makeContext() {
  return {
    tariffs: {
      te_com: 0.5,
      te_sem: 0.4,
      tusd_com: 0.3,
      tus_sem: 0.25,
      icms_pct: 0.25,
      cofins_pct: 0.03,
      pis_pct: 0.015,
    },
    operational: {
      geracao: 300,
      uc_prop: 1.0,
      preco_kwh: 0.85,
      desc_dist: 0.2,
      bndv: 0,
    },
  };
}

// ── Suite 1: resultado completo ───────────────────────────────────────────────

console.log('\n[1] Resultado completo com todos os campos');

{
  const result = buildBillingInputFromUtilityBillMonthlyRecord(makeMonthlyRecord(), makeContext());
  assert('ok=true', result.ok);
  assert('referenceMonth preservado', result.data.referenceMonth === '2025-06');
  assert('beneficiaryUnitId preservado', result.data.beneficiaryUnitId === 'ben-001');
  assert('generatingUnitId preservado', result.data.generatingUnitId === 'gen-001');
  assert('operational.consumo = monthlyConsumptionKwh', result.data.operational.consumo === 250);
  assert('operational.cip = components.cip', result.data.operational.cip === 15);
  assert('operational.minimo = minimumBillableKwh', result.data.operational.minimo === 100);
}

// ── Suite 2: tariffs mapeadas corretamente ────────────────────────────────────

console.log('\n[2] Tariffs mapeadas do contexto');

{
  const result = buildBillingInputFromUtilityBillMonthlyRecord(makeMonthlyRecord(), makeContext());
  assert('tariffs.te_com presente', result.data.tariffs && result.data.tariffs.te_com === 0.5);
  assert('tariffs.icms_pct presente', result.data.tariffs && result.data.tariffs.icms_pct === 0.25);
}

// ── Suite 3: consumo/cip/minimo vêm do registro quando contexto não os provê ──

console.log('\n[3] consumo, cip e minimo lidos da fatura quando contexto não os inclui');

{
  const ctx = makeContext();
  const result = buildBillingInputFromUtilityBillMonthlyRecord(makeMonthlyRecord(), ctx);
  assert('consumo=250 vem da fatura', result.data.operational.consumo === 250);
  assert('cip=15 vem da fatura', result.data.operational.cip === 15);
  assert('minimo=100 vem da fatura', result.data.operational.minimo === 100);
}

// ── Suite 4: tariff obrigatória ausente → erro ────────────────────────────────

console.log('\n[4] Tariff obrigatória ausente → UTILITY_BILL_BILLING_INPUT_INCOMPLETE');

{
  const ctx = makeContext();
  delete ctx.tariffs.te_com;
  const result = buildBillingInputFromUtilityBillMonthlyRecord(makeMonthlyRecord(), ctx);
  assert('ok=false sem te_com', !result.ok);
  assert('erro UTILITY_BILL_BILLING_INPUT_INCOMPLETE', result.errors.some(e => e.code === 'UTILITY_BILL_BILLING_INPUT_INCOMPLETE'));
}

// ── Suite 5: contexto sem tariffs → erros para todos ─────────────────────────

console.log('\n[5] Contexto sem tariffs retorna erros');

{
  const result = buildBillingInputFromUtilityBillMonthlyRecord(makeMonthlyRecord(), {});
  assert('ok=false sem tariffs', !result.ok);
  assert('múltiplos erros', result.errors.length > 1);
}

// ── Suite 6: cip ausente em components → usa valor do contexto ───────────────

console.log('\n[6] cip ausente em components.utilityBillData');

{
  const record = makeMonthlyRecord({ utilityBillData: { components: {}, minimumBillableKwh: 100 } });
  const ctx = { ...makeContext(), operational: { ...makeContext().operational, cip: 20 } };
  const result = buildBillingInputFromUtilityBillMonthlyRecord(record, ctx);
  assert('ok=true (cip do contexto)', result.ok);
  assert('cip vem do contexto quando ausente na fatura', result.data.operational.cip === 20);
}

// ── Suite 7: monthlyRecord inválido ──────────────────────────────────────────

console.log('\n[7] monthlyRecord inválido');

{
  const result = buildBillingInputFromUtilityBillMonthlyRecord(null, makeContext());
  assert('ok=false com monthlyRecord=null', !result.ok);
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`utility-bill-billing-input-adapter: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
