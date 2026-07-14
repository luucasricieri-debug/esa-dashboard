/**
 * ESA OS — Repositories / Energy Credits
 * Implementação em memória do repositório de créditos.
 *
 * Usado em testes, read-model hydration e contextos sem Firebase.
 * Todos os gets/lists retornam cópias defensivas — nunca referências internas.
 * Normalização: undefined→null, NaN→null, Date→ISO, [object Object]→null.
 * Segurança: campos sensíveis são removidos em todas as escritas.
 */

import { EnergyCreditsRepositoryResult } from './energy-credits-repository-result.js';

// ── Constantes e helpers de módulo ────────────────────────────────────────────

const FORBIDDEN_KEYS = new Set([
  'password', 'passHash', 'sessionToken', 'sessionExpiresAt',
  'serviceAccount', 'firebaseConfig', 'apiKey', 'secret', 'downloadUrl',
]);

function _normSecure(v, allowFileUrl = false) {
  if (v === undefined) return null;
  if (typeof v === 'number' && isNaN(v)) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' && v === '[object Object]') return null;
  if (Array.isArray(v)) return v.map(item => _normSecure(item, allowFileUrl));
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      if (k === 'fileUrl' && !allowFileUrl) continue;
      out[k] = _normSecure(val, allowFileUrl);
    }
    return out;
  }
  return v;
}

function _applyFilters(items, filters) {
  let result = items;
  if (filters.id                 != null) result = result.filter(i => i.id === filters.id);
  if (filters.referenceMonth     != null) result = result.filter(i => i.referenceMonth === filters.referenceMonth);
  if (filters.referenceMonthFrom != null) result = result.filter(i => i.referenceMonth >= filters.referenceMonthFrom);
  if (filters.referenceMonthTo   != null) result = result.filter(i => i.referenceMonth <= filters.referenceMonthTo);
  if (filters.generatingUnitId   != null) result = result.filter(i => i.generatingUnitId === filters.generatingUnitId);
  if (filters.beneficiaryUnitId  != null) result = result.filter(i => i.beneficiaryUnitId === filters.beneficiaryUnitId);
  if (filters.targetType         != null) result = result.filter(i => i.targetType === filters.targetType);
  if (filters.targetId           != null) result = result.filter(i => i.targetId === filters.targetId);
  if (filters.paymentStatus      != null) result = result.filter(i => i.paymentStatus === filters.paymentStatus);
  if (filters.status             != null) result = result.filter(i => i.status === filters.status);
  if (filters.utilityCompany     != null) result = result.filter(i => i.utilityCompany === filters.utilityCompany);
  if (filters.ownerName          != null) result = result.filter(i => i.ownerName === filters.ownerName);
  if (filters.document           != null) result = result.filter(i => i.document === filters.document || i.ownerDocument === filters.document);
  if (filters.action             != null) result = result.filter(i => i.action === filters.action);
  if (filters.userId             != null) result = result.filter(i => i.userId === filters.userId);
  return result;
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class EnergyCreditsMemoryRepository {

  constructor() {
    this._generatingUnits                  = new Map();
    this._beneficiaryUnits                 = new Map();
    this._generatingUnitMonthlyRecords     = new Map();
    this._beneficiaryMonthlyRecords        = new Map();
    this._creditAllocations                = new Map();
    this._ownerSettlements                 = new Map();
    this._esaInvoices                      = new Map();
    this._monthlyReports                   = new Map();
    this._creditDocuments                  = new Map();
    this._creditAuditLog                   = new Map();
    this._beneficiaryCreditBalanceRecords  = new Map();
    this._hydrateCount                     = 0;
    this._lastHydration                    = null;
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  _failRequired(field) {
    return EnergyCreditsRepositoryResult.fail([
      EnergyCreditsRepositoryResult.makeError('REQUIRED', `${field} é obrigatório`, field),
    ]);
  }

  _save(map, entity, allowFileUrl = false) {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
      return this._failRequired('entity');
    }
    if (!entity.id || typeof entity.id !== 'string' || !entity.id.trim()) {
      return this._failRequired('id');
    }
    const norm = _normSecure(entity, allowFileUrl);
    map.set(norm.id, norm);
    return EnergyCreditsRepositoryResult.ok(Object.assign({}, norm));
  }

  _get(map, id) {
    if (!id || typeof id !== 'string') return this._failRequired('id');
    const item = map.get(id);
    return EnergyCreditsRepositoryResult.ok(item ? Object.assign({}, item) : null);
  }

  _list(map, filters = {}) {
    const items    = Array.from(map.values()).map(v => Object.assign({}, v));
    const filtered = _applyFilters(items, filters).sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    return EnergyCreditsRepositoryResult.ok(filtered, [], { count: filtered.length });
  }

  _auditLogId(entry) {
    if (entry.id && typeof entry.id === 'string' && entry.id.trim()) return entry.id.trim();
    const { referenceDate, action, targetId } = entry;
    if (referenceDate && action && targetId) return `${referenceDate}::${action}::${targetId}`;
    return null;
  }

  // ── Generating Units ─────────────────────────────────────────────────────

  saveGeneratingUnit(unit)          { return this._save(this._generatingUnits, unit); }
  getGeneratingUnit(id)             { return this._get(this._generatingUnits, id); }
  listGeneratingUnits(filters = {}) { return this._list(this._generatingUnits, filters); }

  // ── Beneficiary Units ────────────────────────────────────────────────────

  saveBeneficiaryUnit(unit)          { return this._save(this._beneficiaryUnits, unit); }
  getBeneficiaryUnit(id)             { return this._get(this._beneficiaryUnits, id); }
  listBeneficiaryUnits(filters = {}) { return this._list(this._beneficiaryUnits, filters); }

  // ── Generating Unit Monthly Records ──────────────────────────────────────

  saveGeneratingUnitMonthlyRecord(record)          { return this._save(this._generatingUnitMonthlyRecords, record); }
  getGeneratingUnitMonthlyRecord(id)               { return this._get(this._generatingUnitMonthlyRecords, id); }
  listGeneratingUnitMonthlyRecords(filters = {})   { return this._list(this._generatingUnitMonthlyRecords, filters); }

  // ── Beneficiary Monthly Records ──────────────────────────────────────────

  saveBeneficiaryMonthlyRecord(record)          { return this._save(this._beneficiaryMonthlyRecords, record); }
  getBeneficiaryMonthlyRecord(id)               { return this._get(this._beneficiaryMonthlyRecords, id); }
  listBeneficiaryMonthlyRecords(filters = {})   { return this._list(this._beneficiaryMonthlyRecords, filters); }

  // ── Credit Allocations ───────────────────────────────────────────────────

  saveCreditAllocation(alloc)          { return this._save(this._creditAllocations, alloc); }
  getCreditAllocation(id)              { return this._get(this._creditAllocations, id); }
  listCreditAllocations(filters = {})  { return this._list(this._creditAllocations, filters); }

  // ── Owner Settlements ────────────────────────────────────────────────────

  saveOwnerSettlement(settlement)       { return this._save(this._ownerSettlements, settlement); }
  getOwnerSettlement(id)                { return this._get(this._ownerSettlements, id); }
  listOwnerSettlements(filters = {})    { return this._list(this._ownerSettlements, filters); }

  // ── ESA Invoices ─────────────────────────────────────────────────────────

  saveEsaInvoice(invoice)          { return this._save(this._esaInvoices, invoice); }
  getEsaInvoice(id)                { return this._get(this._esaInvoices, id); }
  listEsaInvoices(filters = {})    { return this._list(this._esaInvoices, filters); }

  // ── Monthly Reports ──────────────────────────────────────────────────────

  saveMonthlyReport(report)          { return this._save(this._monthlyReports, report); }
  getMonthlyReport(id)               { return this._get(this._monthlyReports, id); }
  listMonthlyReports(filters = {})   { return this._list(this._monthlyReports, filters); }

  // ── Credit Documents (fileUrl permitido) ─────────────────────────────────

  saveCreditDocument(doc)          { return this._save(this._creditDocuments, doc, true); }
  getCreditDocument(id)            { return this._get(this._creditDocuments, id); }
  listCreditDocuments(filters = {}) { return this._list(this._creditDocuments, filters); }

  // ── Credit Audit Log ─────────────────────────────────────────────────────

  // ── Beneficiary Credit Balance Records ──────────────────────────────────────

  saveBeneficiaryCreditBalanceRecord(record)          { return this._save(this._beneficiaryCreditBalanceRecords, record); }
  getBeneficiaryCreditBalanceRecord(id)               { return this._get(this._beneficiaryCreditBalanceRecords, id); }
  listBeneficiaryCreditBalanceRecords(filters = {})   { return this._list(this._beneficiaryCreditBalanceRecords, filters); }

  // ── Credit Audit Log ─────────────────────────────────────────────────────

  appendCreditAuditLog(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return this._failRequired('entry');
    }
    const id = this._auditLogId(entry);
    if (!id) {
      return EnergyCreditsRepositoryResult.fail([
        EnergyCreditsRepositoryResult.makeError(
          'REQUIRED',
          'id ou (referenceDate + action + targetId) são obrigatórios para audit log',
        ),
      ]);
    }
    const norm = _normSecure({ ...entry, id }, false);
    this._creditAuditLog.set(id, norm);
    return EnergyCreditsRepositoryResult.ok(Object.assign({}, norm));
  }

  listCreditAuditLog(filters = {}) { return this._list(this._creditAuditLog, filters); }

  // ── Snapshot ─────────────────────────────────────────────────────────────

  getSnapshot(options = {}) {
    const toArr = map => Array.from(map.values()).map(v => Object.assign({}, v));
    return EnergyCreditsRepositoryResult.ok({
      generatingUnits:                 toArr(this._generatingUnits),
      beneficiaryUnits:                toArr(this._beneficiaryUnits),
      generatingUnitMonthlyRecords:    toArr(this._generatingUnitMonthlyRecords),
      beneficiaryMonthlyRecords:       toArr(this._beneficiaryMonthlyRecords),
      creditAllocations:               toArr(this._creditAllocations),
      ownerSettlements:                toArr(this._ownerSettlements),
      esaInvoices:                     toArr(this._esaInvoices),
      monthlyReports:                  toArr(this._monthlyReports),
      creditDocuments:                 toArr(this._creditDocuments),
      creditAuditLog:                  toArr(this._creditAuditLog),
      beneficiaryCreditBalanceRecords: toArr(this._beneficiaryCreditBalanceRecords),
    });
  }

  // ── Hydrate From Snapshot ─────────────────────────────────────────────────

  hydrateFromSnapshot(snapshot = {}, options = {}) {
    const { replace = true, referenceDate } = options;
    if (replace) this.clear();

    let received = 0;
    let hydrated = 0;
    let skipped  = 0;

    const run = (raw, fn) => {
      const items = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
      for (const item of items) {
        received++;
        const result = fn(item);
        if (result.ok) hydrated++;
        else skipped++;
      }
    };

    run(snapshot.generatingUnits,                 this.saveGeneratingUnit.bind(this));
    run(snapshot.beneficiaryUnits,                this.saveBeneficiaryUnit.bind(this));
    run(snapshot.generatingUnitMonthlyRecords,    this.saveGeneratingUnitMonthlyRecord.bind(this));
    run(snapshot.beneficiaryMonthlyRecords,       this.saveBeneficiaryMonthlyRecord.bind(this));
    run(snapshot.creditAllocations,               this.saveCreditAllocation.bind(this));
    run(snapshot.ownerSettlements,                this.saveOwnerSettlement.bind(this));
    run(snapshot.esaInvoices,                     this.saveEsaInvoice.bind(this));
    run(snapshot.monthlyReports,                  this.saveMonthlyReport.bind(this));
    run(snapshot.creditDocuments,                 this.saveCreditDocument.bind(this));
    run(snapshot.creditAuditLog,                  this.appendCreditAuditLog.bind(this));
    run(snapshot.beneficiaryCreditBalanceRecords, this.saveBeneficiaryCreditBalanceRecord.bind(this));

    this._hydrateCount++;
    const result = { received, hydrated, skipped, replaced: replace, referenceDate: referenceDate || null };
    this._lastHydration = result;
    return EnergyCreditsRepositoryResult.ok(result);
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  clear() {
    this._generatingUnits.clear();
    this._beneficiaryUnits.clear();
    this._generatingUnitMonthlyRecords.clear();
    this._beneficiaryMonthlyRecords.clear();
    this._creditAllocations.clear();
    this._ownerSettlements.clear();
    this._esaInvoices.clear();
    this._monthlyReports.clear();
    this._creditDocuments.clear();
    this._creditAuditLog.clear();
    this._beneficiaryCreditBalanceRecords.clear();
    this._hydrateCount  = 0;
    this._lastHydration = null;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  getStats() {
    return {
      type:                                  'memory',
      generatingUnitCount:                   this._generatingUnits.size,
      beneficiaryUnitCount:                  this._beneficiaryUnits.size,
      generatingUnitMonthlyRecordCount:      this._generatingUnitMonthlyRecords.size,
      beneficiaryMonthlyRecordCount:         this._beneficiaryMonthlyRecords.size,
      creditAllocationCount:                 this._creditAllocations.size,
      ownerSettlementCount:                  this._ownerSettlements.size,
      esaInvoiceCount:                       this._esaInvoices.size,
      monthlyReportCount:                    this._monthlyReports.size,
      creditDocumentCount:                   this._creditDocuments.size,
      creditAuditLogCount:                   this._creditAuditLog.size,
      beneficiaryCreditBalanceRecordCount:   this._beneficiaryCreditBalanceRecords.size,
      hydrateCount:                          this._hydrateCount,
      lastHydration:                         this._lastHydration ? Object.assign({}, this._lastHydration) : null,
    };
  }
}
