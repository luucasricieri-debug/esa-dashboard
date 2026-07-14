/**
 * ESA OS — Repositories / Energy Credits
 * Firebase Adapter — implementação real com firebaseClient injetado.
 *
 * NÃO usa Firebase SDK diretamente.
 * NÃO importa firebase/app, firebase-admin, etc.
 * NÃO acessa window, localStorage, globals.
 * NÃO usa Date.now(), Math.random(), crypto.randomUUID().
 *
 * Requer firebaseClient injetado com interface:
 *   { get(path): Promise<data|null>, set(path, value): Promise<void>, remove?(path): Promise<void> }
 *
 * Todas as operações de dados são async.
 * Erros do client → EnergyCreditsRepositoryResult.fail() — nunca relançados.
 */

import { EnergyCreditsRepositoryResult }                            from './energy-credits-repository-result.js';
import { buildEnergyCreditsPath, buildEnergyCreditsCollectionPath } from './energy-credits-paths.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const SOURCE = 'energy-credits-firebase-repository';

const FORBIDDEN_KEYS = new Set([
  'password', 'passHash', 'sessionToken', 'sessionExpiresAt',
  'serviceAccount', 'firebaseConfig', 'apiKey', 'secret', 'downloadUrl',
  'stack', 'stackTrace', 'internalLog',
]);

// ── Helpers de módulo ─────────────────────────────────────────────────────────

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

function _rawToArray(raw, allowFileUrl = false) {
  if (raw == null) return [];
  let pairs;
  if (Array.isArray(raw)) {
    pairs = raw.filter(v => v != null && typeof v === 'object').map(v => ({ key: null, val: v }));
  } else if (typeof raw === 'object') {
    pairs = Object.entries(raw).filter(([, v]) => v != null).map(([k, v]) => ({ key: k, val: v }));
  } else {
    return [];
  }
  return pairs
    .map(({ key, val }) => {
      const norm = _normSecure(val, allowFileUrl);
      if (!norm || typeof norm !== 'object') return null;
      if (!norm.id && key != null) return Object.assign({}, norm, { id: key });
      return norm;
    })
    .filter(v => v != null);
}

function _meta(collection, path, operation, extra = {}) {
  return Object.assign({ source: SOURCE, collection, path, operation }, extra);
}

function _safeId(raw) {
  return String(raw).replace(/[/$.[\]#]/g, '-').replace(/\.\./g, '--');
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class EnergyCreditsFirebaseRepository {

  constructor(firebaseClient = null, options = {}) {
    this._client  = firebaseClient;
    this._options = options && typeof options === 'object' ? options : {};
  }

  // ── Validação de client ──────────────────────────────────────────────────

  _hasClient() {
    return (
      this._client !== null &&
      this._client !== undefined &&
      typeof this._client.get === 'function' &&
      typeof this._client.set === 'function'
    );
  }

  _failNoClient(operation) {
    return EnergyCreditsRepositoryResult.fail([
      EnergyCreditsRepositoryResult.makeError(
        'NO_FIREBASE_CLIENT',
        `[EnergyCreditsFirebaseRepository.${operation}] firebaseClient não fornecido ou inválido`,
      ),
    ]);
  }

  _failClientError(e, operation, collection, path) {
    return EnergyCreditsRepositoryResult.fail(
      [EnergyCreditsRepositoryResult.makeError(
        'ENERGY_CREDITS_FIREBASE_OPERATION_FAILED',
        `[${operation}] ${e && e.message ? e.message : String(e)}`,
      )],
      [],
      _meta(collection, path, operation, { error: e && e.message ? e.message : String(e) }),
    );
  }

  // ── Helpers genéricos ────────────────────────────────────────────────────

  async _save(collection, entity, allowFileUrl = false) {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
      return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError('REQUIRED', 'entity é obrigatório', 'entity')]);
    }
    if (!entity.id || typeof entity.id !== 'string' || !entity.id.trim()) {
      return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError('REQUIRED', 'id é obrigatório', 'id')]);
    }
    if (!this._hasClient()) return this._failNoClient('save');
    const norm = _normSecure(entity, allowFileUrl);
    let path;
    try { path = buildEnergyCreditsPath(collection, norm.id); }
    catch (e) { return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError('INVALID_ID', e.message, 'id')]); }
    try {
      await this._client.set(path, norm);
      return EnergyCreditsRepositoryResult.ok(Object.assign({}, norm), [], _meta(collection, path, 'save'));
    } catch (e) {
      return this._failClientError(e, 'save', collection, path);
    }
  }

  async _get(collection, id) {
    if (!id || typeof id !== 'string') {
      return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError('REQUIRED', 'id é obrigatório', 'id')]);
    }
    if (!this._hasClient()) return this._failNoClient('get');
    let path;
    try { path = buildEnergyCreditsPath(collection, id); }
    catch (e) { return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError('INVALID_ID', e.message, 'id')]); }
    const allowFileUrl = collection === 'creditDocuments';
    try {
      const raw = await this._client.get(path);
      const data = raw != null ? Object.assign({}, _normSecure(raw, allowFileUrl)) : null;
      return EnergyCreditsRepositoryResult.ok(data, [], _meta(collection, path, 'get'));
    } catch (e) {
      return this._failClientError(e, 'get', collection, path);
    }
  }

  async _list(collection, filters = {}, allowFileUrl = false) {
    if (!this._hasClient()) return this._failNoClient('list');
    const colPath = buildEnergyCreditsCollectionPath(collection);
    try {
      const raw      = await this._client.get(colPath);
      const items    = _rawToArray(raw, allowFileUrl);
      const filtered = _applyFilters(items, filters).sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      return EnergyCreditsRepositoryResult.ok(filtered, [], _meta(collection, colPath, 'list', { count: filtered.length }));
    } catch (e) {
      return this._failClientError(e, 'list', collection, colPath);
    }
  }

  _auditLogId(entry) {
    if (entry.id && typeof entry.id === 'string' && entry.id.trim()) return _safeId(entry.id.trim());
    const { targetType, targetId, action, createdAt } = entry;
    if (targetType && targetId && action && createdAt) {
      return _safeId(`${targetType}::${targetId}::${action}::${createdAt}`);
    }
    return null;
  }

  // ── Generating Units ──────────────────────────────────────────────────────

  async saveGeneratingUnit(unit)           { return this._save('generatingUnits', unit); }
  async getGeneratingUnit(id)              { return this._get('generatingUnits', id); }
  async listGeneratingUnits(filters = {})  { return this._list('generatingUnits', filters); }

  // ── Beneficiary Units ─────────────────────────────────────────────────────

  async saveBeneficiaryUnit(unit)           { return this._save('beneficiaryUnits', unit); }
  async getBeneficiaryUnit(id)              { return this._get('beneficiaryUnits', id); }
  async listBeneficiaryUnits(filters = {})  { return this._list('beneficiaryUnits', filters); }

  // ── Generating Unit Monthly Records ──────────────────────────────────────

  async saveGeneratingUnitMonthlyRecord(record)         { return this._save('generatingUnitMonthlyRecords', record); }
  async getGeneratingUnitMonthlyRecord(id)              { return this._get('generatingUnitMonthlyRecords', id); }
  async listGeneratingUnitMonthlyRecords(filters = {})  { return this._list('generatingUnitMonthlyRecords', filters); }

  // ── Beneficiary Monthly Records ───────────────────────────────────────────

  async saveBeneficiaryMonthlyRecord(record)         { return this._save('beneficiaryMonthlyRecords', record); }
  async getBeneficiaryMonthlyRecord(id)              { return this._get('beneficiaryMonthlyRecords', id); }
  async listBeneficiaryMonthlyRecords(filters = {})  { return this._list('beneficiaryMonthlyRecords', filters); }

  // ── Credit Allocations ────────────────────────────────────────────────────

  async saveCreditAllocation(alloc)          { return this._save('creditAllocations', alloc); }
  async getCreditAllocation(id)              { return this._get('creditAllocations', id); }
  async listCreditAllocations(filters = {})  { return this._list('creditAllocations', filters); }

  // ── Owner Settlements ─────────────────────────────────────────────────────

  async saveOwnerSettlement(settlement)       { return this._save('ownerSettlements', settlement); }
  async getOwnerSettlement(id)                { return this._get('ownerSettlements', id); }
  async listOwnerSettlements(filters = {})    { return this._list('ownerSettlements', filters); }

  // ── ESA Invoices ──────────────────────────────────────────────────────────

  async saveEsaInvoice(invoice)          { return this._save('esaInvoices', invoice); }
  async getEsaInvoice(id)               { return this._get('esaInvoices', id); }
  async listEsaInvoices(filters = {})   { return this._list('esaInvoices', filters); }

  // ── Monthly Reports ───────────────────────────────────────────────────────

  async saveMonthlyReport(report)          { return this._save('monthlyReports', report); }
  async getMonthlyReport(id)              { return this._get('monthlyReports', id); }
  async listMonthlyReports(filters = {})  { return this._list('monthlyReports', filters); }

  // ── Credit Documents (fileUrl permitido) ─────────────────────────────────

  async saveCreditDocument(doc)            { return this._save('creditDocuments', doc, true); }
  async getCreditDocument(id)              { return this._get('creditDocuments', id); }
  async listCreditDocuments(filters = {})  { return this._list('creditDocuments', filters, true); }

  // ── Beneficiary Credit Balance Records ───────────────────────────────────

  async saveBeneficiaryCreditBalanceRecord(record)         { return this._save('beneficiaryCreditBalanceRecords', record); }
  async getBeneficiaryCreditBalanceRecord(id)              { return this._get('beneficiaryCreditBalanceRecords', id); }
  async listBeneficiaryCreditBalanceRecords(filters = {})  { return this._list('beneficiaryCreditBalanceRecords', filters); }

  // ── Credit Audit Log ──────────────────────────────────────────────────────

  async appendCreditAuditLog(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError('REQUIRED', 'entry é obrigatório', 'entry')]);
    }
    const id = this._auditLogId(entry);
    if (!id) {
      return EnergyCreditsRepositoryResult.fail([
        EnergyCreditsRepositoryResult.makeError('REQUIRED', 'id ou (targetType + targetId + action + createdAt) são obrigatórios'),
      ]);
    }
    return this._save('creditAuditLog', { ...entry, id }, false);
  }

  async listCreditAuditLog(filters = {})   { return this._list('creditAuditLog', filters); }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  async getSnapshot(options = {}) {
    if (!this._hasClient()) return this._failNoClient('getSnapshot');
    const load = col => this._list(col, {}, col === 'creditDocuments');
    try {
      const [gen, ben, genR, benR, alloc, sett, inv, rep, doc, audit, balRec] = await Promise.all([
        load('generatingUnits'), load('beneficiaryUnits'),
        load('generatingUnitMonthlyRecords'), load('beneficiaryMonthlyRecords'),
        load('creditAllocations'), load('ownerSettlements'),
        load('esaInvoices'), load('monthlyReports'),
        load('creditDocuments'), load('creditAuditLog'),
        load('beneficiaryCreditBalanceRecords'),
      ]);
      const failed = [gen, ben, genR, benR, alloc, sett, inv, rep, doc, audit, balRec].find(r => !r.ok);
      if (failed) return failed;
      return EnergyCreditsRepositoryResult.ok({
        generatingUnits:                 gen.data,
        beneficiaryUnits:                ben.data,
        generatingUnitMonthlyRecords:    genR.data,
        beneficiaryMonthlyRecords:       benR.data,
        creditAllocations:               alloc.data,
        ownerSettlements:                sett.data,
        esaInvoices:                     inv.data,
        monthlyReports:                  rep.data,
        creditDocuments:                 doc.data,
        creditAuditLog:                  audit.data,
        beneficiaryCreditBalanceRecords: balRec.data,
      }, [], { source: SOURCE, referenceDate: options.referenceDate || null });
    } catch (e) {
      return this._failClientError(e, 'getSnapshot', 'all', '');
    }
  }

  // ── Stats (nunca lança) ───────────────────────────────────────────────────

  getStats() {
    return {
      type:          'firebase',
      hasClient:     this._hasClient(),
      clientMethods: ['get', 'set', 'remove']
        .filter(m => this._client && typeof this._client[m] === 'function'),
    };
  }
}
