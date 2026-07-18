/**
 * ESA OS — Importers / Energy Utility Bills
 * UtilityBillImportService
 *
 * Orquestra o fluxo completo de importação de fatura da distribuidora.
 * Mantém estado interno em memória (_imports Map).
 * NÃO cria beneficiária automaticamente.
 * NÃO gera Fatura ESA automaticamente.
 * NÃO persiste em Firebase por padrão.
 * NÃO usa Date.now(), Math.random(), crypto.randomUUID().
 */

import { UtilityBillExtractionNormalizer } from './utility-bill-extraction-normalizer.js';
import { UtilityBillValidator }            from './utility-bill-validator.js';
import { UtilityBillMatcher }              from './utility-bill-matcher.js';
import { UtilityBillDuplicateDetector }    from './utility-bill-duplicate-detector.js';
import { UtilityBillResult }               from './utility-bill-result.js';
import {
  UTILITY_BILL_IMPORT_STATUS,
  UTILITY_BILL_DATA_SOURCE,
  UTILITY_BILL_MATCH_TYPE,
  UTILITY_BILL_ERROR_CODE,
  UTILITY_BILL_CONFIDENCE,
} from './utility-bill-types.js';

// ── Helpers internos ──────────────────────────────────────────────────────────

function _notFound(id) {
  return UtilityBillResult.fail([UtilityBillResult.makeError(
    UTILITY_BILL_ERROR_CODE.UTILITY_BILL_IMPORT_NOT_FOUND,
    `Import não encontrado: ${id}`, 'id',
  )]);
}

function _effectiveData(record) {
  if (!record.correctedData) return record.extraction;
  return Object.assign({}, record.extraction, record.correctedData);
}

function _initialStatus(confidence) {
  return confidence === UTILITY_BILL_CONFIDENCE.REVIEW || confidence === UTILITY_BILL_CONFIDENCE.UNIDENTIFIED
    ? UTILITY_BILL_IMPORT_STATUS.REVIEW
    : UTILITY_BILL_IMPORT_STATUS.EXTRACTED;
}

function _buildRecord(extraction, options = {}) {
  return {
    id:                extraction.id,
    status:            _initialStatus(extraction.confidence),
    extraction,
    match:             null,
    duplicate:         null,
    correctedData:     null,
    beneficiaryUnitId: null,
    generatingUnitId:  null,
    referenceMonth:    extraction.referenceMonth,
    dataSource:        UTILITY_BILL_DATA_SOURCE.UTILITY_BILL_IMPORT,
    sourceFileName:    extraction.fileName,
    confirmedAt:       null,
    confirmedBy:       null,
    replacedAt:        null,
    replacementReason: null,
    metadata:          options.metadata || {},
  };
}

function _persistRecord(record, repository) {
  if (!repository || typeof repository.saveUtilityBillImport !== 'function') {
    return UtilityBillResult.fail([UtilityBillResult.makeError(
      UTILITY_BILL_ERROR_CODE.UTILITY_BILL_REPOSITORY_REQUIRED,
      'Repository com saveUtilityBillImport é obrigatório quando persist=true', 'repository',
    )]);
  }
  return repository.saveUtilityBillImport(record);
}

function _buildMonthlyRecordId(beneficiaryUnitId, referenceMonth) {
  return `ubm-${beneficiaryUnitId}-${referenceMonth}`;
}

function _buildMonthlyRecord(importRecord, data, options = {}) {
  const bid   = importRecord.beneficiaryUnitId;
  const gid   = importRecord.generatingUnitId;
  const month = importRecord.referenceMonth || data?.referenceMonth;
  return {
    id:                   _buildMonthlyRecordId(bid, month),
    beneficiaryUnitId:    bid,
    generatingUnitId:     gid,
    referenceMonth:       month,
    monthlyConsumptionKwh: data?.monthlyConsumptionKwh ?? null,
    dataSource:           UTILITY_BILL_DATA_SOURCE.UTILITY_BILL_IMPORT,
    sourceImportId:       importRecord.id,
    sourceFileName:       importRecord.sourceFileName,
    utilityBillData: {
      uc:                   data?.uc             ?? null,
      utilityCompany:       data?.utilityCompany ?? null,
      components:           data?.components     ?? null,
      minimumBillableKwh:   data?.minimumBillableKwh    ?? null,
      totalUtilityBillAmount: data?.totalUtilityBillAmount ?? null,
    },
    status: 'review',
  };
}

function _persistMonthlyRecord(monthlyRecord, options) {
  if (!options.persistMonthlyRecord) return null;
  if (!options.repository || typeof options.repository.saveBeneficiaryMonthlyRecord !== 'function') {
    return UtilityBillResult.fail([UtilityBillResult.makeError(
      UTILITY_BILL_ERROR_CODE.UTILITY_BILL_REPOSITORY_REQUIRED,
      'Repository com saveBeneficiaryMonthlyRecord é obrigatório quando persistMonthlyRecord=true', 'repository',
    )]);
  }
  return options.repository.saveBeneficiaryMonthlyRecord(monthlyRecord);
}

function _checkConfirmPreconditions(record) {
  if (record.status === UTILITY_BILL_IMPORT_STATUS.DISCARDED) {
    return UtilityBillResult.makeError('UTILITY_BILL_DISCARDED', 'Import descartado não pode ser confirmado', 'status');
  }
  if (!record.beneficiaryUnitId) {
    return UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_BENEFICIARY_REQUIRED, 'beneficiaryUnitId é obrigatório', 'beneficiaryUnitId');
  }
  if (!record.generatingUnitId) {
    return UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_GENERATING_UNIT_REQUIRED, 'generatingUnitId é obrigatório', 'generatingUnitId');
  }
  if (record.duplicate?.duplicate && !record._allowDuplicate) {
    return UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_MONTHLY_RECORD_DUPLICATE, 'Duplicidade detectada. Use replaceMonthlyRecord ou defina allowDuplicate.', 'duplicate');
  }
  return null;
}

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

// ── Classe ────────────────────────────────────────────────────────────────────

export class UtilityBillImportService {

  constructor() {
    this._imports    = new Map();
    this._normalizer = new UtilityBillExtractionNormalizer();
    this._validator  = new UtilityBillValidator();
    this._matcher    = new UtilityBillMatcher();
    this._dupDetector = new UtilityBillDuplicateDetector();
  }

  createImport(rawExtraction, options = {}) {
    const normResult = this._normalizer.normalize(rawExtraction);
    if (!normResult.ok) return normResult;

    const validResult = this._validator.validate(normResult.data);
    if (!validResult.ok) return validResult;

    const extraction = normResult.data;
    const record     = _buildRecord(extraction, options);
    this._imports.set(record.id, record);

    if (options.persist) {
      const persisted = _persistRecord(record, options.repository);
      if (persisted && !persisted.ok) return persisted;
    }
    return UtilityBillResult.ok(record, validResult.warnings);
  }

  matchImport(importId, beneficiaryUnits, options = {}) {
    const record = this._imports.get(importId);
    if (!record) return _notFound(importId);

    const matchResult = this._matcher.match(record.extraction, beneficiaryUnits);
    if (!matchResult.ok) {
      const updated = Object.assign({}, record, { status: UTILITY_BILL_IMPORT_STATUS.REVIEW, match: { matched: false, matchType: UTILITY_BILL_MATCH_TYPE.NONE, beneficiaryUnit: null, candidates: matchResult.metadata?.candidates || [], metadata: { ambiguous: true } } });
      this._imports.set(importId, updated);
      return matchResult;
    }

    const matched   = matchResult.data.matched;
    const matchData = matchResult.data;
    const updated   = Object.assign({}, record, {
      status:            matched ? UTILITY_BILL_IMPORT_STATUS.MATCHED : UTILITY_BILL_IMPORT_STATUS.UNMATCHED,
      match:             matchData,
      beneficiaryUnitId: matchData.beneficiaryUnit?.id || null,
      generatingUnitId:  matchData.beneficiaryUnit?.generatingUnitId || null,
    });
    this._imports.set(importId, updated);

    if (options.persist) _persistRecord(updated, options.repository);
    return UtilityBillResult.ok(updated);
  }

  linkImportToBeneficiary(importId, beneficiaryUnitId, context = {}) {
    const record = this._imports.get(importId);
    if (!record) return _notFound(importId);
    if (!beneficiaryUnitId) {
      return UtilityBillResult.fail([UtilityBillResult.makeError(
        UTILITY_BILL_ERROR_CODE.UTILITY_BILL_BENEFICIARY_REQUIRED, 'beneficiaryUnitId é obrigatório', 'beneficiaryUnitId',
      )]);
    }
    const units = Array.isArray(context.beneficiaryUnits) ? context.beneficiaryUnits : [];
    const unit  = units.find(u => u.id === beneficiaryUnitId) || null;

    const updated = Object.assign({}, record, {
      status: UTILITY_BILL_IMPORT_STATUS.MATCHED,
      match:  { matched: true, matchType: UTILITY_BILL_MATCH_TYPE.MANUAL, beneficiaryUnit: unit, candidates: unit ? [unit] : [], metadata: { manualLink: true } },
      beneficiaryUnitId,
      generatingUnitId: unit?.generatingUnitId || null,
    });
    this._imports.set(importId, updated);
    return UtilityBillResult.ok(updated);
  }

  prepareBeneficiaryFromImport(importId) {
    const record = this._imports.get(importId);
    if (!record) return _notFound(importId);
    const data = _effectiveData(record);
    return UtilityBillResult.ok({
      name:           data?.customerName     ?? null,
      document:       data?.customerDocument ?? null,
      uc:             data?.uc               ?? null,
      utilityCompany: data?.utilityCompany   ?? null,
    });
  }

  reviewImport(importId, correctedData, options = {}) {
    const record = this._imports.get(importId);
    if (!record) return _notFound(importId);

    const merged     = Object.assign({}, _effectiveData(record), correctedData || {});
    const normResult = this._normalizer.normalize(merged);
    if (!normResult.ok) return normResult;

    const validResult = this._validator.validate(normResult.data);
    if (!validResult.ok) return validResult;

    const updated = Object.assign({}, record, {
      status:        UTILITY_BILL_IMPORT_STATUS.REVIEW,
      correctedData: normResult.data,
    });
    this._imports.set(importId, updated);
    return UtilityBillResult.ok(updated, validResult.warnings);
  }

  detectDuplicate(importId, existingMonthlyRecords, options = {}) {
    const record = this._imports.get(importId);
    if (!record) return _notFound(importId);

    const data   = _effectiveData(record);
    const result = this._dupDetector.detect(
      record.beneficiaryUnitId,
      record.referenceMonth || data?.referenceMonth,
      existingMonthlyRecords,
      data,
    );
    if (!result.ok) return result;

    const isDup  = result.data.duplicate;
    const updated = Object.assign({}, record, {
      duplicate: result.data,
      status:    isDup ? UTILITY_BILL_IMPORT_STATUS.DUPLICATE : record.status,
    });
    this._imports.set(importId, updated);
    return UtilityBillResult.ok(updated);
  }

  confirmMonthlyRecord(importId, options = {}) {
    const record = this._imports.get(importId);
    if (!record) return _notFound(importId);

    const flaggedRecord = options.allowDuplicate
      ? Object.assign({}, record, { _allowDuplicate: true })
      : record;

    const precondErr = _checkConfirmPreconditions(flaggedRecord);
    if (precondErr) return UtilityBillResult.fail([precondErr]);

    const data         = _effectiveData(record);
    const monthlyRecord = _buildMonthlyRecord(record, data, options);
    const persistErr   = _persistMonthlyRecord(monthlyRecord, options);
    if (persistErr && !persistErr.ok) return persistErr;

    const updated = Object.assign({}, record, {
      status:      UTILITY_BILL_IMPORT_STATUS.CONFIRMED,
      confirmedAt: options.referenceDate || null,
      confirmedBy: options.confirmedBy   || null,
    });
    delete updated._allowDuplicate;
    this._imports.set(importId, updated);
    return UtilityBillResult.ok({ importRecord: updated, monthlyRecord });
  }

  replaceMonthlyRecord(importId, replacementReason, options = {}) {
    if (!replacementReason) {
      return UtilityBillResult.fail([UtilityBillResult.makeError(
        UTILITY_BILL_ERROR_CODE.UTILITY_BILL_REPLACEMENT_REASON_REQUIRED, 'replacementReason é obrigatório', 'replacementReason',
      )]);
    }
    const record = this._imports.get(importId);
    if (!record) return _notFound(importId);
    if (!record.beneficiaryUnitId) {
      return UtilityBillResult.fail([UtilityBillResult.makeError(
        UTILITY_BILL_ERROR_CODE.UTILITY_BILL_NOT_MATCHED, 'Import deve estar matched para substituição', 'status',
      )]);
    }
    const data         = _effectiveData(record);
    const monthlyRecord = _buildMonthlyRecord(record, data, options);
    const persistErr   = _persistMonthlyRecord(monthlyRecord, options);
    if (persistErr && !persistErr.ok) return persistErr;

    const updated = Object.assign({}, record, {
      status:            UTILITY_BILL_IMPORT_STATUS.REPLACED,
      replacementReason,
      replacedAt:        options.referenceDate || null,
    });
    this._imports.set(importId, updated);
    return UtilityBillResult.ok({ importRecord: updated, monthlyRecord });
  }

  discardImport(importId, options = {}) {
    const record = this._imports.get(importId);
    if (!record) return _notFound(importId);
    const updated = Object.assign({}, record, { status: UTILITY_BILL_IMPORT_STATUS.DISCARDED });
    this._imports.set(importId, updated);
    return UtilityBillResult.ok(updated);
  }

  listUnlinkedUtilityBills(filters = {}) {
    const all = Array.from(this._imports.values())
      .filter(r => r.status === UTILITY_BILL_IMPORT_STATUS.UNMATCHED);
    return UtilityBillResult.ok(_applyFilters(all, filters), [], { count: all.length });
  }

  getImport(importId) {
    const record = this._imports.get(importId);
    return record
      ? UtilityBillResult.ok(record)
      : _notFound(importId);
  }

  listImports(filters = {}) {
    const all     = Array.from(this._imports.values());
    const filtered = _applyFilters(all, filters)
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    return UtilityBillResult.ok(filtered, [], { count: filtered.length });
  }
}
