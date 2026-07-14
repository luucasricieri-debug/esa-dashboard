/**
 * ESA OS — Engines / Energy Billing
 * Legacy COPEL Calculation Adapter
 *
 * Implementa literalmente a lógica da calculadora oficial ESA Energia.
 * Fonte: calculadora_html.html (index.html) do repositório esa-calculadora-energia.
 *
 * Preserva nomes de variáveis legacy para rastreabilidade.
 * Preserva ordem das operações.
 * Sem arredondamentos intermediários (idêntico ao JS original).
 * NÃO usa Date.now, Math.random, Firebase, window, localStorage.
 */

import { parseCurrency } from './currency-parser.js';

// ── Validação de inputs ───────────────────────────────────────────────────────

function _requireNumber(val, field) {
  const n = typeof val === 'string' ? parseCurrency(val) : val;
  if (typeof n !== 'number' || isNaN(n)) {
    throw new TypeError(`[LegacyCopelAdapter] Campo inválido: ${field} = ${val}`);
  }
  return n;
}

function _parseInputs(raw) {
  return {
    consumo:     _requireNumber(raw.consumo,    'consumo'),
    cip:         _requireNumber(raw.cip,        'cip'),
    te_com:      _requireNumber(raw.te_com,     'te_com'),
    te_sem:      _requireNumber(raw.te_sem,     'te_sem'),
    tusd_com:    _requireNumber(raw.tusd_com,   'tusd_com'),
    tus_sem:     _requireNumber(raw.tus_sem,    'tus_sem'),
    icms_pct:    _requireNumber(raw.icms_pct,   'icms_pct'),
    cofins_pct:  _requireNumber(raw.cofins_pct, 'cofins_pct'),
    pis_pct:     _requireNumber(raw.pis_pct,    'pis_pct'),
    geracao:     _requireNumber(raw.geracao,    'geracao'),
    uc_prop:     _requireNumber(raw.uc_prop,    'uc_prop'),
    minimo:      _requireNumber(raw.minimo,     'minimo'),
    preco_kwh:   _requireNumber(raw.preco_kwh,  'preco_kwh'),
    desc_dist:   _requireNumber(raw.desc_dist,  'desc_dist'),
    bndv:        _requireNumber(raw.bndv,       'bndv'),
  };
}

// ── Copel Normal ──────────────────────────────────────────────────────────────

function _calcCopelNormal(i) {
  const c_te   = i.consumo * (i.te_com + i.bndv);
  const c_tusd = i.consumo * i.tusd_com;
  const c_fat  = c_te + c_tusd + i.cip;
  return { c_te, c_tusd, c_fat };
}

function _calcCopelTaxes(i, c_te, c_tusd) {
  const c_base_icms    = c_te + c_tusd;
  const c_icms         = c_base_icms * i.icms_pct;
  const c_base_piscof  = c_base_icms - c_icms;
  const c_cofins       = c_base_piscof * i.cofins_pct;
  const c_pis          = c_base_piscof * i.pis_pct;
  const c_imp          = c_icms + c_cofins + c_pis;
  return { c_base_icms, c_icms, c_base_piscof, c_cofins, c_pis, c_imp };
}

// ── GD2 ───────────────────────────────────────────────────────────────────────

function _calcGd2Credits(i, c_te, c_tusd) {
  const cred_te    = i.consumo * (i.te_sem + i.bndv);
  const cred_tus   = i.consumo * i.tus_sem;
  const fio_b      = i.consumo * (i.tusd_com - i.tus_sem);
  const gd2_te_liq = c_te - cred_te;
  const gd2_tus_liq = c_tusd - cred_tus;
  return { cred_te, cred_tus, fio_b, gd2_te_liq, gd2_tus_liq };
}

function _calcGd2Taxes(i, c_tusd, gd2_tus_liq) {
  const gd2_base_icms    = c_tusd;
  const gd2_icms         = gd2_base_icms * i.icms_pct;
  const gd2_base_piscof  = gd2_tus_liq - gd2_icms;
  const gd2_cofins       = gd2_base_piscof * i.cofins_pct;
  const gd2_pis          = gd2_base_piscof * i.pis_pct;
  const gd2_imp          = gd2_icms + gd2_cofins + gd2_pis;
  return { gd2_base_icms, gd2_icms, gd2_base_piscof, gd2_cofins, gd2_pis, gd2_imp };
}

// ── Venda de Créditos ─────────────────────────────────────────────────────────

function _calcCreditSale(i) {
  const cred_disp       = Math.max(i.geracao - i.uc_prop - i.minimo, 0);
  const cred_comp_uc    = i.consumo;
  const cred_excedente  = Math.max(cred_disp - cred_comp_uc, 0);
  const custo_min       = i.minimo * (i.te_com + i.bndv) + i.minimo * i.tusd_com + i.cip;
  const rec_bruta       = cred_excedente * i.preco_kwh;
  const rec_liq         = rec_bruta * (1 - i.desc_dist);
  const venda_kwh       = (i.geracao - i.minimo) * i.preco_kwh;
  const custo_min_sc    = i.minimo * (i.te_com + i.bndv) + i.minimo * i.tusd_com;
  return { cred_disp, cred_comp_uc, cred_excedente, custo_min, rec_bruta, rec_liq, venda_kwh, custo_min_sc };
}

function _calcFinalAndEconomy(c_fat, gd2_tus_liq, venda_kwh, custo_min_sc, cip) {
  const gd2_liq_final = gd2_tus_liq + cip + venda_kwh + custo_min_sc;
  const eco_mensal    = c_fat - gd2_liq_final;
  const eco_pct       = c_fat > 0 ? (eco_mensal / c_fat) * 100 : 0;
  const eco_anual     = eco_mensal * 12;
  return { gd2_liq_final, eco_mensal, eco_pct, eco_anual };
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Calcula fatura COPEL normal vs ESA GD2.
 * Todos os inputs são obrigatórios e já em unidade base (não %).
 *
 * @param {object} rawInputs
 * @returns {object} memória de cálculo completa (variáveis legacy)
 */
export function calculate(rawInputs) {
  const i = _parseInputs(rawInputs);

  const { c_te, c_tusd, c_fat }                           = _calcCopelNormal(i);
  const copelTax                                           = _calcCopelTaxes(i, c_te, c_tusd);
  const { cred_te, cred_tus, fio_b, gd2_te_liq, gd2_tus_liq } = _calcGd2Credits(i, c_te, c_tusd);
  const gd2Tax                                             = _calcGd2Taxes(i, c_tusd, gd2_tus_liq);
  const sale                                               = _calcCreditSale(i);
  const fin                                                = _calcFinalAndEconomy(c_fat, gd2_tus_liq, sale.venda_kwh, sale.custo_min_sc, i.cip);

  return {
    // inputs passados adiante para snapshot
    consumo: i.consumo, cip: i.cip, te_com: i.te_com, te_sem: i.te_sem,
    tusd_com: i.tusd_com, tus_sem: i.tus_sem, icms_pct: i.icms_pct,
    cofins_pct: i.cofins_pct, pis_pct: i.pis_pct, geracao: i.geracao,
    uc_prop: i.uc_prop, minimo: i.minimo, preco_kwh: i.preco_kwh,
    desc_dist: i.desc_dist, bndv: i.bndv,
    // Copel normal
    c_te, c_tusd, c_fat,
    // Copel taxes
    ...copelTax,
    // GD2 credits
    cred_te, cred_tus, fio_b, gd2_te_liq, gd2_tus_liq,
    // GD2 taxes
    ...gd2Tax,
    // Credit sale
    ...sale,
    // Final
    ...fin,
  };
}
