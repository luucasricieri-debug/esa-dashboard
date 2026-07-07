/**
 * ESA OS — UI / Insights
 * CRMInsightsView
 *
 * Primeira UI gerencial nativa da ESA OS.
 * Consome EXCLUSIVAMENTE window.ESA_OS.getCRMExecutiveSummary().
 * Não acessa Firebase, Event Bus, Audit, CRMReadModel, CRMMetrics ou crmDeals diretamente.
 */

export class CRMInsightsView {
  constructor(queryProvider) {
    this._queryProvider   = queryProvider;
    this._renderCount     = 0;
    this._lastGeneratedAt = null;
    this._lastDealCount   = null;
    this._lastError       = null;
  }

  load(filters = {}) {
    if (!this._queryProvider || typeof this._queryProvider.getCRMExecutiveSummary !== 'function') {
      throw new TypeError('[CRMInsightsView] queryProvider must expose getCRMExecutiveSummary()');
    }
    const result = this._queryProvider.getCRMExecutiveSummary(filters);
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
    return {
      generatedAt,
      dealCount,
      cards,
      pipeline: this._buildPipelineViewModel(data.pipeline),
      status:   this._buildStatusViewModel(data.status),
      forecast: this._buildForecastViewModel(data.forecast),
    };
  }

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

  render(container, filters = {}) {
    if (!container || container.innerHTML === undefined) {
      throw new TypeError('[CRMInsightsView] container must have innerHTML');
    }
    let viewModel;
    try {
      viewModel = this.load(filters);
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

  _buildHTML(viewModel) {
    if (viewModel.dealCount === 0) {
      return (
        `<div style="padding:32px">` +
        this._buildHeaderHTML(viewModel.generatedAt) +
        `<div style="text-align:center;padding:64px 0;color:var(--gr,#4A7A5E);font-size:15px">` +
        `Nenhum Deal disponível para análise.</div></div>`
      );
    }
    return (
      `<div style="padding:24px 32px;background:var(--bg,#F7F5F0);min-height:100%">` +
      this._buildHeaderHTML(viewModel.generatedAt) +
      this._buildCardsHTML(viewModel.cards) +
      this._buildPipelineHTML(viewModel.pipeline) +
      this._buildStatusSectionHTML(viewModel.status) +
      this._buildForecastSectionHTML(viewModel.forecast) +
      `</div>`
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
    let formatted;
    if (card.format === 'currency')     formatted = this._formatCurrency(card.value);
    else if (card.format === 'percent') formatted = this._formatPercent(card.value);
    else                                formatted = this._formatNumber(card.value);
    return (
      `<div class="kpi-card" data-card-id="${card.id}">` +
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
    const kwhLine =
      f.totalKwh > 0
        ? `<span style="color:var(--gr,#4A7A5E)"> · ${this._formatKwh(f.totalKwh)}</span>`
        : '';
    const stagesHTML = f.stages
      .map((st) => {
        const kwhSt =
          st.totalKwh > 0
            ? `<span style="font-size:11px;color:var(--gr,#4A7A5E)"> ${this._formatKwh(st.totalKwh)}</span>`
            : '';
        return (
          `<div style="display:flex;align-items:center;justify-content:space-between;` +
          `padding:6px 12px 6px 20px;font-size:12px;border-top:1px solid var(--bd,#E0DBD0)">` +
          `<span style="color:var(--bk,#1A1A1A)">${st.etapa}</span>` +
          `<span style="font-family:DM Mono,monospace;color:var(--g,#0D2418)">` +
          `${st.count} deal${st.count !== 1 ? 's' : ''} · ${this._formatCurrency(st.totalValue)}${kwhSt}</span>` +
          `</div>`
        );
      })
      .join('');
    return (
      `<div style="margin-bottom:12px">` +
      `<div style="display:flex;align-items:center;justify-content:space-between;` +
      `padding:8px 12px;background:var(--gl,#EEF5F1);border-radius:8px;margin-bottom:2px">` +
      `<span style="font-weight:600;font-size:13px;color:var(--g,#0D2418)">${f.funil}</span>` +
      `<span style="font-size:12px;font-family:DM Mono,monospace;color:var(--g,#0D2418)">` +
      `${f.count} deal${f.count !== 1 ? 's' : ''} · ${this._formatCurrency(f.totalValue)}${kwhLine}</span>` +
      `</div>${stagesHTML}</div>`
    );
  }

  _buildStatusSectionHTML(status) {
    if (!status.length) return '';
    const rowsHTML = status
      .map((s) => {
        const w = Math.min(100, Math.max(0, s.percent));
        return (
          `<div style="margin-bottom:12px">` +
          `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">` +
          `<span style="color:var(--bk,#1A1A1A);font-weight:500">${s.status}</span>` +
          `<span style="font-family:DM Mono,monospace;color:var(--g,#0D2418)">` +
          `${s.count} · ${this._formatPercent(s.percent)}</span>` +
          `</div>` +
          `<div style="height:8px;background:var(--gl,#EEF5F1);border-radius:4px;overflow:hidden">` +
          `<div style="height:100%;width:${w.toFixed(1)}%;background:var(--gr,#4A7A5E);border-radius:4px"></div>` +
          `</div></div>`
        );
      })
      .join('');
    return (
      `<div class="card" style="margin-bottom:18px">` +
      `<div class="card-title"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:16px;height:16px">` +
      `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>Status Comercial</div>` +
      rowsHTML +
      `</div>`
    );
  }

  _buildForecastSectionHTML(forecast) {
    if (!forecast.length) return '';
    const rowsHTML = forecast
      .map(
        (f) =>
          `<tr>` +
          `<td style="padding:8px 12px;font-size:12px;color:var(--bk,#1A1A1A)">${f.status}</td>` +
          `<td style="padding:8px 12px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--g,#0D2418)">${f.count}</td>` +
          `<td style="padding:8px 12px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--g,#0D2418)">${this._formatCurrency(f.totalValue)}</td>` +
          `<td style="padding:8px 12px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--g,#0D2418)">${(f.weight * 100).toFixed(0)}%</td>` +
          `<td style="padding:8px 12px;font-size:12px;font-family:DM Mono,monospace;text-align:right;color:var(--success,#1A5C38);font-weight:600">${this._formatCurrency(f.weightedValue)}</td>` +
          `</tr>`,
      )
      .join('');
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

  getStats() {
    return {
      renderCount:     this._renderCount,
      lastGeneratedAt: this._lastGeneratedAt,
      lastDealCount:   this._lastDealCount,
      lastError:       this._lastError,
    };
  }
}
