/**
 * ESA OS — Operations Domain
 * TechnicalForm
 *
 * Modela um formulário técnico customizável por tipo de serviço.
 *
 * Responsabilidades:
 * - Definir a estrutura e campos de um formulário técnico de campo
 * - Suportar múltiplos tipos de campo (texto, foto, medição, checklist, etc.)
 * - Versionar formulários — mudanças de versão geram nova instância
 * - Ser agnóstico de UI — renderização é responsabilidade da camada de apresentação
 *
 * Casos de uso:
 * - Relatório de inspeção elétrica (NR10)
 * - Laudo de comissionamento fotovoltaico
 * - Checklist de O&M
 * - Formulário de vistoria técnica prévia
 * - Registro de leitura de medidores
 *
 * IMPORTANTE:
 * Este arquivo NÃO renderiza UI.
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 */

/**
 * Tipos de campo suportados em um TechnicalForm.
 *
 * TODO: Implementar renderizadores por tipo na camada de UI
 */
export const FORM_FIELD_TYPE = {
  TEXT:         'TEXT',         // Texto livre
  NUMBER:       'NUMBER',       // Valor numérico
  DATE:         'DATE',         // Data/hora
  BOOLEAN:      'BOOLEAN',      // Sim/Não
  SELECT:       'SELECT',       // Seleção única de lista
  MULTI_SELECT: 'MULTI_SELECT', // Seleção múltipla
  PHOTO:        'PHOTO',        // Captura de foto obrigatória
  VIDEO:        'VIDEO',        // Captura de vídeo
  SIGNATURE:    'SIGNATURE',    // Assinatura digital
  MEASUREMENT:  'MEASUREMENT',  // Leitura de medição (com unidade)
  CHECKLIST:    'CHECKLIST',    // Lista de itens verificados
};

/**
 * Definição de um campo em um TechnicalForm.
 * Não é uma classe — é um contrato de dado.
 *
 * @typedef {Object} FormField
 * @property {string}   id          - Identificador único do campo no formulário
 * @property {string}   type        - FORM_FIELD_TYPE.*
 * @property {string}   label       - Rótulo exibido ao técnico
 * @property {boolean}  required    - Obrigatório para submissão
 * @property {string}   [unit]      - Unidade de medida (para MEASUREMENT)
 * @property {string[]} [options]   - Opções disponíveis (para SELECT / MULTI_SELECT / CHECKLIST)
 * @property {string}   [hint]      - Dica de preenchimento
 * @property {Object}   [metadata]  - Dados extras (min, max, validation rules)
 */

/**
 * Formulário técnico customizável por tipo de serviço.
 */
export class TechnicalForm {
  /**
   * @param {string}      name        - Nome do formulário
   * @param {string}      serviceType - SERVICE_TYPE.* ao qual este formulário se aplica
   * @param {FormField[]} fields      - Campos do formulário
   * @param {string}      organizationId
   * @param {number}      version     - Versão do formulário (incrementa a cada alteração)
   * @param {boolean}     required    - Preenchimento obrigatório para concluir WorkOrder
   * @param {boolean}     active      - Formulário ativo e aplicável
   * @param {Object}      metadata    - Dados extras (approvedBy, approvedAt)
   */
  constructor(
    name,
    serviceType    = '',
    fields         = [],
    organizationId = '',
    version        = 1,
    required       = false,
    active         = true,
    metadata       = {}
  ) {
    /** @type {string} */
    this.id = TechnicalForm._generateId();

    this.name          = name;
    this.serviceType   = serviceType;

    /** @type {FormField[]} */
    this.fields        = fields;

    this.organizationId = organizationId;
    this.version       = version;
    this.required      = required;
    this.active        = active;
    this.metadata      = metadata;

    /** @type {number} */
    this.createdAt = Date.now();
  }

  /**
   * Retorna apenas os campos obrigatórios.
   * @returns {FormField[]}
   *
   * TODO: Filtrar fields onde required === true
   */
  getRequiredFields() {
    // TODO: implementar
    return [];
  }

  /**
   * Localiza um campo pelo ID.
   * @param {string} fieldId
   * @returns {FormField|null}
   *
   * TODO: Buscar em this.fields por id
   */
  findField(fieldId) {
    // TODO: implementar
    return null;
  }

  /**
   * Adiciona um campo ao formulário.
   * @param {FormField} field
   *
   * TODO: Validar unicidade de field.id
   * TODO: Incrementar versão ao alterar campos
   */
  addField(field) {
    // TODO: implementar
  }

  /**
   * Remove um campo do formulário.
   * @param {string} fieldId
   *
   * TODO: Incrementar versão ao remover campos
   */
  removeField(fieldId) {
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
   * @returns {TechnicalForm}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new TechnicalForm('');
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
