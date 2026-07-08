/**
 * ESA OS — Queries / CRM
 * CRMQueryService
 *
 * Camada somente leitura para consultas gerenciais do CRM.
 * Centraliza acesso ao CRMReadModel e CRMMetrics para UI, Solana IA, APIs e relatórios.
 *
 * Padrão: Query Service (CQRS)
 *
 * IMPORTANTE:
 * Não acessa Firebase. Não acessa Audit. Não acessa Logger. Não acessa Event Bus.
 * Usa dependency injection — não importa singletons diretamente.
 * Valida dependências no momento da execução da query, não no constructor.
 */

import { CRMQueryResult }       from './crm-query-result.js';
import { CRMPipelineAnalyzer }  from './crm-pipeline-analyzer.js';

export class CRMQueryService {
  /**
   * @param {CRMReadModel} readModel - Instância do Read Model CRM (injetada)
   * @param {CRMMetrics}   metrics   - Instância de métricas CRM (injetada)
   */
  constructor(readModel, metrics) {
    this._readModel        = readModel;
    this._metrics          = metrics;
    this._pipelineAnalyzer = null;
  }

  // ── Queries de Read Model ─────────────────────────────────────────────────

  /**
   * Retorna um Deal pelo ID.
   * Não valida metrics — esta query não as utiliza.
   *
   * @param {string} dealId
   * @returns {CRMQueryResult} data: Deal | null
   */
  getDeal(dealId) {
    this._requireReadModel('getDeal');
    const deal = this._readModel.getDeal(dealId);
    return new CRMQueryResult(deal, { query: 'crm.getDeal', dealId });
  }

  /**
   * Busca Deals com filtros opcionais.
   *
   * @param {Object} filters - Filtros aceitos por CRMReadModel.getDeals()
   * @returns {CRMQueryResult} data: Deal[]
   */
  searchDeals(filters = {}) {
    this._requireReadModel('getDeals');
    const deals = this._readModel.getDeals(filters);
    return new CRMQueryResult(deals, {
      query:   'crm.searchDeals',
      filters: Object.assign({}, filters),
      count:   deals.length,
    });
  }

  /**
   * Retorna pipeline agrupado por funil → etapa.
   *
   * @param {Object} filters
   * @returns {CRMQueryResult} data: pipeline
   */
  getPipeline(filters = {}) {
    this._requireReadModel('getPipeline');
    const pipeline = this._readModel.getPipeline(filters);
    return new CRMQueryResult(pipeline, {
      query:   'crm.getPipeline',
      filters: Object.assign({}, filters),
    });
  }

  /**
   * Retorna contagem de Deals por status.
   *
   * @param {Object} filters
   * @returns {CRMQueryResult} data: { total, byStatus }
   */
  getStatusSummary(filters = {}) {
    this._requireReadModel('getStatusSummary');
    const summary = this._readModel.getStatusSummary(filters);
    return new CRMQueryResult(summary, {
      query:   'crm.getStatusSummary',
      filters: Object.assign({}, filters),
    });
  }

  // ── Queries de Métricas ───────────────────────────────────────────────────

  /**
   * Retorna métricas de conversão, win/loss/paused rate.
   * Não inclui forecast — use getForecast() separadamente.
   *
   * @param {Object} filters
   * @returns {CRMQueryResult} data: { conversion, winRate, lossRate, pausedRate }
   */
  getMetrics(filters = {}) {
    this._requireMetrics('getConversionRate');
    this._requireMetrics('getWinRate');
    this._requireMetrics('getLossRate');
    this._requireMetrics('getPausedRate');
    return new CRMQueryResult(
      {
        conversion: this._metrics.getConversionRate(filters),
        winRate:    this._metrics.getWinRate(filters),
        lossRate:   this._metrics.getLossRate(filters),
        pausedRate: this._metrics.getPausedRate(filters),
      },
      { query: 'crm.getMetrics', filters: Object.assign({}, filters) },
    );
  }

  /**
   * Retorna forecast ponderado por status.
   *
   * @param {Object} filters
   * @returns {CRMQueryResult} data: { totalValue, weightedValue, dealCount, byStatus }
   */
  getForecast(filters = {}) {
    this._requireMetrics('getForecast');
    const forecast = this._metrics.getForecast(filters);
    return new CRMQueryResult(forecast, {
      query:   'crm.getForecast',
      filters: Object.assign({}, filters),
    });
  }

  // ── Executive Summary ─────────────────────────────────────────────────────

  /**
   * Consolida pipeline, status e todas as métricas em uma única resposta.
   * Projetado para Dashboard executivo, Solana IA e relatórios gerenciais.
   *
   * @param {Object} filters
   * @returns {CRMQueryResult} data: { pipeline, status, conversion, winRate, lossRate, pausedRate, forecast }
   */
  getExecutiveSummary(filters = {}) {
    this._requireReadModel('getPipeline');
    this._requireReadModel('getStatusSummary');
    this._requireReadModel('getDeals');
    this._requireMetrics('getConversionRate');
    this._requireMetrics('getWinRate');
    this._requireMetrics('getLossRate');
    this._requireMetrics('getPausedRate');
    this._requireMetrics('getForecast');

    const dealCount = this._readModel.getDeals(filters).length;

    return new CRMQueryResult(
      {
        pipeline:   this._readModel.getPipeline(filters),
        status:     this._readModel.getStatusSummary(filters),
        conversion: this._metrics.getConversionRate(filters),
        winRate:    this._metrics.getWinRate(filters),
        lossRate:   this._metrics.getLossRate(filters),
        pausedRate: this._metrics.getPausedRate(filters),
        forecast:   this._metrics.getForecast(filters),
      },
      {
        query:     'crm.getExecutiveSummary',
        filters:   Object.assign({}, filters),
        dealCount,
      },
    );
  }

  // ── Pipeline Health / Aging ───────────────────────────────────────────────

  /**
   * Retorna resumo de saúde do pipeline com distribuição de aging e valores em risco.
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @returns {CRMQueryResult} data: PipelineHealth
   */
  getPipelineHealth(filters = {}, options = {}) {
    this._requireReadModel('getDeals');
    const health = this._getAnalyzer().getPipelineHealth(filters, options);
    return new CRMQueryResult(health, {
      query:   'crm.getPipelineHealth',
      filters: Object.assign({}, filters),
    });
  }

  /**
   * Retorna lista gerencial de deals críticos (aging > 30 dias).
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @returns {CRMQueryResult} data: DealItem[]
   */
  getCriticalDeals(filters = {}, options = {}) {
    this._requireReadModel('getDeals');
    const items = this._getAnalyzer().getCriticalDeals(filters, options);
    return new CRMQueryResult(items, {
      query:   'crm.getCriticalDeals',
      filters: Object.assign({}, filters),
      count:   items.length,
    });
  }

  /**
   * Retorna lista gerencial de deals sem próxima ação registrada.
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @returns {CRMQueryResult} data: DealItem[]
   */
  getDealsWithoutNextAction(filters = {}, options = {}) {
    this._requireReadModel('getDeals');
    const items = this._getAnalyzer().getDealsWithoutNextAction(filters, options);
    return new CRMQueryResult(items, {
      query:   'crm.getDealsWithoutNextAction',
      filters: Object.assign({}, filters),
      count:   items.length,
    });
  }

  // ── Validação privada ─────────────────────────────────────────────────────

  _getAnalyzer() {
    if (!this._pipelineAnalyzer) {
      this._pipelineAnalyzer = new CRMPipelineAnalyzer(this._readModel);
    }
    return this._pipelineAnalyzer;
  }

  _requireReadModel(method) {
    if (!this._readModel || typeof this._readModel[method] !== 'function') {
      throw new TypeError(`[CRMQueryService] readModel must expose ${method}()`);
    }
  }

  _requireMetrics(method) {
    if (!this._metrics || typeof this._metrics[method] !== 'function') {
      throw new TypeError(`[CRMQueryService] metrics must expose ${method}()`);
    }
  }
}
