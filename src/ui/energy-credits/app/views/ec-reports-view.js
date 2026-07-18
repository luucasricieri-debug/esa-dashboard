/**
 * ESA OS — UI / Energy Credits / App / Views
 * Relatórios — geração de relatórios mensais.
 */

import { ecLoadingState }  from '../components/ec-loading-state.js';
import { ecErrorState }    from '../components/ec-error-state.js';
import { currentReferenceMonth, formatReferenceMonth } from '../energy-credits-formatters.js';

const REPORT_TYPES = [
  { id: 'owner',     label: 'Relatório do Proprietário', desc: 'Resumo mensal da unidade geradora para o dono da usina.', needsUg: true },
  { id: 'beneficiary', label: 'Relatório da Beneficiária', desc: 'Resumo mensal de créditos e economia para a beneficiária.', needsBen: true },
  { id: 'esa-internal', label: 'Relatório Interno ESA',   desc: 'Dados operacionais completos para uso interno da ESA.', needsUg: false },
  { id: 'esa-financial', label: 'Relatório Financeiro ESA', desc: 'Consolidação financeira mensal para a ESA.', needsUg: false },
];

export class EcReportsView {
  constructor({ provider, state, navigate }) {
    this._provider  = provider;
    this._state     = state;
    this._navigate  = navigate;
    this._el        = null;
    this._handler   = null;
    this._month     = currentReferenceMonth();
    this._ugId      = '';
    this._benId     = '';
    this._result    = null;
    this._loading   = false;
    this._activeReport = null;
    this._ugList    = [];
    this._benList   = [];
  }

  render(container) {
    this._el = container;
    this._el.innerHTML = this._skeleton();
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._el.addEventListener('change', (e) => this._onChange(e));
    this._loadLists();
  }

  _loadLists() {
    const r1 = this._provider.searchGeneratingUnits();
    const r2 = this._provider.searchBeneficiaryUnits();
    this._ugList  = r1.ok ? (Array.isArray(r1.data) ? r1.data : (r1.data?.items ?? [])) : [];
    this._benList = r2.ok ? (Array.isArray(r2.data) ? r2.data : (r2.data?.items ?? [])) : [];
    this._paintFilters();
  }

  _paintFilters() {
    const ugSel  = this._el?.querySelector('#ec-rpt-ug');
    const benSel = this._el?.querySelector('#ec-rpt-ben');
    if (ugSel)  ugSel.innerHTML  = `<option value="">— UG —</option>` + this._ugList.map((u) => `<option value="${u.id}">${u.name ?? u.id}</option>`).join('');
    if (benSel) benSel.innerHTML = `<option value="">— UB —</option>` + this._benList.map((u) => `<option value="${u.id}">${u.name ?? u.id}</option>`).join('');
  }

  _skeleton() {
    return `
      <div class="ec-view-header">
        <div class="ec-view-title">Relatórios</div>
        <div class="ec-view-subtitle">Geração de relatórios mensais por tipo</div>
      </div>
      <div class="ec-filters">
        <span class="ec-filter-label">Mês:</span>
        <input type="month" class="ec-filter-input" id="ec-rpt-month" value="${this._month}" data-filter="month">
        <span class="ec-filter-label">UG:</span>
        <select class="ec-filter-select" id="ec-rpt-ug" data-filter="ug" style="min-width:160px;"></select>
        <span class="ec-filter-label">UB:</span>
        <select class="ec-filter-select" id="ec-rpt-ben" data-filter="ben" style="min-width:160px;"></select>
      </div>
      <div class="ec-kpi-grid">${REPORT_TYPES.map((t) => this._reportCard(t)).join('')}</div>
      <div id="ec-rpt-result"></div>
    `;
  }

  _reportCard(t) {
    return `
      <div class="ec-card ec-mb-0" style="cursor:pointer;" data-action="generate-report" data-report="${t.id}">
        <div class="ec-bold" style="font-size:13px;color:var(--ec-green);margin-bottom:6px;">${t.label}</div>
        <div class="ec-text-sm ec-text-muted" style="line-height:1.5;">${t.desc}</div>
        <div style="margin-top:12px;"><span class="ec-btn ec-btn-primary ec-btn-sm" style="pointer-events:none;">Gerar</span></div>
      </div>
    `;
  }

  _generateReport(type) {
    this._activeReport = type;
    this._loading = true;
    this._paintResult();
    let r;
    if (type === 'owner')        r = this._provider.getOwnerMonthlyReport(this._ugId, this._month);
    if (type === 'beneficiary')  r = this._provider.getBeneficiaryMonthlyReport(this._benId, this._month);
    if (type === 'esa-internal') r = this._provider.getEsaInternalMonthlyReport(this._month);
    if (type === 'esa-financial') r = this._provider.getEsaFinancialMonthlyReport(this._month);
    this._loading = false;
    this._result  = r;
    this._paintResult();
  }

  _paintResult() {
    const el = this._el?.querySelector('#ec-rpt-result');
    if (!el) return;
    if (this._loading) { el.innerHTML = ecLoadingState('Gerando relatório...'); return; }
    if (!this._result) { el.innerHTML = ''; return; }
    if (!this._result.ok) { el.innerHTML = ecErrorState(this._result.errors); return; }
    const d = this._result.data;
    el.innerHTML = `
      <div class="ec-card">
        <div class="ec-card-title">Resultado — ${formatReferenceMonth(this._month)}</div>
        <pre style="font-family:'DM Mono',monospace;font-size:11px;white-space:pre-wrap;word-break:break-all;color:var(--ec-black);line-height:1.6;">${JSON.stringify(d, null, 2)}</pre>
      </div>
    `;
  }

  _onChange(e) {
    const f = e.target.dataset.filter;
    if (f === 'month') this._month = e.target.value;
    if (f === 'ug')    this._ugId  = e.target.value;
    if (f === 'ben')   this._benId = e.target.value;
  }

  _onClick(e) {
    const el     = e.target.closest('[data-action]');
    const action = el?.dataset.action;
    const report = el?.dataset.report;
    if (action === 'generate-report' && report) this._generateReport(report);
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
