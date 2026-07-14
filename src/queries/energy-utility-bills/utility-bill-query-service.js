/**
 * ESA OS — Queries / Energy Utility Bills
 * UtilityBillQueryService
 *
 * Arquitetura: query service específico para workflow de ingestão de faturas.
 * Razão: separar o workflow de ingestão do EnergyCreditsQueryService evita
 * poluição de responsabilidades — faturas da distribuidora são dados externos
 * que passam por um fluxo de review antes de se tornarem dados operacionais.
 *
 * Lê diretamente do UtilityBillImportService (fonte de verdade em memória).
 * Sem Firebase. Sem efeitos colaterais. Sem estado próprio.
 */

import { UtilityBillResult }       from '../../importers/energy-utility-bills/utility-bill-result.js';
import { UTILITY_BILL_IMPORT_STATUS } from '../../importers/energy-utility-bills/utility-bill-types.js';

// ── Helpers de filtro ─────────────────────────────────────────────────────────

function _applyFilters(records, filters) {
  let result = records;
  if (filters.status          != null) result = result.filter(r => r.status          === filters.status);
  if (filters.referenceMonth  != null) result = result.filter(r => r.referenceMonth  === filters.referenceMonth);
  if (filters.uc              != null) result = result.filter(r => r.extraction?.uc  === filters.uc);
  if (filters.beneficiaryUnitId != null) result = result.filter(r => r.beneficiaryUnitId === filters.beneficiaryUnitId);
  if (filters.utilityCompany  != null) result = result.filter(r => r.extraction?.utilityCompany === filters.utilityCompany);
  if (filters.confidence      != null) result = result.filter(r => r.extraction?.confidence     === filters.confidence);
  return result;
}

function _sortById(records) {
  return [...records].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
}

function _buildDataSourceEntry(importRecord) {
  return {
    importId:         importRecord.id,
    status:           importRecord.status,
    dataSource:       importRecord.dataSource,
    sourceFileName:   importRecord.sourceFileName,
    referenceMonth:   importRecord.referenceMonth,
    beneficiaryUnitId: importRecord.beneficiaryUnitId,
    confidence:       importRecord.extraction?.confidence ?? null,
    matched:          importRecord.match?.matched ?? false,
    matchType:        importRecord.match?.matchType ?? null,
    duplicate:        importRecord.duplicate?.duplicate ?? false,
    confirmedAt:      importRecord.confirmedAt,
    confirmedBy:      importRecord.confirmedBy,
  };
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class UtilityBillQueryService {

  constructor(importService) {
    this._svc = importService || null;
  }

  _requireService(method) {
    if (!this._svc || typeof this._svc.listImports !== 'function') {
      throw new TypeError(`[UtilityBillQueryService.${method}] importService inválido`);
    }
  }

  getUtilityBillImport(id) {
    this._requireService('getUtilityBillImport');
    return this._svc.getImport(id);
  }

  searchUtilityBillImports(filters = {}) {
    this._requireService('searchUtilityBillImports');
    const listResult = this._svc.listImports(filters);
    if (!listResult.ok) return listResult;
    const sorted = _sortById(_applyFilters(listResult.data, {}));
    return UtilityBillResult.ok(sorted, [], { count: sorted.length, filters });
  }

  getUnlinkedUtilityBills(filters = {}) {
    this._requireService('getUnlinkedUtilityBills');
    const listResult = this._svc.listImports({ ...filters, status: UTILITY_BILL_IMPORT_STATUS.UNMATCHED });
    if (!listResult.ok) return listResult;
    const sorted = _sortById(listResult.data);
    return UtilityBillResult.ok(sorted, [], { count: sorted.length });
  }

  getBeneficiaryMonthlyDataSources(beneficiaryUnitId, filters = {}) {
    this._requireService('getBeneficiaryMonthlyDataSources');
    const listResult = this._svc.listImports({ ...filters, beneficiaryUnitId });
    if (!listResult.ok) return listResult;
    const sorted = _sortById(listResult.data)
      .map(_buildDataSourceEntry);
    return UtilityBillResult.ok(sorted, [], { count: sorted.length, beneficiaryUnitId });
  }
}
