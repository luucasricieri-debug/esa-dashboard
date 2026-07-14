/**
 * ESA OS — Importers / Energy Utility Bills
 * UtilityBillDuplicateDetector
 *
 * Detecta duplicidade por beneficiaryUnitId + referenceMonth.
 * Compara campos financeiros e operacionais quando disponíveis.
 * Comparações ordenadas deterministicamente.
 */

import { UtilityBillResult } from './utility-bill-result.js';

// ── Campos de comparação (ordem determinística) ───────────────────────────────

const COMPARISON_FIELDS = Object.freeze([
  'monthlyConsumptionKwh',
  'te',
  'tusd',
  'fioB',
  'bandeira',
  'cip',
  'taxes',
  'minimumBillableKwh',
  'totalUtilityBillAmount',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function _extractFieldValue(record, field) {
  if (field === 'monthlyConsumptionKwh') return record.monthlyConsumptionKwh ?? null;
  if (field === 'minimumBillableKwh')   return record.utilityBillData?.minimumBillableKwh ?? null;
  if (field === 'totalUtilityBillAmount') return record.utilityBillData?.totalUtilityBillAmount ?? null;
  return record.utilityBillData?.components?.[field] ?? null;
}

function _extractIncomingValue(extraction, field) {
  if (field === 'monthlyConsumptionKwh') return extraction?.monthlyConsumptionKwh ?? null;
  if (field === 'minimumBillableKwh')   return extraction?.minimumBillableKwh    ?? null;
  if (field === 'totalUtilityBillAmount') return extraction?.totalUtilityBillAmount ?? null;
  return extraction?.components?.[field] ?? null;
}

function _buildComparison(existingRecord, extraction) {
  return COMPARISON_FIELDS.map(field => {
    const currentValue  = _extractFieldValue(existingRecord, field);
    const incomingValue = _extractIncomingValue(extraction, field);
    const changed       = currentValue !== incomingValue && !(currentValue === null && incomingValue === null);
    return Object.freeze({ field, currentValue, incomingValue, changed });
  });
}

function _findDuplicate(beneficiaryUnitId, referenceMonth, existingMonthlyRecords) {
  for (const rec of existingMonthlyRecords) {
    if (rec.beneficiaryUnitId === beneficiaryUnitId && rec.referenceMonth === referenceMonth) {
      return rec;
    }
  }
  return null;
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class UtilityBillDuplicateDetector {

  detect(beneficiaryUnitId, referenceMonth, existingMonthlyRecords, extraction = null) {
    if (!beneficiaryUnitId || !referenceMonth) {
      return UtilityBillResult.fail([
        UtilityBillResult.makeError('REQUIRED', 'beneficiaryUnitId e referenceMonth são obrigatórios', null),
      ]);
    }
    const records = Array.isArray(existingMonthlyRecords) ? existingMonthlyRecords : [];
    const existing = _findDuplicate(beneficiaryUnitId, referenceMonth, records);
    const comparison = existing ? _buildComparison(existing, extraction) : [];

    return UtilityBillResult.ok({
      duplicate:      existing !== null,
      existingRecord: existing ?? null,
      comparison,
    });
  }
}
