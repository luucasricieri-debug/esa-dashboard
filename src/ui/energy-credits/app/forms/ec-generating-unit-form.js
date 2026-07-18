/**
 * ESA OS — UI / Energy Credits / App / Forms
 * Formulário de criação/edição de Unidade Geradora.
 */

import { ecLoadingState } from '../components/ec-loading-state.js';
import { ecErrorState }   from '../components/ec-error-state.js';

export class EcGeneratingUnitForm {
  constructor({ provider, state, onSave }) {
    this._provider = provider;
    this._state    = state;
    this._onSave   = onSave;
    this._el       = null;
    this._handler  = null;
    this._id       = null;
    this._existing = null;
    this._errors   = [];
  }

  render(container, id = null) {
    this._el = container;
    this._id = id;
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    if (id) this._loadExisting(id);
    else    this._paint(null);
  }

  _loadExisting(id) {
    this._el.innerHTML = ecLoadingState('Carregando...');
    const r = this._provider.queryGeneratingUnit(id);
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

  _formHtml(v) {
    return `
      <div class="ec-form-grid">
        <div class="ec-form-field">
          <label class="ec-form-label">ID / Código</label>
          <input class="ec-form-input" name="id" value="${v.id ?? ''}" ${this._id ? 'readonly' : ''} placeholder="ug-001">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">Nome da Usina</label>
          <input class="ec-form-input" name="name" value="${v.name ?? ''}" placeholder="Usina Solar XYZ">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">UC da Concessionária</label>
          <input class="ec-form-input" name="uc" value="${v.uc ?? v.contaConcessionaria ?? ''}" placeholder="1234567">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">Cap. Instalada (kWp)</label>
          <input class="ec-form-input" type="number" name="installedCapacityKwp" value="${v.installedCapacityKwp ?? ''}" placeholder="50.0" step="0.01">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">Cidade</label>
          <input class="ec-form-input" name="city" value="${v.city ?? ''}" placeholder="São Paulo">
        </div>
        <div class="ec-form-field">
          <label class="ec-form-label">Estado (UF)</label>
          <input class="ec-form-input" name="state" value="${v.state ?? ''}" placeholder="SP" maxlength="2">
        </div>
        <div class="ec-form-field ec-span-2">
          <label class="ec-form-label">Tipo / Tecnologia</label>
          <select class="ec-form-select" name="type">
            <option value="">— Selecione —</option>
            ${['solar-gd', 'solar-ufv', 'hydro', 'wind', 'other'].map((t) => `<option value="${t}" ${v.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="ec-form-actions" style="margin-top:16px;">
        <button class="ec-btn ec-btn-primary" data-action="save-form">Salvar</button>
        <button class="ec-btn ec-btn-secondary" data-action="close-modal">Cancelar</button>
      </div>
    `;
  }

  _collectData() {
    const fields = ['id', 'name', 'uc', 'installedCapacityKwp', 'city', 'state', 'type'];
    const data = {};
    fields.forEach((f) => {
      const el = this._el.querySelector(`[name="${f}"]`);
      if (el) data[f] = el.value.trim() || undefined;
    });
    if (data.installedCapacityKwp) data.installedCapacityKwp = parseFloat(data.installedCapacityKwp);
    return data;
  }

  _save() {
    this._errors = [];
    const data = this._collectData();
    if (!data.name) { this._errors = [{ message: 'Nome é obrigatório.' }]; this._paint(data); return; }
    const opts = { persistenceMode: this._state.get().persistenceMode };
    const r    = this._id
      ? this._provider.updateGeneratingUnit(this._id, data, { ...opts, existing: this._existing })
      : this._provider.createGeneratingUnit(data, opts);
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
