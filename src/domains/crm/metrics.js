/**
 * ESA OS — CRM Domain
 * CRMMetrics
 *
 * Concentra o cálculo e a estrutura de todos os indicadores do CRM ESA OS.
 * É a fonte de verdade para dashboards, relatórios e alertas baseados em CRM.
 *
 * Responsabilidades:
 * - Calcular taxa de conversão por Pipeline e por responsável
 * - Calcular valor total, ticket médio e forecast por Pipeline
 * - Calcular tempo médio de ciclo de venda (lead time)
 * - Prover snapshots de indicadores para o módulo Indicadores CRM
 * - Preparar estrutura para análise preditiva futura pela Solana IA
 *
 * Indicadores planejados:
 *   Conversão       → % de deals ganhos sobre o total de deals fechados
 *   Valor Total     → soma dos valores dos deals abertos por Pipeline
 *   Ticket Médio    → valor médio por deal ganho
 *   Tempo Médio     → dias médios do deal até fechamento
 *   Forecast        → previsão de receita com base em probabilidade × valor
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * O legado calcula indicadores diretamente em renderIndCRM() via dados
 * brutos do Firebase. Esta classe estrutura o modelo para cálculo
 * desacoplado, testável e reutilizável.
 */

/**
 * Janelas de tempo para segmentação de indicadores.
 *
 * TODO: Suportar janelas customizadas (ex: últimos 90 dias, último trimestre)
 */
export const METRICS_PERIOD = {
  TODAY:        'today',
  THIS_WEEK:    'this_week',
  THIS_MONTH:   'this_month',
  THIS_QUARTER: 'this_quarter',
  THIS_YEAR:    'this_year',
  ALL_TIME:     'all_time',
};

/**
 * Snapshot de indicadores de um Pipeline em um período.
 * Estrutura de dados retornada pelos métodos de cálculo.
 */
export class PipelineSnapshot {
  /**
   * @param {string} pipelineId     - ID do Pipeline
   * @param {string} pipelineName   - Nome do Pipeline
   * @param {string} period         - Período: METRICS_PERIOD.*
   * @param {number} totalDeals     - Total de deals no período
   * @param {number} openDeals      - Deals em andamento
   * @param {number} wonDeals       - Deals ganhos
   * @param {number} lostDeals      - Deals perdidos
   * @param {number} totalValue     - Valor total em negociação (abertos)
   * @param {number} wonValue       - Valor total ganho
   * @param {number} avgTicket      - Ticket médio dos deals ganhos
   * @param {number} conversionRate - Taxa de conversão (0–1)
   * @param {number} avgCycleDays   - Tempo médio de ciclo em dias
   * @param {number} forecast       - Previsão de receita (probabilidade × valor)
   * @param {Object} byStage        - Distribuição de deals por Stage
   * @param {number} computedAt     - Timestamp do cálculo (ms)
   */
  constructor(
    pipelineId,
    pipelineName,
    period,
    totalDeals = 0,
    openDeals = 0,
    wonDeals = 0,
    lostDeals = 0,
    totalValue = 0,
    wonValue = 0,
    avgTicket = 0,
    conversionRate = 0,
    avgCycleDays = 0,
    forecast = 0,
    byStage = {},
    computedAt = Date.now()
  ) {
    this.pipelineId = pipelineId;
    this.pipelineName = pipelineName;
    this.period = period;
    this.totalDeals = totalDeals;
    this.openDeals = openDeals;
    this.wonDeals = wonDeals;
    this.lostDeals = lostDeals;
    this.totalValue = totalValue;
    this.wonValue = wonValue;
    this.avgTicket = avgTicket;
    this.conversionRate = conversionRate;
    this.avgCycleDays = avgCycleDays;
    this.forecast = forecast;
    this.byStage = byStage;
    this.computedAt = computedAt;
  }
}

/**
 * Motor de cálculo de indicadores do CRM ESA OS.
 */
export class CRMMetrics {

  /**
   * Calcula a taxa de conversão de um conjunto de Deals.
   * @param {Deal[]} deals - Deals do período a analisar
   * @returns {number} - Valor entre 0 e 1 (ex: 0.35 = 35%)
   *
   * TODO: Implementar: wonDeals.length / (wonDeals.length + lostDeals.length)
   * TODO: Retornar 0 quando não houver deals fechados para evitar divisão por zero
   */
  static computeConversionRate(deals) {
    // TODO: implementar
    return 0;
  }

  /**
   * Calcula o valor total em negociação (apenas deals abertos).
   * @param {Deal[]} deals
   * @param {string} pipelineId - Filtra por pipeline
   * @returns {{ amount: number, unit: string }}
   *
   * TODO: Usar deal.getEffectiveValue() para respeitar unidade do Pipeline (R$ vs kWh)
   * TODO: Agrupar por Pipeline antes de somar
   */
  static computeTotalValue(deals, pipelineId = '') {
    // TODO: implementar
    return { amount: 0, unit: 'BRL' };
  }

  /**
   * Calcula o ticket médio dos deals ganhos.
   * @param {Deal[]} deals
   * @returns {number}
   *
   * TODO: Implementar: totalWonValue / wonDeals.length
   * TODO: Retornar 0 se não houver deals ganhos
   */
  static computeAverageTicket(deals) {
    // TODO: implementar
    return 0;
  }

  /**
   * Calcula o tempo médio de ciclo de venda em dias.
   * @param {Deal[]} deals - Apenas deals com closedAt definido
   * @returns {number}
   *
   * TODO: Implementar: média de (closedAt - createdAt) em dias
   * TODO: Excluir tempo em que o deal estava pausado do cálculo
   */
  static computeAverageCycleDays(deals) {
    // TODO: implementar
    return 0;
  }

  /**
   * Calcula o forecast de receita para deals em aberto.
   * @param {Deal[]} deals
   * @returns {number}
   *
   * TODO: Implementar: soma de (deal.value * deal.probability / 100) para deals abertos
   * TODO: Usar forecastDate para segmentar por período futuro
   */
  static computeForecast(deals) {
    // TODO: implementar
    return 0;
  }

  /**
   * Gera a distribuição de deals por Stage de um Pipeline.
   * @param {Deal[]}    deals
   * @param {Stage[]}   stages
   * @returns {Object}  - { [stageId]: { count: number, value: number } }
   *
   * TODO: Implementar agrupamento e soma de valores por stageId
   * TODO: Incluir stages sem deals (count = 0, value = 0) para exibição completa no funil
   */
  static computeByStage(deals, stages) {
    // TODO: implementar
    return {};
  }

  /**
   * Gera um snapshot completo de indicadores para um Pipeline em um período.
   * @param {string}   pipelineId
   * @param {string}   pipelineName
   * @param {Deal[]}   deals         - Deals já filtrados para este pipeline e período
   * @param {Stage[]}  stages
   * @param {string}   period        - METRICS_PERIOD.*
   * @returns {PipelineSnapshot}
   *
   * TODO: Compor todos os cálculos acima em um único snapshot
   * TODO: Cachear resultado por pipelineId + period para evitar recálculo desnecessário
   */
  static buildPipelineSnapshot(pipelineId, pipelineName, deals, stages, period = METRICS_PERIOD.THIS_MONTH) {
    // TODO: implementar
    return new PipelineSnapshot(pipelineId, pipelineName, period);
  }

  /**
   * Gera snapshots para todos os Pipelines de uma vez.
   * @param {Pipeline[]} pipelines
   * @param {Deal[]}     allDeals
   * @param {string}     period
   * @returns {PipelineSnapshot[]}
   *
   * TODO: Paralelizar cálculo por pipeline (Promise.all)
   * TODO: Exportar resultado para o módulo Indicadores CRM
   */
  static buildAllPipelineSnapshots(pipelines, allDeals, period = METRICS_PERIOD.THIS_MONTH) {
    // TODO: implementar
    return [];
  }

  /**
   * Calcula indicadores consolidados por responsável (ranking de desempenho).
   * @param {Deal[]}  deals
   * @param {Person[]} persons
   * @returns {Array<{ person: Person, wonDeals: number, wonValue: number, conversionRate: number }>}
   *
   * TODO: Alimentar o componente de ranking no módulo Indicadores
   * TODO: Suportar filtro por período e por Pipeline
   */
  static buildPersonRanking(deals, persons) {
    // TODO: implementar
    return [];
  }

  /**
   * Filtra deals de um array pelo período especificado.
   * @param {Deal[]}  deals
   * @param {string}  period - METRICS_PERIOD.*
   * @returns {Deal[]}
   *
   * TODO: Implementar comparação de createdAt com o intervalo do período
   * TODO: Suportar fuso horário da organização
   */
  static filterByPeriod(deals, period) {
    // TODO: implementar
    return [];
  }
}
