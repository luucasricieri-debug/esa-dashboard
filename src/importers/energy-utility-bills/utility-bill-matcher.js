/**
 * ESA OS — Importers / Energy Utility Bills
 * UtilityBillMatcher
 *
 * Faz matching de extração contra lista de UC beneficiárias.
 * Prioridade: UC exata > CPF/CNPJ exato.
 * Ambiguidade explicitada — nunca escolhida silenciosamente.
 * Não cria beneficiária.
 */

import { UtilityBillResult }     from './utility-bill-result.js';
import { UTILITY_BILL_MATCH_TYPE, UTILITY_BILL_ERROR_CODE } from './utility-bill-types.js';

// ── Helpers de normalização para comparação ───────────────────────────────────

function _normalizeUc(raw) {
  if (!raw) return null;
  return String(raw).trim().replace(/[\s\-\.\/]/g, '').toUpperCase();
}

function _normalizeDoc(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

function _unitNormalizedUc(unit) {
  return _normalizeUc(unit.uc);
}

function _unitNormalizedDoc(unit) {
  return _normalizeDoc(unit.holderDocument || unit.holderCpfCnpj || unit.document || unit.cpfCnpj);
}

// ── Lógica de busca ───────────────────────────────────────────────────────────

function _findByUc(units, extractionUc) {
  if (!extractionUc) return [];
  return units.filter(u => _unitNormalizedUc(u) === extractionUc);
}

function _findByDoc(units, extractionDoc) {
  if (!extractionDoc) return [];
  return units.filter(u => {
    const d = _unitNormalizedDoc(u);
    return d && d === extractionDoc;
  });
}

function _buildMatchResult(matched, matchType, unit, candidates, meta = {}) {
  return { matched, matchType, beneficiaryUnit: unit, candidates, metadata: meta };
}

function _ambiguousResult(candidates, matchType) {
  return UtilityBillResult.fail([
    UtilityBillResult.makeError(
      UTILITY_BILL_ERROR_CODE.AMBIGUOUS_BENEFICIARY_MATCH,
      `Mais de uma beneficiária encontrada para ${matchType}: ${candidates.map(u => u.id).join(', ')}`,
      matchType,
      { candidateIds: candidates.map(u => u.id) },
    ),
  ], [], { candidates });
}

function _unmatchedResult(extractionUc, extractionDoc) {
  return UtilityBillResult.ok(
    _buildMatchResult(false, UTILITY_BILL_MATCH_TYPE.NONE, null, [], { extractionUc, extractionDoc }),
    [],
    { status: 'unmatched' },
  );
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class UtilityBillMatcher {

  match(extraction, beneficiaryUnits) {
    if (!extraction || typeof extraction !== 'object') {
      return UtilityBillResult.fail([UtilityBillResult.makeError(
        UTILITY_BILL_ERROR_CODE.INVALID_UTILITY_BILL_EXTRACTION, 'Extraction é obrigatória', null,
      )]);
    }
    const units = Array.isArray(beneficiaryUnits) ? beneficiaryUnits : [];

    const extractionUc  = extraction.uc  || _normalizeUc(extraction.ucOriginal);
    const extractionDoc = extraction.customerDocumentDigits || _normalizeDoc(extraction.customerDocument);

    return this._runMatch(units, extractionUc, extractionDoc);
  }

  _runMatch(units, extractionUc, extractionDoc) {
    const byUc = _findByUc(units, extractionUc);
    if (byUc.length === 1) {
      return UtilityBillResult.ok(_buildMatchResult(true, UTILITY_BILL_MATCH_TYPE.UC_EXACT, byUc[0], byUc));
    }
    if (byUc.length > 1) return _ambiguousResult(byUc, 'uc-exact');

    const byDoc = _findByDoc(units, extractionDoc);
    if (byDoc.length === 1) {
      return UtilityBillResult.ok(_buildMatchResult(true, UTILITY_BILL_MATCH_TYPE.DOCUMENT_EXACT, byDoc[0], byDoc));
    }
    if (byDoc.length > 1) return _ambiguousResult(byDoc, 'document-exact');

    return _unmatchedResult(extractionUc, extractionDoc);
  }
}
