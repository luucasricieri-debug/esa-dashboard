/**
 * ESA OS — Reports / Energy Credits
 * EnergyCreditsReportService
 *
 * Builders de contratos de relatório mensal de créditos de energia.
 * Fonte única: EnergyCreditsQueryService (dependency injection).
 * Sem Firebase. Sem UI. Sem PDF real. Sem envio. READ-ONLY.
 * Data minimization aplicada — whitelist-first em toda saída.
 */

import { EnergyCreditsQueryResult } from '../../queries/energy-credits/energy-credits-query-result.js';
import { REPORT_VERSION, REPORT_TYPE, DISTRIBUTION_DEFAULTS } from './report-types.js';
import { roundKwh, roundMoney }     from '../../domains/energy/credits/rounding.js';

// ── Helpers de módulo ─────────────────────────────────────────────────────────

function _sanitize(v) {
  if (v === undefined) return null;
  if (typeof v === 'number' && isNaN(v)) return null;
  if (Array.isArray(v)) return v.map(_sanitize);
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = _sanitize(v[k]);
    return out;
  }
  return v;
}

function _payStatus(paid, open) {
  if (paid > 0) return 'paid';
  if (open > 0) return 'pending';
  return null;
}

function _reportMetadata(alerts, available, unavailable) {
  return {
    source:              'energy-credits-query-service',
    sourceVersion:       '1.0',
    minimized:           true,
    readOnly:            true,
    sectionsAvailable:   available,
    sectionsUnavailable: unavailable,
    alertCount:          Array.isArray(alerts) ? alerts.length : 0,
    generatedBy:         'esa-os',
    requiresPdfRendering: true,
  };
}

function _wrap(report, source, filters, options) {
  return new EnergyCreditsQueryResult(
    report,
    { source, filters: Object.assign({}, filters), referenceDate: options.referenceDate || null, count: 1 },
    options.referenceDate || null,
  );
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class EnergyCreditsReportService {

  constructor(queryService) {
    this._qs = queryService || null;
  }

  _requireQueryService(method) {
    if (!this._qs || typeof this._qs.getGeneratingUnit !== 'function') {
      throw new TypeError(`[EnergyCreditsReportService.${method}] queryService inválido`);
    }
  }

  // ── Owner Monthly Report ───────────────────────────────────────────────────

  buildOwnerMonthlyReport(generatingUnitId, referenceMonth, options = {}) {
    this._requireQueryService('buildOwnerMonthlyReport');
    const qOpts  = { referenceDate: options.referenceDate || null };
    const filters = { referenceMonth };
    const genGid  = { generatingUnitId };

    const genSum  = this._qs.getGeneratingUnitSummary(generatingUnitId, filters, qOpts);
    const unit    = genSum.data.generatingUnit;
    if (!unit) throw new Error(`[buildOwnerMonthlyReport] Unidade geradora não encontrada: ${generatingUnitId}`);

    const stmt      = this._qs.getMonthlyStatement(generatingUnitId, referenceMonth, qOpts).data;
    const benUnits  = this._qs.searchBeneficiaryUnits(genGid, qOpts).data
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    const fin       = this._qs.getFinancialSummary({ ...filters, ...genGid }, qOpts).data;
    const alertsSum = this._qs.getAlertsSummary({ ...filters, ...genGid }, qOpts).data;
    const genRec    = this._qs.getGeneratingUnitMonthlyHistory(generatingUnitId, filters, qOpts).data[0] || null;
    const bItems    = this._buildBeneficiaryItems(benUnits, referenceMonth, qOpts);
    const creditDst = this._buildCreditDestinations(benUnits, referenceMonth, qOpts);
    const alerts    = alertsSum.alerts;
    const SECTIONS  = ['identification', 'generationAndBalance', 'beneficiaryConsumption', 'creditDestinations', 'ownerSettlement', 'alerts', 'documentsPlaceholder'];

    const report = _sanitize({
      reportVersion: REPORT_VERSION,
      reportType:    REPORT_TYPE.OWNER_MONTHLY,
      generatedAt:   options.referenceDate || null,
      referenceMonth,
      target:        this._ownerTarget(unit),
      title:         `Relatório Mensal do Proprietário — ${unit.name} — ${referenceMonth}`,
      summary:       this._ownerSummary(unit, stmt, genRec, fin, referenceMonth),
      sections:      this._ownerSections(unit, stmt, genRec, fin, alerts, bItems, referenceMonth, creditDst),
      totals:        this._ownerTotals(stmt, fin),
      alerts,
      distribution:  Object.assign({}, DISTRIBUTION_DEFAULTS),
      metadata:      _reportMetadata(alerts, SECTIONS, []),
    });

    return _wrap(report, 'ec.buildOwnerMonthlyReport', { generatingUnitId, referenceMonth }, options);
  }

  _ownerTarget(unit) {
    return {
      targetType:       'generating-unit-owner',
      generatingUnitId: unit.id,
      ownerName:        unit.ownerName,
      ownerDocument:    unit.ownerDocument,
    };
  }

  _ownerSummary(unit, stmt, genRec, fin, referenceMonth) {
    return {
      generatingUnitName:           unit.name,
      ownerName:                    unit.ownerName,
      referenceMonth,
      previousBalanceKwh:           stmt ? stmt.previousBalanceKwh : null,
      monthlyGenerationKwh:         stmt ? stmt.totalGenerationKwh : null,
      availableKwhBeforeAllocation: stmt ? stmt.availableKwhBeforeAllocation : null,
      totalAllocatedKwh:            stmt ? stmt.totalAllocatedKwh : null,
      totalCompensatedKwh:          stmt ? stmt.totalCompensatedKwh : null,
      totalPendingKwh:              stmt ? stmt.totalPendingKwh : null,
      currentBalanceKwh:            stmt ? stmt.currentBalanceKwh : null,
      purchaseKwhPrice:             genRec ? genRec.purchaseKwhPrice : null,
      monthlyOwnerReturn:           genRec ? genRec.monthlyOwnerReturn : null,
      accumulatedOwnerReturn:       genRec ? genRec.accumulatedOwnerReturn : null,
      paymentStatus:                _payStatus(fin.paidOwnerSettlements, fin.openOwnerSettlements),
    };
  }

  _ownerSections(unit, stmt, genRec, fin, alerts, bItems, referenceMonth, creditDst) {
    return {
      identification:         this._genIdentification(unit),
      generationAndBalance:   this._genBalance(stmt, referenceMonth),
      beneficiaryConsumption: { count: bItems.length, beneficiaries: bItems },
      creditDestinations:     creditDst,
      ownerSettlement:        this._ownerSettlement(genRec, fin),
      alerts:                 { count: alerts.length, items: alerts },
      documentsPlaceholder:   { pdfReport: null, signed: null, attachments: [] },
    };
  }

  _ownerTotals(stmt, fin) {
    return {
      totalGenerationKwh:  stmt ? stmt.totalGenerationKwh : null,
      totalAllocatedKwh:   stmt ? stmt.totalAllocatedKwh : null,
      totalCompensatedKwh: stmt ? stmt.totalCompensatedKwh : null,
      totalOwnerReturn:    fin.totalOwnerReturn,
      grossSpread:         fin.grossSpread,
    };
  }

  _genIdentification(unit) {
    return {
      generatingUnitId:  unit.id,
      name:              unit.name,
      ownerName:         unit.ownerName,
      ownerDocument:     unit.ownerDocument,
      uc:                unit.uc,
      utilityCompany:    unit.utilityCompany,
      operationalStatus: unit.operationalStatus,
      installedPower:    unit.installedPower,
      address:           unit.address,
      city:              unit.city,
      state:             unit.state,
    };
  }

  _genBalance(stmt, referenceMonth) {
    return {
      referenceMonth,
      previousBalanceKwh:           stmt ? stmt.previousBalanceKwh : null,
      monthlyGenerationKwh:         stmt ? stmt.totalGenerationKwh : null,
      availableKwhBeforeAllocation: stmt ? stmt.availableKwhBeforeAllocation : null,
      totalAllocatedKwh:            stmt ? stmt.totalAllocatedKwh : null,
      totalCompensatedKwh:          stmt ? stmt.totalCompensatedKwh : null,
      totalPendingKwh:              stmt ? stmt.totalPendingKwh : null,
      currentBalanceKwh:            stmt ? stmt.currentBalanceKwh : null,
      beneficiaryCount:             stmt ? stmt.beneficiaryCount : 0,
    };
  }

  _ownerSettlement(genRec, fin) {
    return {
      purchaseKwhPrice:      genRec ? genRec.purchaseKwhPrice : null,
      consumedAllocatedKwh:  genRec ? genRec.consumedAllocatedKwh : null,
      monthlyOwnerReturn:    genRec ? genRec.monthlyOwnerReturn : null,
      accumulatedOwnerReturn: genRec ? genRec.accumulatedOwnerReturn : null,
      totalSettlementAmount: fin.totalOwnerSettlementAmount,
      totalSettlementOpen:   fin.totalOwnerSettlementOpenAmount,
      paymentStatus:         _payStatus(fin.paidOwnerSettlements, fin.openOwnerSettlements),
    };
  }

  _buildBeneficiaryItems(benUnits, referenceMonth, qOpts) {
    return benUnits.map(u => {
      const hist = this._qs.getBeneficiaryMonthlyHistory(u.id, { referenceMonth }, qOpts).data;
      const rec  = hist.length > 0 ? hist[0] : null;
      return {
        beneficiaryUnitId:     u.id,
        name:                  u.name,
        uc:                    u.uc,
        subscriptionStatus:    u.subscriptionStatus,
        monthlyConsumptionKwh: rec ? rec.monthlyConsumptionKwh : null,
        allocatedKwh:          rec ? rec.allocatedKwh : null,
        compensatedKwh:        rec ? rec.compensatedKwh : null,
        pendingKwh:            rec ? rec.pendingKwh : null,
        esaInvoiceAmount:      rec ? rec.esaInvoiceAmount : null,
        paymentStatus:         rec ? rec.paymentStatus : null,
      };
    });
  }

  _buildCreditDestinations(benUnits, referenceMonth, qOpts) {
    const items = benUnits
      .map(u => {
        const hist = this._qs.getBeneficiaryMonthlyHistory(u.id, { referenceMonth }, qOpts).data;
        const rec  = hist.length > 0 ? hist[0] : null;
        const bal  = this._qs.getBeneficiaryCreditBalance
          ? this._qs.getBeneficiaryCreditBalance(u.id, referenceMonth, qOpts).data
          : null;
        return {
          beneficiaryUnitId:     u.id,
          beneficiaryName:       u.name,
          beneficiaryUc:         u.uc,
          utilityCompany:        u.utilityCompany,
          allocationPercentage:  bal ? bal.allocationPercentage : null,
          creditsReceivedKwh:    bal ? bal.creditsReceivedKwh   : null,
          monthlyConsumptionKwh: rec ? rec.monthlyConsumptionKwh : null,
          creditsCompensatedKwh: bal ? bal.creditsCompensatedKwh : (rec ? rec.compensatedKwh : null),
          previousBalanceKwh:    bal ? bal.previousBalanceKwh   : null,
          currentBalanceKwh:     bal ? bal.currentBalanceKwh    : null,
          coverageMonths:        bal ? bal.coverageMonths        : null,
        };
      })
      .sort((a, b) => (a.beneficiaryUnitId || '').localeCompare(b.beneficiaryUnitId || ''));

    const sum = (field) => roundKwh(items.reduce((s, i) => s + (i[field] || 0), 0));
    return {
      items,
      summary: {
        beneficiaryCount:                items.length,
        totalCreditsDistributedKwh:      sum('creditsReceivedKwh'),
        totalBeneficiaryConsumptionKwh:  sum('monthlyConsumptionKwh'),
        totalCreditsCompensatedKwh:      sum('creditsCompensatedKwh'),
        totalBeneficiaryCreditBalanceKwh: sum('currentBalanceKwh'),
      },
    };
  }

  // ── Beneficiary Monthly Report ─────────────────────────────────────────────

  buildBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options = {}) {
    this._requireQueryService('buildBeneficiaryMonthlyReport');
    const qOpts    = { referenceDate: options.referenceDate || null };
    const filters  = { referenceMonth };

    const benSum = this._qs.getBeneficiarySummary(beneficiaryUnitId, filters, qOpts);
    const unit   = benSum.data.beneficiaryUnit;
    if (!unit) throw new Error(`[buildBeneficiaryMonthlyReport] Unidade beneficiária não encontrada: ${beneficiaryUnitId}`);

    const hist    = this._qs.getBeneficiaryMonthlyHistory(beneficiaryUnitId, filters, qOpts).data;
    const rec     = hist.length > 0 ? hist[0] : null;
    const aFilters = { ...filters, generatingUnitId: unit.generatingUnitId };
    const alerts  = this._qs.getAlertsSummary(aFilters, qOpts).data.alerts;
    const billingSnapshot   = options.billingSnapshot           || null;
    const savingsHistory    = options.beneficiarySavingsHistory || null;
    const SECTIONS = ['identification', 'consumption', 'creditBalance', 'billingComparison', 'savings', 'savingsHistory', 'settlement', 'payment', 'alerts', 'documentsPlaceholder'];

    const report = _sanitize({
      reportVersion: REPORT_VERSION,
      reportType:    REPORT_TYPE.BENEFICIARY_MONTHLY,
      generatedAt:   options.referenceDate || null,
      referenceMonth,
      target:        this._benTarget(unit),
      title:         `Relatório Mensal da Unidade Beneficiária — ${unit.name} — ${referenceMonth}`,
      summary:       this._benSummary(unit, rec, referenceMonth),
      sections:      this._benSections(unit, rec, alerts, referenceMonth, billingSnapshot, savingsHistory),
      totals:        this._benTotals(rec),
      alerts,
      billingSnapshot,
      distribution:  Object.assign({}, DISTRIBUTION_DEFAULTS),
      metadata:      _reportMetadata(alerts, SECTIONS, []),
    });

    return _wrap(report, 'ec.buildBeneficiaryMonthlyReport', { beneficiaryUnitId, referenceMonth }, options);
  }

  _benTarget(unit) {
    return {
      targetType:        'beneficiary-unit',
      beneficiaryUnitId: unit.id,
      generatingUnitId:  unit.generatingUnitId,
      name:              unit.name,
      document:          unit.holderName || null,
      uc:                unit.uc,
    };
  }

  _benSummary(unit, rec, referenceMonth) {
    return {
      beneficiaryName:        unit.name,
      uc:                     unit.uc,
      referenceMonth,
      monthlyConsumptionKwh:  rec ? rec.monthlyConsumptionKwh : null,
      allocatedKwh:           rec ? rec.allocatedKwh : null,
      compensatedKwh:         rec ? rec.compensatedKwh : null,
      pendingKwh:             rec ? rec.pendingKwh : null,
      residualKwh:            rec ? rec.residualKwh : null,
      esaKwhPrice:            rec ? rec.esaKwhPrice : null,
      utilityReferenceTariff: rec ? rec.utilityReferenceTariff : null,
      billWithoutEsa:         rec ? rec.billWithoutEsa : null,
      esaInvoiceAmount:       rec ? rec.esaInvoiceAmount : null,
      residualUtilityAmount:  rec ? rec.residualUtilityAmount : null,
      billWithEsa:            rec ? rec.billWithEsa : null,
      monthlyDiscount:        rec ? rec.monthlyDiscount : null,
      accumulatedDiscountTotal: rec ? rec.accumulatedDiscountTotal : null,
      paymentStatus:          rec ? rec.paymentStatus : null,
      dueDate:                rec ? rec.dueDate : null,
      paidAt:                 rec ? rec.paidAt : null,
    };
  }

  _benSections(unit, rec, alerts, referenceMonth, billingSnapshot = null, savingsHistory = null) {
    const creditBal = this._qs.getBeneficiaryCreditBalance
      ? this._qs.getBeneficiaryCreditBalance(unit.id, referenceMonth).data
      : null;
    return {
      identification:      this._benIdentification(unit),
      consumption:         this._consumptionSection(rec),
      creditBalance:       this._creditBalanceSection(creditBal),
      billingComparison:   this._billingComparisonSection(rec, billingSnapshot),
      savings:             this._savingsSection(rec, billingSnapshot),
      savingsHistory:      this._savingsHistorySection(savingsHistory, rec),
      settlement:          this._settlementSection(billingSnapshot),
      payment:             this._paymentSection(rec),
      alerts:              { count: alerts.length, items: alerts },
      documentsPlaceholder: { pdfReport: null, signed: null, attachments: [] },
    };
  }

  _benTotals(rec) {
    if (!rec) return null;
    return {
      compensatedKwh:           rec.compensatedKwh,
      esaInvoiceAmount:         rec.esaInvoiceAmount,
      monthlyDiscount:          rec.monthlyDiscount,
      accumulatedDiscountTotal: rec.accumulatedDiscountTotal,
    };
  }

  _benIdentification(unit) {
    return {
      beneficiaryUnitId:  unit.id,
      generatingUnitId:   unit.generatingUnitId,
      name:               unit.name,
      holderName:         unit.holderName,
      uc:                 unit.uc,
      utilityCompany:     unit.utilityCompany,
      subscriptionStatus: unit.subscriptionStatus,
      address:            unit.address,
      city:               unit.city,
      state:              unit.state,
    };
  }

  _consumptionSection(rec) {
    return {
      monthlyConsumptionKwh: rec ? rec.monthlyConsumptionKwh : null,
      allocatedKwh:          rec ? rec.allocatedKwh : null,
      compensatedKwh:        rec ? rec.compensatedKwh : null,
      pendingKwh:            rec ? rec.pendingKwh : null,
      residualKwh:           rec ? rec.residualKwh : null,
    };
  }

  _creditBalanceSection(bal) {
    if (!bal) return { source: 'unavailable' };
    return {
      source:                        'beneficiary-credit-balance-record',
      previousBalanceKwh:            bal.previousBalanceKwh,
      creditsReceivedKwh:            bal.creditsReceivedKwh,
      creditsCompensatedKwh:         bal.creditsCompensatedKwh,
      positiveAdjustmentsKwh:        bal.positiveAdjustmentsKwh,
      negativeAdjustmentsKwh:        bal.negativeAdjustmentsKwh,
      currentBalanceKwh:             bal.currentBalanceKwh,
      averageMonthlyConsumptionKwh:  bal.averageMonthlyConsumptionKwh,
      preventiveMarginPercentage:    bal.preventiveMarginPercentage,
      targetCreditKwh:               bal.targetCreditKwh,
      allocationPercentage:          bal.allocationPercentage,
      coverageMonths:                bal.coverageMonths,
    };
  }

  _savingsHistorySection(savingsHistory, rec) {
    if (!Array.isArray(savingsHistory) || savingsHistory.length === 0) {
      return { source: 'unavailable', currentMonthSavings: rec ? rec.monthlyDiscount : null };
    }
    const sorted = [...savingsHistory].sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));
    const first  = sorted[0];
    const last   = sorted[sorted.length - 1];
    const accumulated = sorted.reduce((s, snap) => s + (snap.monthlySavings ?? snap.economiaMensal ?? 0), 0);
    return {
      source:                      'savings-history',
      currentMonthSavings:         last.monthlySavings ?? last.economiaMensal ?? null,
      accumulatedSavings:          roundMoney(accumulated),
      customerSinceReferenceMonth: first.referenceMonth || null,
      monthsAsCustomer:            sorted.length,
    };
  }

  _settlementSection(billingSnapshot) {
    const r = billingSnapshot && billingSnapshot.settlementRecipient;
    if (!r) return { source: 'unavailable' };
    return {
      source:            'billing-snapshot',
      recipientName:     r.recipientName     || null,
      recipientDocument: r.recipientDocument || null,
      pixKey:            r.pixKey            || null,
      pixKeyType:        r.pixKeyType        || null,
    };
  }

  _billingComparisonSection(rec, billingSnapshot = null) {
    if (billingSnapshot) {
      return {
        source:                 'billing-snapshot',
        calculationSource:      billingSnapshot.calculationSource,
        billWithoutEsa:         billingSnapshot.contaConcessionaria?.total ?? null,
        billWithEsa:            billingSnapshot.contaEsa?.total            ?? null,
        esaKwhPrice:            billingSnapshot.inputs?.preco_kwh          ?? null,
        utilityReferenceTariff: billingSnapshot.inputs?.te_com             ?? null,
        esaInvoiceAmount:       billingSnapshot.contaEsa?.total            ?? null,
        residualUtilityAmount:  billingSnapshot.contaEsa?.fioB             ?? null,
        componentesTarifarios:  billingSnapshot.componentesTarifarios      || null,
      };
    }
    if (!rec) return { source: 'unavailable' };
    return {
      source:                 'operational-record',
      esaKwhPrice:            rec.esaKwhPrice            || null,
      utilityReferenceTariff: rec.utilityReferenceTariff || null,
      billWithoutEsa:         rec.billWithoutEsa         || null,
      esaInvoiceAmount:       rec.esaInvoiceAmount       || null,
      residualUtilityAmount:  rec.residualUtilityAmount  || null,
      billWithEsa:            rec.billWithEsa            || null,
    };
  }

  _savingsSection(rec, billingSnapshot = null) {
    if (billingSnapshot) {
      return {
        source:               'billing-snapshot',
        monthlySavings:       billingSnapshot.economiaMensal      ?? null,
        savingsPercentage:    billingSnapshot.economiaPercentual   ?? null,
        annualSavings:        billingSnapshot.economiaAnual        ?? null,
        monthlyDiscount:             rec ? rec.monthlyDiscount             : null,
        previousAccumulatedDiscount: rec ? rec.previousAccumulatedDiscount : null,
        accumulatedDiscountTotal:    rec ? rec.accumulatedDiscountTotal    : null,
      };
    }
    return {
      source:                      'operational-record',
      monthlyDiscount:             rec ? rec.monthlyDiscount             : null,
      previousAccumulatedDiscount: rec ? rec.previousAccumulatedDiscount : null,
      accumulatedDiscountTotal:    rec ? rec.accumulatedDiscountTotal    : null,
    };
  }

  _paymentSection(rec) {
    return {
      esaInvoiceAmount: rec ? rec.esaInvoiceAmount : null,
      paymentStatus:    rec ? rec.paymentStatus : null,
      dueDate:          rec ? rec.dueDate : null,
      paidAt:           rec ? rec.paidAt : null,
    };
  }

  // ── ESA Internal Monthly Report ────────────────────────────────────────────

  buildEsaInternalMonthlyReport(referenceMonth, options = {}) {
    this._requireQueryService('buildEsaInternalMonthlyReport');
    const qOpts   = { referenceDate: options.referenceDate || null };
    const filters  = { referenceMonth };

    const exec   = this._qs.getExecutiveSummary(filters, qOpts).data;
    const fin    = this._qs.getFinancialSummary(filters, qOpts).data;
    const alerts = this._qs.getAlertsSummary(filters, qOpts).data.alerts;
    const SECTIONS = ['executiveSummary', 'operationalSummary', 'financialSummary', 'alerts', 'pendingActionsPlaceholder'];

    const report = _sanitize({
      reportVersion: REPORT_VERSION,
      reportType:    REPORT_TYPE.ESA_INTERNAL_MONTHLY,
      generatedAt:   options.referenceDate || null,
      referenceMonth,
      target:        { targetType: 'esa-internal', organization: 'esa' },
      title:         `Relatório Interno Mensal ESA — ${referenceMonth}`,
      summary:       this._internalSummary(exec, fin, referenceMonth),
      sections:      this._internalSections(exec, fin, alerts),
      totals:        this._internalTotals(exec, fin),
      alerts,
      distribution:  Object.assign({}, DISTRIBUTION_DEFAULTS),
      metadata:      _reportMetadata(alerts, SECTIONS, []),
    });

    return _wrap(report, 'ec.buildEsaInternalMonthlyReport', { referenceMonth }, options);
  }

  _internalSummary(exec, fin, referenceMonth) {
    return {
      referenceMonth,
      generatingUnitCount:    exec.generatingUnitCount,
      beneficiaryUnitCount:   exec.beneficiaryUnitCount,
      totalGenerationKwh:     exec.totalGenerationKwh,
      totalAllocatedKwh:      exec.totalAllocatedKwh,
      totalCompensatedKwh:    exec.totalCompensatedKwh,
      totalPendingKwh:        exec.totalPendingKwh,
      totalCurrentBalanceKwh: exec.totalCurrentBalanceKwh,
      totalEsaRevenue:        exec.totalEsaRevenue,
      totalOwnerReturn:       exec.totalOwnerReturn,
      grossSpread:            exec.grossSpread,
      totalMonthlyDiscount:   exec.totalMonthlyDiscount,
      delinquentInvoiceCount: exec.delinquentInvoiceCount,
      alertCount:             exec.alertCount,
    };
  }

  _internalSections(exec, fin, alerts) {
    return {
      executiveSummary: {
        generatingUnitCount:  exec.generatingUnitCount,
        beneficiaryUnitCount: exec.beneficiaryUnitCount,
        referenceMonths:      exec.referenceMonths,
        alertCount:           exec.alertCount,
        criticalAlertCount:   exec.criticalAlertCount,
      },
      operationalSummary: {
        totalGenerationKwh:    exec.totalGenerationKwh,
        totalAllocatedKwh:     exec.totalAllocatedKwh,
        totalCompensatedKwh:   exec.totalCompensatedKwh,
        totalPendingKwh:       exec.totalPendingKwh,
        totalCurrentBalanceKwh: exec.totalCurrentBalanceKwh,
      },
      financialSummary: {
        totalEsaRevenue:     fin.totalEsaRevenue,
        totalOwnerReturn:    fin.totalOwnerReturn,
        grossSpread:         fin.grossSpread,
        totalInvoicedAmount: fin.totalInvoicedAmount,
        overdueInvoices:     fin.overdueInvoices,
      },
      alerts:                    { count: alerts.length, items: alerts },
      pendingActionsPlaceholder: { items: [], generatedAt: null },
    };
  }

  _internalTotals(exec, fin) {
    return {
      totalGenerationKwh:  exec.totalGenerationKwh,
      totalEsaRevenue:     exec.totalEsaRevenue,
      totalOwnerReturn:    exec.totalOwnerReturn,
      grossSpread:         exec.grossSpread,
      totalInvoicedAmount: fin.totalInvoicedAmount,
    };
  }

  // ── ESA Financial Monthly Report ───────────────────────────────────────────

  buildEsaFinancialMonthlyReport(referenceMonth, options = {}) {
    this._requireQueryService('buildEsaFinancialMonthlyReport');
    const qOpts   = { referenceDate: options.referenceDate || null };
    const filters  = { referenceMonth };

    const fin    = this._qs.getFinancialSummary(filters, qOpts).data;
    const exec   = this._qs.getExecutiveSummary(filters, qOpts).data;
    const alerts = this._qs.getAlertsSummary(filters, qOpts).data.alerts;
    const SECTIONS = ['invoicing', 'receipts', 'ownerSettlements', 'spread', 'delinquency', 'alerts'];

    const report = _sanitize({
      reportVersion: REPORT_VERSION,
      reportType:    REPORT_TYPE.ESA_FINANCIAL_MONTHLY,
      generatedAt:   options.referenceDate || null,
      referenceMonth,
      target:        { targetType: 'esa-financial', organization: 'esa' },
      title:         `Relatório Financeiro Mensal ESA — ${referenceMonth}`,
      summary:       this._financialSummary(fin, referenceMonth),
      sections:      this._financialSections(fin, exec, alerts),
      totals:        this._financialTotals(fin),
      alerts,
      distribution:  Object.assign({}, DISTRIBUTION_DEFAULTS),
      metadata:      _reportMetadata(alerts, SECTIONS, []),
    });

    return _wrap(report, 'ec.buildEsaFinancialMonthlyReport', { referenceMonth }, options);
  }

  _financialSummary(fin, referenceMonth) {
    return {
      referenceMonth,
      totalEsaRevenue:                fin.totalEsaRevenue,
      totalOwnerReturn:               fin.totalOwnerReturn,
      grossSpread:                    fin.grossSpread,
      totalInvoices:                  fin.totalInvoices,
      paidInvoices:                   fin.paidInvoices,
      openInvoices:                   fin.openInvoices,
      overdueInvoices:                fin.overdueInvoices,
      totalInvoicedAmount:            fin.totalInvoicedAmount,
      totalPaidAmount:                fin.totalPaidAmount,
      totalOpenAmount:                fin.totalOpenAmount,
      totalOwnerSettlements:          fin.totalOwnerSettlements,
      paidOwnerSettlements:           fin.paidOwnerSettlements,
      openOwnerSettlements:           fin.openOwnerSettlements,
      totalOwnerSettlementAmount:     fin.totalOwnerSettlementAmount,
      totalOwnerSettlementOpenAmount: fin.totalOwnerSettlementOpenAmount,
    };
  }

  _financialSections(fin, exec, alerts) {
    return {
      invoicing: {
        totalInvoices:       fin.totalInvoices,
        totalInvoicedAmount: fin.totalInvoicedAmount,
        paidInvoices:        fin.paidInvoices,
        openInvoices:        fin.openInvoices,
        overdueInvoices:     fin.overdueInvoices,
      },
      receipts: {
        totalPaidAmount:  fin.totalPaidAmount,
        totalOpenAmount:  fin.totalOpenAmount,
        paidInvoices:     fin.paidInvoices,
      },
      ownerSettlements: {
        totalOwnerSettlements:          fin.totalOwnerSettlements,
        paidOwnerSettlements:           fin.paidOwnerSettlements,
        openOwnerSettlements:           fin.openOwnerSettlements,
        totalOwnerSettlementAmount:     fin.totalOwnerSettlementAmount,
        totalOwnerSettlementOpenAmount: fin.totalOwnerSettlementOpenAmount,
      },
      spread: {
        totalEsaRevenue:  fin.totalEsaRevenue,
        totalOwnerReturn: fin.totalOwnerReturn,
        grossSpread:      fin.grossSpread,
      },
      delinquency: {
        overdueInvoices:        fin.overdueInvoices,
        totalOpenAmount:        fin.totalOpenAmount,
        delinquentInvoiceCount: exec.delinquentInvoiceCount,
      },
      alerts: { count: alerts.length, items: alerts },
    };
  }

  _financialTotals(fin) {
    return {
      totalEsaRevenue:                fin.totalEsaRevenue,
      totalOwnerReturn:               fin.totalOwnerReturn,
      grossSpread:                    fin.grossSpread,
      totalInvoicedAmount:            fin.totalInvoicedAmount,
      totalOwnerSettlementAmount:     fin.totalOwnerSettlementAmount,
      totalOwnerSettlementOpenAmount: fin.totalOwnerSettlementOpenAmount,
    };
  }

}
