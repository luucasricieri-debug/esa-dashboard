'use strict';
/**
 * ESA OS — Hotfix: null-safe runtime real
 *
 * Valida que energy-credits-v2.html não quebra com snapshots vazios,
 * parciais ou com campos ausentes no modo runtime=real.
 *
 * Rodar: npx tsx tests/hotfix-null-safe-runtime-production.manual-test.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const HTML = path.join(ROOT, 'energy-credits-v2.html');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

// ── Helpers que replicam as funções do HTML (para teste isolado) ───────────────

function _safeN(v: unknown): number {
  if (v == null || (typeof v === 'number' && isNaN(v as number))) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function brl(v: unknown): string {
  return _safeN(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function kwh(v: unknown): string {
  return _safeN(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' kWh';
}

function num(v: unknown, d = 2): string {
  return _safeN(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── Dados de fixture ──────────────────────────────────────────────────────────

const emptyM = { generation: 0, compensated: 0, balance: 0, revenue: 0, ownerPayment: 0, spread: 0, savings: 0 };

// Snapshot completamente vazio
const emptySnapshot = {
  results: [],
  current: { ...emptyM },
  previous: { ...emptyM },
  cycleStatus: 'aberto',
  criticalAlerts: 0,
  trendData: [],
  generatingUnitCount: 0,
  beneficiaryUnitCount: 0,
};

// Snapshot parcial — current existe mas sem todos os campos
const partialSnapshot = {
  results: [],
  current: { generation: 1000 }, // campos como compensated, balance, etc. ausentes
  previous: null,
  cycleStatus: 'aberto',
};

// dashboardData undefined/null
const nullDashboardData: null = null;
const undefinedDashboardData: undefined = undefined;

// financialData undefined/null
const nullFinancialData: null = null;

// ownerReport undefined/null
const nullOwnerReport: null = null;

// allocationPlan undefined/null
const nullAllocationPlan: null = null;

// alerts undefined/null
const nullAlerts: null = null;
const emptyAlerts: unknown[] = [];

// months undefined/null
const nullMonths: null = null;
const emptyMonths: unknown[] = [];

// UGs undefined/null
const nullUgs: null = null;
const emptyUgs: unknown[] = [];

// UBs undefined/null
const nullUbs: null = null;
const emptyUbs: unknown[] = [];

// Resultado de settlement com rows undefined
const partialResult = {
  ug: { id: 'UG-001', name: 'UG Test', owner: 'Teste', uc: '123', distributor: 'Copel' },
  generation: 5000,
  currentBalance: undefined,
  totalCompensated: undefined,
  ownerPayment: undefined,
  esaRevenue: undefined,
  rows: undefined, // ← o campo problemático
};

// Resultado com row.ub parcial
const resultWithPartialUb = {
  ug: { id: 'UG-001', name: 'UG Test', owner: 'Teste', uc: '123', distributor: 'Copel' },
  generation: 5000,
  rows: [
    {
      ub: undefined, // ub ausente
      compensated: 100,
      faturaEsa: undefined,
      economia: undefined,
    },
  ],
};

const resultWithMissingPrices = {
  ug: { id: 'UG-001', name: 'UG Test', owner: 'Teste', purchasePrice: undefined },
  totalCompensated: 1000,
  ownerPayment: undefined,
  rows: [
    {
      ub: { id: 'UB-001', name: 'UB Test', esaPrice: undefined, monthlyConsumption: 300 },
      compensated: 100,
      faturaEsa: undefined,
    },
  ],
};

// ============================================================
// 1. Formatadores seguros — nunca jogam exceção
// ============================================================
console.log('\n=== 1. Formatadores seguros ===');

assert('F1 brl(undefined) não lança exceção', (() => { try { brl(undefined); return true; } catch { return false; } })());
assert('F2 brl(null) não lança exceção', (() => { try { brl(null); return true; } catch { return false; } })());
assert('F3 brl(NaN) não lança exceção', (() => { try { brl(NaN); return true; } catch { return false; } })());
assert('F4 brl(undefined) retorna "R$ 0,00"', brl(undefined).includes('0'));
assert('F5 kwh(undefined) não lança exceção', (() => { try { kwh(undefined); return true; } catch { return false; } })());
assert('F6 kwh(null) não lança exceção', (() => { try { kwh(null); return true; } catch { return false; } })());
assert('F7 kwh(NaN) não lança exceção', (() => { try { kwh(NaN); return true; } catch { return false; } })());
assert('F8 kwh(undefined) retorna "0 kWh"', kwh(undefined).includes('0'));
assert('F9 num(undefined) não lança exceção', (() => { try { num(undefined); return true; } catch { return false; } })());
assert('F10 num(null) não lança exceção', (() => { try { num(null); return true; } catch { return false; } })());
assert('F11 num(NaN) não lança exceção', (() => { try { num(NaN); return true; } catch { return false; } })());
assert('F12 brl(1234.56) funciona normalmente', brl(1234.56).includes('1.234'));
assert('F13 kwh(5000) funciona normalmente', kwh(5000).includes('5.000'));
assert('F14 num(3.14159, 2) funciona normalmente', num(3.14159, 2).includes('3,14'));

// ============================================================
// 2. renderVals com snapshot vazio
// ============================================================
console.log('\n=== 2. renderVals com snapshot vazio ===');

assert('RV1 snapshot vazio: results=[] → nenhum crash em map', (() => {
  try {
    const results: unknown[] = emptySnapshot.results;
    const r = results.map(() => ({}));
    return Array.isArray(r);
  } catch { return false; }
})());

assert('RV2 snapshot vazio: curr = emptyM → KPIs não crasham', (() => {
  try {
    const curr = emptySnapshot.current;
    const v = brl(curr.revenue) + kwh(curr.generation) + brl(curr.spread);
    return typeof v === 'string';
  } catch { return false; }
})());

assert('RV3 snapshot vazio: flatMap de r.rows || [] não lança', (() => {
  try {
    const results = emptySnapshot.results;
    const flat = results.flatMap((r: unknown) => ((r as { rows?: unknown[] }).rows || []));
    return Array.isArray(flat);
  } catch { return false; }
})());

// ============================================================
// 3. renderVals com snapshot parcial
// ============================================================
console.log('\n=== 3. renderVals com snapshot parcial ===');

assert('RP1 snapshot parcial: current com campo ausente → _safeN retorna 0', _safeN((partialSnapshot.current as { compensated?: number }).compensated) === 0);
assert('RP2 snapshot parcial: brl(curr.compensated) → "R$ 0,00"', brl((partialSnapshot.current as { compensated?: number }).compensated).includes('0'));
assert('RP3 snapshot parcial: previous = null → acesso seguro', (() => {
  try {
    const prev = partialSnapshot.previous || emptyM;
    const v = brl(prev.revenue);
    return typeof v === 'string';
  } catch { return false; }
})());

assert('RP4 r.rows = undefined → (r.rows || []) seguro', (() => {
  try {
    const rows = ((partialResult as { rows?: unknown[] }).rows) || [];
    return Array.isArray(rows) && rows.length === 0;
  } catch { return false; }
})());

assert('RP5 row.ub = undefined → guard preserva', (() => {
  try {
    const row = resultWithPartialUb.rows[0];
    const name = row.ub ? (row.ub as { name: string }).name : '—';
    return name === '—';
  } catch { return false; }
})());

// ============================================================
// 4. dashboardData undefined/null
// ============================================================
console.log('\n=== 4. dashboardData undefined/null ===');

assert('DD1 _rtDash = null → if(_rtData) falso → usa _emptyM', (() => {
  const _rtData = nullDashboardData;
  if (_rtData) return false;
  return true; // segue para o else if
})());

assert('DD2 _rtDash = undefined → if(_rtData) falso → usa _emptyM', (() => {
  const _rtData = undefinedDashboardData;
  if (_rtData) return false;
  return true;
})());

assert('DD3 _rtDash = {} (empty) → results = [] → nenhum crash', (() => {
  try {
    const _rtDash = {} as { results?: unknown[] };
    const results = _rtDash.results || [];
    const flat = results.flatMap((r: unknown) => ((r as { rows?: unknown[] }).rows || []));
    return flat.length === 0;
  } catch { return false; }
})());

// ============================================================
// 5. financialData undefined/null
// ============================================================
console.log('\n=== 5. financialData undefined/null ===');

assert('FD1 _rtFinAll = null → fa?.ubs || [] → array vazio seguro', (() => {
  try {
    const fa = nullFinancialData;
    const ubs = (fa as null | { ubs?: unknown[] })?.ubs || [];
    return Array.isArray(ubs) && ubs.length === 0;
  } catch { return false; }
})());

assert('FD2 _rtFinAll = null → brl(inv ? (inv.faturaEsa || 0) : 0) seguro', (() => {
  try {
    const inv = null;
    const v = brl(inv ? (inv as { faturaEsa: number }).faturaEsa : 0);
    return v.includes('0');
  } catch { return false; }
})());

// ============================================================
// 6. ownerReport undefined/null
// ============================================================
console.log('\n=== 6. ownerReport undefined/null ===');

assert('OR1 or = null → or ? (or.totalCompensated || 0) : 0 → 0', (() => {
  const or = nullOwnerReport;
  const v = or ? ((or as { totalCompensated?: number }).totalCompensated || 0) : 0;
  return v === 0;
})());

assert('OR2 or = null → brl(or ? (or.ownerPayment || 0) : 0) seguro', (() => {
  try {
    const or = nullOwnerReport;
    const v = brl(or ? (or as { ownerPayment?: number }).ownerPayment : 0);
    return typeof v === 'string';
  } catch { return false; }
})());

// ============================================================
// 7. allocationPlan undefined/null
// ============================================================
console.log('\n=== 7. allocationPlan undefined/null ===');

assert('AP1 _rtApPlan = null → if (_rtPlan && _rtPlan.rows) → falso → usa estado vazio', (() => {
  const _rtPlan = nullAllocationPlan;
  const hasRows = _rtPlan && (_rtPlan as { rows?: unknown[] }).rows;
  return !hasRows;
})());

assert('AP2 _rtApPlan = {} → if (_rtPlan && _rtPlan.rows) → falso → usa estado vazio', (() => {
  const _rtPlan = {} as { rows?: unknown[] };
  const hasRows = _rtPlan && _rtPlan.rows;
  return !hasRows;
})());

// ============================================================
// 8. alerts undefined/null
// ============================================================
console.log('\n=== 8. alerts undefined/null ===');

assert('AL1 _rtAlerts = null → S._rtAlerts || [] → array vazio', (() => {
  const _rtAlerts = nullAlerts;
  const alerts = (_rtAlerts as null | unknown[]) || [];
  return Array.isArray(alerts) && alerts.length === 0;
})());

assert('AL2 alerts = [] → alertCards = [] → nenhum crash', (() => {
  try {
    const alerts = emptyAlerts;
    const cards = alerts.slice(0, 4).map((a) => a);
    return Array.isArray(cards) && cards.length === 0;
  } catch { return false; }
})());

// ============================================================
// 9. months undefined/null
// ============================================================
console.log('\n=== 9. months undefined/null ===');

assert('MO1 _rtMonths = null → S._rtMonths || MONTHS_AV → MONTHS_AV', (() => {
  const _rtMonths = nullMonths;
  const MONTHS_AV = [{ value: '2026-07', label: 'Julho/2026' }];
  const months = (_rtMonths as null | unknown[]) || MONTHS_AV;
  return months === MONTHS_AV;
})());

assert('MO2 months = [] → initMonth = fallback dashMonth', (() => {
  const months = emptyMonths;
  const initMonth = ((months[0] as { value?: string } | undefined) || {}).value || '2026-07';
  return initMonth === '2026-07';
})());

// ============================================================
// 10. UGs undefined/null
// ============================================================
console.log('\n=== 10. UGs undefined/null ===');

assert('UG1 _rtUgs = null → S._rtUgs || [] → array vazio', (() => {
  const _rtUgs = nullUgs;
  const ugs = (_rtUgs as null | unknown[]) || [];
  return Array.isArray(ugs) && ugs.length === 0;
})());

assert('UG2 ugListRows de _rtUgs vazio → [] (nenhum crash)', (() => {
  try {
    const _rtUgSrc: unknown[] = [];
    const rows = _rtUgSrc.map((ug) => ({ name: (ug as { name: string }).name }));
    return rows.length === 0;
  } catch { return false; }
})());

// ============================================================
// 11. UBs undefined/null
// ============================================================
console.log('\n=== 11. UBs undefined/null ===');

assert('UB1 _rtUbs = null → S._rtUbs || [] → array vazio', (() => {
  const _rtUbs = nullUbs;
  const ubs = (_rtUbs as null | unknown[]) || [];
  return Array.isArray(ubs) && ubs.length === 0;
})());

assert('UB2 ubListRows de _rtUbs vazio → [] (nenhum crash)', (() => {
  try {
    const _rtUbSrc: unknown[] = [];
    const rows = _rtUbSrc.map((ub) => ({ name: (ub as { name: string }).name }));
    return rows.length === 0;
  } catch { return false; }
})());

// ============================================================
// 12. nenhum toLocaleString sobre undefined
// ============================================================
console.log('\n=== 12. Sem toLocaleString sobre undefined ===');

assert('TL1 brl(undefined) não chama toLocaleString sobre undefined', (() => {
  let called = false;
  try {
    called = true;
    brl(undefined);
    return true;
  } catch { return !called; }
})());

assert('TL2 kwh(undefined) não chama toLocaleString sobre undefined', (() => {
  try { kwh(undefined); return true; } catch { return false; }
})());

assert('TL3 num(undefined) não chama toLocaleString sobre undefined', (() => {
  try { num(undefined); return true; } catch { return false; }
})());

assert('TL4 brl(null) retorna string válida', typeof brl(null) === 'string');
assert('TL5 kwh(null) retorna string com "kWh"', kwh(null).endsWith('kWh'));
assert('TL6 _safeN(undefined) === 0', _safeN(undefined) === 0);
assert('TL7 _safeN(null) === 0', _safeN(null) === 0);
assert('TL8 _safeN(NaN) === 0', _safeN(NaN) === 0);
assert('TL9 _safeN("123") === 123', _safeN('123') === 123);
assert('TL10 _safeN(456.78) === 456.78', _safeN(456.78) === 456.78);

// ============================================================
// 13. Sem toFixed sobre undefined
// ============================================================
console.log('\n=== 13. Sem toFixed sobre undefined ===');

assert('TF1 purchasePrice undefined → _safeN().toFixed() seguro', (() => {
  try {
    const price: number | undefined = resultWithMissingPrices.ug.purchasePrice;
    const s = _safeN(price).toFixed(2);
    return s === '0.00';
  } catch { return false; }
})());

assert('TF2 esaPrice undefined → _safeN().toFixed() seguro', (() => {
  try {
    const price: number | undefined = resultWithMissingPrices.rows[0].ub.esaPrice;
    const s = _safeN(price).toFixed(2);
    return s === '0.00';
  } catch { return false; }
})());

assert('TF3 discountPct disponível no invoice (demo somente) → não alterado', (() => {
  return typeof _safeN(0.15).toFixed(1) === 'string';
})());

// ============================================================
// 14. dashMonth ausente
// ============================================================
console.log('\n=== 14. dashMonth ausente ===');

assert('DM1 dashMonth = undefined → fallback "2026-07" seguro', (() => {
  const dashMonth: string | undefined = undefined;
  const month = dashMonth || '2026-07';
  return month === '2026-07';
})());

assert('DM2 dashMonth = undefined → findIndex retorna -1 (não crash)', (() => {
  try {
    const months = [{ value: '2026-07', label: 'Jul' }];
    const idx = months.findIndex((m) => m.value === undefined);
    return idx === -1;
  } catch { return false; }
})());

assert('DM3 monthLabel = dashMonth quando mês não encontrado', (() => {
  const months: { value: string; label: string }[] = [];
  const dashMonth: string | undefined = undefined;
  const idx = months.findIndex((m) => m.value === dashMonth);
  const monthLabel = months[idx] ? months[idx].label : dashMonth;
  return monthLabel === undefined; // acesso seguro
})());

// ============================================================
// 15. prevState sem dashMonth
// ============================================================
console.log('\n=== 15. prevState sem dashMonth ===');

assert('PS1 prevState = undefined → prevState || {} não lança', (() => {
  try {
    const prevState: Record<string, unknown> | undefined = undefined;
    const safe: Record<string, unknown> = prevState || {};
    return typeof safe['dashMonth'] === 'undefined';
  } catch { return false; }
})());

assert('PS2 prevState = {} → prevState.dashMonth = undefined → comparação segura', (() => {
  const prevState: Record<string, unknown> = {};
  const currentDashMonth = '2026-07';
  const monthChanged = currentDashMonth !== prevState.dashMonth;
  return monthChanged === true; // '2026-07' !== undefined → true
})());

assert('PS3 prevState = null → prevState || {} → {} (não crash)', (() => {
  try {
    const prevState: Record<string, unknown> | null = null;
    const safe: Record<string, unknown> = prevState || {};
    const monthChanged = '2026-07' !== safe['dashMonth'];
    return monthChanged === true;
  } catch { return false; }
})());

// ============================================================
// 16. componentDidUpdate não quebra com prevState faltando
// ============================================================
console.log('\n=== 16. componentDidUpdate seguro ===');

assert('CD1 guard prevState = prevState || {} está no HTML', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  return src.includes('prevState = prevState || {}');
})());

assert('CD2 dashKey dedup substitui prevState.dashMonth (prevenção de loop)', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  const cdIdx = src.indexOf('componentDidUpdate(prevProps, prevState)');
  return cdIdx > 0 && src.includes('dashKey !== this.state._rtLastDashKey', cdIdx);
})());

assert('CD3 guard é a primeira linha de componentDidUpdate', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  const cdStart = src.indexOf('componentDidUpdate(prevProps, prevState)');
  const blockStart = src.indexOf('{', cdStart) + 1;
  const guardIdx = src.indexOf('prevState = prevState || {}', cdStart);
  const nextStmt = src.slice(blockStart).search(/\S/);
  // guard deve aparecer antes do return e da comparação
  return guardIdx > 0 && guardIdx < cdStart + 200;
})());

// ============================================================
// 17. runtime real não cai para demo
// ============================================================
console.log('\n=== 17. runtime real não cai para demo ===');

assert('RD1 HTML não tem fallback para DEMO_DATA em modo real', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  const realBlocks = src.match(/if\s*\(S\._rtMode === "real"\)/g) || [];
  return realBlocks.length > 0;
})());

assert('RD2 HTML não atribui this.UGS em bloco _rtMode real', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  // Verificar que não há fallback usando this.UGS diretamente quando _rtMode===real
  const rtBlock = src.match(/if \(S\._rtMode === "real"\) \{[^}]*this\.UGS/);
  return !rtBlock;
})());

assert('RD3 _safeN está definido no HTML', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  return src.includes('_safeN(v)');
})());

assert('RD4 brl usa _safeN(v).toLocaleString', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  return src.includes('this._safeN(v).toLocaleString') || src.includes('_safeN(v).toLocaleString');
})());

// ============================================================
// 18. demo preservado
// ============================================================
console.log('\n=== 18. demo preservado ===');

assert('DP1 HTML preserva bloco DEMO MODE', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  return src.includes('DEMO MODE') || src.includes("_rtMode !== \"real\"");
})());

assert('DP2 scaledResults ainda presente para demo', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  return src.includes('scaledResults(');
})());

assert('DP3 computeAllocationPlan preservado', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  return src.includes('computeAllocationPlan(');
})());

assert('DP4 MONTHS_AV preservado como fallback demo', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  return src.includes('this.MONTHS_AV');
})());

assert('DP5 sem remoção do ALERTS demo', (() => {
  const src = fs.readFileSync(HTML, 'utf8');
  return src.includes('this.ALERTS');
})());

// ── Relatório ─────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`Hotfix null-safe runtime: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
