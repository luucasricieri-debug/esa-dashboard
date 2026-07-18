/**
 * ESA OS — UI / Energy Credits / App / Views
 * Alertas — visão de alertas e pendências do módulo ESA Energia.
 */

import { ecLoadingState }  from '../components/ec-loading-state.js';
import { ecErrorState }    from '../components/ec-error-state.js';
import { ecEmptyState }    from '../components/ec-empty-state.js';
import { ecBadge }         from '../components/ec-status-badge.js';
import { formatReferenceMonth } from '../energy-credits-formatters.js';

const SEVERITY_CLS = { high: 'ec-badge-red', medium: 'ec-badge-gold', low: 'ec-badge-gray', info: 'ec-badge-blue' };
const SEVERITY_LABEL = { high: 'Crítico', medium: 'Atenção', low: 'Informativo', info: 'Info' };

export class EcAlertsView {
  constructor({ provider, state, navigate }) {
    this._provider = provider;
    this._state    = state;
    this._navigate = navigate;
    this._el       = null;
    this._handler  = null;
    this._status   = 'loading';
    this._error    = null;
    this._alerts   = [];
  }

  render(container) {
    this._el = container;
    this._el.innerHTML = `
      <div class="ec-view-header">
        <div class="ec-view-header-row">
          <div>
            <div class="ec-view-title">Alertas</div>
            <div class="ec-view-subtitle">Pendências e alertas automáticos do módulo de créditos</div>
          </div>
          <div class="ec-view-actions">
            <button class="ec-btn ec-btn-secondary ec-btn-sm" data-action="reload">Atualizar</button>
          </div>
        </div>
      </div>
      <div id="ec-alerts-body"></div>
    `;
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._load();
  }

  _load() {
    this._status = 'loading';
    this._paint();
    const r = this._provider.getAlertsSummary();
    if (!r.ok) { this._status = 'error'; this._error = r.errors; this._paint(); return; }
    const d = r.data;
    this._alerts = Array.isArray(d) ? d : (Array.isArray(d?.alerts) ? d.alerts : (d?.items ?? []));
    this._status = 'loaded';
    this._paint();
  }

  _paint() {
    const body = this._el?.querySelector('#ec-alerts-body');
    if (!body) return;
    body.innerHTML = this._buildHtml();
  }

  _buildHtml() {
    if (this._status === 'loading') return ecLoadingState('Carregando alertas...');
    if (this._status === 'error')   return ecErrorState(this._error);
    if (!this._alerts.length)       return ecEmptyState({ title: 'Nenhum alerta ativo', text: 'Todos os créditos estão em conformidade.' });
    return this._buildAlerts();
  }

  _buildAlerts() {
    const grouped = { high: [], medium: [], low: [], info: [] };
    this._alerts.forEach((a) => {
      const key = a.severity ?? a.level ?? 'info';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    });
    const sections = Object.entries(grouped)
      .filter(([, items]) => items.length)
      .map(([severity, items]) => {
        const header = `<div class="ec-detail-section-title">${SEVERITY_LABEL[severity] ?? severity} (${items.length})</div>`;
        const cards  = items.map((a) => this._alertCard(a, severity)).join('');
        return `<div class="ec-detail-section">${header}${cards}</div>`;
      }).join('');
    return sections;
  }

  _alertCard(a, severity) {
    const badge = ecBadge(SEVERITY_LABEL[severity] ?? severity, SEVERITY_CLS[severity] ?? 'ec-badge-gray');
    const month = a.referenceMonth ? ` · ${formatReferenceMonth(a.referenceMonth)}` : '';
    const entity = a.entityName ?? a.unit ?? a.entityId ?? '';
    return `
      <div class="ec-card ec-mb-0" style="margin-bottom:8px;border-left:3px solid ${severity==='high'?'var(--ec-danger)':severity==='medium'?'var(--ec-gold)':'var(--ec-border)'};">
        <div class="ec-flex ec-gap-2" style="margin-bottom:6px;">
          ${badge}
          <span class="ec-text-mono ec-text-sm ec-text-muted">${entity}${month}</span>
        </div>
        <div style="font-size:13px;color:var(--ec-black);line-height:1.5;">${a.message ?? a.description ?? a.type ?? '—'}</div>
        ${a.suggestion ? `<div class="ec-text-sm ec-text-muted" style="margin-top:4px;">💡 ${a.suggestion}</div>` : ''}
      </div>
    `;
  }

  _onClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'reload' || action === 'retry') this._load();
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
