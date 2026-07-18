/**
 * ESA OS — UI / Energy Credits / App / Views
 * Lista de Unidades Beneficiárias.
 */

import { ecLoadingState }  from '../components/ec-loading-state.js';
import { ecErrorState }    from '../components/ec-error-state.js';
import { ecEmptyState }    from '../components/ec-empty-state.js';
import { ecTable, ecActionBtn } from '../components/ec-table.js';
import { ecModalHtml, ecOpenModal, ecCloseModal } from '../components/ec-modal.js';
import { ICONS }           from '../energy-credits-navigation.js';
import { formatDocument, formatCoverageMonths, coverageBadgeClass } from '../energy-credits-formatters.js';
import { ecCoverageBadge } from '../components/ec-status-badge.js';
import { EcBeneficiaryUnitForm }   from '../forms/ec-beneficiary-unit-form.js';
import { EcBeneficiaryUnitDetail } from '../details/ec-beneficiary-unit-detail.js';

export class EcBeneficiaryUnitsView {
  constructor({ provider, state, navigate }) {
    this._provider = provider;
    this._state    = state;
    this._navigate = navigate;
    this._el       = null;
    this._handler  = null;
    this._status   = 'loading';
    this._error    = null;
    this._units    = [];
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
    const r = this._provider.searchBeneficiaryUnits();
    if (!r.ok) { this._status = 'error'; this._error = r.errors; this._paint(); return; }
    this._units  = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
    this._status = 'loaded';
    this._paint();
  }

  _skeleton() {
    return `
      <div class="ec-view-header">
        <div class="ec-view-header-row">
          <div>
            <div class="ec-view-title">Unidades Beneficiárias</div>
            <div class="ec-view-subtitle">Consumidoras de créditos vinculadas às unidades geradoras</div>
          </div>
          <div class="ec-view-actions">
            <button class="ec-btn ec-btn-primary" data-action="new-unit">
              <span style="width:14px;height:14px;">${ICONS.plus}</span>Nova UB
            </button>
          </div>
        </div>
      </div>
      <div id="ec-ub-body"></div>
    `;
  }

  _paint() {
    const body = this._el?.querySelector('#ec-ub-body');
    if (!body) return;
    body.innerHTML = this._buildHtml();
  }

  _buildHtml() {
    if (this._status === 'loading') return ecLoadingState('Carregando unidades beneficiárias...');
    if (this._status === 'error')   return ecErrorState(this._error);
    if (!this._units.length)        return ecEmptyState({ title: 'Nenhuma unidade beneficiária cadastrada', text: 'Clique em "Nova UB" para cadastrar a primeira unidade beneficiária.' });
    return this._buildTable();
  }

  _buildTable() {
    const headers = ['Nome / Documento', 'UC Concessionária', 'UG Vinculada', 'Cobertura', 'Ações'];
    const rows = this._units.map((u) => {
      const cov = formatCoverageMonths(u.coverageMonths);
      const covBadge = cov.level !== 'none' ? ecCoverageBadge(cov.level, cov.text) : '—';
      return [
        `<div><strong>${u.name ?? u.holderName ?? '—'}</strong><div class="ec-text-mono ec-text-sm ec-text-muted">${formatDocument(u.document)}</div></div>`,
        `<span class="ec-text-mono ec-text-sm">${u.uc ?? u.contaConcessionaria ?? '—'}</span>`,
        `<span class="ec-text-mono ec-text-sm">${u.generatingUnitId ?? '—'}</span>`,
        covBadge,
        `<div class="ec-table-actions">
          ${ecActionBtn('Ver', 'view-unit', `data-id="${u.id}"`)}
          ${ecActionBtn('Editar', 'edit-unit', `data-id="${u.id}"`, 'ec-btn-secondary')}
         </div>`,
      ];
    });
    return ecTable(headers, rows);
  }

  _onClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'retry') { this._load(); return; }
    if (action === 'new-unit') { this._openForm(null); return; }
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (action === 'view-unit' && id) this._openDetail(id);
    if (action === 'edit-unit' && id) this._openForm(id);
    if (action === 'close-modal')     ecCloseModal(this._el);
  }

  _openDetail(id) {
    const detail = new EcBeneficiaryUnitDetail({ provider: this._provider, state: this._state });
    const html = ecModalHtml({ title: 'Detalhe — Unidade Beneficiária', body: '<div id="ec-detail-body"></div>', size: 'lg' });
    const modal = ecOpenModal(this._el, html);
    detail.render(modal.querySelector('#ec-detail-body'), id);
  }

  _openForm(id) {
    const form = new EcBeneficiaryUnitForm({ provider: this._provider, state: this._state, onSave: () => { ecCloseModal(this._el); this._load(); } });
    const html = ecModalHtml({ title: id ? 'Editar Unidade Beneficiária' : 'Nova Unidade Beneficiária', body: '<div id="ec-form-body"></div>' });
    const modal = ecOpenModal(this._el, html);
    form.render(modal.querySelector('#ec-form-body'), id);
  }

  destroy() {
    if (this._el && this._handler) this._el.removeEventListener('click', this._handler);
  }
}
