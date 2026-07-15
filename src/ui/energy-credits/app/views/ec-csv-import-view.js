/**
 * ESA OS — UI / Energy Credits / App / Views
 * Importação CSV — fluxo em 4 etapas: tipo → upload → prévia → confirmação.
 */

import { ecLoadingState }  from '../components/ec-loading-state.js';
import { ecErrorState }    from '../components/ec-error-state.js';
import { ecStepper }       from '../components/ec-stepper.js';
import { ecPaymentBadge }  from '../components/ec-status-badge.js';

const STEPS = [
  { label: 'Tipo' },
  { label: 'Upload' },
  { label: 'Prévia' },
  { label: 'Conclusão' },
];

const IMPORT_TYPES = [
  { value: 'generating-units',             label: 'Unidades Geradoras' },
  { value: 'beneficiary-units',            label: 'Unidades Beneficiárias' },
  { value: 'generating-unit-monthly-records', label: 'Registros Mensais — Geração' },
  { value: 'beneficiary-monthly-records',  label: 'Registros Mensais — Consumo' },
];

export class EcCsvImportView {
  constructor({ provider, state, navigate }) {
    this._provider    = provider;
    this._state       = state;
    this._navigate    = navigate;
    this._el          = null;
    this._handler     = null;
    this._step        = 0;
    this._importType  = '';
    this._csvText     = '';
    this._preview     = null;
    this._importError = null;
    this._importOk    = false;
  }

  render(container) {
    this._el = container;
    this._el.innerHTML = `
      <div class="ec-view-header">
        <div class="ec-view-title">Importar CSV</div>
        <div class="ec-view-subtitle">Importe unidades e registros mensais via arquivo CSV</div>
      </div>
      <div class="ec-card" id="ec-csv-card"></div>
    `;
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._el.addEventListener('change', (e) => this._onChange(e));
    this._paintCard();
  }

  _paintCard() {
    const card = this._el?.querySelector('#ec-csv-card');
    if (!card) return;
    card.innerHTML = ecStepper(STEPS, this._step) + this._buildStep();
  }

  _buildStep() {
    if (this._step === 0) return this._buildStepType();
    if (this._step === 1) return this._buildStepUpload();
    if (this._step === 2) return this._buildStepPreview();
    return this._buildStepDone();
  }

  _buildStepType() {
    const options = IMPORT_TYPES.map((t) => `
      <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1.5px solid var(--ec-border);border-radius:8px;cursor:pointer;${this._importType===t.value?'border-color:var(--ec-gold);background:var(--ec-gold-faint);':''}">
        <input type="radio" name="ec-import-type" value="${t.value}" ${this._importType===t.value?'checked':''} style="accent-color:var(--ec-gold);">
        <span style="font-size:13px;font-weight:500;color:var(--ec-green);">${t.label}</span>
      </label>
    `).join('');
    return `
      <div style="display:flex;flex-direction:column;gap:9px;margin-bottom:18px;">${options}</div>
      <div class="ec-form-actions">
        <button class="ec-btn ec-btn-primary" data-action="step-next" ${!this._importType?'disabled':''}>Próximo</button>
      </div>
    `;
  }

  _buildStepUpload() {
    const tplBtn = `<button class="ec-btn ec-btn-secondary ec-btn-sm" data-action="download-template" style="margin-top:12px;">⬇ Baixar template CSV</button>`;
    return `
      <div class="ec-notice ec-notice-info">Faça upload do arquivo CSV com delimitador <strong>ponto-e-vírgula (;)</strong>.</div>
      <div class="ec-upload-area" id="ec-upload-area" data-action="open-file-input">
        <div class="ec-upload-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
        <div class="ec-upload-title">Arraste o arquivo ou clique para selecionar</div>
        <div class="ec-upload-text">Formato: CSV (;)</div>
        <input type="file" id="ec-file-input" accept=".csv,.txt" style="display:none;">
      </div>
      ${tplBtn}
      ${this._csvText ? `<div class="ec-notice ec-notice-success" style="margin-top:10px;">Arquivo carregado — ${this._csvText.split('\n').length} linhas</div>` : ''}
      <div class="ec-form-actions" style="margin-top:14px;">
        <button class="ec-btn ec-btn-secondary" data-action="step-back">Voltar</button>
        <button class="ec-btn ec-btn-primary" data-action="step-preview" ${!this._csvText?'disabled':''}>Prévia</button>
      </div>
    `;
  }

  _buildStepPreview() {
    if (!this._preview) return ecLoadingState('Processando CSV...');
    if (!this._preview.ok) return ecErrorState(this._preview.errors) + `<div class="ec-form-actions"><button class="ec-btn ec-btn-secondary" data-action="step-back">Corrigir</button></div>`;
    const items = (Array.isArray(this._preview.data) ? this._preview.data : []).slice(0, 10);
    const keys  = items.length ? Object.keys(items[0]).slice(0, 6) : [];
    const tHead = keys.map((k) => `<th>${k}</th>`).join('');
    const tBody = items.map((row) => `<tr>${keys.map((k) => `<td class="ec-text-mono" style="font-size:11px;">${row[k] ?? ''}</td>`).join('')}</tr>`).join('');
    const mode  = this._state.get().persistenceMode;
    const notice = mode === 'preview'
      ? `<div class="ec-notice ec-notice-warn">MODO DE PRÉVIA — os dados não serão salvos no banco.</div>`
      : `<div class="ec-notice ec-notice-info">${items.length} registros serão importados.</div>`;
    return `
      ${notice}
      <div class="ec-csv-preview ec-table-wrap" style="max-height:260px;overflow-y:auto;">
        <table class="ec-table"><thead><tr>${tHead}</tr></thead><tbody>${tBody}</tbody></table>
      </div>
      <div class="ec-form-actions" style="margin-top:14px;">
        <button class="ec-btn ec-btn-secondary" data-action="step-back">Voltar</button>
        <button class="ec-btn ec-btn-primary" data-action="confirm-import">Confirmar importação</button>
      </div>
    `;
  }

  _buildStepDone() {
    if (this._importError) return ecErrorState(this._importError) + `<div class="ec-form-actions"><button class="ec-btn ec-btn-secondary" data-action="restart-import">Recomeçar</button></div>`;
    return `
      <div class="ec-empty" style="padding:40px 20px;">
        <div class="ec-empty-icon" style="background:#E8F5E9;color:#1A5C38;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div class="ec-empty-title">Importação concluída!</div>
        <div class="ec-empty-text">Os registros foram ${this._state.get().persistenceMode==='preview'?'processados em modo de prévia':'importados com sucesso'}.</div>
      </div>
      <div class="ec-form-actions" style="justify-content:center;">
        <button class="ec-btn ec-btn-secondary" data-action="restart-import">Nova importação</button>
      </div>
    `;
  }

  _onChange(e) {
    if (e.target.name === 'ec-import-type') {
      this._importType = e.target.value;
      this._paintCard();
    }
    if (e.target.id === 'ec-file-input' && e.target.files.length) {
      const reader = new FileReader();
      reader.onload = (ev) => { this._csvText = ev.target.result; this._paintCard(); };
      reader.readAsText(e.target.files[0], 'UTF-8');
    }
  }

  _runPreview() {
    const r = this._provider.importFromCsv(this._importType, this._csvText, { persistenceMode: 'preview' });
    this._preview = r;
    this._paintCard();
  }

  _runImport() {
    const mode = this._state.get().persistenceMode;
    const r = this._provider.importFromCsv(this._importType, this._csvText, { persistenceMode: mode });
    if (!r.ok) { this._importError = r.errors; }
    this._step = 3;
    this._paintCard();
  }

  _downloadTemplate() {
    const r = this._provider.getCsvTemplate(this._importType);
    if (!r.ok || !r.data?.csvText) return;
    const blob = new Blob([r.data.csvText], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `template-${this._importType}.csv`;
    a.click();
  }

  _onClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'step-next')      { this._step = 1; this._paintCard(); }
    if (action === 'step-back')      { this._step = Math.max(0, this._step - 1); this._paintCard(); }
    if (action === 'step-preview')   { this._step = 2; this._runPreview(); }
    if (action === 'confirm-import') { this._runImport(); }
    if (action === 'download-template') this._downloadTemplate();
    if (action === 'restart-import') { this._step = 0; this._importType = ''; this._csvText = ''; this._preview = null; this._importError = null; this._paintCard(); }
    if (action === 'open-file-input') { this._el?.querySelector('#ec-file-input')?.click(); }
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
