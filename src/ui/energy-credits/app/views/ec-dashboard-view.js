/**
 * ESA OS — UI / Energy Credits / App / Views
 * Dashboard — visão geral executiva dos créditos de energia.
 */

import { ecLoadingState }  from '../components/ec-loading-state.js';
import { ecErrorState }    from '../components/ec-error-state.js';
import { ecEmptyState }    from '../components/ec-empty-state.js';
import { ecKpiGrid }       from '../components/ec-kpi-card.js';
import { formatCurrencyBRL, formatKwh, formatNumber } from '../energy-credits-formatters.js';

export class EcDashboardView {
  constructor({ provider, state, navigate }) {
    this._provider = provider;
    this._state    = state;
    this._navigate = navigate;
    this._el       = null;
    this._handler  = null;
    this._status   = 'loading';
    this._error    = null;
    this._data     = null;
    this._financial = null;
    this._alerts   = null;
  }

  render(container) {
    this._el = container;
    this._el.innerHTML = `<div class="ec-view-header"><div class="ec-view-title">Dashboard</div><div class="ec-view-subtitle">Visão executiva dos créditos ESA Energia</div></div><div id="ec-dash-body"></div>`;
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._load();
  }

  _load() {
    this._status = 'loading';
    this._paint();
    const r1 = this._provider.getExecutiveSummary();
    const r2 = this._provider.getFinancialSummary();
    const r3 = this._provider.getAlertsSummary();
    if (!r1.ok) { this._status = 'error'; this._error = r1.errors; this._paint(); return; }
    this._data      = r1.data;
    this._financial = r2.ok ? r2.data : null;
    this._alerts    = r3.ok ? r3.data : null;
    this._status = 'loaded';
    this._paint();
  }

  _paint() {
    const body = this._el?.querySelector('#ec-dash-body');
    if (!body) return;
    body.innerHTML = this._buildHtml();
  }

  _buildHtml() {
    if (this._status === 'loading') return ecLoadingState('Carregando dashboard...');
    if (this._status === 'error')   return ecErrorState(this._error);
    if (!this._data) return ecEmptyState({ title: 'Sem dados disponíveis' });
    return this._buildDashboard();
  }

  _buildDashboard() {
    const d  = this._data;
    const f  = this._financial;
    const al = this._alerts;
    const cards = [
      { label: 'Unid. Geradoras',    value: formatNumber(d.totalGeneratingUnits ?? d.generatingUnits ?? 0), route: 'generating-units' },
      { label: 'Unid. Beneficiárias',value: formatNumber(d.totalBeneficiaryUnits ?? d.beneficiaryUnits ?? 0), route: 'beneficiary-units' },
      { label: 'Geração Total',       value: formatKwh(d.totalGenerationKwh ?? 0, 0), meta: 'período atual', route: 'monthly-settlement' },
      { label: 'Economia Total',      value: formatCurrencyBRL(f?.totalEconomy ?? d.totalEconomyBRL ?? 0), meta: 'período atual', route: 'financial' },
      { label: 'Alertas Ativos',      value: formatNumber(al?.totalAlerts ?? al?.count ?? 0), route: 'alerts' },
    ];
    const kpiHtml = ecKpiGrid(cards);
    const quickLinks = this._buildQuickLinks();
    return kpiHtml + quickLinks;
  }

  _buildQuickLinks() {
    const links = [
      { label: 'Liquidação Mensal',  route: 'monthly-settlement', desc: 'Rateio e saldo por beneficiária' },
      { label: 'Importar CSV',       route: 'csv-import',         desc: 'Importar unidades e registros' },
      { label: 'Relatórios',         route: 'reports',            desc: 'Relatórios mensais' },
      { label: 'Faturas (BETA)',     route: 'utility-bill-import',desc: 'Importar faturas da concessionária' },
    ];
    const items = links.map((l) => `
      <div class="ec-kpi-card ec-kpi-clickable" data-route="${l.route}" style="cursor:pointer;">
        <div class="ec-kpi-label">${l.label}</div>
        <div class="ec-text-sm ec-text-muted" style="margin-top:6px;line-height:1.4;">${l.desc}</div>
      </div>
    `).join('');
    return `
      <div class="ec-card">
        <div class="ec-card-title">Acesso Rápido</div>
        <div class="ec-kpi-grid">${items}</div>
      </div>
    `;
  }

  _onClick(e) {
    const route = e.target.closest('[data-route]')?.dataset.route;
    if (route) this._navigate(route);
    if (e.target.dataset.action === 'retry') this._load();
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
