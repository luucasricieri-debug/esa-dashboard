/**
 * ESA OS — Operations Domain
 * Inspection
 *
 * Representa uma inspeção técnica realizada em campo.
 *
 * Responsabilidades:
 * - Modelar o resultado de uma inspeção técnica
 * - Registrar achados, recomendações e severidade
 * - Vincular ao equipamento/ativo inspecionado
 * - Preparar geração de laudo técnico (PDF, futuro)
 *
 * Tipos cobertos:
 * - Inspeção elétrica (NR10)
 * - Inspeção de sistema fotovoltaico
 * - Inspeção de bateria de armazenamento
 * - Inspeção de carregador elétrico (EVSE)
 * - Inspeção de O&M programada
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não gera laudos PDF nesta versão.
 */

/**
 * Tipos de inspeção.
 */
export const INSPECTION_TYPE = {
  ELECTRICAL:    'ELECTRICAL',    // Inspeção elétrica (NR10)
  SOLAR:         'SOLAR',         // Sistema fotovoltaico (módulos, inversor, estrutura)
  BATTERY:       'BATTERY',       // Sistema de bateria
  EV_CHARGER:    'EV_CHARGER',    // Carregador de veículo elétrico
  OM_ROUTINE:    'OM_ROUTINE',    // O&M preventivo rotineiro
  OM_CORRECTIVE: 'OM_CORRECTIVE', // O&M corretivo
  OTHER:         'OTHER',
};

/**
 * Resultado geral da inspeção.
 */
export const INSPECTION_RESULT = {
  APPROVED:          'APPROVED',          // Aprovado — sem irregularidades
  APPROVED_WITH_OBS: 'APPROVED_WITH_OBS', // Aprovado com observações
  PENDING_REPAIR:    'PENDING_REPAIR',    // Reprovado — necessita reparo
  CONDEMNED:         'CONDEMNED',         // Condenado — fora de operação
  INCONCLUSIVE:      'INCONCLUSIVE',      // Inconclusivo — inspeção incompleta
};

/**
 * Severidade dos achados identificados.
 */
export const INSPECTION_SEVERITY = {
  NONE:     'NONE',     // Sem achados
  LOW:      'LOW',      // Achados de baixo impacto
  MEDIUM:   'MEDIUM',   // Achados que necessitam atenção
  HIGH:     'HIGH',     // Achados críticos — ação imediata necessária
  CRITICAL: 'CRITICAL', // Risco à segurança — parar operação
};

/**
 * @typedef {Object} InspectionFinding
 * @property {string}  code        - Código do achado (ex: 'EL-001')
 * @property {string}  description - Descrição do achado
 * @property {string}  severity    - INSPECTION_SEVERITY.*
 * @property {string}  [photoUrl]  - URL da foto de evidência
 */

/**
 * Inspeção técnica realizada em campo.
 */
export class Inspection {
  /**
   * @param {string}             workOrderId     - ID da WorkOrder
   * @param {string}             inspectionType  - INSPECTION_TYPE.*
   * @param {string}             technicianId    - ID do Technician responsável
   * @param {string}             assetId         - ID do ativo/equipamento inspecionado
   * @param {string}             result          - INSPECTION_RESULT.*
   * @param {InspectionFinding[]} findings       - Achados identificados
   * @param {string[]}           recommendations - Recomendações técnicas
   * @param {string}             severity        - Severidade geral: INSPECTION_SEVERITY.*
   * @param {Object}             metadata        - Dados extras (normRef, equipmentAge, photos)
   */
  constructor(
    workOrderId,
    inspectionType  = INSPECTION_TYPE.OTHER,
    technicianId    = '',
    assetId         = null,
    result          = INSPECTION_RESULT.INCONCLUSIVE,
    findings        = [],
    recommendations = [],
    severity        = INSPECTION_SEVERITY.NONE,
    metadata        = {}
  ) {
    /** @type {string} */
    this.id = Inspection._generateId();

    this.workOrderId     = workOrderId;
    this.inspectionType  = inspectionType;
    this.technicianId    = technicianId;
    this.assetId         = assetId;
    this.result          = result;

    /** @type {InspectionFinding[]} */
    this.findings        = findings;

    this.recommendations = recommendations;
    this.severity        = severity;
    this.metadata        = metadata;

    /** @type {number} */
    this.createdAt = Date.now();
  }

  /**
   * Verifica se a inspeção foi aprovada.
   * @returns {boolean}
   *
   * TODO: Retornar result === APPROVED || result === APPROVED_WITH_OBS
   */
  isApproved() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se existem achados críticos ou de alta severidade.
   * @returns {boolean}
   *
   * TODO: Verificar findings onde severity === HIGH || severity === CRITICAL
   */
  hasCriticalFindings() {
    // TODO: implementar
    return false;
  }

  /**
   * Adiciona um achado à inspeção.
   * @param {InspectionFinding} finding
   *
   * TODO: Recalcular severity geral com base nos achados acumulados
   */
  addFinding(finding) {
    // TODO: implementar
  }

  /**
   * Adiciona uma recomendação técnica.
   * @param {string} recommendation
   */
  addRecommendation(recommendation) {
    // TODO: implementar
  }

  /**
   * Finaliza a inspeção com resultado.
   * @param {string} result   - INSPECTION_RESULT.*
   * @param {string} severity - INSPECTION_SEVERITY.*
   *
   * TODO: Setar result e severity
   * TODO: Validar que findings estão presentes se result for PENDING_REPAIR ou CONDEMNED
   */
  conclude(result, severity) {
    // TODO: implementar
  }

  /**
   * @returns {Object}
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {Inspection}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Inspection('');
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
