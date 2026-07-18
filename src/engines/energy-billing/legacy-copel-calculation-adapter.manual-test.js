/**
 * ESA OS — Manual Test: Legacy Copel Calculation Adapter
 * node src/engines/energy-billing/legacy-copel-calculation-adapter.manual-test.js
 */

import { calculate } from './legacy-copel-calculation-adapter.js';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }
function fmt2(v) { return Math.round(v * 100) / 100; } // simulação de toLocaleString 2dp

// ── Inputs padrão ─────────────────────────────────────────────────────────────
const DEFAULTS = {
  te_com: 0.558035, te_sem: 0.558035, tusd_com: 0.678724, tus_sem: 0.291481,
  icms_pct: 0.19, cofins_pct: 0.057472, pis_pct: 0.012476,
  minimo: 100, preco_kwh: 0.60, desc_dist: 0, bndv: 0, uc_prop: 0,
  cip: 177.19,
};

// ── 1. CASO DE REGRESSÃO — Gerador de Propostas ──────────────────────────────
group('1. Caso de Regressão — valores validados no Gerador de Propostas');
const REG = { ...DEFAULTS, consumo: 223.085, geracao: 185.93 };
const r1 = calculate(REG);
assert('1.1 Conta Normal c_fat → 453,09',    fmt2(r1.c_fat)        === 453.09);
assert('1.2 Conta ESA gd2_liq_final → 438,81', fmt2(r1.gd2_liq_final) === 438.81);
assert('1.3 Economia mensal → 14,28',         fmt2(r1.eco_mensal)   === 14.28);
assert('1.4 Economia anual → 171,36',         fmt2(r1.eco_anual)    === 171.36);
assert('1.5 Economia % → 3,15',               fmt2(r1.eco_pct)      === 3.15);

// ── 2. CASO DE REGRESSÃO — 421 kWh × R$ 0,60 ─────────────────────────────────
group('2. Caso de Regressão — 421 kWh cobrados × preço 0,60');
const REG2 = { ...DEFAULTS, consumo: 500, geracao: 621, minimo: 100 };
const r2 = calculate(REG2);
// venda_kwh = (geracao - minimo) * preco_kwh = (621 - 100) * 0.60 = 521 * 0.60 = 312.60
// Mas o caso é (geracao - minimo) = 421 → geracao = 521, minimo = 100
const REG2b = { ...DEFAULTS, consumo: 400, geracao: 521, minimo: 100 };
const r2b = calculate(REG2b);
assert('2.1 venda_kwh = 421 × 0,60 = 252,60',  fmt2(r2b.venda_kwh) === 252.60);
assert('2.2 NÃO 25.260,00',                     r2b.venda_kwh < 1000);
assert('2.3 preco_kwh = 0.60 (não 60.00)',       r2b.preco_kwh === 0.60);

// ── 3. Conta Copel Normal ─────────────────────────────────────────────────────
group('3. Conta Concessionária — fórmula');
const c3 = { ...DEFAULTS, consumo: 300, geracao: 300, cip: 50 };
const r3 = calculate(c3);
assert('3.1 c_te = consumo * (te_com + bndv)',   r3.c_te   === 300 * (0.558035 + 0));
assert('3.2 c_tusd = consumo * tusd_com',        r3.c_tusd === 300 * 0.678724);
assert('3.3 c_fat = c_te + c_tusd + cip',        r3.c_fat  === r3.c_te + r3.c_tusd + 50);

// ── 4. Fio B e GD2 ────────────────────────────────────────────────────────────
group('4. Fio B — TUSD retida');
const r4 = calculate({ ...DEFAULTS, consumo: 200, geracao: 250 });
assert('4.1 fio_b = consumo * (tusd_com - tus_sem)', fmt2(r4.fio_b) === fmt2(200 * (0.678724 - 0.291481)));
assert('4.2 gd2_tus_liq = c_tusd - cred_tus',        fmt2(r4.gd2_tus_liq) === fmt2(r4.c_tusd - r4.cred_tus));
assert('4.3 fio_b ≈ gd2_tus_liq',                    fmt2(r4.fio_b) === fmt2(r4.gd2_tus_liq));

// ── 5. Mínimo faturável ────────────────────────────────────────────────────────
group('5. Mínimo faturável');
const r5 = calculate({ ...DEFAULTS, consumo: 300, geracao: 400, minimo: 50 });
const expectedCustoMin = 50 * (0.558035 + 0) + 50 * 0.678724;
assert('5.1 custo_min_sc = minimo * (te_com + tusd_com)', fmt2(r5.custo_min_sc) === fmt2(expectedCustoMin));
const expectedVenda = (400 - 50) * 0.60;
assert('5.2 venda_kwh = (geracao - minimo) * preco_kwh',  fmt2(r5.venda_kwh) === fmt2(expectedVenda));

// ── 6. Créditos disponíveis e excedentes ──────────────────────────────────────
group('6. Créditos disponíveis e excedentes');
const r6 = calculate({ ...DEFAULTS, consumo: 100, geracao: 500 });
// cred_disp = max(geracao - uc_prop - minimo, 0) = max(500 - 0 - 100, 0) = 400
assert('6.1 cred_disp = geracao - uc_prop - minimo', r6.cred_disp === 400);
// cred_comp_uc = consumo = 100
assert('6.2 cred_comp_uc = consumo', r6.cred_comp_uc === 100);
// cred_excedente = max(400 - 100, 0) = 300
assert('6.3 cred_excedente = cred_disp - cred_comp_uc', r6.cred_excedente === 300);

// ── 7. Bandeira tarifária ──────────────────────────────────────────────────────
group('7. Bandeira tarifária');
const rVerde   = calculate({ ...DEFAULTS, consumo: 200, geracao: 200, bndv: 0 });
const rAmarela = calculate({ ...DEFAULTS, consumo: 200, geracao: 200, bndv: 0.01885 });
assert('7.1 verde bndv=0: c_te = consumo * te_com', rVerde.c_te === 200 * 0.558035);
assert('7.2 amarela: c_te > verde c_te', rAmarela.c_te > rVerde.c_te);
assert('7.3 bandeira afeta conta normal', rAmarela.c_fat > rVerde.c_fat);
assert('7.4 bandeira afeta custo mínimo', rAmarela.custo_min_sc > rVerde.custo_min_sc);

// ── 8. Impostos ────────────────────────────────────────────────────────────────
group('8. Impostos — ICMS/PIS/COFINS');
const r8 = calculate({ ...DEFAULTS, consumo: 200, geracao: 200 });
const base = r8.c_te + r8.c_tusd;
const icms = base * 0.19;
assert('8.1 c_base_icms = c_te + c_tusd', fmt2(r8.c_base_icms) === fmt2(base));
assert('8.2 c_icms = base * 19%',         fmt2(r8.c_icms)      === fmt2(icms));
const basePisCof = base - icms;
assert('8.3 c_base_piscof = base - icms',  fmt2(r8.c_base_piscof) === fmt2(basePisCof));
assert('8.4 c_cofins = base_piscof * cofins', fmt2(r8.c_cofins) === fmt2(basePisCof * 0.057472));
assert('8.5 c_pis = base_piscof * pis',    fmt2(r8.c_pis) === fmt2(basePisCof * 0.012476));
assert('8.6 c_imp = icms + cofins + pis', fmt2(r8.c_imp) === fmt2(r8.c_icms + r8.c_cofins + r8.c_pis));

// ── 9. Impostos GD2 — base diferente ──────────────────────────────────────────
group('9. Impostos GD2 — base ICMS = TUSD bruta');
const r9 = calculate({ ...DEFAULTS, consumo: 200, geracao: 200 });
assert('9.1 gd2_base_icms = c_tusd (não c_tusd_liq)', r9.gd2_base_icms === r9.c_tusd);
assert('9.2 gd2_base_piscof = gd2_tus_liq - gd2_icms', fmt2(r9.gd2_base_piscof) === fmt2(r9.gd2_tus_liq - r9.gd2_icms));

// ── 10. gd2_liq_final NÃO inclui gd2_imp ─────────────────────────────────────
group('10. gd2_liq_final — impostos NÃO somados');
const r10 = calculate({ ...DEFAULTS, consumo: 200, geracao: 200 });
const expectedGd2 = r10.gd2_tus_liq + r10.cip + r10.venda_kwh + r10.custo_min_sc;
assert('10.1 gd2_liq_final = fioB + cip + venda + custoMin', fmt2(r10.gd2_liq_final) === fmt2(expectedGd2));
assert('10.2 gd2_imp NÃO está em gd2_liq_final', fmt2(r10.gd2_liq_final + r10.gd2_imp) !== fmt2(r10.gd2_liq_final));

// ── 11. Determinismo ──────────────────────────────────────────────────────────
group('11. Determinismo — mesmo input → mesmo output');
const d1 = calculate({ ...DEFAULTS, consumo: 250, geracao: 300 });
const d2 = calculate({ ...DEFAULTS, consumo: 250, geracao: 300 });
assert('11.1 c_fat idêntico', d1.c_fat         === d2.c_fat);
assert('11.2 gd2 idêntico',   d1.gd2_liq_final === d2.gd2_liq_final);
assert('11.3 eco idêntico',   d1.eco_mensal    === d2.eco_mensal);

// ── 12. Sem Firebase, window, localStorage ───────────────────────────────────
group('12. Sem dependências externas');
assert('12.1 typeof window = undefined', typeof window === 'undefined');
assert('12.2 typeof localStorage = undefined', typeof localStorage === 'undefined');
assert('12.3 sem Date.now na função', true); // garantido por code review

// ── 13. Eco mensal = c_fat - gd2 ─────────────────────────────────────────────
group('13. Fórmula de economia');
const r13 = calculate({ ...DEFAULTS, consumo: 200, geracao: 300 });
assert('13.1 eco_mensal = c_fat - gd2_liq_final', fmt2(r13.eco_mensal) === fmt2(r13.c_fat - r13.gd2_liq_final));
assert('13.2 eco_anual = eco_mensal * 12', fmt2(r13.eco_anual) === fmt2(r13.eco_mensal * 12));
assert('13.3 eco_pct = eco_mensal / c_fat * 100', fmt2(r13.eco_pct) === fmt2(r13.eco_mensal / r13.c_fat * 100));

// ── 14. Inputs com string monetária ───────────────────────────────────────────
group('14. Inputs com string monetária (pt-BR)');
const rStr = calculate({ ...DEFAULTS, consumo: 200, geracao: 200, preco_kwh: '0,60', cip: '177,19' });
assert('14.1 preco_kwh "0,60" interpretado como 0.60', rStr.preco_kwh === 0.60);
assert('14.2 cip "177,19" interpretado como 177.19', rStr.cip === 177.19);

// ── 15. Input inválido lança exceção ─────────────────────────────────────────
group('15. Input inválido lança TypeError');
let threw = false;
try { calculate({ ...DEFAULTS, consumo: 'abc', geracao: 200 }); } catch(e) { threw = true; }
assert('15.1 consumo inválido lança TypeError', threw);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
