/**
 * ESA OS — Energy Domain
 * EnergyReport
 *
 * Relatório de uma operação energética por competência e destinatário.
 *
 * Destinatários previstos:
 * - Investidor: geração, compensação, retorno financeiro
 * - Comprador/Assinante: consumo, compensação, economia na fatura
 * - Associação: geração coletiva e distribuição de créditos
 * - Interno ESA: operação completa + financeiro + inadimplência
 *
 * IMPORTANTE: Não gera PDF. Não usa IA. NÃO conectado ao Dashboard legado.
 */

export const REPORT_TYPE = {
  INVESTOR:     'INVESTOR',     // Relatório para investidor
  BUYER:        'BUYER',        // Relatório para comprador/assinante
  ASSOCIATION:  'ASSOCIATION',  // Relatório para associação/condomínio
  INTERNAL_ESA: 'INTERNAL_ESA',// Relatório interno ESA
  REGULATORY:   'REGULATORY',   // Relatório regulatório
};

export const REPORT_STATUS = {
  DRAFT:     'DRAFT',
  GENERATED: 'GENERATED', // Dados consolidados, aguardando envio
  SENT:      'SENT',      // Enviado ao destinatário
  VIEWED:    'VIEWED',    // Visualizado pelo destinatário
};

export class EnergyReport {
  /**
   * @param {string} operationId      - ID da EnergyOperation
   * @param {string} competence       - Competência (ex: '2024-05')
   * @param {string} reportType       - REPORT_TYPE.*
   * @param {string} recipientId      - ID do destinatário (Person ou Organization)
   * @param {string} generatedBy      - UID da Person que gerou
   * @param {Object} generationData   - Dados de geração do período
   * @param {Object} consumptionData  - Dados de consumo do período
   * @param {Object} creditData       - Dados de crédito e compensação
   * @param {Object} compensationData - Dados de compensação nas faturas
   * @param {Object} financialData    - Dados financeiros do período
   * @param {string} fileUrl          - URL do arquivo gerado (PDF futuro)
   * @param {Object} metadata         - Dados extras (notes, version)
   */
  constructor(
    operationId      = '',
    competence       = '',
    reportType       = REPORT_TYPE.INTERNAL_ESA,
    recipientId      = '',
    generatedBy      = '',
    generationData   = {},
    consumptionData  = {},
    creditData       = {},
    compensationData = {},
    financialData    = {},
    fileUrl          = null,
    metadata         = {}
  ) {
    this.id              = EnergyReport._generateId();
    this.operationId     = operationId;
    this.competence      = competence;
    this.reportType      = reportType;
    this.recipientId     = recipientId;
    this.generatedBy     = generatedBy;
    this.generationData  = generationData;
    this.consumptionData = consumptionData;
    this.creditData      = creditData;
    this.compensationData = compensationData;
    this.financialData   = financialData;
    this.fileUrl         = fileUrl;
    this.status          = REPORT_STATUS.DRAFT;
    this.metadata        = metadata;
    this.generatedAt     = Date.now();
  }

  /** @returns {Object} */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
