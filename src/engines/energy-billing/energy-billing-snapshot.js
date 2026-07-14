/**
 * ESA OS — Engines / Energy Billing
 * Snapshot imutável de um cálculo de faturamento.
 *
 * calculationSource: "legacy-copel-calculator"
 * Consumido por UI e relatórios sem recalcular.
 */

export const SNAPSHOT_VERSION  = '1.0';
export const CALCULATION_SOURCE = 'legacy-copel-calculator';

/**
 * Monta e congela o snapshot de faturamento.
 *
 * @param {object} params
 * @returns {object} frozen snapshot
 */
export function buildBillingSnapshot(params) {
  const {
    referenceMonth      = null,
    generatingUnitId    = null,
    beneficiaryUnitId   = null,
    inputs,
    mem,
    settlementRecipient = null,
    metadata            = {},
  } = params;

  return Object.freeze({
    snapshotVersion:   SNAPSHOT_VERSION,
    calculationSource: CALCULATION_SOURCE,
    referenceMonth,
    generatingUnitId,
    beneficiaryUnitId,
    inputs:            Object.freeze({ ...inputs }),
    contaConcessionaria: Object.freeze(_contaConcessionaria(mem)),
    contaEsa:            Object.freeze(_contaEsa(mem)),
    economiaMensal:      mem.eco_mensal,
    economiaPercentual:  mem.eco_pct,
    economiaAnual:       mem.eco_anual,
    componentesTarifarios: Object.freeze(_componentesTarifarios(mem)),
    creditos:            Object.freeze(_creditos(mem)),
    settlementRecipient: settlementRecipient ? Object.freeze(_safeRecipient(settlementRecipient)) : null,
    calculationMemory:   Object.freeze({ ...mem }),
    metadata:            Object.freeze({ ...metadata, generatedAt: null }),
  });
}

function _contaConcessionaria(m) {
  return {
    total:  m.c_fat,
    te:     m.c_te,
    tusd:   m.c_tusd,
    cip:    m.cip,
    taxes:  Object.freeze({ icms: m.c_icms, cofins: m.c_cofins, pis: m.c_pis, total: m.c_imp }),
  };
}

function _contaEsa(m) {
  return {
    total:             m.gd2_liq_final,
    fioB:              m.gd2_tus_liq,
    cip:               m.cip,
    vendaKwh:          m.venda_kwh,
    custoMinimoSemCip: m.custo_min_sc,
    taxes:             Object.freeze({ icms: m.gd2_icms, cofins: m.gd2_cofins, pis: m.gd2_pis, total: m.gd2_imp }),
  };
}

function _componentesTarifarios(m) {
  return {
    te:          m.c_te,
    tusd:        m.c_tusd,
    fioB:        m.fio_b,
    bandeira:    m.bndv,
    cip:         m.cip,
    custoMinimo: Object.freeze({ comCip: m.custo_min, semCip: m.custo_min_sc }),
  };
}

function _creditos(m) {
  return {
    disponiveis:   m.cred_disp,
    compensados:   m.cred_comp_uc,
    excedentes:    m.cred_excedente,
    vendaKwh:      m.geracao - m.minimo,
    receitaBruta:  m.rec_bruta,
    receitaLiquida: m.rec_liq,
  };
}

function _safeRecipient(r) {
  return {
    recipientName:     r.name         || r.recipientName     || null,
    recipientDocument: r.document     || r.recipientDocument || null,
    pixKey:            r.pixKey       || null,
    pixKeyType:        r.pixKeyType   || null,
  };
}
