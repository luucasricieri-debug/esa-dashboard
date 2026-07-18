/**
 * ESA OS — UI / Energy Credits / App / Details
 * Painel de detalhe da Unidade Beneficiária.
 */

import { ecLoadingState }   from '../components/ec-loading-state.js';
import { ecErrorState }     from '../components/ec-error-state.js';
import { ecCoverageBadge }  from '../components/ec-status-badge.js';
import { formatDocument, formatCurrencyBRL, formatKwh, formatCoverageMonths, currentReferenceMonth } from '../energy-credits-formatters.js';

export class EcBeneficiaryUnitDetail {
  constructor({ provider, state }) {
    this._provider  = provider;
    this._state     = state;
    this._el        = null;
    this._data      = null;
    this._balance   = null;
    this._avg       = null;
    this._activeTab = 'geral';
    this._handler   = null;
  }

  render(container, id) {
    this._el = container;
    this._el.innerHTML = ecLoadingState('Carregando detalhe...');
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._load(id);
  }

  _load(id) {
    const r   = this._provider.queryBeneficiaryUnit(id);
    const rb  = this._provider.getBeneficiaryCreditBalance(id, currentReferenceMonth());
    const ra  = this._provider.getBeneficiaryConsumptionAverage(id);
    if (!r.ok) { this._el.innerHTML = ecErrorState(r.errors); return; }
    this._data    = r.data;
    this._balance = rb.ok ? rb.data : null;
    this._avg     = ra.ok ? ra.data : null;
    this._paint();
  }

  _paint() {
    this._el.innerHTML = this._buildHtml();
  }

  _buildHtml() {
    const tabs = ['geral', 'saldo', 'histórico'].map((t) => `
      <button class="ec-tab ${t===this._activeTab?'ec-active':''}" data-action="switch-tab" data-tab="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</button>
    `).join('');
    return `<div class="ec-tabs">${tabs}</div><div id="ec-det-body">${this._buildTab()}</div>`;
  }

  _buildTab() {
    if (this._activeTab === 'geral')    return this._buildGeral();
    if (this._activeTab === 'saldo')    return this._buildSaldo();
    if (this._activeTab === 'histórico') return this._buildHistorico();
    return '';
  }

  _buildGeral() {
    const d = this._data ?? {};
    const field = (label, value, mono = false) => `
      <div class="ec-detail-field">
        <div class="ec-detail-field-label">${label}</div>
        <div class="ec-detail-field-value ${mono?'ec-mono':''}">${value ?? '—'}</div>
      </div>
    `;
    const avg = this._avg;
    const cov = avg ? formatCoverageMonths(avg.coverageMonths ?? 0) : { text: '—', level: 'none' };
    const covBadge = cov.level !== 'none' ? ecCoverageBadge(cov.level, cov.text) : '—';
    return `
      <div class="ec-detail-section">
        <div class="ec-detail-section-title">Identificação</div>
        <div class="ec-detail-grid">
          ${field('ID', d.id, true)}
          ${field('Nome / Titular', d.name ?? d.holderName)}
          ${field('Documento', formatDocument(d.document), true)}
          ${field('UC Concessionária', d.uc ?? d.contaConcessionaria, true)}
          ${field('UG Vinculada', d.generatingUnitId, true)}
          ${field('E-mail', d.email)}
          ${field('Preço ESA (R$/kWh)', d.esaPricePerKwh ? formatCurrencyBRL(d.esaPricePerKwh) : '—', true)}
        </div>
      </div>
      <div class="ec-detail-section">
        <div class="ec-detail-section-title">Consumo Médio</div>
        <div class="ec-detail-grid">
          <div class="ec-detail-field"><div class="ec-detail-field-label">Média mensal</div><div class="ec-detail-field-value ec-mono">${avg ? formatKwh(avg.averageConsumptionKwh ?? 0) : '—'}</div></div>
          <div class="ec-detail-field"><div class="ec-detail-field-label">Cobertura de meses</div><div class="ec-detail-field-value">${covBadge}</div></div>
        </div>
      </div>
    `;
  }

  _buildSaldo() {
    const b = this._balance;
    if (!b) return `<div class="ec-empty-text" style="padding:20px;color:var(--ec-medium);text-align:center;">Saldo não disponível para este mês.</div>`;
    return `
      <div class="ec-detail-section">
        <div class="ec-detail-section-title">Saldo de Créditos — Mês Atual</div>
        <div class="ec-detail-grid">
          <div class="ec-detail-field"><div class="ec-detail-field-label">Créditos disponíveis</div><div class="ec-detail-field-value ec-mono">${formatKwh(b.availableCreditsKwh ?? 0)}</div></div>
          <div class="ec-detail-field"><div class="ec-detail-field-label">Créditos utilizados</div><div class="ec-detail-field-value ec-mono">${formatKwh(b.usedCreditsKwh ?? 0)}</div></div>
          <div class="ec-detail-field"><div class="ec-detail-field-label">Economia estimada</div><div class="ec-detail-field-value ec-mono">${formatCurrencyBRL(b.economyBRL ?? 0)}</div></div>
          <div class="ec-detail-field"><div class="ec-detail-field-label">Saldo anterior</div><div class="ec-detail-field-value ec-mono">${formatKwh(b.previousBalanceKwh ?? 0)}</div></div>
        </div>
      </div>
    `;
  }

  _buildHistorico() {
    const r = this._provider.getBeneficiaryHistory(this._data?.id);
    if (!r.ok) return ecErrorState(r.errors);
    const items = Array.isArray(r.data) ? r.data : (r.data?.records ?? []);
    if (!items.length) return `<div class="ec-empty-text" style="padding:20px;color:var(--ec-medium);text-align:center;">Sem histórico disponível.</div>`;
    const rows = items.slice(0, 12).map((h) => `
      <tr>
        <td class="ec-text-mono">${h.referenceMonth ?? '—'}</td>
        <td class="ec-text-mono">${formatKwh(h.allocatedKwh ?? 0)}</td>
        <td class="ec-text-mono">${formatKwh(h.consumptionKwh ?? 0)}</td>
        <td class="ec-text-mono">${formatCurrencyBRL(h.economyBRL ?? 0)}</td>
      </tr>
    `).join('');
    return `
      <div class="ec-table-wrap">
        <table class="ec-table">
          <thead><tr><th>Mês Ref.</th><th>Alocado</th><th>Consumo</th><th>Economia</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  _onClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'switch-tab') {
      this._activeTab = e.target.closest('[data-tab]')?.dataset.tab ?? 'geral';
      this._paint();
    }
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
