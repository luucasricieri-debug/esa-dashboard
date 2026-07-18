/**
 * ESA OS — UI / Energy Credits / App / Forms
 * Formulário de criação/edição de Unidade Beneficiária.
 */

import { ecLoadingState } from '../components/ec-loading-state.js';
import { ecErrorState }   from '../components/ec-error-state.js';

export class EcBeneficiaryUnitForm {
  constructor({ provider, state, onSave }) {
    this._provider = provider;
    this._state    = state;
    this._onSave   = onSave;
    this._el       = null;
    this._handler  = null;
    this._id       = null;
    this._existing = null;
    this._errors   = [];
    this._ugList   = [];
  }

  render(container, id = null) {
    this._el = container;
    this._id = id;
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._loadUgList();
    if (id) this._loadExisting(id);
    else    this._paint(null);
  }

  _loadUgList() {
    const r = this._provider.searchGeneratingUnits();
    this._ugList = r.ok ? (Array.isArray(r.data) ? r.data : (r.data?.items ?? [])) : [];
  }

  _loadExisting(id) {
    this._el.innerHTML = ecLoadingState('Carregando...');
    const r = this._provider.queryBeneficiaryUnit(id);
    if (!r.ok) { this._el.innerHTML = ecErrorState(r.errors); return; }
    this._existing = r.data;
    this._paint(r.data);
  }

  _paint(data) {
    const v = data ?? {};
    const mode = this._state.get().persistenceMode;
    const modeNotice = mode === 'preview'
      ? `<div class="ec-notice ec-notice-warn" style="margin-bottom:12px;font-size:11px;">MODO DE PRÉVIA — alterações não serão salvas.</div>` : '';
    const errHtml = this._errors.length
      ? `<div class="ec-notice ec-notice-danger">${this._errors.map((e) => e.message ?? e).join('<br>')}</div>` : '';
    this._el.innerHTML = modeNotice + errHtml + this._formHtml(v);
  }

  _ugOptions(selectedId) {
    return this._ugList.map((u) => `<option value="${u.id}" ${u.id===selectedId?'selected':''}>${u.name ?? u.id}</option>`).join('');
  }

  _formHtml(v) {
    return `
      <div class="ec-form-grid">
        <div class="ec-form-field">
          <label class="ec-form-label">ID / Código</label>
          <input class="ec-form-input" name="id" value="${v.id ?? ''}" ${this._id ? 'readonly' : ''} placeholder="ub-001">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">Unidade Geradora</label>
          <select class="ec-form-select" name="generatingUnitId">
            <option value="">— Selecione —</option>
            ${this._ugOptions(v.generatingUnitId)}
          </select>
        </div>
        <div class="ec-form-field ec-span-2">
          <label class="ec-form-label">Nome / Titular</label>
          <input class="ec-form-input" name="name" value="${v.name ?? v.holderName ?? ''}" placeholder="João da Silva">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">Documento (CPF/CNPJ)</label>
          <input class="ec-form-input" name="document" value="${v.document ?? ''}" placeholder="000.000.000-00">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">UC Concessionária</label>
          <input class="ec-form-input" name="uc" value="${v.uc ?? v.contaConcessionaria ?? ''}" placeholder="7654321">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">E-mail</label>
          <input class="ec-form-input" type="email" name="email" value="${v.email ?? ''}" placeholder="email@exemplo.com">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">Telefone</label>
          <input class="ec-form-input" name="phone" value="${v.phone ?? ''}" placeholder="(11) 99999-9999">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">Preço ESA (R$/kWh)</label>
          <input class="ec-form-input" type="number" name="esaPricePerKwh" value="${v.esaPricePerKwh ?? ''}" placeholder="0.35" step="0.001">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">Consumo Médio (kWh/mês)</label>
          <input class="ec-form-input" type="number" name="averageConsumptionKwh" value="${v.averageConsumptionKwh ?? ''}" step="0.01">
        </div>
      </div>
      <div class="ec-form-actions" style="margin-top:16px;">
        <button class="ec-btn ec-btn-primary" data-action="save-form">Salvar</button>
        <button class="ec-btn ec-btn-secondary" data-action="close-modal">Cancelar</button>
      </div>
    `;
  }

  _collectData() {
    const fields = ['id', 'generatingUnitId', 'name', 'document', 'uc', 'email', 'phone', 'esaPricePerKwh', 'averageConsumptionKwh'];
    const data = {};
    fields.forEach((f) => {
      const el = this._el.querySelector(`[name="${f}"]`);
      if (el) data[f] = el.value.trim() || undefined;
    });
    if (data.esaPricePerKwh) data.esaPricePerKwh = parseFloat(data.esaPricePerKwh);
    if (data.averageConsumptionKwh) data.averageConsumptionKwh = parseFloat(data.averageConsumptionKwh);
    return data;
  }

  _save() {
    this._errors = [];
    const data = this._collectData();
    if (!data.name) { this._errors = [{ message: 'Nome é obrigatório.' }]; this._paint(data); return; }
    const opts = { persistenceMode: this._state.get().persistenceMode };
    const r    = this._id
      ? this._provider.updateBeneficiaryUnit(this._id, data, { ...opts, existing: this._existing })
      : this._provider.createBeneficiaryUnit(data, opts);
    if (!r.ok) { this._errors = r.errors; this._paint(data); return; }
    this._onSave?.(r.data);
  }

  _onClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'save-form') this._save();
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
