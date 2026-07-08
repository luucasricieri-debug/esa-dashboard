/**
 * ESA OS — UI / Insights
 * CRMInsightsView
 *
 * UI gerencial nativa da ESA OS — filtros, drill-down e detalhe de Deal.
 * Fontes permitidas: getCRMExecutiveSummary, searchCRMDeals, queryCRMDeal.
 * Não acessa Firebase, Event Bus, Audit, CRMReadModel, CRMMetrics ou crmDeals.
 */

export class CRMInsightsView {
  constructor(queryProvider) {
    this._queryProvider   = queryProvider;
    this._renderCount     = 0;
    this._lastGeneratedAt = null;
    this._lastDealCount   = null;
    this._lastError       = null;
    this._activeFilters   = {};
    this._drilldown       = { active: false, title: '', filters: {}, deals: [] };
    this._selectedDeal    = null;
  }

  // ── Filtros ───────────────────────────────────────────────────────────────

  _normalizeFilters(filters = {}) {
    const result = {};
    const str = (v) => (typeof v === 'string' ? v.trim() : null);
    const num = (v) => {
      if (v === undefined || v === null) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };
    const funil      = str(filters.funil);      if (funil)            result.funil      = funil;
    const status     = str(filters.status);     if (status)           result.status     = status;
    const responsavel = str(filters.responsavel); if (responsavel)    result.responsavel = responsavel;
    const from       = num(filters.from);       if (from  !== null)   result.from       = from;
    const to         = num(filters.to);         if (to    !== null)   result.to         = to;
    return result;
  }

  setFilters(filters = {}) {
    this._activeFilters = this._normalizeFilters(filters);
    return Object.assign({}, this._activeFilters);
  }

  clearFilters() {
    this._activeFilters = {};
    this._drilldown     = { active: false, title: '', filters: {}, deals: [] };
    this._selectedDeal  = null;
    return {};
  }

  getActiveFilters() {
    return Object.assign({}, this._activeFilters);
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  load(filters = {}) {
    if (!this._queryProvider || typeof this._queryProvider.getCRMExecutiveSummary !== 'function') {
      throw new TypeError('[CRMInsightsView] queryProvider must expose getCRMExecutiveSummary()');
    }
    const normalized = this._normalizeFilters(filters);
    const result = this._queryProvider.getCRMExecutiveSummary(normalized);
    if (!result || !result.data || !result.metadata || result.generatedAt === undefined) {
      throw new Error('[CRMInsightsView] Invalid CRM executive summary result');
    }
    return this.buildViewModel(result);
  }

  buildViewModel(queryResult) {
    const { data, metadata, generatedAt } = queryResult;
    const dealCount =
      metadata.dealCount !== undefined && metadata.dealCount !== null
        ? metadata.dealCount
        : (data.status && data.status.total) || 0;
    const cards = [
      { id: 'deals',         label: 'Total de Deals',     value: dealCount,                   format: 'number'   },
      { id: 'conversion',    label: 'Conversão',           value: data.conversion.rate,        format: 'percent'  },
      { id: 'winRate',       label: 'Win Rate',            value: data.winRate.rate,           format: 'percent'  },
      { id: 'lossRate',      label: 'Loss Rate',           value: data.lossRate.rate,          format: 'percent'  },
      { id: 'pipelineValue', label: 'Pipeline Total',      value: data.forecast.totalValue,    format: 'currency' },
      { id: 'forecast',      label: 'Forecast Ponderado',  value: data.forecast.weightedValue, format: 'currency' },
    ];
    const pipeline = this._buildPipelineViewModel(data.pipeline);
    const status   = this._buildStatusViewModel(data.status);
    const forecast = this._buildForecastViewModel(data.forecast);
    return {
      generatedAt,
      dealCount,
      cards,
      pipeline,
      status,
      forecast,
      activeFilters: Object.assign({}, this._activeFilters),
      filterOptions: { funis: pipeline.map((p) => p.funil), statuses: status.map((s) => s.status) },
      drilldown:     this.getDrilldown(),
      selectedDeal:  this.getSelectedDeal(),
    };
  }

  // ── Drilldown ─────────────────────────────────────────────────────────────

  loadDrilldown(title, filters = {}) {
    if (!this._queryProvider || typeof this._queryProvider.searchCRMDeals !== 'function') {
      throw new TypeError('[CRMInsightsView] queryProvider must expose searchCRMDeals()');
    }
    const specific    = this._normalizeFilters(filters);
    const merged      = Object.assign({}, this._activeFilters, specific);
    const result      = this._queryProvider.searchCRMDeals(merged);
    if (!result || !result.data || !result.metadata || result.generatedAt === undefined) {
      throw new Error('[CRMInsightsView] Invalid CRM deals search result');
    }
    if (!Array.isArray(result.data)) {
      throw new Error('[CRMInsightsView] Invalid CRM deals search result');
    }
    this._drilldown = {
      active:  true,
      title:   String(title || 'Deals'),
      filters: Object.assign({}, merged),
      deals:   result.data.map((d) => Object.assign({}, d)),
    };
    this._selectedDeal = null;
    return this.getDrilldown();
  }

  getDrilldown() {
    return {
      active:  this._drilldown.active,
      title:   this._drilldown.title,
      filters: Object.assign({}, this._drilldown.filters),
      deals:   this._drilldown.deals.map((d) => Object.assign({}, d)),
    };
  }

  // ── Deal detail ───────────────────────────────────────────────────────────

  selectDeal(dealId) {
    if (!this._queryProvider || typeof this._queryProvider.queryCRMDeal !== 'function') {
      throw new TypeError('[CRMInsightsView] queryProvider must expose queryCRMDeal()');
    }
    const result = this._queryProvider.queryCRMDeal(dealId);
    if (!result || !result.metadata || result.generatedAt === undefined || !('data' in result)) {
      throw new Error('[CRMInsightsView] Invalid CRM deal query result');
    }
    this._selectedDeal = result.data ? Object.assign({}, result.data) : null;
    return this._selectedDeal ? Object.assign({}, this._selectedDeal) : null;
  }

  getSelectedDeal() {
    return this._selectedDeal ? Object.assign({}, this._selectedDeal) : null;
  }

  // ── View Model helpers ────────────────────────────────────────────────────

  _buildPipelineViewModel(pipeline) {
    return Object.keys(pipeline)
      .sort()
      .map((funil) => {
        const stages = Object.keys(pipeline[funil])
          .sort()
          .map((etapa) => ({
            etapa,
            count:      pipeline[funil][etapa].count,
            totalValue: pipeline[funil][etapa].totalValue,
            totalKwh:   pipeline[funil][etapa].totalKwh,
          }));
        return {
          funil,
          stages,
          count:      stages.reduce((s, st) => s + st.count, 0),
          totalValue: stages.reduce((s, st) => s + st.totalValue, 0),
          totalKwh:   stages.reduce((s, st) => s + st.totalKwh, 0),
        };
      });
  }

  _buildStatusViewModel(status) {
    const total = status.total || 0;
    return Object.entries(status.byStatus || {})
      .map(([st, count]) => ({
        status:  st,
        count,
        percent: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
  }

  _buildForecastViewModel(forecast) {
    return Object.entries(forecast.byStatus || {})
      .map(([status, s]) => ({
        status,
        count:         s.count,
        totalValue:    s.totalValue,
        weight:        s.weight,
        weightedValue: s.weightedValue,
      }))
      .sort((a, b) => b.weightedValue - a.weightedValue);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render(container) {
    if (!container || container.innerHTML === undefined) {
      throw new TypeError('[CRMInsightsView] container must have innerHTML');
    }
    if (arguments.length >= 2) {
      this.setFilters(arguments[1] != null ? arguments[1] : {});
    }
    let viewModel;
    try {
      viewModel = this.load(this._activeFilters);
    } catch (err) {
      this._lastError = { name: err.name || 'Error', message: err.message || String(err) };
      container.innerHTML =
        `<div style="padding:2rem;text-align:center;color:var(--danger,#C0392B)">` +
        `Não foi possível carregar os insights do CRM.</div>`;
      console.error('[ESA OS Insights] Falha ao carregar:', err);
      return null;
    }
    container.innerHTML = this._buildHTML(viewModel);
    this._renderCount++;
    this._lastGeneratedAt = viewModel.generatedAt;
    this._lastDealCount   = viewModel.dealCount;
    this._lastError       = null;
    return viewModel;
  }

  // ── HTML builders ─────────────────────────────────────────────────────────

  _buildHTML(viewModel) {
    const filters  = this._buildFiltersHTML(viewModel);
    const header   = this._buildHeaderHTML(viewModel.generatedAt);
    const drilldown = this._buildDrilldownHTML(viewModel.drilldown);
    const detail    = this._buildDealDetailHTML(viewModel.selectedDeal);
    if (viewModel.dealCount === 0) {
      return (
        `<div style="padding:32px">${filters}${header}` +
        `<div style="text-align:center;padding:64px 0;color:var(--gr,#4A7A5E);font-size:15px">` +
        `Nenhum Deal disponível para análise.</div></div>`
      );
    }
    return (
      `<div style="padding:24px 32px;background:var(--bg,#F7F5F0);min-height:100%">` +
      filters + header +
      this._buildCardsHTML(viewModel.cards) +
      this._buildPipelineHTML(viewModel.pipeline) +
      this._buildStatusSectionHTML(viewModel.status) +
      this._buildForecastSectionHTML(viewModel.forecast) +
      drilldown + detail +
      `</div>`
    );
  }

  _buildFiltersHTML(vm) {
    const af = vm.activeFilters || {};
    const fo = vm.filterOptions || { funis: [], statuses: [] };
    const funiOpts = fo.funis
      .map((f) => `<option value="${this._escapeHTML(f)}"${af.funil === f ? ' selected' : ''}>${this._escapeHTML(f)}</option>`)
      .join('');
    const stOpts = fo.statuses
      .map((s) => `<option value="${this._escapeHTML(s)}"${af.status === s ? ' selected' : ''}>${this._escapeHTML(s)}</option>`)
      .join('');
    const grid = this._buildFilterSelectHTML('funil', 'Funil', funiOpts)
      + this._buildFilterSelectHTML('status', 'Status', stOpts)
      + this._buildFilterInputHTML('responsavel', 'Responsável', 'text', this._escapeHTML(af.responsavel || ''), 'Nome do responsável')
      + this._buildFilterInputHTML('from', 'Data inicial', 'date', this._formatDateInput(af.from), '')
      + this._buildFilterInputHTML('to', 'Data final', 'date', this._formatDateInput(af.to), '');
    return (
      `<div class="card" style="margin-bottom:18px" data-insights-filters>` +
      `<div class="card-title">Filtros</div>` +
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:12px">${grid}</div>` +
      `<div style="display:flex;gap:8px">` +
      `<button data-insights-action="apply-filters" style="padding:7px 16px;background:var(--g,#0D2418);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600">Aplicar filtros</button>` +
      `<button data-insights-action="clear-filters" style="padding:7px 16px;background:transparent;color:var(--g,#0D2418);border:1px solid var(--bd,#E0DBD0);border-radius:6px;font-size:12px;cursor:pointer">Limpar filtros</button>` +
      `</div></div>`
    );
  }

  _buildFilterSelectHTML(name, label, optionsHTML) {
    return (
      `<div><label style="font-size:11px;color:var(--gr,#4A7A5E);display:block;margin-bottom:4px">${label}</label>` +
      `<select data-insights-filter="${name}" style="width:100%;padding:6px 8px;border:1px solid var(--bd,#E0DBD0);border-radius:6px;font-size:12px;background:#fff">` +
      `<option value="">Todos</option>${optionsHTML}</select></div>`
    );
  }

  _buildFilterInputHTML(name, label, type, value, placeholder) {
    const ph = placeholder ? ` placeholder="${placeholder}"` : '';
    return (
      `<div><label style="font-size:11px;color:var(--gr,#4A7A5E);display:block;margin-bottom:4px">${label}</label>` +
      `<input type="${type}" data-insights-filter="${name}" value="${value}"${ph}` +
      ` style="width:100%;padding:6px 8px;border:1px solid var(--bd,#E0DBD0);border-radius:6px;font-size:12px;box-sizing:border-box"></div>`
    );
  }

  _buildHeaderHTML(generatedAt) {
    const d = new Date(generatedAt);
    const dateStr = d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    return (
      `<div class="page-header">` +
      `<div class="page-title">◆ ESA OS Insights</div>` +
      `<div class="page-sub">Inteligência comercial em tempo real</div>` +
      `<div style="font-size:11px;color:var(--gr,#4A7A5E);margin-top:4px;font-family:DM Mono,monospace">` +
      `Atualizado em ${dateStr}</div>` +
      `</div>`
    );
  }

  _buildCardsHTML(cards) {
    return (
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">` +
      cards.map((c) => this._buildCardHTML(c)).join('') +
      `</div>`
    );
  }

  _buildCardHTML(card) {
    const drilldownMap = {
      deals: 'all', conversion: 'won', winRate: 'won',
      lossRate: 'lost', pipelineValue: 'all', forecast: 'all',
    };
    let formatted;
    if (card.format === 'currency')     formatted = this._formatCurrency(card.value);
    else if (card.format === 'percent') formatted = this._formatPercent(card.value);
    else                                formatted = this._formatNumber(card.value);
    return (
      `<div class="kpi-card" data-card-id="${card.id}" data-insights-drilldown="${drilldownMap[card.id] || 'all'}">` +
      `<div class="kpi-val">${formatted}</div>` +
      `<div class="kpi-label">${card.label}</div>` +
      `</div>`
    );
  }

  _buildPipelineHTML(pipeline) {
    if (!pipeline.length) return '';
    return (
      `<div class="card" style="margin-bottom:18px">` +
      `<div class="card-title"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:16px;height:16px">` +
      `<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>Pipeline por Funil</div>` +
      pipeline.map((f) => this._buildFunilHTML(f)).join('') +
      `</div>`
    );
  }

  _buildFunilHTML(f) {
    const ef = this._escapeHTML(f.funil);
    const kwhLine = f.totalKwh > 0
      ? `<span style="color:var(--gr,#4A7A5E)"> · ${this._formatKwh(f.totalKwh)}</span>` : '';
    const stagesHTML = f.stages.map((st) => {
      const ee   = this._escapeHTML(st.etapa);
      const kwhSt = st.totalKwh > 0
        ? `<span style="font-size:11px;color:var(--gr,#4A7A5E)"> ${this._formatKwh(st.totalKwh)}</span>` : '';
      return (
        `<div data-insights-etapa="${ee}" data-insights-etapa-funil="${ef}" ` +
        `style="display:flex;align-items:center;justify-content:space-between;` +
        `padding:6px 12px 6px 20px;font-size:12px;border-top:1px solid var(--bd,#E0DBD0)">` +
        `<span style="color:var(--bk,#1A1A1A)">${ee}</span>` +
        `<span style="font-family:DM Mono,monospace;color:var(--g,#0D2418)">` +
        `${st.count} deal${st.count !== 1 ? 's' : ''} · ${this._formatCurrency(st.totalValue)}${kwhSt}</span>` +
        `</div>`
      );
    }).join('');
    return (
      `<div style="margin-bottom:12px">` +
      `<div data-insights-funil="${ef}" style="display:flex;align-items:center;justify-content:space-between;` +
      `padding:8px 12px;background:var(--gl,#EEF5F1);border-radius:8px;margin-bottom:2px">` +
      `<span style="font-weight:600;font-size:13px;color:var(--g,#0D2418)">${ef}</span>` +
      `<span style="font-size:12px;font-family:DM Mono,monospace;color:var(--g,#0D2418)">` +
      `${f.count} deal${f.count !== 1 ? 's' : ''} · ${this._formatCurrency(f.totalValue)}${kwhLine}</span>` +
      `</div>${stagesHTML}</div>`
    );
  }

  _buildStatusSectionHTML(status) {
    if (!status.length) return '';
    const rowsHTML = status.map((s) => {
      const w  = Math.min(100, Math.max(0, s.percent));
      const es = this._escapeHTML(s.status);
      return (
        `<div data-insights-status="${es}" style="margin-bottom:12px">` +
        `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">` +
        `<span style="color:var(--bk,#1A1A1A);font-weight:500">${es}</span>` +
        `<span style="font-family:DM Mono,monospace;color:var(--g,#0D2418)">` +
        `${s.count} · ${this._formatPercent(s.percent)}</span>` +
        `</div>` +
        `<div style="height:8px;background:var(--gl,#EEF5F1);border-radius:4px;overflow:hidden">` +
        `<div style="height:100%;width:${w.toFixed(1)}%;background:var(--gr,#4A7A5E);border-radius:4px"></div>` +
        `</div></div>`
      );
    }).join('');
    return (
      `<div class="card" style="margin-bottom:18px">` +
      `<div class="card-title"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:16px;height:16px">` +
      `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>Status Comercial</div>` +
      rowsHTML + `</div>`
    );
  }

  _buildForecastSectionHTML(forecast) {
    if (!forecast.length) return '';
    const rowsHTML = forecast.map(
      (f) =>
        `<tr>` +
        `<td style="padding:8px 12px;font-size:12px;color:var(--bk,#1A1A1A)">${f.status}</td>` +
        `<td style="padding:8px 12px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--g,#0D2418)">${f.count}</td>` +
        `<td style="padding:8px 12px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--g,#0D2418)">${this._formatCurrency(f.totalValue)}</td>` +
        `<td style="padding:8px 12px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--g,#0D2418)">${(f.weight * 100).toFixed(0)}%</td>` +
        `<td style="padding:8px 12px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--success,#1A5C38);font-weight:600">${this._formatCurrency(f.weightedValue)}</td>` +
        `</tr>`,
    ).join('');
    const th = (label, align = 'left') =>
      `<th style="padding:8px 12px;font-size:11px;color:var(--gr,#4A7A5E);text-align:${align};` +
      `font-weight:600;text-transform:uppercase;letter-spacing:.7px">${label}</th>`;
    return (
      `<div class="card" style="margin-bottom:18px">` +
      `<div class="card-title"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:16px;height:16px">` +
      `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>Forecast por Status</div>` +
      `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">` +
      `<thead><tr style="border-bottom:1.5px solid var(--bd,#E0DBD0)">` +
      th('Status') + th('Deals', 'right') + th('Valor Total', 'right') + th('Peso', 'right') + th('Forecast', 'right') +
      `</tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`
    );
  }

  _buildDrilldownHTML(drilldown) {
    if (!drilldown || !drilldown.active) return '';
    const title = this._escapeHTML(drilldown.title);
    if (!drilldown.deals.length) {
      return (
        `<div class="card" style="margin-bottom:18px">` +
        `<div class="card-title">Deals analisados — ${title}</div>` +
        `<div style="text-align:center;padding:32px;color:var(--gr,#4A7A5E);font-size:13px">` +
        `Nenhum Deal encontrado para este recorte.</div></div>`
      );
    }
    const th = (label, align = 'left') =>
      `<th style="padding:8px 12px;font-size:11px;color:var(--gr,#4A7A5E);text-align:${align};` +
      `font-weight:600;text-transform:uppercase;letter-spacing:.7px">${label}</th>`;
    const rowsHTML = drilldown.deals.map((d) => {
      const name  = this._escapeHTML(d.nome || d.cliente || d.id || '—');
      const valor = d.valor != null ? this._formatCurrency(d.valor) : '—';
      return (
        `<tr data-insights-deal-id="${this._escapeHTML(d.id || '')}">` +
        `<td style="padding:8px 12px;font-size:12px;color:var(--bk,#1A1A1A)">${name}</td>` +
        `<td style="padding:8px 12px;font-size:12px;color:var(--g,#0D2418)">${this._escapeHTML(d.funil || '—')}</td>` +
        `<td style="padding:8px 12px;font-size:12px;color:var(--g,#0D2418)">${this._escapeHTML(d.etapa || '—')}</td>` +
        `<td style="padding:8px 12px;font-size:12px;color:var(--g,#0D2418)">${this._escapeHTML(d.status || '—')}</td>` +
        `<td style="padding:8px 12px;font-size:12px;color:var(--g,#0D2418)">${this._escapeHTML(d.responsavel || '—')}</td>` +
        `<td style="padding:8px 12px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--g,#0D2418)">${valor}</td>` +
        `</tr>`
      );
    }).join('');
    return (
      `<div class="card" style="margin-bottom:18px">` +
      `<div class="card-title">Deals analisados — ${title}</div>` +
      `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">` +
      `<thead><tr style="border-bottom:1.5px solid var(--bd,#E0DBD0)">` +
      th('Cliente / Deal') + th('Funil') + th('Etapa') + th('Status') + th('Responsável') + th('Valor', 'right') +
      `</tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`
    );
  }

  _buildDealDetailHTML(deal) {
    if (!deal) return '';
    const row = (label, value) => {
      const v = value !== undefined && value !== null && value !== ''
        ? this._escapeHTML(String(value)) : '—';
      return (
        `<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--bd,#E0DBD0);font-size:12px">` +
        `<span style="color:var(--gr,#4A7A5E);min-width:120px;font-weight:500">${label}</span>` +
        `<span style="color:var(--bk,#1A1A1A)">${v}</span></div>`
      );
    };
    return (
      `<div class="card" style="margin-bottom:18px">` +
      `<div class="card-title">Detalhe do Deal</div>` +
      row('Nome / Cliente', deal.nome || deal.cliente || null) +
      row('ID', deal.id) +
      row('Funil', deal.funil) +
      row('Etapa', deal.etapa) +
      row('Status', deal.status) +
      row('Responsável', deal.responsavel) +
      row('Captador', deal.captador) +
      row('Valor', deal.valor != null ? this._formatCurrency(deal.valor) : null) +
      row('kWh', deal.kwh ? this._formatKwh(deal.kwh) : null) +
      row('Atualizado em', deal.updatedAt ? this._formatDateInput(deal.updatedAt) : null) +
      `</div>`
    );
  }

  // ── Format helpers ────────────────────────────────────────────────────────

  _formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(value);
  }

  _formatPercent(value) {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  _formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style:                'currency',
      currency:             'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  _formatKwh(value) {
    return new Intl.NumberFormat('pt-BR').format(value) + ' kWh';
  }

  _formatDateInput(timestamp) {
    if (timestamp === undefined || timestamp === null) return '';
    const n = Number(timestamp);
    if (isNaN(n) || n <= 0) return '';
    try { return new Date(n).toISOString().slice(0, 10); } catch (e) { return ''; }
  }

  _escapeHTML(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  getStats() {
    return {
      renderCount:        this._renderCount,
      lastGeneratedAt:    this._lastGeneratedAt,
      lastDealCount:      this._lastDealCount,
      lastError:          this._lastError,
      activeFilterCount:  Object.keys(this._activeFilters).length,
      drilldownDealCount: this._drilldown.deals.length,
      selectedDealId:     this._selectedDeal ? (this._selectedDeal.id || null) : null,
    };
  }
}
