/**
 * ESA OS — UI / Energy Credits / Preview
 * Provider falso compatível com EnergyCreditsUIProvider.
 *
 * Todos os 27 métodos retornam { ok, data, errors, warnings, metadata }.
 * Não há Firebase, sem backend, sem rede.
 * Estado mutable (faturas) é mantido em memória durante a sessão de preview.
 */

import {
  PREVIEW_MONTH,
  GENERATING_UNITS,
  BENEFICIARY_UNITS,
  CREDIT_BALANCES,
  BILLING_SNAPSHOTS,
  INITIAL_INVOICES,
  UTILITY_BILL_IMPORTS,
  ALERTS,
  COMMERCIAL_TERMS,
  BENEFICIARY_HISTORY,
  REPORT_OWNER,
  REPORT_BENEFICIARY,
  REPORT_ESA_INTERNAL,
  REPORT_ESA_FINANCIAL,
  EXECUTIVE_SUMMARY,
} from './energy-credits-preview-data.js';

// ─── helpers UIResult ─────────────────────────────────────────────────────────

function ok(data, warnings = [], extra = {}) {
  return {
    ok: true,
    data,
    errors: [],
    warnings,
    metadata: { generatedAt: new Date().toISOString(), source: 'preview', ...extra },
  };
}

function fail(code, message) {
  return {
    ok: false,
    data: null,
    errors: [{ code, message }],
    warnings: [],
    metadata: { generatedAt: new Date().toISOString(), source: 'preview' },
  };
}

function previewWarn(action) {
  return [`[Preview] Ação "${action}" simulada — nenhum dado foi persistido.`];
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createPreviewProvider() {
  // Estado mutable em memória: faturas
  let _invoices = INITIAL_INVOICES.map((inv) => ({ ...inv }));

  // Estado mutable em memória: importações de faturas de concessionária
  let _utilityBills = UTILITY_BILL_IMPORTS.map((u) => ({ ...u }));

  return {

    // ── Capabilities e Stats ─────────────────────────────────────────────────

    getCapabilities() {
      return ok({
        version: '1.0.0',
        persistenceMode: 'preview',
        features: ['dashboard', 'generating-units', 'beneficiary-units', 'monthly-settlement',
          'csv-import', 'utility-bill-import', 'reports', 'financial', 'alerts'],
      });
    },

    getStats() {
      return ok({
        totalGeneratingUnits: GENERATING_UNITS.length,
        totalBeneficiaryUnits: BENEFICIARY_UNITS.length,
        totalGenerationKwh: 13000,
        referenceMonth: PREVIEW_MONTH,
      });
    },

    // ── Dashboard ────────────────────────────────────────────────────────────

    getExecutiveSummary(_filters = {}) {
      return ok(EXECUTIVE_SUMMARY);
    },

    // ── Financeiro ───────────────────────────────────────────────────────────

    getFinancialSummary(_filters = {}) {
      const paid     = _invoices.filter((i) => i.paymentStatus === 'paid').reduce((s, i) => s + i.amount, 0);
      const open     = _invoices.filter((i) => i.paymentStatus === 'open').reduce((s, i) => s + i.amount, 0);
      const overdue  = _invoices.filter((i) => i.paymentStatus === 'overdue').reduce((s, i) => s + i.amount, 0);

      return ok({
        referenceMonth: PREVIEW_MONTH,
        totalEconomy: 57.18,
        totalInvoiceAmount: paid + open + overdue,
        paidAmount: paid,
        openAmount: open,
        overdueAmount: overdue,
        ownerRevenue: 4522.70,
        invoices: _invoices.slice(),
        ownerSettlements: [
          {
            id: 'set-001',
            generatingUnitId: 'ug-assai',
            referenceMonth: PREVIEW_MONTH,
            amount: 4522.70,
            paymentStatus: 'pending',
          },
        ],
      });
    },

    confirmInvoicePayment(invoiceId, _data = {}, _options = {}) {
      const inv = _invoices.find((i) => i.id === invoiceId);
      if (!inv) return fail('NOT_FOUND', `Fatura ${invoiceId} não encontrada.`);
      inv.paymentStatus = 'paid';
      inv.paidAt = new Date().toISOString();
      return ok({ ...inv }, previewWarn('confirmInvoicePayment'));
    },

    reopenInvoicePayment(invoiceId, _reason = '', _options = {}) {
      const inv = _invoices.find((i) => i.id === invoiceId);
      if (!inv) return fail('NOT_FOUND', `Fatura ${invoiceId} não encontrada.`);
      inv.paymentStatus = 'open';
      inv.paidAt = null;
      return ok({ ...inv }, previewWarn('reopenInvoicePayment'));
    },

    // ── Alertas ──────────────────────────────────────────────────────────────

    getAlertsSummary(_filters = {}) {
      const byHigh   = ALERTS.filter((a) => a.severity === 'high');
      const byMedium = ALERTS.filter((a) => a.severity === 'medium');
      const byLow    = ALERTS.filter((a) => a.severity === 'low');

      return ok({
        total: ALERTS.length,
        byHighSeverity: byHigh.length,
        byMediumSeverity: byMedium.length,
        byLowSeverity: byLow.length,
        alerts: ALERTS,
      });
    },

    // ── Unidades Geradoras ───────────────────────────────────────────────────

    searchGeneratingUnits(_filters = {}, _options = {}) {
      return ok({ items: GENERATING_UNITS.slice(), total: GENERATING_UNITS.length });
    },

    queryGeneratingUnit(id, _options = {}) {
      const unit = GENERATING_UNITS.find((u) => u.id === id);
      if (!unit) return fail('NOT_FOUND', `Unidade geradora "${id}" não encontrada.`);
      return ok(unit);
    },

    getGeneratingUnitCommercialTerms(ugId, _options = {}) {
      const terms = COMMERCIAL_TERMS[ugId];
      if (!terms) return fail('NOT_FOUND', `Termos comerciais para "${ugId}" não encontrados.`);
      return ok(terms);
    },

    getSettlementRecipient(ugId, _options = {}) {
      const unit = GENERATING_UNITS.find((u) => u.id === ugId);
      if (!unit) return fail('NOT_FOUND', `UG "${ugId}" não encontrada.`);
      return ok({
        recipientName: 'João Pereira',
        recipientDocument: '123.456.789-01',
        pixKeyType: 'cpf',
        pixKey: '123.456.789-01',
        generatingUnitId: ugId,
      });
    },

    createGeneratingUnit(_input, _options = {}) {
      return ok(
        { id: 'ug-new-preview', ..._input, status: 'active', createdAt: new Date().toISOString() },
        previewWarn('createGeneratingUnit'),
      );
    },

    updateGeneratingUnit(id, _input, _options = {}) {
      const unit = GENERATING_UNITS.find((u) => u.id === id);
      if (!unit) return fail('NOT_FOUND', `UG "${id}" não encontrada.`);
      return ok({ ...unit, ..._input }, previewWarn('updateGeneratingUnit'));
    },

    // ── Unidades Beneficiárias ───────────────────────────────────────────────

    searchBeneficiaryUnits(_filters = {}, _options = {}) {
      let items = BENEFICIARY_UNITS.slice();
      if (_filters.generatingUnitId) {
        items = items.filter((u) => u.generatingUnitId === _filters.generatingUnitId);
      }
      if (_filters.search) {
        const q = _filters.search.toLowerCase();
        items = items.filter((u) => u.name.toLowerCase().includes(q) || u.uc.includes(q));
      }
      return ok({ items, total: items.length });
    },

    queryBeneficiaryUnit(id, _options = {}) {
      const unit = BENEFICIARY_UNITS.find((u) => u.id === id);
      if (!unit) return fail('NOT_FOUND', `Unidade beneficiária "${id}" não encontrada.`);
      return ok(unit);
    },

    getBeneficiaryCreditBalance(benId, _month, _options = {}) {
      const bal = CREDIT_BALANCES[benId];
      if (!bal) return fail('NOT_FOUND', `Saldo de créditos para "${benId}" não encontrado.`);
      return ok(bal);
    },

    getBeneficiaryConsumptionAverage(benId, _options = {}) {
      const unit = BENEFICIARY_UNITS.find((u) => u.id === benId);
      if (!unit) return fail('NOT_FOUND', `Beneficiária "${benId}" não encontrada.`);
      return ok({
        beneficiaryUnitId: benId,
        averageConsumptionKwh: unit.averageConsumptionKwh,
        monthsConsidered: 4,
        computedAt: '2026-08-01T00:00:00Z',
      });
    },

    getBeneficiaryHistory(benId, _options = {}) {
      const history = BENEFICIARY_HISTORY[benId];
      if (!history) return fail('NOT_FOUND', `Histórico para "${benId}" não encontrado.`);
      return ok({ beneficiaryUnitId: benId, months: history });
    },

    createBeneficiaryUnit(_input, _options = {}) {
      return ok(
        { id: 'ub-new-preview', ..._input, status: 'active', createdAt: new Date().toISOString() },
        previewWarn('createBeneficiaryUnit'),
      );
    },

    updateBeneficiaryUnit(id, _input, _options = {}) {
      const unit = BENEFICIARY_UNITS.find((u) => u.id === id);
      if (!unit) return fail('NOT_FOUND', `Beneficiária "${id}" não encontrada.`);
      return ok({ ...unit, ..._input }, previewWarn('updateBeneficiaryUnit'));
    },

    // ── Rateio mensal ────────────────────────────────────────────────────────

    getMonthlyStatement(ugId, _month, _options = {}) {
      if (ugId !== 'ug-assai') return fail('NOT_FOUND', `Nenhum rateio encontrado para "${ugId}".`);

      return ok({
        generatingUnitId: 'ug-assai',
        referenceMonth: PREVIEW_MONTH,
        totalGenerationKwh: 13000,
        totalAllocatedKwh: 12922,
        totalUnallocatedKwh: 78,
        ownerRevenue: 4522.70,
        allocationPercentageTotal: 99.4,
        allocations: [
          { beneficiaryUnitId: 'ub-mercado',      beneficiaryName: 'Mercado Central',   allocatedKwh: 4199, allocationPercentage: 32.3, economiaMensal: 14.28, contaEsa: 438.81, invoiceAmount: 1185.00, paymentStatus: 'open' },
          { beneficiaryUnitId: 'ub-panificadora', beneficiaryName: 'Panificadora Sol',   allocatedKwh: 2340, allocationPercentage: 18.0, economiaMensal: 11.70, contaEsa: 256.80, invoiceAmount:  588.00, paymentStatus: 'paid' },
          { beneficiaryUnitId: 'ub-academia',     beneficiaryName: 'Academia Movimento', allocatedKwh: 2977, allocationPercentage: 22.9, economiaMensal: 14.50, contaEsa: 328.30, invoiceAmount:  768.50, paymentStatus: 'open' },
          { beneficiaryUnitId: 'ub-clinica',      beneficiaryName: 'Clínica Vida',       allocatedKwh: 3406, allocationPercentage: 26.2, economiaMensal: 16.70, contaEsa: 374.50, invoiceAmount:  930.00, paymentStatus: 'overdue' },
        ],
      });
    },

    // ── Importação CSV ───────────────────────────────────────────────────────

    getCsvTemplate(type, _options = {}) {
      const templates = {
        'generating-units': 'nome,uc,municipio,uf,cnpj,capacidade_kwp\nUG Solar Assaí,4567890,Assaí,PR,12345678000195,52.8',
        'beneficiary-units': 'nome,uc,cnpj_cpf,email,percentual_rateio,ug_id\nMercado Central,7891234,98765432000187,financeiro@mc.com.br,32.3,ug-assai',
        'credits': 'ug_id,mes_referencia,kwh_gerado\nug-assai,2026-07,13000',
      };
      const csv = templates[type] ?? templates['credits'];
      return ok({ type, csv, filename: `modelo-${type ?? 'creditos'}.csv` });
    },

    importFromCsv(_type, _text, _options = {}) {
      return ok(
        { rowsImported: 3, rowsSkipped: 0, rowsWithError: 0, preview: [] },
        previewWarn('importFromCsv'),
      );
    },

    // ── Faturas da concessionária ────────────────────────────────────────────

    searchUtilityBillImports(_filters = {}, _options = {}) {
      return ok({ items: _utilityBills.slice(), total: _utilityBills.length });
    },

    discardUtilityBillImport(id, _options = {}) {
      const idx = _utilityBills.findIndex((u) => u.id === id);
      if (idx === -1) return fail('NOT_FOUND', `Importação "${id}" não encontrada.`);
      _utilityBills.splice(idx, 1);
      return ok({ discarded: id }, previewWarn('discardUtilityBillImport'));
    },

    // ── Relatórios ───────────────────────────────────────────────────────────

    getOwnerMonthlyReport(_ugId, _month, _options = {}) {
      return ok(REPORT_OWNER);
    },

    getBeneficiaryMonthlyReport(_benId, _month, _options = {}) {
      const snapshot = BILLING_SNAPSHOTS[_benId] ?? BILLING_SNAPSHOTS['ub-mercado'];
      const balance  = CREDIT_BALANCES[_benId]  ?? CREDIT_BALANCES['ub-mercado'];
      const unit     = BENEFICIARY_UNITS.find((u) => u.id === _benId) ?? BENEFICIARY_UNITS[0];
      return ok({
        ...REPORT_BENEFICIARY,
        beneficiaryUnitId: _benId,
        beneficiaryName: unit.name,
        billingSnapshot: snapshot,
        creditBalance: balance,
        invoiceAmount: snapshot.invoiceAmount,
      });
    },

    getEsaInternalMonthlyReport(_month, _options = {}) {
      return ok(REPORT_ESA_INTERNAL);
    },

    getEsaFinancialMonthlyReport(_month, _options = {}) {
      const paid    = _invoices.filter((i) => i.paymentStatus === 'paid').reduce((s, i) => s + i.amount, 0);
      const open    = _invoices.filter((i) => i.paymentStatus === 'open').reduce((s, i) => s + i.amount, 0);
      const overdue = _invoices.filter((i) => i.paymentStatus === 'overdue').reduce((s, i) => s + i.amount, 0);

      return ok({
        ...REPORT_ESA_FINANCIAL,
        invoicesSummary: {
          total: _invoices.length,
          paid: _invoices.filter((i) => i.paymentStatus === 'paid').length,
          open: _invoices.filter((i) => i.paymentStatus === 'open').length,
          overdue: _invoices.filter((i) => i.paymentStatus === 'overdue').length,
          totalAmount: paid + open + overdue,
          paidAmount: paid,
          openAmount: open,
          overdueAmount: overdue,
        },
      });
    },
  };
}
