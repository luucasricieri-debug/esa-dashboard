/**
 * ESA OS — Energy Domain / Credits
 * EnergyCreditsQueryService
 *
 * 12 queries sobre o EnergyCreditsReadModel.
 * Sem estado próprio. Sem Firebase. Sem efeitos colaterais.
 */

import { EnergyCreditsQueryResult }            from './energy-credits-query-result.js';
import { roundKwh, roundMoney }                from '../../domains/energy/credits/rounding.js';
import { BeneficiaryConsumptionAverageCalculator } from '../../domains/energy/credits/allocation/consumption-average-calculator.js';

// ── Helpers de módulo ─────────────────────────────────────────────────────────

function _sum(items, field) {
  return items.reduce((acc, item) => {
    const v = item[field];
    return acc + (typeof v === 'number' && !isNaN(v) ? v : 0);
  }, 0);
}

function _latestPerBeneficiary(records) {
  const map = new Map();
  for (const r of records) {
    const bid      = r.beneficiaryUnitId;
    const existing = map.get(bid);
    if (!existing || (r.referenceMonth || '') > (existing.referenceMonth || '')) {
      map.set(bid, r);
    }
  }
  return Array.from(map.values());
}

const SEV_ORDER = ['critical', 'risk', 'attention', 'info'];

function _sortAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    const si = SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity);
    if (si !== 0) return si;
    const ci = (a.code || '').localeCompare(b.code || '');
    if (ci !== 0) return ci;
    return (a.targetId || '').localeCompare(b.targetId || '');
  });
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class EnergyCreditsQueryService {

  constructor(readModel) {
    this._rm      = readModel || null;
    this._avgCalc = new BeneficiaryConsumptionAverageCalculator();
  }

  _requireReadModel(queryName) {
    if (!this._rm || typeof this._rm.listGeneratingUnits !== 'function') {
      throw new TypeError(`[EnergyCreditsQueryService.${queryName}] readModel inválido`);
    }
  }

  _result(data, metadata, options = {}) {
    return new EnergyCreditsQueryResult(data, metadata, options.referenceDate || null);
  }

  // ── Queries de Entidade ────────────────────────────────────────────────────

  getGeneratingUnit(id, options = {}) {
    this._requireReadModel('getGeneratingUnit');
    const unit = this._rm.getGeneratingUnit(id);
    return this._result(unit, { query: 'ec.getGeneratingUnit', id }, options);
  }

  getBeneficiaryUnit(id, options = {}) {
    this._requireReadModel('getBeneficiaryUnit');
    const unit = this._rm.getBeneficiaryUnit(id);
    return this._result(unit, { query: 'ec.getBeneficiaryUnit', id }, options);
  }

  searchGeneratingUnits(filters = {}, options = {}) {
    this._requireReadModel('searchGeneratingUnits');
    const units = this._rm.listGeneratingUnits(filters);
    return this._result(units, {
      query: 'ec.searchGeneratingUnits', filters: Object.assign({}, filters), count: units.length,
    }, options);
  }

  searchBeneficiaryUnits(filters = {}, options = {}) {
    this._requireReadModel('searchBeneficiaryUnits');
    const units = this._rm.listBeneficiaryUnits(filters);
    return this._result(units, {
      query: 'ec.searchBeneficiaryUnits', filters: Object.assign({}, filters), count: units.length,
    }, options);
  }

  // ── Queries de Histórico ───────────────────────────────────────────────────

  getMonthlyStatement(generatingUnitId, referenceMonth, options = {}) {
    this._requireReadModel('getMonthlyStatement');
    const stmt = this._rm.getMonthlyStatement(generatingUnitId, referenceMonth);
    return this._result(stmt, { query: 'ec.getMonthlyStatement', generatingUnitId, referenceMonth }, options);
  }

  getGeneratingUnitMonthlyHistory(generatingUnitId, filters = {}, options = {}) {
    this._requireReadModel('getGeneratingUnitMonthlyHistory');
    const recs = this._rm.listGeneratingUnitMonthlyRecords({ ...filters, generatingUnitId });
    return this._result(recs, {
      query: 'ec.getGeneratingUnitMonthlyHistory', generatingUnitId,
      filters: Object.assign({}, filters), count: recs.length,
    }, options);
  }

  getBeneficiaryMonthlyHistory(beneficiaryUnitId, filters = {}, options = {}) {
    this._requireReadModel('getBeneficiaryMonthlyHistory');
    const recs = this._rm.listBeneficiaryMonthlyRecords({ ...filters, beneficiaryUnitId });
    return this._result(recs, {
      query: 'ec.getBeneficiaryMonthlyHistory', beneficiaryUnitId,
      filters: Object.assign({}, filters), count: recs.length,
    }, options);
  }

  // ── Summaries ──────────────────────────────────────────────────────────────

  getExecutiveSummary(filters = {}, options = {}) {
    this._requireReadModel('getExecutiveSummary');
    const data = this._buildExecutiveSummary(filters, options);
    return this._result(data, { query: 'ec.getExecutiveSummary', filters: Object.assign({}, filters) }, options);
  }

  getGeneratingUnitSummary(generatingUnitId, filters = {}, options = {}) {
    this._requireReadModel('getGeneratingUnitSummary');
    const data = this._buildGeneratingUnitSummary(generatingUnitId, filters, options);
    return this._result(data, { query: 'ec.getGeneratingUnitSummary', generatingUnitId, filters: Object.assign({}, filters) }, options);
  }

  getBeneficiarySummary(beneficiaryUnitId, filters = {}, options = {}) {
    this._requireReadModel('getBeneficiarySummary');
    const data = this._buildBeneficiarySummary(beneficiaryUnitId, filters, options);
    return this._result(data, { query: 'ec.getBeneficiarySummary', beneficiaryUnitId, filters: Object.assign({}, filters) }, options);
  }

  getFinancialSummary(filters = {}, options = {}) {
    this._requireReadModel('getFinancialSummary');
    const data = this._buildFinancialSummary(filters, options);
    return this._result(data, { query: 'ec.getFinancialSummary', filters: Object.assign({}, filters) }, options);
  }

  getAlertsSummary(filters = {}, options = {}) {
    this._requireReadModel('getAlertsSummary');
    const data = this._buildAlertsSummary(filters, options);
    return this._result(data, { query: 'ec.getAlertsSummary', filters: Object.assign({}, filters) }, options);
  }

  // ── Queries de Saldo e Rateio ──────────────────────────────────────────────

  getBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options = {}) {
    this._requireReadModel('getBeneficiaryCreditBalance');
    const id = `beneficiary-credit-balance-${beneficiaryUnitId}-${referenceMonth}`;
    const record = this._rm.getBeneficiaryCreditBalanceRecord
      ? this._rm.getBeneficiaryCreditBalanceRecord(id)
      : null;
    return this._result(record, { query: 'ec.getBeneficiaryCreditBalance', beneficiaryUnitId, referenceMonth }, options);
  }

  getBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters = {}, options = {}) {
    this._requireReadModel('getBeneficiaryCreditBalanceHistory');
    const records = this._rm.listBeneficiaryCreditBalanceRecords
      ? this._rm.listBeneficiaryCreditBalanceRecords({ ...filters, beneficiaryUnitId })
      : [];
    return this._result(records, {
      query: 'ec.getBeneficiaryCreditBalanceHistory', beneficiaryUnitId,
      filters: Object.assign({}, filters), count: records.length,
    }, options);
  }

  getCreditAllocationPlan(generatingUnitId, referenceMonth, options = {}) {
    this._requireReadModel('getCreditAllocationPlan');
    const records = this._rm.listBeneficiaryCreditBalanceRecords
      ? this._rm.listBeneficiaryCreditBalanceRecords({ generatingUnitId, referenceMonth })
      : [];
    const sorted = [...records].sort((a, b) => (a.beneficiaryUnitId || '').localeCompare(b.beneficiaryUnitId || ''));
    const plan = {
      generatingUnitId, referenceMonth,
      beneficiaryCount:       sorted.length,
      totalPlannedCreditsKwh: roundKwh(sorted.reduce((s, r) => s + (r.creditsReceivedKwh || 0), 0)),
      beneficiaries:          sorted,
    };
    return this._result(plan, { query: 'ec.getCreditAllocationPlan', generatingUnitId, referenceMonth }, options);
  }

  getBeneficiaryConsumptionAverage(beneficiaryUnitId, filters = {}, options = {}) {
    this._requireReadModel('getBeneficiaryConsumptionAverage');
    const records = this._rm.listBeneficiaryMonthlyRecords({ ...filters, beneficiaryUnitId });
    const history = records.map(r => ({ referenceMonth: r.referenceMonth, consumptionKwh: r.monthlyConsumptionKwh }));
    const calcResult = this._avgCalc.calculate({
      beneficiaryUnitId,
      monthlyConsumptionHistory: history,
      options: { monthWindow: filters.monthWindow || 12, referenceMonth: filters.referenceMonth || null },
    });
    const data = calcResult.ok ? calcResult.data : null;
    return this._result(data, { query: 'ec.getBeneficiaryConsumptionAverage', beneficiaryUnitId }, options);
  }

  // ── Builders privados ──────────────────────────────────────────────────────

  _buildExecutiveSummary(filters) {
    const statements = this._rm.listMonthlyStatements(filters);
    const genUnits   = this._rm.listGeneratingUnits({});
    const benUnits   = this._rm.listBeneficiaryUnits({});
    const benRecs    = this._rm.listBeneficiaryMonthlyRecords(filters);
    const invoices   = this._rm.listEsaInvoices(filters);
    const allAlerts  = statements.flatMap(s => Array.isArray(s.alerts) ? s.alerts : []);
    const latest     = _latestPerBeneficiary(benRecs);
    const months     = [...new Set(statements.map(s => s.referenceMonth))].sort();

    return {
      generatingUnitCount:      genUnits.length,
      beneficiaryUnitCount:     benUnits.length,
      totalGenerationKwh:       roundKwh(_sum(statements, 'totalGenerationKwh')),
      totalAllocatedKwh:        roundKwh(_sum(statements, 'totalAllocatedKwh')),
      totalCompensatedKwh:      roundKwh(_sum(statements, 'totalCompensatedKwh')),
      totalPendingKwh:          roundKwh(_sum(statements, 'totalPendingKwh')),
      totalCurrentBalanceKwh:   roundKwh(_sum(statements, 'currentBalanceKwh')),
      totalOwnerReturn:         roundMoney(_sum(statements, 'totalOwnerReturn')),
      totalEsaRevenue:          roundMoney(_sum(statements, 'totalEsaRevenue')),
      grossSpread:              roundMoney(_sum(statements, 'grossSpread')),
      totalMonthlyDiscount:     roundMoney(_sum(benRecs, 'monthlyDiscount')),
      totalAccumulatedDiscount: roundMoney(_sum(latest, 'accumulatedDiscountTotal')),
      delinquentInvoiceCount:   invoices.filter(i => i.paymentStatus === 'overdue').length,
      alertCount:               allAlerts.length,
      criticalAlertCount:       allAlerts.filter(a => a.severity === 'critical').length,
      riskAlertCount:           allAlerts.filter(a => a.severity === 'risk').length,
      referenceMonths:          months,
    };
  }

  _buildGeneratingUnitSummary(generatingUnitId, filters) {
    const unit       = this._rm.getGeneratingUnit(generatingUnitId);
    const benUnits   = this._rm.listBeneficiaryUnits({ generatingUnitId });
    const statements = this._rm.listMonthlyStatements({ ...filters, generatingUnitId });
    const allAlerts  = statements.flatMap(s => Array.isArray(s.alerts) ? s.alerts : []);
    const lastStmt   = statements.length > 0 ? statements[statements.length - 1] : null;

    return {
      generatingUnit:        unit,
      beneficiaryCount:      benUnits.length,
      monthlyStatementCount: statements.length,
      totalGenerationKwh:    roundKwh(_sum(statements, 'totalGenerationKwh')),
      totalAllocatedKwh:     roundKwh(_sum(statements, 'totalAllocatedKwh')),
      totalCompensatedKwh:   roundKwh(_sum(statements, 'totalCompensatedKwh')),
      currentBalanceKwh:     lastStmt ? (lastStmt.currentBalanceKwh || 0) : 0,
      totalOwnerReturn:      roundMoney(_sum(statements, 'totalOwnerReturn')),
      grossSpread:           roundMoney(_sum(statements, 'grossSpread')),
      alerts:                allAlerts,
      lastStatement:         lastStmt,
    };
  }

  _buildBeneficiarySummary(beneficiaryUnitId, filters) {
    const unit    = this._rm.getBeneficiaryUnit(beneficiaryUnitId);
    const records = this._rm.listBeneficiaryMonthlyRecords({ ...filters, beneficiaryUnitId });
    const lastRec = records.length > 0 ? records[records.length - 1] : null;
    const balRecs = this._rm.listBeneficiaryCreditBalanceRecords
      ? this._rm.listBeneficiaryCreditBalanceRecords({ beneficiaryUnitId })
      : [];
    const lastBal = balRecs.length > 0 ? balRecs[balRecs.length - 1] : null;
    const paymentStatusSummary = {};
    for (const r of records) {
      const s = r.paymentStatus || 'unknown';
      paymentStatusSummary[s] = (paymentStatusSummary[s] || 0) + 1;
    }
    return {
      beneficiaryUnit:              unit,
      monthlyRecordCount:           records.length,
      totalConsumptionKwh:          roundKwh(_sum(records, 'monthlyConsumptionKwh')),
      totalAllocatedKwh:            roundKwh(_sum(records, 'allocatedKwh')),
      totalCompensatedKwh:          roundKwh(_sum(records, 'compensatedKwh')),
      totalResidualKwh:             roundKwh(_sum(records, 'residualKwh')),
      totalEsaInvoiceAmount:        roundMoney(_sum(records, 'esaInvoiceAmount')),
      totalBillWithoutEsa:          roundMoney(_sum(records, 'billWithoutEsa')),
      totalBillWithEsa:             roundMoney(_sum(records, 'billWithEsa')),
      totalMonthlyDiscount:         roundMoney(_sum(records, 'monthlyDiscount')),
      accumulatedDiscountTotal:     lastRec ? (lastRec.accumulatedDiscountTotal || 0) : 0,
      paymentStatusSummary,
      lastMonthlyRecord:            lastRec,
      averageMonthlyConsumptionKwh: lastBal ? lastBal.averageMonthlyConsumptionKwh : (unit ? unit.averageConsumption12Months : null),
      currentCreditBalanceKwh:      lastBal ? lastBal.currentBalanceKwh : null,
      coverageMonths:               lastBal ? lastBal.coverageMonths : null,
      preventiveMarginPercentage:   lastBal ? lastBal.preventiveMarginPercentage : null,
      allocationPercentage:         lastBal ? lastBal.allocationPercentage : null,
    };
  }

  _buildFinancialSummary(filters) {
    const invoices    = this._rm.listEsaInvoices(filters);
    const settlements = this._rm.listOwnerSettlements(filters);
    const statements  = this._rm.listMonthlyStatements(filters);
    const paid    = invoices.filter(i => i.paymentStatus === 'paid');
    const open    = invoices.filter(i => i.paymentStatus === 'pending');
    const overdue = invoices.filter(i => i.paymentStatus === 'overdue');
    const spaid   = settlements.filter(s => s.paymentStatus === 'paid');
    const sopen   = settlements.filter(s => s.paymentStatus === 'pending');

    return {
      totalEsaRevenue:                roundMoney(_sum(statements, 'totalEsaRevenue')),
      totalOwnerReturn:               roundMoney(_sum(statements, 'totalOwnerReturn')),
      grossSpread:                    roundMoney(_sum(statements, 'grossSpread')),
      totalInvoices:                  invoices.length,
      paidInvoices:                   paid.length,
      openInvoices:                   open.length,
      overdueInvoices:                overdue.length,
      totalInvoicedAmount:            roundMoney(_sum(invoices, 'invoiceAmount')),
      totalPaidAmount:                roundMoney(_sum(paid, 'invoiceAmount')),
      totalOpenAmount:                roundMoney(_sum(open, 'invoiceAmount')),
      totalOwnerSettlements:          settlements.length,
      paidOwnerSettlements:           spaid.length,
      openOwnerSettlements:           sopen.length,
      totalOwnerSettlementAmount:     roundMoney(_sum(settlements, 'netReturn')),
      totalOwnerSettlementOpenAmount: roundMoney(_sum(sopen, 'netReturn')),
    };
  }

  _buildAlertsSummary(filters) {
    const statements = this._rm.listMonthlyStatements(filters);
    const raw        = statements.flatMap(s => Array.isArray(s.alerts) ? s.alerts : []);
    const sorted     = _sortAlerts(raw);
    const bySeverity = {};
    const byCode     = {};
    for (const a of sorted) {
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
      byCode[a.code]         = (byCode[a.code]         || 0) + 1;
    }
    return {
      totalAlerts:     sorted.length,
      bySeverity,
      byCode,
      criticalAlerts:  sorted.filter(a => a.severity === 'critical'),
      riskAlerts:      sorted.filter(a => a.severity === 'risk'),
      attentionAlerts: sorted.filter(a => a.severity === 'attention'),
      infoAlerts:      sorted.filter(a => a.severity === 'info'),
      alerts:          sorted,
    };
  }

}
