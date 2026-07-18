/**
 * ESA OS — UI / Energy Credits / App / Views
 * Financeiro — consolidação financeira e pagamentos.
 */

import { ecLoadingState }  from '../components/ec-loading-state.js';
import { ecErrorState }    from '../components/ec-error-state.js';
import { ecEmptyState }    from '../components/ec-empty-state.js';
import { ecKpiGrid }       from '../components/ec-kpi-card.js';
import { ecTable, ecActionBtn } from '../components/ec-table.js';
import { ecPaymentBadge }  from '../components/ec-status-badge.js';
import { formatCurrencyBRL, formatKwh, formatReferenceMonth, currentReferenceMonth } from '../energy-credits-formatters.js';

export class EcFinancialView {
  constructor({ provider, state, navigate }) {
    this._provider = provider;
    this._state    = state;
    this._navigate = navigate;
    this._el       = null;
    this._handler  = null;
    this._status   = 'loading';
    this._error    = null;
    this._data     = null;
    this._month    = currentReferenceMonth();
  }

  render(container) {
    this._el = container;
    this._el.innerHTML = this._skeleton();
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._el.addEventListener('change', (e) => { if (e.target.dataset.filter === 'month') { this._month = e.target.value; } });
    this._load();
  }

  _load() {
    this._status = 'loading';
    this._paint();
    const r = this._provider.getFinancialSummary({ referenceMonth: this._month });
    if (!r.ok) { this._status = 'error'; this._error = r.errors; this._paint(); return; }
    this._data   = r.data;
    this._status = 'loaded';
    this._paint();
  }

  _skeleton() {
    return `
      <div class="ec-view-header">
        <div class="ec-view-header-row">
          <div>
            <div class="ec-view-title">Financeiro</div>
            <div class="ec-view-subtitle">Consolidação de pagamentos e liquidações</div>
          </div>
        </div>
      </div>
      <div class="ec-filters">
        <span class="ec-filter-label">Mês:</span>
        <input type="month" class="ec-filter-input" data-filter="month" value="${this._month}">
        <button class="ec-btn ec-btn-primary ec-btn-sm" data-action="reload">Consultar</button>
      </div>
      <div id="ec-fin-body"></div>
    `;
  }

  _paint() {
    const body = this._el?.querySelector('#ec-fin-body');
    if (!body) return;
    body.innerHTML = this._buildHtml();
  }

  _buildHtml() {
    if (this._status === 'loading') return ecLoadingState('Carregando dados financeiros...');
    if (this._status === 'error')   return ecErrorState(this._error);
    if (!this._data)                return ecEmptyState({ title: 'Sem dados financeiros para o período' });
    return this._buildFinancial();
  }

  _buildFinancial() {
    const d = this._data;
    const kpiData = [
      { label: 'Economia Total', value: formatCurrencyBRL(d.totalEconomy ?? d.economyBRL ?? 0) },
      { label: 'Receita Proprietário', value: formatCurrencyBRL(d.ownerRevenue ?? 0) },
      { label: 'Faturamento ESA', value: formatCurrencyBRL(d.esaRevenue ?? d.esaBilling ?? 0) },
      { label: 'Inadimplência', value: formatCurrencyBRL(d.overdueAmount ?? 0) },
    ];
    const invoices = Array.isArray(d.invoices) ? d.invoices : [];
    const headers  = ['Beneficiária', 'Mês Ref.', 'Valor', 'Status', 'Ações'];
    const rows     = invoices.map((inv) => [
      inv.beneficiaryName ?? inv.beneficiaryUnitId ?? '—',
      formatReferenceMonth(inv.referenceMonth),
      formatCurrencyBRL(inv.amount ?? 0),
      ecPaymentBadge(inv.paymentStatus),
      `<div class="ec-table-actions">
        ${inv.paymentStatus !== 'paid' ? ecActionBtn('Confirmar Pgto', 'confirm-payment', `data-id="${inv.id}"`, 'ec-btn-primary') : ''}
        ${inv.paymentStatus === 'paid' ? ecActionBtn('Reabrir', 'reopen-payment', `data-id="${inv.id}"`, 'ec-btn-warn') : ''}
       </div>`,
    ]);
    const tableHtml = invoices.length ? ecTable(headers, rows) : ecEmptyState({ title: 'Sem faturas no período' });
    return ecKpiGrid(kpiData) + `<div class="ec-card"><div class="ec-card-title">Faturas do Período</div>${tableHtml}</div>`;
  }

  _confirmPayment(id) {
    const r = this._provider.confirmInvoicePayment(id, { paidAt: new Date().toISOString(), paidAmount: null });
    if (!r.ok) { alert('Erro ao confirmar: ' + (r.errors[0]?.message ?? 'Erro')); return; }
    this._load();
  }

  _reopenPayment(id) {
    const reason = prompt('Motivo para reabertura:');
    if (!reason) return;
    const r = this._provider.reopenInvoicePayment(id, reason);
    if (!r.ok) { alert('Erro: ' + (r.errors[0]?.message ?? 'Erro')); return; }
    this._load();
  }

  _onClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const id     = e.target.closest('[data-id]')?.dataset.id;
    if (action === 'reload')          this._load();
    if (action === 'retry')           this._load();
    if (action === 'confirm-payment' && id) this._confirmPayment(id);
    if (action === 'reopen-payment'  && id) this._reopenPayment(id);
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
