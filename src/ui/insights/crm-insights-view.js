/**
 * ESA OS — UI / Insights
 * CRMInsightsView
 *
 * UI gerencial nativa da ESA OS — filtros, drill-down, detalhe de Deal e saúde do pipeline.
 * Fontes permitidas: getCRMExecutiveSummary, searchCRMDeals, queryCRMDeal,
 *                   getCRMPipelineHealth, getCRMCriticalDeals, getCRMDealsWithoutNextAction,
 *                   getCRMRiskSignalSummary, getCRMActionPrioritySummary.
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
    this._selectedDeal      = null;
    this._dealDetailState   = 'empty';
    this._dealDetailError   = null;
    this._health            = null;
    this._criticalDeals     = [];
    this._healthState       = 'empty';
    this._riskSummary             = null;
    this._riskSignalsState        = 'empty';
    this._actionPrioritySummary   = null;
    this._actionPriorityState     = 'empty';
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
    this._activeFilters   = {};
    this._drilldown       = { active: false, title: '', filters: {}, deals: [] };
    this._selectedDeal    = null;
    this._dealDetailState = 'empty';
    this._dealDetailError = null;
    this._health           = null;
    this._criticalDeals    = [];
    this._healthState      = 'empty';
    this._riskSummary            = null;
    this._riskSignalsState       = 'empty';
    this._actionPrioritySummary  = null;
    this._actionPriorityState    = 'empty';
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
    this._selectedDeal    = null;
    this._dealDetailState = 'empty';
    this._dealDetailError = null;
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
    let result;
    try {
      result = this._queryProvider.queryCRMDeal(dealId);
    } catch (err) {
      this._selectedDeal    = null;
      this._dealDetailState = 'error';
      this._dealDetailError = { name: err.name || 'Error', message: err.message || String(err) };
      return null;
    }
    if (!result || !result.metadata || result.generatedAt === undefined || !('data' in result)) {
      throw new Error('[CRMInsightsView] Invalid CRM deal query result');
    }
    if (result.data === null) {
      this._selectedDeal    = null;
      this._dealDetailState = 'not-found';
      this._dealDetailError = null;
      return null;
    }
    this._selectedDeal    = Object.assign({}, result.data);
    this._dealDetailState = 'loaded';
    this._dealDetailError = null;
    return Object.assign({}, this._selectedDeal);
  }

  getSelectedDeal() {
    return this._selectedDeal ? Object.assign({}, this._selectedDeal) : null;
  }

  getDealDetailState() {
    return this._dealDetailState;
  }

  // ── Pipeline Health ───────────────────────────────────────────────────────

  /**
   * Carrega a análise de saúde do pipeline de forma independente.
   * Falha é isolada: erro na análise não quebra o restante do Insights.
   * Retorna null em caso de erro ou quando provider não suporta a query.
   *
   * @param {Object} [filters={}]
   * @returns {Object|null}
   */
  loadPipelineHealth(filters = {}) {
    if (!this._queryProvider || typeof this._queryProvider.getCRMPipelineHealth !== 'function') {
      this._health        = null;
      this._criticalDeals = [];
      this._healthState   = 'empty';
      return null;
    }

    const normalized = this._normalizeFilters(filters);

    try {
      const hResult = this._queryProvider.getCRMPipelineHealth(normalized);
      if (!hResult || !('data' in hResult)) {
        throw new Error('[CRMInsightsView] Invalid pipeline health result');
      }
      this._health      = hResult.data ? Object.assign({}, hResult.data) : null;
      this._healthState = this._health ? 'loaded' : 'empty';
    } catch (err) {
      this._health        = null;
      this._criticalDeals = [];
      this._healthState   = 'error';
      return null;
    }

    try {
      if (typeof this._queryProvider.getCRMCriticalDeals === 'function') {
        const cResult = this._queryProvider.getCRMCriticalDeals(normalized);
        this._criticalDeals = cResult && Array.isArray(cResult.data) ? cResult.data.slice() : [];
      }
    } catch (err) {
      this._criticalDeals = [];
    }

    return this._health ? Object.assign({}, this._health) : null;
  }

  getPipelineHealth() {
    return this._health ? Object.assign({}, this._health) : null;
  }

  // ── Risk Signals ──────────────────────────────────────────────────────────

  /**
   * Carrega o resumo de sinais de risco comercial de forma independente.
   * Falha é isolada: erro aqui não quebra o Insights nem a seção de Pipeline Health.
   * Retorna null em caso de erro ou quando provider não suporta a query.
   *
   * @param {Object} [filters={}]
   * @returns {Object|null}
   */
  loadRiskSignals(filters = {}) {
    if (!this._queryProvider || typeof this._queryProvider.getCRMRiskSignalSummary !== 'function') {
      this._riskSummary      = null;
      this._riskSignalsState = 'empty';
      return null;
    }

    const normalized = this._normalizeFilters(filters);

    try {
      const result = this._queryProvider.getCRMRiskSignalSummary(normalized);
      if (!result || !('data' in result)) {
        throw new Error('[CRMInsightsView] Invalid risk signal summary result');
      }
      this._riskSummary      = result.data ? Object.assign({}, result.data) : null;
      this._riskSignalsState = this._riskSummary ? 'loaded' : 'empty';
    } catch (err) {
      this._riskSummary      = null;
      this._riskSignalsState = 'error';
      return null;
    }

    return this._riskSummary ? Object.assign({}, this._riskSummary) : null;
  }

  getRiskSignalSummary() {
    return this._riskSummary ? Object.assign({}, this._riskSummary) : null;
  }

  // ── Action Priorities ─────────────────────────────────────────────────────

  /**
   * Carrega o resumo de prioridades de ação comercial de forma independente.
   * Falha é isolada: erro aqui não quebra nenhuma outra seção do Insights.
   * Retorna null em caso de erro ou quando provider não suporta a query.
   *
   * @param {Object} [filters={}]
   * @returns {Object|null}
   */
  loadActionPriorities(filters = {}) {
    if (!this._queryProvider || typeof this._queryProvider.getCRMActionPrioritySummary !== 'function') {
      this._actionPrioritySummary = null;
      this._actionPriorityState   = 'empty';
      return null;
    }
    const normalized = this._normalizeFilters(filters);
    try {
      const result = this._queryProvider.getCRMActionPrioritySummary(normalized);
      if (!result || !('data' in result)) {
        throw new Error('[CRMInsightsView] Invalid action priority summary result');
      }
      this._actionPrioritySummary = result.data ? Object.assign({}, result.data) : null;
      this._actionPriorityState   = this._actionPrioritySummary ? 'loaded' : 'empty';
    } catch (err) {
      this._actionPrioritySummary = null;
      this._actionPriorityState   = 'error';
      return null;
    }
    return this._actionPrioritySummary ? Object.assign({}, this._actionPrioritySummary) : null;
  }

  getActionPrioritySummary() {
    return this._actionPrioritySummary ? Object.assign({}, this._actionPrioritySummary) : null;
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
    // Health, risk and action-priority analyses loaded independently — failures are isolated
    this.loadPipelineHealth(this._activeFilters);
    this.loadRiskSignals(this._activeFilters);
    this.loadActionPriorities(this._activeFilters);

    container.innerHTML = this._buildHTML(viewModel);
    this._renderCount++;
    this._lastGeneratedAt = viewModel.generatedAt;
    this._lastDealCount   = viewModel.dealCount;
    this._lastError       = null;
    return viewModel;
  }

  // ── HTML builders ─────────────────────────────────────────────────────────

  _buildHTML(viewModel) {
    const filters   = this._buildFiltersHTML(viewModel);
    const header    = this._buildHeaderHTML(viewModel.generatedAt);
    const drilldown = this._buildDrilldownHTML(viewModel.drilldown);
    const detail    = this._buildDealDetailHTML();
    const health         = this._buildHealthSectionHTML();
    const riskSignals    = this._buildRiskSignalsSectionHTML();
    const actionPriority = this._buildActionPrioritySection();
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
      health +
      riskSignals +
      actionPriority +
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

  _buildHealthSectionHTML() {
    if (this._healthState === 'empty') return '';
    if (this._healthState === 'error') {
      return (
        `<div class="card" style="margin-bottom:18px" data-insights-health>` +
        `<div class="card-title">Saúde do Pipeline</div>` +
        `<div style="text-align:center;padding:32px;color:var(--danger,#C0392B);font-size:13px">` +
        `Não foi possível carregar a análise de saúde do pipeline.</div></div>`
      );
    }
    const h = this._health;
    return (
      `<div class="card" style="margin-bottom:18px" data-insights-health>` +
      `<div class="card-title">◆ Saúde do Pipeline</div>` +
      this._buildHealthKpisHTML(h) +
      this._buildAgingDistributionHTML(h.agingDistribution) +
      this._buildCriticalListHTML(this._criticalDeals) +
      `</div>`
    );
  }

  _buildHealthKpisHTML(h) {
    const kpi = (key, label, value, isCurrency) => {
      const formatted = isCurrency ? this._formatCurrency(value) : String(value);
      return (
        `<div style="background:var(--gl,#EEF5F1);border-radius:8px;padding:12px 16px;text-align:center" data-health-kpi="${key}">` +
        `<div style="font-size:18px;font-weight:700;font-family:DM Mono,monospace;color:var(--g,#0D2418)">${formatted}</div>` +
        `<div style="font-size:11px;color:var(--gr,#4A7A5E);margin-top:4px">${label}</div>` +
        `</div>`
      );
    };
    return (
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:16px">` +
      kpi('attention',      'Atenção',          h.attentionDeals) +
      kpi('risk',           'Risco',            h.riskDeals) +
      kpi('critical',       'Críticos',         h.criticalDeals) +
      kpi('without-action', 'Sem Próx. Ação',   h.dealsWithoutNextAction) +
      kpi('value-at-risk',  'Valor em Risco',   h.valueAtRisk, true) +
      `</div>`
    );
  }

  _buildAgingDistributionHTML(dist) {
    if (!dist) return '';
    const total = (dist.fresh.count + dist.attention.count + dist.risk.count + dist.critical.count) || 0;
    const bar = (level, label, color) => {
      const b = dist[level] || { count: 0 };
      const w = total > 0 ? Math.min(100, (b.count / total) * 100) : 0;
      return (
        `<div style="margin-bottom:8px" data-health-aging-level="${level}">` +
        `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">` +
        `<span style="color:var(--bk,#1A1A1A);font-weight:500">${label}</span>` +
        `<span style="font-family:DM Mono,monospace;color:var(--g,#0D2418)">${b.count}</span>` +
        `</div>` +
        `<div style="height:6px;background:var(--gl,#EEF5F1);border-radius:3px;overflow:hidden">` +
        `<div style="height:100%;width:${w.toFixed(1)}%;background:${color};border-radius:3px"></div>` +
        `</div></div>`
      );
    };
    return (
      `<div style="margin-bottom:16px" data-health-aging-distribution>` +
      `<div style="font-size:11px;color:var(--gr,#4A7A5E);font-weight:600;text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px">Distribuição de Aging</div>` +
      bar('fresh',     'Fresh (0–7 dias)',   '#4A7A5E') +
      bar('attention', 'Atenção (8–14 dias)','#F39C12') +
      bar('risk',      'Risco (15–30 dias)', '#E67E22') +
      bar('critical',  'Crítico (31+ dias)', '#C0392B') +
      `</div>`
    );
  }

  _buildCriticalListHTML(deals) {
    if (!deals || !deals.length) return '';
    const th = (label, align = 'left') =>
      `<th style="padding:6px 10px;font-size:11px;color:var(--gr,#4A7A5E);text-align:${align};` +
      `font-weight:600;text-transform:uppercase;letter-spacing:.7px">${label}</th>`;
    const rowsHTML = deals.slice(0, 10).map((d) => {
      const name  = this._escapeHTML(d.name  || d.id || '—');
      const stage = this._escapeHTML(d.stage || '—');
      const resp  = this._escapeHTML(d.responsible || '—');
      const valor = d.value > 0 ? this._formatCurrency(d.value) : '—';
      const days  = d.agingDays >= 0 ? d.agingDays + 'd' : '—';
      return (
        `<tr data-insights-deal-id="${this._escapeHTML(d.id || '')}" style="cursor:pointer">` +
        `<td style="padding:6px 10px;font-size:12px;color:var(--bk,#1A1A1A)">${name}</td>` +
        `<td style="padding:6px 10px;font-size:12px;color:var(--g,#0D2418)">${stage}</td>` +
        `<td style="padding:6px 10px;font-size:12px;color:var(--g,#0D2418)">${resp}</td>` +
        `<td style="padding:6px 10px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--g,#0D2418)">${valor}</td>` +
        `<td style="padding:6px 10px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--danger,#C0392B);font-weight:600">${days}</td>` +
        `</tr>`
      );
    }).join('');
    return (
      `<div data-health-critical-list>` +
      `<div style="font-size:11px;color:var(--gr,#4A7A5E);font-weight:600;text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px">Deals Críticos</div>` +
      `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">` +
      `<thead><tr style="border-bottom:1.5px solid var(--bd,#E0DBD0)">` +
      th('Deal / Cliente') + th('Etapa') + th('Responsável') + th('Valor', 'right') + th('Aging', 'right') +
      `</tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`
    );
  }

  _buildRiskSignalsSectionHTML() {
    if (this._riskSignalsState === 'empty') return '';
    if (this._riskSignalsState === 'error') {
      return (
        `<div class="card" style="margin-bottom:18px" data-insights-risk-signals>` +
        `<div class="card-title">Sinais de Risco Comercial</div>` +
        `<div style="text-align:center;padding:32px;color:var(--danger,#C0392B);font-size:13px">` +
        `Não foi possível carregar os sinais de risco comercial.</div></div>`
      );
    }
    const s = this._riskSummary;
    return (
      `<div class="card" style="margin-bottom:18px" data-insights-risk-signals>` +
      `<div class="card-title">◆ Sinais de Risco Comercial</div>` +
      this._buildRiskSignalsKpisHTML(s) +
      this._buildRiskSignalsListHTML(s.signals || []) +
      `</div>`
    );
  }

  _buildRiskSignalsKpisHTML(s) {
    const kpi = (key, label, value, isCurrency) => {
      const formatted = isCurrency ? this._formatCurrency(value || 0) : String(value || 0);
      return (
        `<div style="background:var(--gl,#EEF5F1);border-radius:8px;padding:12px 16px;text-align:center" data-risk-kpi="${key}">` +
        `<div style="font-size:18px;font-weight:700;font-family:DM Mono,monospace;color:var(--g,#0D2418)">${formatted}</div>` +
        `<div style="font-size:11px;color:var(--gr,#4A7A5E);margin-top:4px">${label}</div>` +
        `</div>`
      );
    };
    return (
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:16px">` +
      kpi('critical',       'Sinais Críticos',  s.criticalSignals)          +
      kpi('risk',           'Sinais de Risco',  s.riskSignals)              +
      kpi('affected-deals', 'Deals Afetados',   s.affectedDeals)            +
      kpi('value-exposed',  'Valor Exposto',    s.valueExposed, true)       +
      `</div>`
    );
  }

  _buildRiskSignalsListHTML(signals) {
    if (!signals || !signals.length) {
      return (
        `<div data-risk-signals-list style="text-align:center;padding:24px;color:var(--gr,#4A7A5E);font-size:13px">` +
        `Nenhum sinal de risco identificado.</div>`
      );
    }
    const rows = signals.slice(0, 20).map((s) => this._buildRiskSignalItemHTML(s)).join('');
    return `<div data-risk-signals-list>${rows}</div>`;
  }

  _buildRiskSignalItemHTML(signal) {
    const SEV_COLOR = { critical: '#C0392B', risk: '#E67E22', attention: '#F39C12', info: '#4A7A5E' };
    const SEV_LABEL = { critical: 'Crítico',  risk: 'Risco',   attention: 'Atenção',  info: 'Info' };
    const sev     = String(signal.severity || 'info');
    const color   = SEV_COLOR[sev]  || '#4A7A5E';
    const label   = SEV_LABEL[sev]  || sev;
    const title   = this._escapeHTML(signal.title       || '');
    const desc    = this._escapeHTML(signal.description || '');
    const dealId  = signal.dealId != null ? this._escapeHTML(String(signal.dealId)) : null;
    const meta    = this._buildRiskSignalMetaHTML(signal);
    const clickable = dealId ? ` data-insights-deal-id="${dealId}" style="cursor:pointer"` : '';
    return (
      `<div style="border-bottom:1px solid var(--bd,#E0DBD0);padding:10px 0;display:flex;gap:12px;align-items:flex-start"` +
      ` data-risk-signal-id="${this._escapeHTML(String(signal.id || ''))}"` +
      ` data-risk-signal-type="${this._escapeHTML(String(signal.type || ''))}"` +
      ` data-risk-signal-severity="${this._escapeHTML(sev)}"${clickable}>` +
      `<div style="min-width:60px;text-align:center;padding:3px 6px;border-radius:4px;font-size:10px;font-weight:700;color:#fff;background:${color};flex-shrink:0">${label}</div>` +
      `<div style="flex:1;min-width:0">` +
      `<div style="font-size:13px;font-weight:600;color:var(--bk,#1A1A1A)">${title}</div>` +
      `<div style="font-size:11px;color:var(--gr,#4A7A5E);margin-top:2px">${desc}</div>` +
      (meta ? `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:11px;font-family:DM Mono,monospace;color:var(--g,#0D2418)">${meta}</div>` : '') +
      `</div></div>`
    );
  }

  _buildRiskSignalMetaHTML(signal) {
    const parts = [];
    if (signal.dealName   != null) parts.push(`<span>Deal: ${this._escapeHTML(String(signal.dealName))}</span>`);
    if (signal.responsible != null) parts.push(`<span>Resp.: ${this._escapeHTML(String(signal.responsible))}</span>`);
    if (signal.value !== null && signal.value > 0) parts.push(`<span>${this._formatCurrency(signal.value)}</span>`);
    if (signal.agingDays !== null && signal.agingDays >= 0) parts.push(`<span>${signal.agingDays}d</span>`);
    return parts.join('');
  }

  _buildActionPrioritySection() {
    if (this._actionPriorityState === 'empty') return '';
    if (this._actionPriorityState === 'error') {
      return (
        `<div class="card" style="margin-bottom:18px" data-insights-action-priorities>` +
        `<div class="card-title">Prioridades de Ação</div>` +
        `<div style="text-align:center;padding:32px;color:var(--danger,#C0392B);font-size:13px">` +
        `Não foi possível carregar as prioridades de ação.</div></div>`
      );
    }
    const s = this._actionPrioritySummary;
    return (
      `<div class="card" style="margin-bottom:18px" data-insights-action-priorities>` +
      `<div class="card-title">◆ Prioridades de Ação</div>` +
      this._buildActionPriorityKpisHTML(s) +
      this._buildActionPriorityListHTML(s.priorities || []) +
      `</div>`
    );
  }

  _buildActionPriorityKpisHTML(s) {
    const kpi = (key, label, value, isCurrency) => {
      const formatted = isCurrency ? this._formatCurrency(value || 0) : String(value ?? 0);
      return (
        `<div style="background:var(--gl,#EEF5F1);border-radius:8px;padding:12px 16px;text-align:center" data-action-kpi="${key}">` +
        `<div style="font-size:18px;font-weight:700;font-family:DM Mono,monospace;color:var(--g,#0D2418)">${formatted}</div>` +
        `<div style="font-size:11px;color:var(--gr,#4A7A5E);margin-top:4px">${label}</div>` +
        `</div>`
      );
    };
    return (
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:16px">` +
      kpi('urgent',            'Urgentes',         s.urgentDeals)             +
      kpi('high',              'Alta Prioridade',  s.highPriorityDeals)       +
      kpi('prioritized-value', 'Valor Priorizado', s.prioritizedValue, true)  +
      kpi('average-score',     'Score Médio',      s.averagePriorityScore)    +
      `</div>`
    );
  }

  _buildActionPriorityListHTML(priorities) {
    if (!priorities || !priorities.length) {
      return (
        `<div data-action-priorities-list style="text-align:center;padding:24px;color:var(--gr,#4A7A5E);font-size:13px">` +
        `Nenhuma prioridade de ação identificada.</div>`
      );
    }
    const rows = priorities.slice(0, 20).map((p) => this._buildActionPriorityItemHTML(p)).join('');
    return `<div data-action-priorities-list>${rows}</div>`;
  }

  _buildActionPriorityItemHTML(item) {
    const LEVEL_COLOR = { urgent: '#C0392B', high: '#E67E22', medium: '#F39C12', low: '#4A7A5E' };
    const LEVEL_LABEL = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };
    const lv     = String(item.priorityLevel || 'low');
    const color  = LEVEL_COLOR[lv] || '#4A7A5E';
    const label  = LEVEL_LABEL[lv] || lv;
    const name   = this._escapeHTML(item.dealName   || item.dealId || '—');
    const resp   = this._escapeHTML(item.responsible || '—');
    const value  = item.value > 0 ? this._formatCurrency(item.value) : '—';
    const aging  = item.agingDays >= 0 ? `${item.agingDays}d` : '—';
    const score  = String(item.priorityScore ?? 0);
    const dealId = item.dealId ? this._escapeHTML(String(item.dealId)) : null;
    const reasons = this._buildActionPriorityReasonsHTML(item.reasons || []);
    const clickable = dealId ? ` data-insights-deal-id="${dealId}" style="cursor:pointer"` : '';
    return (
      `<div style="border-bottom:1px solid var(--bd,#E0DBD0);padding:10px 0;display:flex;gap:12px;align-items:flex-start"` +
      ` data-action-priority-id="${this._escapeHTML(String(item.id || ''))}"` +
      ` data-action-priority-level="${this._escapeHTML(lv)}"` +
      ` data-action-priority-score="${this._escapeHTML(score)}"${clickable}>` +
      `<div style="min-width:60px;text-align:center;padding:3px 6px;border-radius:4px;font-size:10px;font-weight:700;color:#fff;background:${color};flex-shrink:0">${label}</div>` +
      `<div style="flex:1;min-width:0">` +
      `<div style="font-size:13px;font-weight:600;color:var(--bk,#1A1A1A)">${name}</div>` +
      `<div style="font-size:11px;color:var(--gr,#4A7A5E);margin-top:2px;font-family:DM Mono,monospace">` +
      `Resp.: ${resp} · ${value} · ${aging} · Score: ${score}</div>` +
      (reasons ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${reasons}</div>` : '') +
      `</div></div>`
    );
  }

  _buildActionPriorityReasonsHTML(reasons) {
    return reasons
      .slice(0, 4)
      .map((r) => (
        `<span style="font-size:10px;padding:2px 6px;background:var(--gl,#EEF5F1);border-radius:3px;color:var(--g,#0D2418)"` +
        ` data-action-reason-code="${this._escapeHTML(String(r.code || ''))}">${this._escapeHTML(String(r.label || r.code || ''))}</span>`
      ))
      .join('');
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

  _buildDealDetailHTML() {
    if (this._dealDetailState === 'empty') return '';
    if (this._dealDetailState === 'not-found') {
      return (
        `<div class="card" style="margin-bottom:18px" data-insights-deal-detail>` +
        `<div class="card-title">Detalhe do Deal</div>` +
        `<div style="text-align:center;padding:32px;color:var(--gr,#4A7A5E);font-size:13px">` +
        `Deal não encontrado.</div></div>`
      );
    }
    if (this._dealDetailState === 'error') {
      return (
        `<div class="card" style="margin-bottom:18px" data-insights-deal-detail>` +
        `<div class="card-title">Detalhe do Deal</div>` +
        `<div style="text-align:center;padding:32px;color:var(--danger,#C0392B);font-size:13px">` +
        `Não foi possível carregar o detalhe do deal.</div></div>`
      );
    }
    return this._buildDealDetailPanelHTML(this._buildDealDetailViewModel(this._selectedDeal));
  }

  _buildDealDetailViewModel(deal) {
    return {
      id:          deal.id           || null,
      nome:        deal.nome         || deal.cliente || null,
      empresa:     deal.empresa      || null,
      funil:       deal.funil        || null,
      etapa:       deal.etapa        || null,
      status:      deal.status       || null,
      produto:     deal.produto      || null,
      responsavel: deal.responsavel  || null,
      captador:    deal.captador     || null,
      valor:       typeof deal.valor === 'number'     ? deal.valor     : null,
      kwh:         typeof deal.kwh   === 'number'     ? deal.kwh       : null,
      createdAt:   typeof deal.createdAt === 'number' ? deal.createdAt : null,
      updatedAt:   typeof deal.updatedAt === 'number' ? deal.updatedAt : null,
      proximaAcao: deal.proximaAcao  || null,
      obs:         deal.obs          || null,
    };
  }

  _buildDealDetailPanelHTML(vm) {
    const row = (label, value) => {
      const v = value !== null && value !== undefined && value !== ''
        ? this._escapeHTML(String(value)) : '—';
      return (
        `<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--bd,#E0DBD0);font-size:12px">` +
        `<span style="color:var(--gr,#4A7A5E);min-width:140px;font-weight:500">${label}</span>` +
        `<span style="color:var(--bk,#1A1A1A)">${v}</span></div>`
      );
    };
    return (
      `<div class="card" style="margin-bottom:18px" data-insights-deal-detail>` +
      `<div class="card-title">Detalhe do Deal</div>` +
      row('Nome / Cliente', vm.nome) +
      row('Empresa',        vm.empresa) +
      row('ID',             vm.id) +
      row('Funil',          vm.funil) +
      row('Etapa',          vm.etapa) +
      row('Status',         vm.status) +
      row('Produto',        vm.produto) +
      row('Responsável',    vm.responsavel) +
      row('Captador',       vm.captador) +
      row('Valor',          vm.valor !== null ? this._formatCurrency(vm.valor) : null) +
      row('kWh',            vm.kwh   !== null ? this._formatKwh(vm.kwh)       : null) +
      row('Criado em',      vm.createdAt !== null ? this._formatDate(vm.createdAt) : null) +
      row('Atualizado em',  vm.updatedAt !== null ? this._formatDate(vm.updatedAt) : null) +
      row('Próxima ação',   vm.proximaAcao) +
      row('Observações',    vm.obs) +
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

  _formatDate(timestamp) {
    if (timestamp === undefined || timestamp === null) return '';
    const n = Number(timestamp);
    if (isNaN(n) || n <= 0) return '';
    try {
      return new Date(n).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (e) { return ''; }
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
      dealDetailState:      this._dealDetailState,
      healthState:          this._healthState,
      riskSignalsState:     this._riskSignalsState,
      actionPriorityState:  this._actionPriorityState,
    };
  }
}
