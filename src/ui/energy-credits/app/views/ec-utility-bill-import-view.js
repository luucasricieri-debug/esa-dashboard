/**
 * ESA OS — UI / Energy Credits / App / Views
 * Importação de Faturas da Concessionária (BETA).
 */

import { ecLoadingState }     from '../components/ec-loading-state.js';
import { ecErrorState }       from '../components/ec-error-state.js';
import { ecEmptyState }       from '../components/ec-empty-state.js';
import { ecTable, ecActionBtn } from '../components/ec-table.js';
import { ecImportStatusBadge }  from '../components/ec-status-badge.js';
import { formatDateBR }         from '../energy-credits-formatters.js';

export class EcUtilityBillImportView {
  constructor({ provider, state, navigate }) {
    this._provider = provider;
    this._state    = state;
    this._navigate = navigate;
    this._el       = null;
    this._handler  = null;
    this._status   = 'loading';
    this._error    = null;
    this._imports  = [];
  }

  render(container) {
    this._el = container;
    this._el.innerHTML = this._skeleton();
    this._handler = (e) => this._onClick(e);
    this._el.addEventListener('click', this._handler);
    this._load();
  }

  _load() {
    this._status = 'loading';
    this._paint();
    const r = this._provider.searchUtilityBillImports();
    if (!r.ok) { this._status = 'error'; this._error = r.errors; this._paint(); return; }
    this._imports = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
    this._status  = 'loaded';
    this._paint();
  }

  _skeleton() {
    return `
      <div class="ec-view-header">
        <div class="ec-view-header-row">
          <div>
            <div class="ec-view-title">Faturas de Energia <span class="ec-badge ec-badge-blue" style="vertical-align:middle;font-size:10px;">BETA</span></div>
            <div class="ec-view-subtitle">Importações de faturas da concessionária por extração automatizada</div>
          </div>
        </div>
      </div>
      <div class="ec-notice ec-notice-info">
        <strong>BETA:</strong> Funcionalidade em fase experimental. Faturas são importadas via extração automática e precisam ser vinculadas a uma unidade beneficiária antes da confirmação.
      </div>
      <div id="ec-ub-import-body"></div>
    `;
  }

  _paint() {
    const body = this._el?.querySelector('#ec-ub-import-body');
    if (!body) return;
    body.innerHTML = this._buildHtml();
  }

  _buildHtml() {
    if (this._status === 'loading') return ecLoadingState('Carregando faturas...');
    if (this._status === 'error')   return ecErrorState(this._error);
    if (!this._imports.length)      return ecEmptyState({ title: 'Nenhuma fatura importada', text: 'As faturas são geradas automaticamente pelo processo de extração ESA.' });
    return this._buildTable();
  }

  _buildTable() {
    const headers = ['ID', 'UC Concessionária', 'Mês Ref.', 'Status', 'Importado em', 'Ações'];
    const rows = this._imports.map((imp) => [
      `<span class="ec-text-mono ec-text-sm">${imp.id ?? '—'}</span>`,
      `<span class="ec-text-mono">${imp.uc ?? imp.contaConcessionaria ?? '—'}</span>`,
      imp.referenceMonth ?? '—',
      ecImportStatusBadge(imp.status),
      formatDateBR(imp.importedAt ?? imp.createdAt),
      `<div class="ec-table-actions">
        ${ecActionBtn('Ver', 'view-import', `data-id="${imp.id}"`)}
        ${imp.status === 'pending' ? ecActionBtn('Descartar', 'discard-import', `data-id="${imp.id}"`, 'ec-btn-danger') : ''}
       </div>`,
    ]);
    return ecTable(headers, rows);
  }

  _discardImport(id) {
    const reason = 'Descartado pelo operador via UI';
    const r = this._provider.discardUtilityBillImport(id, { reason });
    if (!r.ok) { alert('Erro ao descartar: ' + (r.errors[0]?.message ?? 'Erro desconhecido')); return; }
    this._load();
  }

  _onClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const id     = e.target.closest('[data-id]')?.dataset.id;
    if (action === 'retry')          this._load();
    if (action === 'discard-import' && id) {
      if (confirm('Descartar esta importação?')) this._discardImport(id);
    }
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
