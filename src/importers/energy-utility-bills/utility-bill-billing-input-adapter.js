/**
 * ESA OS — Importers / Energy Utility Bills
 * buildBillingInputFromUtilityBillMonthlyRecord
 *
 * Monta input para o EnergyBillingEngine a partir de um registro mensal de fatura.
 * NÃO executa cálculo. NÃO inventa tarifa. NÃO assume defaults silenciosos.
 * Campos não disponíveis na fatura devem ser fornecidos via context.
 */

import { UtilityBillResult }     from './utility-bill-result.js';
import { UTILITY_BILL_ERROR_CODE } from './utility-bill-types.js';

// ── Campos obrigatórios do Billing Engine (legacy COPEL) ─────────────────────

const REQUIRED_TARIFF_FIELDS    = ['te_com', 'te_sem', 'tusd_com', 'tus_sem', 'icms_pct', 'cofins_pct', 'pis_pct'];
const REQUIRED_OPERATIONAL_FIELDS = ['consumo', 'cip', 'geracao', 'uc_prop', 'minimo', 'preco_kwh', 'desc_dist', 'bndv'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isValidNum(v) {
  return typeof v === 'number' && !isNaN(v);
}

function _extractFromRecord(monthlyRecord) {
  const comp = monthlyRecord?.utilityBillData?.components;
  return {
    consumo: monthlyRecord?.monthlyConsumptionKwh ?? null,
    cip:     comp?.cip                            ?? null,
    minimo:  monthlyRecord?.utilityBillData?.minimumBillableKwh ?? null,
  };
}

function _mergeOperational(fromRecord, contextOperational) {
  return Object.assign({}, fromRecord, contextOperational || {});
}

function _findMissingFields(merged, contextTariffs) {
  const allFields = { ...contextTariffs, ...merged };
  const missing = [];
  for (const f of REQUIRED_TARIFF_FIELDS) {
    if (!_isValidNum(Number(allFields[f]))) missing.push(f);
  }
  for (const f of REQUIRED_OPERATIONAL_FIELDS) {
    if (!_isValidNum(Number(allFields[f]))) missing.push(f);
  }
  return missing;
}

function _buildMissingErrors(missingFields) {
  return missingFields.map(f =>
    UtilityBillResult.makeError(
      UTILITY_BILL_ERROR_CODE.UTILITY_BILL_BILLING_INPUT_INCOMPLETE,
      `Campo obrigatório ausente para o Billing Engine: ${f}`,
      f,
    ),
  );
}

function _buildInput(monthlyRecord, tariffs, operational) {
  return {
    referenceMonth:    monthlyRecord.referenceMonth    || null,
    beneficiaryUnitId: monthlyRecord.beneficiaryUnitId || null,
    generatingUnitId:  monthlyRecord.generatingUnitId  || null,
    tariffs:           { ...tariffs },
    operational:       { ...operational },
  };
}

// ── Função exportada ──────────────────────────────────────────────────────────

export function buildBillingInputFromUtilityBillMonthlyRecord(monthlyRecord, context = {}) {
  if (!monthlyRecord || typeof monthlyRecord !== 'object') {
    return UtilityBillResult.fail([
      UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.INVALID_UTILITY_BILL_EXTRACTION, 'monthlyRecord é obrigatório', null),
    ]);
  }
  const tariffs           = context.tariffs     || {};
  const contextOperational = context.operational || {};
  const fromRecord        = _extractFromRecord(monthlyRecord);
  const operational       = _mergeOperational(fromRecord, contextOperational);
  const missing           = _findMissingFields(operational, tariffs);

  if (missing.length > 0) {
    return UtilityBillResult.fail(_buildMissingErrors(missing), [], { missingFields: missing });
  }
  return UtilityBillResult.ok(_buildInput(monthlyRecord, tariffs, operational));
}
