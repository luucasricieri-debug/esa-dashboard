/**
 * ESA OS — UI / Energy Credits / App / Details
 * Painel de detalhe da Unidade Geradora.
 */

import { ecLoadingState }  from '../components/ec-loading-state.js';
import { ecErrorState }    from '../components/ec-error-state.js';
import { formatCurrencyBRL, formatDocument, formatKwh } from '../energy-credits-formatters.js';

export class EcGeneratingUnitDetail {
  constructor({ provider, state }) {
    this._provider = provider;
    this._state    = state;
    this._el       = null;
    this._data     = null;
    this._terms    = null;
    this._recipient = null;
    this._activeTab = 'geral';
    this._handler  = null;
  }

  render(container, id) {
    this._el = container;
    this._el.innerHTML = ecLoadingState('Carregando detalhe...');
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._load(id);
  }

  _load(id) {
    const r  = this._provider.queryGeneratingUnit(id);
    const rt = this._provider.getGeneratingUnitCommercialTerms(id);
    const rr = this._provider.getSettlementRecipient(id);
    if (!r.ok) { this._el.innerHTML = ecErrorState(r.errors); return; }
    this._data      = r.data;
    this._terms     = rt.ok ? rt.data : null;
    this._recipient = rr.ok ? rr.data : null;
    this._paint();
  }

  _paint() {
    this._el.innerHTML = this._buildHtml();
  }

  _buildHtml() {
    const tabs = ['geral', 'termos', 'beneficiárias'].map((t) => `
      <button class="ec-tab ${t===this._activeTab?'ec-active':''}" data-action="switch-tab" data-tab="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</button>
    `).join('');
    return `<div class="ec-tabs">${tabs}</div><div id="ec-det-body">${this._buildTab()}</div>`;
  }

  _buildTab() {
    if (this._activeTab === 'geral')          return this._buildGeral();
    if (this._activeTab === 'termos')         return this._buildTermos();
    if (this._activeTab === 'beneficiárias')  return this._buildBeneficiarias();
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
    return `
      <div class="ec-detail-section">
        <div class="ec-detail-section-title">Identificação</div>
        <div class="ec-detail-grid">
          ${field('ID', d.id, true)}
          ${field('Nome', d.name)}
          ${field('UC Concessionária', d.uc ?? d.contaConcessionaria, true)}
          ${field('Tipo', d.type)}
          ${field('Cidade', d.city)}
          ${field('Estado', d.state)}
          ${field('Cap. Instalada', d.installedCapacityKwp ? d.installedCapacityKwp + ' kWp' : '—', true)}
          ${field('Documento', formatDocument(d.document))}
        </div>
      </div>
    `;
  }

  _buildTermos() {
    const t = this._terms ?? {};
    const field = (label, value, mono = false) => `
      <div class="ec-detail-field">
        <div class="ec-detail-field-label">${label}</div>
        <div class="ec-detail-field-value ${mono?'ec-mono':''}">${value ?? '—'}</div>
      </div>
    `;
    const rec = this._recipient ?? {};
    return `
      <div class="ec-detail-section">
        <div class="ec-detail-section-title">Termos Comerciais</div>
        <div class="ec-detail-grid">
          ${field('Preço Compra (R$/kWh)', t.purchasePricePerKwh ? formatCurrencyBRL(t.purchasePricePerKwh) : '—', true)}
          ${field('Vigência a partir de', t.effectiveFrom)}
          ${field('Observações', t.notes)}
        </div>
      </div>
      <div class="ec-detail-section">
        <div class="ec-detail-section-title">Destinatário do Repasse</div>
        <div class="ec-detail-grid">
          ${field('Nome', rec.recipientName)}
          ${field('Documento', formatDocument(rec.recipientDocument))}
          ${field('Tipo Chave PIX', rec.pixKeyType)}
          ${field('Chave PIX', rec.pixKey, true)}
        </div>
      </div>
    `;
  }

  _buildBeneficiarias() {
    const r = this._provider.searchBeneficiaryUnits({ generatingUnitId: this._data?.id });
    if (!r.ok) return ecErrorState(r.errors);
    const items = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
    if (!items.length) return `<div class="ec-empty-text" style="padding:24px;text-align:center;color:var(--ec-medium);">Nenhuma beneficiária vinculada.</div>`;
    const rows = items.map((u) => `
      <div class="ec-flex ec-gap-2" style="padding:9px 0;border-bottom:1px solid var(--ec-border);">
        <div style="flex:1;font-size:13px;font-weight:500;">${u.name ?? u.id}</div>
        <div class="ec-text-mono ec-text-sm ec-text-muted">${u.uc ?? '—'}</div>
      </div>
    `).join('');
    return `<div class="ec-detail-section"><div class="ec-detail-section-title">Beneficiárias (${items.length})</div>${rows}</div>`;
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
