/**
 * ESA OS — Energy Domain / Credits
 * EnergyCreditsReadModel
 *
 * Projeção em memória dos dados de créditos de energia.
 * Oito coleções, isoladas e normalizadas.
 * Sem Firebase. Sem persistência. Sem efeitos colaterais.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// ── Normalização primitiva ────────────────────────────────────────────────────

function _str(v) {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s === '[object Object]' ? null : s;
}

function _num(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function _toArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return Object.values(raw);
  return [];
}

function _applyMonthFilter(items, filters) {
  let result = items;
  if (filters.referenceMonth     != null) result = result.filter(r => r.referenceMonth === filters.referenceMonth);
  if (filters.referenceMonthFrom != null) result = result.filter(r => r.referenceMonth >= filters.referenceMonthFrom);
  if (filters.referenceMonthTo   != null) result = result.filter(r => r.referenceMonth <= filters.referenceMonthTo);
  return result;
}

function _normalizeAlerts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(a => ({
    code:       _str(a.code),
    severity:   _str(a.severity),
    message:    _str(a.message),
    targetType: _str(a.targetType),
    targetId:   _str(a.targetId),
    metadata:   (a.metadata && typeof a.metadata === 'object' && !Array.isArray(a.metadata))
      ? Object.assign({}, a.metadata) : {},
  }));
}

function _normalizeStatementMetadata(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return {
    generatedAt: _num(raw.generatedAt),
    status:      _str(raw.status),
    source:      _str(raw.source),
  };
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class EnergyCreditsReadModel {

  constructor() {
    this._generatingUnits                  = new Map();
    this._beneficiaryUnits                 = new Map();
    this._generatingUnitMonthlyRecords     = new Map();
    this._beneficiaryMonthlyRecords        = new Map();
    this._creditAllocations                = new Map();
    this._ownerSettlements                 = new Map();
    this._esaInvoices                      = new Map();
    this._monthlyStatements                = new Map();
    this._beneficiaryCreditBalanceRecords  = new Map();
    this._hydrationCount                   = 0;
    this._lastHydration                    = null;
  }

  // ── Hydrate / Clear ────────────────────────────────────────────────────────

  hydrate(snapshot = {}, options = {}) {
    const { replace = true, referenceDate } = options;
    if (replace) this.clear();

    let received = 0;
    let hydrated = 0;
    let skipped  = 0;

    const run = (raw, fn) => {
      for (const item of _toArray(raw)) {
        received++;
        if (fn(item)) hydrated++;
        else skipped++;
      }
    };

    run(snapshot.generatingUnits,                 this.upsertGeneratingUnit.bind(this));
    run(snapshot.beneficiaryUnits,                this.upsertBeneficiaryUnit.bind(this));
    run(snapshot.generatingUnitMonthlyRecords,    this.upsertGeneratingUnitMonthlyRecord.bind(this));
    run(snapshot.beneficiaryMonthlyRecords,       this.upsertBeneficiaryMonthlyRecord.bind(this));
    run(snapshot.creditAllocations,               this.upsertCreditAllocation.bind(this));
    run(snapshot.ownerSettlements,                this.upsertOwnerSettlement.bind(this));
    run(snapshot.esaInvoices,                     this.upsertEsaInvoice.bind(this));
    run(snapshot.monthlyStatements,               this.upsertMonthlyStatement.bind(this));
    run(snapshot.beneficiaryCreditBalanceRecords, this.upsertBeneficiaryCreditBalanceRecord.bind(this));

    this._hydrationCount++;
    const result = { received, hydrated, skipped, replaced: replace, referenceDate: referenceDate || null };
    this._lastHydration = result;
    return result;
  }

  clear() {
    this._generatingUnits.clear();
    this._beneficiaryUnits.clear();
    this._generatingUnitMonthlyRecords.clear();
    this._beneficiaryMonthlyRecords.clear();
    this._creditAllocations.clear();
    this._ownerSettlements.clear();
    this._esaInvoices.clear();
    this._monthlyStatements.clear();
    this._beneficiaryCreditBalanceRecords.clear();
    this._lastHydration   = null;
    this._hydrationCount  = 0;
  }

  getStats() {
    return {
      generatingUnitCount:                  this._generatingUnits.size,
      beneficiaryUnitCount:                 this._beneficiaryUnits.size,
      generatingUnitMonthlyRecordCount:     this._generatingUnitMonthlyRecords.size,
      beneficiaryMonthlyRecordCount:        this._beneficiaryMonthlyRecords.size,
      creditAllocationCount:                this._creditAllocations.size,
      ownerSettlementCount:                 this._ownerSettlements.size,
      esaInvoiceCount:                      this._esaInvoices.size,
      monthlyStatementCount:                this._monthlyStatements.size,
      beneficiaryCreditBalanceRecordCount:  this._beneficiaryCreditBalanceRecords.size,
      hydrationCount:                       this._hydrationCount,
      lastHydration: this._lastHydration ? Object.assign({}, this._lastHydration) : null,
    };
  }

  // ── Upserts — Generating Unit ──────────────────────────────────────────────

  upsertGeneratingUnit(unit) {
    if (!unit || typeof unit !== 'object') return false;
    const id = _str(unit.id);
    if (!id || !id.trim()) return false;
    this._generatingUnits.set(id, this._normalizeGeneratingUnit(unit));
    return true;
  }

  _normalizeGeneratingUnit(u) {
    return {
      id:                _str(u.id),
      name:              _str(u.name),
      ownerName:         _str(u.ownerName),
      ownerDocument:     _str(u.ownerDocument),
      uc:                _str(u.uc),
      address:           _str(u.address),
      city:              _str(u.city),
      state:             _str(u.state),
      utilityCompany:    _str(u.utilityCompany),
      pixKey:            _str(u.pixKey),
      installedPower:    _num(u.installedPower),
      operationalStatus: _str(u.operationalStatus),
      startedAt:         _num(u.startedAt),
      notes:             _str(u.notes),
    };
  }

  // ── Upserts — Beneficiary Unit ─────────────────────────────────────────────

  upsertBeneficiaryUnit(unit) {
    if (!unit || typeof unit !== 'object') return false;
    const id = _str(unit.id);
    if (!id || !id.trim()) return false;
    this._beneficiaryUnits.set(id, this._normalizeBeneficiaryUnit(unit));
    return true;
  }

  _normalizeBeneficiaryUnit(u) {
    return {
      id:                        _str(u.id),
      generatingUnitId:          _str(u.generatingUnitId),
      name:                      _str(u.name),
      holderName:                _str(u.holderName),
      uc:                        _str(u.uc),
      address:                   _str(u.address),
      city:                      _str(u.city),
      state:                     _str(u.state),
      utilityCompany:            _str(u.utilityCompany),
      subscriptionStatus:        _str(u.subscriptionStatus),
      averageConsumption12Months: _num(u.averageConsumption12Months),
      startedAt:                 _num(u.startedAt),
      notes:                     _str(u.notes),
    };
  }

  // ── Upserts — Generating Unit Monthly Record ───────────────────────────────

  upsertGeneratingUnitMonthlyRecord(record) {
    if (!record || typeof record !== 'object') return false;
    const gid   = _str(record.generatingUnitId);
    const month = _str(record.referenceMonth);
    if (!gid || !month || !MONTH_RE.test(month)) return false;
    const key = _str(record.id) || `${gid}::${month}`;
    this._generatingUnitMonthlyRecords.set(key, this._normalizeGenRecord(record));
    return true;
  }

  _normalizeGenRecord(r) {
    return {
      id:                            _str(r.id),
      generatingUnitId:              _str(r.generatingUnitId),
      referenceMonth:                _str(r.referenceMonth),
      purchaseKwhPrice:              _num(r.purchaseKwhPrice),
      previousAccumulatedKwhBalance: _num(r.previousAccumulatedKwhBalance),
      monthlyGenerationKwh:          _num(r.monthlyGenerationKwh),
      availableKwhBeforeAllocation:  _num(r.availableKwhBeforeAllocation),
      consumedAllocatedKwh:          _num(r.consumedAllocatedKwh),
      currentAccumulatedKwhBalance:  _num(r.currentAccumulatedKwhBalance),
      monthlyOwnerReturn:            _num(r.monthlyOwnerReturn),
      accumulatedOwnerReturn:        _num(r.accumulatedOwnerReturn),
      status:                        _str(r.status),
      notes:                         _str(r.notes),
    };
  }

  // ── Upserts — Beneficiary Monthly Record ──────────────────────────────────

  upsertBeneficiaryMonthlyRecord(record) {
    if (!record || typeof record !== 'object') return false;
    const bid   = _str(record.beneficiaryUnitId);
    const month = _str(record.referenceMonth);
    if (!bid || !month || !MONTH_RE.test(month)) return false;
    const key = _str(record.id) || `${bid}::${month}`;
    this._beneficiaryMonthlyRecords.set(key, this._normalizeBenRecord(record));
    return true;
  }

  _normalizeBenRecord(r) {
    return {
      id:                          _str(r.id),
      beneficiaryUnitId:           _str(r.beneficiaryUnitId),
      generatingUnitId:            _str(r.generatingUnitId),
      referenceMonth:              _str(r.referenceMonth),
      monthlyConsumptionKwh:       _num(r.monthlyConsumptionKwh),
      allocatedKwh:                _num(r.allocatedKwh),
      compensatedKwh:              _num(r.compensatedKwh),
      pendingKwh:                  _num(r.pendingKwh),
      residualKwh:                 _num(r.residualKwh),
      esaKwhPrice:                 _num(r.esaKwhPrice),
      utilityReferenceTariff:      _num(r.utilityReferenceTariff),
      billWithoutEsa:              _num(r.billWithoutEsa),
      esaInvoiceAmount:            _num(r.esaInvoiceAmount),
      residualUtilityAmount:       _num(r.residualUtilityAmount),
      billWithEsa:                 _num(r.billWithEsa),
      monthlyDiscount:             _num(r.monthlyDiscount),
      previousAccumulatedDiscount: _num(r.previousAccumulatedDiscount),
      accumulatedDiscountTotal:    _num(r.accumulatedDiscountTotal),
      paymentStatus:               _str(r.paymentStatus),
      dueDate:                     _num(r.dueDate),
      paidAt:                      _num(r.paidAt),
      notes:                       _str(r.notes),
    };
  }

  // ── Upserts — Credit Allocation ────────────────────────────────────────────

  upsertCreditAllocation(alloc) {
    if (!alloc || typeof alloc !== 'object') return false;
    const id = _str(alloc.id);
    if (!id || !id.trim()) return false;
    this._creditAllocations.set(id, this._normalizeAllocation(alloc));
    return true;
  }

  _normalizeAllocation(a) {
    return {
      id:                _str(a.id),
      generatingUnitId:  _str(a.generatingUnitId),
      beneficiaryUnitId: _str(a.beneficiaryUnitId),
      referenceMonth:    _str(a.referenceMonth),
      allocatedKwh:      _num(a.allocatedKwh),
      compensatedKwh:    _num(a.compensatedKwh),
      pendingKwh:        _num(a.pendingKwh),
      status:            _str(a.status),
    };
  }

  // ── Upserts — Owner Settlement ─────────────────────────────────────────────

  upsertOwnerSettlement(settlement) {
    if (!settlement || typeof settlement !== 'object') return false;
    const gid   = _str(settlement.generatingUnitId);
    const month = _str(settlement.referenceMonth);
    if (!gid || !month || !MONTH_RE.test(month)) return false;
    const key = _str(settlement.id) || `${gid}::${month}`;
    this._ownerSettlements.set(key, this._normalizeSettlement(settlement));
    return true;
  }

  _normalizeSettlement(s) {
    return {
      id:                   _str(s.id),
      generatingUnitId:     _str(s.generatingUnitId),
      ownerName:            _str(s.ownerName),
      referenceMonth:       _str(s.referenceMonth),
      consumedAllocatedKwh: _num(s.consumedAllocatedKwh),
      purchaseKwhPrice:     _num(s.purchaseKwhPrice),
      grossReturn:          _num(s.grossReturn),
      adjustments:          _num(s.adjustments),
      netReturn:            _num(s.netReturn),
      paymentStatus:        _str(s.paymentStatus),
      dueDate:              _num(s.dueDate),
      paidAt:               _num(s.paidAt),
    };
  }

  // ── Upserts — ESA Invoice ──────────────────────────────────────────────────

  upsertEsaInvoice(invoice) {
    if (!invoice || typeof invoice !== 'object') return false;
    const bid   = _str(invoice.beneficiaryUnitId);
    const month = _str(invoice.referenceMonth);
    if (!bid || !month || !MONTH_RE.test(month)) return false;
    const key = _str(invoice.id) || `${bid}::${month}`;
    this._esaInvoices.set(key, this._normalizeInvoice(invoice));
    return true;
  }

  _normalizeInvoice(inv) {
    return {
      id:                _str(inv.id),
      beneficiaryUnitId: _str(inv.beneficiaryUnitId),
      referenceMonth:    _str(inv.referenceMonth),
      consumedKwh:       _num(inv.consumedKwh),
      compensatedKwh:    _num(inv.compensatedKwh),
      esaKwhPrice:       _num(inv.esaKwhPrice),
      invoiceAmount:     _num(inv.invoiceAmount),
      paymentStatus:     _str(inv.paymentStatus),
      dueDate:           _num(inv.dueDate),
      paidAt:            _num(inv.paidAt),
    };
  }

  // ── Upserts — Monthly Statement ────────────────────────────────────────────

  upsertMonthlyStatement(statement) {
    if (!statement || typeof statement !== 'object') return false;
    const gid   = _str(statement.generatingUnitId);
    const month = _str(statement.referenceMonth);
    if (!gid || !month || !MONTH_RE.test(month)) return false;
    const key = `${gid}::${month}`;
    this._monthlyStatements.set(key, this._normalizeStatement(statement));
    return true;
  }

  _normalizeStatement(s) {
    return {
      referenceMonth:               _str(s.referenceMonth),
      generatingUnitId:             _str(s.generatingUnitId),
      totalGenerationKwh:           _num(s.totalGenerationKwh),
      previousBalanceKwh:           _num(s.previousBalanceKwh),
      availableKwhBeforeAllocation: _num(s.availableKwhBeforeAllocation),
      totalAllocatedKwh:            _num(s.totalAllocatedKwh),
      totalCompensatedKwh:          _num(s.totalCompensatedKwh),
      totalPendingKwh:              _num(s.totalPendingKwh),
      totalResidualKwh:             _num(s.totalResidualKwh),
      currentBalanceKwh:            _num(s.currentBalanceKwh),
      totalOwnerReturn:             _num(s.totalOwnerReturn),
      totalEsaRevenue:              _num(s.totalEsaRevenue),
      grossSpread:                  _num(s.grossSpread),
      beneficiaryCount:             _num(s.beneficiaryCount),
      alerts:                       _normalizeAlerts(s.alerts),
      metadata:                     _normalizeStatementMetadata(s.metadata),
    };
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getGeneratingUnit(id) {
    const unit = this._generatingUnits.get(String(id));
    return unit ? Object.assign({}, unit) : null;
  }

  getBeneficiaryUnit(id) {
    const unit = this._beneficiaryUnits.get(String(id));
    return unit ? Object.assign({}, unit) : null;
  }

  getMonthlyStatement(generatingUnitId, referenceMonth) {
    const key  = `${generatingUnitId}::${referenceMonth}`;
    const stmt = this._monthlyStatements.get(key);
    return stmt ? Object.assign({}, stmt) : null;
  }

  // ── Listers ────────────────────────────────────────────────────────────────

  listGeneratingUnits(filters = {}) {
    let items = Array.from(this._generatingUnits.values()).map(u => Object.assign({}, u));
    if (filters.utilityCompany    != null) items = items.filter(u => u.utilityCompany    === filters.utilityCompany);
    if (filters.operationalStatus != null) items = items.filter(u => u.operationalStatus === filters.operationalStatus);
    items.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    return items;
  }

  listBeneficiaryUnits(filters = {}) {
    let items = Array.from(this._beneficiaryUnits.values()).map(u => Object.assign({}, u));
    if (filters.generatingUnitId  != null) items = items.filter(u => u.generatingUnitId  === filters.generatingUnitId);
    if (filters.utilityCompany    != null) items = items.filter(u => u.utilityCompany    === filters.utilityCompany);
    if (filters.subscriptionStatus != null) items = items.filter(u => u.subscriptionStatus === filters.subscriptionStatus);
    items.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    return items;
  }

  listGeneratingUnitMonthlyRecords(filters = {}) {
    let items = Array.from(this._generatingUnitMonthlyRecords.values()).map(r => Object.assign({}, r));
    items = _applyMonthFilter(items, filters);
    if (filters.generatingUnitId != null) items = items.filter(r => r.generatingUnitId === filters.generatingUnitId);
    if (filters.status           != null) items = items.filter(r => r.status           === filters.status);
    items.sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));
    return items;
  }

  listBeneficiaryMonthlyRecords(filters = {}) {
    let items = Array.from(this._beneficiaryMonthlyRecords.values()).map(r => Object.assign({}, r));
    items = _applyMonthFilter(items, filters);
    if (filters.generatingUnitId  != null) items = items.filter(r => r.generatingUnitId  === filters.generatingUnitId);
    if (filters.beneficiaryUnitId != null) items = items.filter(r => r.beneficiaryUnitId === filters.beneficiaryUnitId);
    if (filters.paymentStatus     != null) items = items.filter(r => r.paymentStatus     === filters.paymentStatus);
    items.sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));
    return items;
  }

  listCreditAllocations(filters = {}) {
    let items = Array.from(this._creditAllocations.values()).map(a => Object.assign({}, a));
    items = _applyMonthFilter(items, filters);
    if (filters.generatingUnitId  != null) items = items.filter(a => a.generatingUnitId  === filters.generatingUnitId);
    if (filters.beneficiaryUnitId != null) items = items.filter(a => a.beneficiaryUnitId === filters.beneficiaryUnitId);
    if (filters.status            != null) items = items.filter(a => a.status            === filters.status);
    return items;
  }

  listOwnerSettlements(filters = {}) {
    let items = Array.from(this._ownerSettlements.values()).map(s => Object.assign({}, s));
    items = _applyMonthFilter(items, filters);
    if (filters.generatingUnitId != null) items = items.filter(s => s.generatingUnitId === filters.generatingUnitId);
    if (filters.paymentStatus    != null) items = items.filter(s => s.paymentStatus    === filters.paymentStatus);
    items.sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));
    return items;
  }

  listEsaInvoices(filters = {}) {
    let items = Array.from(this._esaInvoices.values()).map(i => Object.assign({}, i));
    items = _applyMonthFilter(items, filters);
    if (filters.beneficiaryUnitId != null) items = items.filter(i => i.beneficiaryUnitId === filters.beneficiaryUnitId);
    if (filters.paymentStatus     != null) items = items.filter(i => i.paymentStatus     === filters.paymentStatus);
    items.sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));
    return items;
  }

  listMonthlyStatements(filters = {}) {
    let items = Array.from(this._monthlyStatements.values()).map(s => Object.assign({}, s));
    items = _applyMonthFilter(items, filters);
    if (filters.generatingUnitId != null) items = items.filter(s => s.generatingUnitId === filters.generatingUnitId);
    if (filters.status           != null) items = items.filter(s => (s.metadata && s.metadata.status) === filters.status);
    items.sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));
    return items;
  }

  // ── Upserts — Beneficiary Credit Balance Record ────────────────────────────

  upsertBeneficiaryCreditBalanceRecord(record) {
    if (!record || typeof record !== 'object') return false;
    const bid   = _str(record.beneficiaryUnitId);
    const month = _str(record.referenceMonth);
    if (!bid || !month || !MONTH_RE.test(month)) return false;
    const key = _str(record.id) || `beneficiary-credit-balance-${bid}-${month}`;
    this._beneficiaryCreditBalanceRecords.set(key, this._normalizeBalanceRecord(record));
    return true;
  }

  _normalizeBalanceRecord(r) {
    return {
      id:                           _str(r.id),
      beneficiaryUnitId:            _str(r.beneficiaryUnitId),
      generatingUnitId:             _str(r.generatingUnitId),
      beneficiaryUc:                _str(r.beneficiaryUc),
      referenceMonth:               _str(r.referenceMonth),
      previousBalanceKwh:           _num(r.previousBalanceKwh),
      creditsReceivedKwh:           _num(r.creditsReceivedKwh),
      creditsCompensatedKwh:        _num(r.creditsCompensatedKwh),
      positiveAdjustmentsKwh:       _num(r.positiveAdjustmentsKwh),
      negativeAdjustmentsKwh:       _num(r.negativeAdjustmentsKwh),
      currentBalanceKwh:            _num(r.currentBalanceKwh),
      averageMonthlyConsumptionKwh: _num(r.averageMonthlyConsumptionKwh),
      preventiveMarginPercentage:   _num(r.preventiveMarginPercentage),
      targetCreditKwh:              _num(r.targetCreditKwh),
      allocationPercentage:         _num(r.allocationPercentage),
      coverageMonths:               _num(r.coverageMonths),
      status:                       _str(r.status),
      alerts: Array.isArray(r.alerts)
        ? r.alerts.map(a => ({ code: _str(a.code), severity: _str(a.severity), message: _str(a.message) }))
        : [],
      metadata: (r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata))
        ? Object.assign({}, r.metadata) : {},
    };
  }

  getBeneficiaryCreditBalanceRecord(id) {
    const rec = this._beneficiaryCreditBalanceRecords.get(String(id));
    return rec ? Object.assign({}, rec) : null;
  }

  listBeneficiaryCreditBalanceRecords(filters = {}) {
    let items = Array.from(this._beneficiaryCreditBalanceRecords.values()).map(r => Object.assign({}, r));
    items = _applyMonthFilter(items, filters);
    if (filters.beneficiaryUnitId != null) items = items.filter(r => r.beneficiaryUnitId === filters.beneficiaryUnitId);
    if (filters.generatingUnitId  != null) items = items.filter(r => r.generatingUnitId  === filters.generatingUnitId);
    if (filters.status            != null) items = items.filter(r => r.status            === filters.status);
    items.sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));
    return items;
  }

}
