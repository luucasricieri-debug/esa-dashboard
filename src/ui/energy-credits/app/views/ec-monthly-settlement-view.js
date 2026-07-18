/**
 * ESA OS — UI / Energy Credits / App / Views
 * Liquidação Mensal — rateio de créditos por UG e mês de referência.
 */

import { ecLoadingState }  from '../components/ec-loading-state.js';
import { ecErrorState }    from '../components/ec-error-state.js';
import { ecEmptyState }    from '../components/ec-empty-state.js';
import { ecPaymentBadge }  from '../components/ec-status-badge.js';
import { formatCurrencyBRL, formatKwh, formatPercentage, formatReferenceMonth, currentReferenceMonth } from '../energy-credits-formatters.js';

export class EcMonthlySettlementView {
  constructor({ provider, state, navigate }) {
    this._provider = provider;
    this._state    = state;
    this._navigate = navigate;
    this._el       = null;
    this._handler  = null;
    this._status   = 'loading';
    this._error    = null;
    this._data     = null;
    this._ugId     = '';
    this._month    = currentReferenceMonth();
    this._ugList   = [];
  }

  render(container) {
    this._el = container;
    this._el.innerHTML = this._skeleton();
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._el.addEventListener('change', (e) => this._onChange(e));
    this._loadUgList();
  }

  _loadUgList() {
    const r = this._provider.searchGeneratingUnits();
    this._ugList = r.ok ? (Array.isArray(r.data) ? r.data : (r.data?.items ?? [])) : [];
    this._paintFilters();
    if (this._ugId) this._loadSettlement();
    else { this._status = 'idle'; this._paint(); }
  }

  _paintFilters() {
    const sel = this._el?.querySelector('#ec-ug-select');
    if (!sel) return;
    sel.innerHTML = `<option value="">— Selecione uma UG —</option>` +
      this._ugList.map((u) => `<option value="${u.id}" ${u.id === this._ugId ? 'selected' : ''}>${u.name ?? u.id}</option>`).join('');
  }

  _skeleton() {
    return `
      <div class="ec-view-header">
        <div class="ec-view-title">Liquidação Mensal</div>
        <div class="ec-view-subtitle">Rateio de créditos e saldo por unidade beneficiária</div>
      </div>
      <div class="ec-filters">
        <span class="ec-filter-label">Unidade Geradora:</span>
        <select class="ec-filter-select" id="ec-ug-select" data-filter="ug" style="min-width:200px;"></select>
        <span class="ec-filter-label">Mês:</span>
        <input type="month" class="ec-filter-input" id="ec-month-input" data-filter="month" value="${this._month}">
        <button class="ec-btn ec-btn-primary ec-btn-sm" data-action="load-settlement">Consultar</button>
      </div>
      <div id="ec-settlement-body"></div>
    `;
  }

  _loadSettlement() {
    if (!this._ugId) return;
    this._status = 'loading';
    this._paint();
    const r = this._provider.getMonthlyStatement(this._ugId, this._month);
    if (!r.ok) { this._status = 'error'; this._error = r.errors; this._paint(); return; }
    this._data   = r.data;
    this._status = 'loaded';
    this._paint();
  }

  _paint() {
    const body = this._el?.querySelector('#ec-settlement-body');
    if (!body) return;
    body.innerHTML = this._buildHtml();
  }

  _buildHtml() {
    if (this._status === 'idle')    return ecEmptyState({ title: 'Selecione uma UG e o mês de referência', text: 'Escolha a unidade geradora e o mês para consultar a liquidação.' });
    if (this._status === 'loading') return ecLoadingState('Carregando liquidação...');
    if (this._status === 'error')   return ecErrorState(this._error);
    if (!this._data)                return ecEmptyState({ title: 'Sem dados para o período' });
    return this._buildSettlement();
  }

  _buildSettlement() {
    const d = this._data;
    const header = `
      <div class="ec-kpi-grid" style="margin-bottom:16px;">
        <div class="ec-kpi-card"><div class="ec-kpi-label">Mês de Referência</div><div class="ec-kpi-value" style="font-size:18px;">${formatReferenceMonth(this._month)}</div></div>
        <div class="ec-kpi-card"><div class="ec-kpi-label">Geração Total</div><div class="ec-kpi-value">${formatKwh(d.totalGenerationKwh ?? 0, 0)}</div></div>
        <div class="ec-kpi-card"><div class="ec-kpi-label">Créditos Rateados</div><div class="ec-kpi-value">${formatKwh(d.totalAllocatedKwh ?? 0, 0)}</div></div>
        <div class="ec-kpi-card"><div class="ec-kpi-label">Receita Proprietário</div><div class="ec-kpi-value" style="font-size:18px;">${formatCurrencyBRL(d.ownerRevenue ?? 0)}</div></div>
      </div>
    `;
    const alloc = Array.isArray(d.allocations) ? d.allocations : (d.beneficiaries ?? []);
    const rows = alloc.map((a) => `
      <tr class="ec-alloc-ben">
        <td>${a.beneficiaryName ?? a.id ?? '—'}</td>
        <td class="ec-text-mono">${formatKwh(a.allocatedKwh ?? 0)}</td>
        <td class="ec-text-mono">${formatPercentage(a.allocationPercentage ?? a.percentage ?? 0)}</td>
        <td class="ec-text-mono">${formatCurrencyBRL(a.economyBRL ?? a.economy ?? 0)}</td>
        <td>${ecPaymentBadge(a.paymentStatus ?? 'open')}</td>
      </tr>
    `).join('');
    const table = `
      <div class="ec-card"><div class="ec-card-title">Rateio por Beneficiária</div>
        <div class="ec-table-wrap"><table class="ec-table">
          <thead><tr><th>Beneficiária</th><th>kWh Alocados</th><th>%</th><th>Economia</th><th>Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--ec-medium);">Sem alocações no período.</td></tr>'}</tbody>
        </table></div>
      </div>
    `;
    return header + table;
  }

  _onChange(e) {
    const filter = e.target.dataset.filter;
    if (filter === 'ug')    this._ugId  = e.target.value;
    if (filter === 'month') this._month = e.target.value;
  }

  _onClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'load-settlement') this._loadSettlement();
    if (action === 'retry') this._loadSettlement();
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
