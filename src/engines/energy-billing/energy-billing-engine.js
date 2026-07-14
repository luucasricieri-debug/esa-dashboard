/**
 * ESA OS — Engines / Energy Billing
 * Billing Engine — orquestra cálculo, snapshot e resultado.
 *
 * NÃO acessa Firebase.
 * NÃO acessa UI.
 * NÃO usa Date.now, Math.random, crypto.randomUUID.
 */

import { calculate }            from './legacy-copel-calculation-adapter.js';
import { buildBillingSnapshot } from './energy-billing-snapshot.js';
import { EnergyBillingResult }  from './energy-billing-result.js';
import { parseCurrency }        from './currency-parser.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['consumo', 'cip', 'te_com', 'te_sem', 'tusd_com', 'tus_sem', 'icms_pct', 'cofins_pct', 'pis_pct', 'geracao', 'uc_prop', 'minimo', 'preco_kwh', 'desc_dist', 'bndv'];

// ── Engine ────────────────────────────────────────────────────────────────────

export class EnergyBillingEngine {

  /**
   * Calcula o faturamento de um beneficiário.
   *
   * @param {object} input
   * @param {string}  [input.referenceMonth]      - YYYY-MM
   * @param {string}  [input.generatingUnitId]
   * @param {string}  [input.beneficiaryUnitId]
   * @param {object}  input.tariffs               - campos tarifários (te_com, tusd_com, etc.)
   * @param {object}  input.operational            - campos operacionais (consumo, geracao, etc.)
   * @param {object}  [input.settlementRecipient]  - dados PIX/recebedor
   * @param {object}  [input.metadata]
   * @returns {EnergyBillingResult}
   */
  calculateBeneficiaryBilling(input = {}) {
    const validation = this._validateInput(input);
    if (!validation.ok) return EnergyBillingResult.fail(validation.errors);

    const rawInputs = this._mergeInputs(input);
    let mem;
    try {
      mem = calculate(rawInputs);
    } catch (e) {
      return EnergyBillingResult.fail([EnergyBillingResult.makeError('CALCULATION_FAILED', String(e.message || e))]);
    }

    const snapshot = buildBillingSnapshot({
      referenceMonth:    input.referenceMonth    || null,
      generatingUnitId:  input.generatingUnitId  || null,
      beneficiaryUnitId: input.beneficiaryUnitId || null,
      inputs:            rawInputs,
      mem,
      settlementRecipient: input.settlementRecipient || null,
      metadata:          input.metadata || {},
    });

    return EnergyBillingResult.ok(snapshot, [], { referenceMonth: input.referenceMonth || null });
  }

  /**
   * Constrói o histórico de economia acumulada a partir de uma lista de snapshots mensais.
   *
   * @param {object[]} snapshots - array de billing snapshots ordenados por referenceMonth
   * @returns {object[]} beneficiarySavingsHistory
   */
  buildSavingsHistory(snapshots = []) {
    if (!Array.isArray(snapshots)) return [];
    let accumulated = 0;
    return snapshots.map(s => {
      const monthly = s.economiaMensal || 0;
      accumulated += monthly;
      return Object.freeze({
        referenceMonth:    s.referenceMonth    || null,
        billWithoutEsa:    s.contaConcessionaria?.total || null,
        billWithEsa:       s.contaEsa?.total            || null,
        monthlySavings:    monthly,
        savingsPercentage: s.economiaPercentual          || 0,
        accumulatedSavings: accumulated,
      });
    });
  }

  _validateInput(input) {
    if (!input || typeof input !== 'object') {
      return { ok: false, errors: [EnergyBillingResult.makeError('INVALID_INPUT', 'input deve ser objeto')] };
    }
    const merged = this._mergeInputs(input);
    const errors = [];
    for (const f of REQUIRED_FIELDS) {
      const v = merged[f];
      const n = typeof v === 'string' ? parseCurrency(v) : v;
      if (n === null || n === undefined || typeof n !== 'number' || isNaN(n)) {
        errors.push(EnergyBillingResult.makeError('MISSING_FIELD', `Campo obrigatório inválido: ${f}`, f, v));
      }
    }
    return { ok: errors.length === 0, errors };
  }

  _mergeInputs(input) {
    return Object.assign({}, input.tariffs || {}, input.operational || {}, {
      bndv:      input.bndv      ?? input.tariffs?.bndv      ?? 0,
      desc_dist: input.desc_dist ?? input.tariffs?.desc_dist ?? 0,
      uc_prop:   input.uc_prop   ?? input.operational?.uc_prop ?? 0,
    });
  }
}
