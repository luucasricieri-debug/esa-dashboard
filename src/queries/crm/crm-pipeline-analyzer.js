/**
 * ESA OS — Queries / CRM
 * CRMPipelineAnalyzer
 *
 * Análise operacional de aging e saúde do pipeline CRM.
 * Identifica riscos gerenciais: deals críticos, em risco, sem próxima ação.
 *
 * Padrão: Analytic Query (extensão de CRMMetrics no plano arquitetural)
 * Usa dependency injection — não importa singletons diretamente.
 *
 * IMPORTANTE:
 * Não acessa Firebase. Não acessa Audit. Não acessa Event Bus.
 * Usa apenas CRMReadModel.getDeals() como fonte.
 *
 * Estratégia de timestamp para aging:
 *   1. updatedAt — captura stage-changed, updated e status events (qualquer evento
 *      que toque o deal atualiza este campo no CRMReadModel via _applyX())
 *   2. createdAt — fallback quando updatedAt = 0 ou ausente
 *   Não usa Date.now() espalhado. Aceita options.referenceDate para testes determinísticos.
 *
 * Nota sobre proximaAcao:
 *   CRMReadModel._normalizeDeal() armazena um conjunto fixo de campos e não inclui
 *   proximaAcao por padrão. O campo pode estar presente em deals atualizados via
 *   crm:deal:updated com payload.after.proximaAcao. A verificação é defensiva.
 */

/**
 * Thresholds de aging em dias (centralizados — sem números mágicos espalhados).
 *
 * fresh:     0 a 7 dias
 * attention: 8 a 14 dias
 * risk:      15 a 30 dias
 * critical:  31+ dias
 *
 * @type {{ fresh: number, attention: number, risk: number }}
 */
export const AGING_THRESHOLDS = {
  fresh:     7,
  attention: 14,
  risk:      30,
};

/** Milissegundos em um dia solar (86.400.000). */
const MS_PER_DAY = 86_400_000;

/**
 * Analisador de saúde do pipeline CRM.
 */
export class CRMPipelineAnalyzer {
  /**
   * @param {CRMReadModel} readModel - Instância do Read Model CRM (injetada)
   */
  constructor(readModel) {
    this._readModel = readModel;
  }

  // ── API pública ───────────────────────────────────────────────────────────

  /**
   * Retorna resumo de saúde do pipeline com distribuição de aging e valores em risco.
   *
   * @param {Object} filters              - Filtros passados para getDeals()
   * @param {Object} [options={}]
   * @param {number} [options.referenceDate] - Timestamp de referência em ms (para testes determinísticos)
   * @returns {{
   *   totalDeals:            number,
   *   freshDeals:            number,
   *   attentionDeals:        number,
   *   riskDeals:             number,
   *   criticalDeals:         number,
   *   dealsWithoutNextAction:number,
   *   valueAtRisk:           number,
   *   criticalValue:         number,
   *   agingDistribution:     Object,
   *   referenceDate:         number,
   * }}
   */
  getPipelineHealth(filters = {}, options = {}) {
    this._requireReadModel();
    const refMs = this._referenceMs(options);
    const deals = this._readModel.getDeals(filters);

    let freshDeals             = 0;
    let attentionDeals         = 0;
    let riskDeals              = 0;
    let criticalDeals          = 0;
    let dealsWithoutNextAction = 0;
    let valueAtRisk            = 0;
    let criticalValue          = 0;

    const agingDistribution = {
      fresh:     { count: 0, totalValue: 0 },
      attention: { count: 0, totalValue: 0 },
      risk:      { count: 0, totalValue: 0 },
      critical:  { count: 0, totalValue: 0 },
    };

    for (const deal of deals) {
      const days  = this._agingDays(deal, refMs);
      const level = this._classifyAging(days);
      const valor = Number(deal.valor) || 0;

      if      (level === 'fresh')     freshDeals++;
      else if (level === 'attention') attentionDeals++;
      else if (level === 'risk')      { riskDeals++;    valueAtRisk += valor; }
      else if (level === 'critical')  { criticalDeals++; valueAtRisk += valor; criticalValue += valor; }

      const bucket = agingDistribution[level];
      if (bucket) { bucket.count++; bucket.totalValue += valor; }

      if (!this._hasNextAction(deal)) dealsWithoutNextAction++;
    }

    return {
      totalDeals:            deals.length,
      freshDeals,
      attentionDeals,
      riskDeals,
      criticalDeals,
      dealsWithoutNextAction,
      valueAtRisk,
      criticalValue,
      agingDistribution,
      referenceDate:         refMs,
    };
  }

  /**
   * Retorna lista gerencial de deals críticos (aging > 30 dias).
   * Ordenada por agingDays DESC (mais crítico primeiro).
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @returns {Array<DealItem>}
   */
  getCriticalDeals(filters = {}, options = {}) {
    this._requireReadModel();
    const refMs = this._referenceMs(options);
    const deals = this._readModel.getDeals(filters);
    const items = [];

    for (const deal of deals) {
      const days  = this._agingDays(deal, refMs);
      const level = this._classifyAging(days);
      if (level === 'critical') {
        items.push(this._toDealItem(deal, days, level));
      }
    }

    items.sort((a, b) => b.agingDays - a.agingDays);
    return items;
  }

  /**
   * Retorna lista gerencial de deals sem próxima ação registrada.
   * Ordenada por agingDays DESC (mais urgente primeiro).
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @returns {Array<DealItem>}
   */
  getDealsWithoutNextAction(filters = {}, options = {}) {
    this._requireReadModel();
    const refMs = this._referenceMs(options);
    const deals = this._readModel.getDeals(filters);
    const items = [];

    for (const deal of deals) {
      if (!this._hasNextAction(deal)) {
        const days  = this._agingDays(deal, refMs);
        const level = this._classifyAging(days);
        items.push(this._toDealItem(deal, days, level));
      }
    }

    items.sort((a, b) => b.agingDays - a.agingDays);
    return items;
  }

  // ── Helpers internos ──────────────────────────────────────────────────────

  /**
   * Escolhe o timestamp mais relevante do deal para cálculo de aging.
   *
   * Prioridade:
   *   1. updatedAt — captura qualquer evento CRM que tenha tocado o deal
   *   2. createdAt — fallback quando updatedAt = 0 ou ausente
   *
   * Retorna 0 se nenhum timestamp válido estiver disponível.
   */
  _lastRelevantAt(deal) {
    const u = Number(deal.updatedAt);
    if (u > 0) return u;
    const c = Number(deal.createdAt);
    return c > 0 ? c : 0;
  }

  /**
   * Calcula a idade operacional do deal em dias inteiros.
   * Retorna null se o timestamp for inválido ou ausente (updatedAt=0, createdAt=0).
   * Retorna 0 se referenceMs < lastRelevantAt (deal "do futuro" — anomalia de dados).
   */
  _agingDays(deal, referenceMs) {
    const t = this._lastRelevantAt(deal);
    if (t <= 0) return null;
    const ms = referenceMs - t;
    return ms >= 0 ? Math.floor(ms / MS_PER_DAY) : 0;
  }

  /**
   * Classifica o aging em faixa gerencial usando AGING_THRESHOLDS centralizados.
   * null → 'unknown' (timestamp ausente/inválido — não entra nas faixas de contagem).
   *
   * @param {number|null} days
   * @returns {'fresh'|'attention'|'risk'|'critical'|'unknown'}
   */
  _classifyAging(days) {
    if (days === null)                          return 'unknown';
    if (days <= AGING_THRESHOLDS.fresh)         return 'fresh';
    if (days <= AGING_THRESHOLDS.attention)     return 'attention';
    if (days <= AGING_THRESHOLDS.risk)          return 'risk';
    return 'critical';
  }

  /**
   * Verifica se o deal possui próxima ação ou follow-up registrado.
   * Verificação defensiva: checa proximaAcao e followUp.
   */
  _hasNextAction(deal) {
    const pa = deal.proximaAcao;
    if (pa && String(pa).trim()) return true;
    const fu = deal.followUp;
    if (fu && String(fu).trim()) return true;
    return false;
  }

  /**
   * Normaliza um deal para a representação gerencial de lista.
   *
   * @param {Object}      deal
   * @param {number|null} agingDays
   * @param {string}      agingLevel
   * @returns {DealItem}
   */
  _toDealItem(deal, agingDays, agingLevel) {
    return {
      id:            deal.id            || '',
      name:          deal.nome          || deal.cliente  || deal.id || '',
      company:       deal.empresa       || '',
      responsible:   deal.responsavel   || '',
      pipeline:      deal.funil         || '',
      stage:         deal.etapa         || '',
      status:        deal.status        || '',
      value:         Number(deal.valor) || 0,
      agingDays:     agingDays !== null ? agingDays : -1,
      agingLevel,
      lastRelevantAt: this._lastRelevantAt(deal),
      nextActionAt:  deal.proximaAcao   || null,
    };
  }

  /**
   * Resolve o timestamp de referência para aging.
   * Permite injeção via options.referenceDate para testes determinísticos.
   */
  _referenceMs(options) {
    const r = options && options.referenceDate;
    return typeof r === 'number' && r > 0 ? r : Date.now();
  }

  _requireReadModel() {
    if (!this._readModel || typeof this._readModel.getDeals !== 'function') {
      throw new TypeError('[CRMPipelineAnalyzer] readModel must expose getDeals()');
    }
  }
}
