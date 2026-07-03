/**
 * ESA OS — Core / Events
 * CoreEvent
 *
 * Representa um evento interno da plataforma ESA OS.
 * É a unidade fundamental de comunicação assíncrona entre
 * Core, Domains e Services sem acoplamento direto.
 *
 * Responsabilidades:
 * - Modelar a estrutura canônica de um evento interno
 * - Carregar um payload tipado com os dados do evento
 * - Identificar a origem (source) que publicou o evento
 * - Suportar metadados para rastreabilidade (correlationId, traceId)
 * - Ser imutável após construção — eventos são fatos, não estados
 *
 * Convenção de nomenclatura de tipos:
 *   '{domain}:{entity}:{verb}'
 *   Exemplos:
 *     'crm:deal:created'
 *     'crm:deal:stage-changed'
 *     'crm:deal:won'
 *     'identity:session:started'
 *     'identity:session:expired'
 *     'identity:person:created'
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Eventos desta classe não alteram nenhum comportamento da aplicação.
 */

/**
 * Catálogo de tipos de evento conhecidos na plataforma ESA OS.
 * Usado para documentação, autocompletion e validação futura.
 *
 * TODO: Exportar para arquivo separado (event-types.js) quando o catálogo crescer
 * TODO: Gerar automaticamente a partir das definições de cada Domain
 */
export const EVENT_TYPES = {
  // ─── Identity ────────────────────────────────────────────────────────────
  IDENTITY_SESSION_STARTED:  'identity:session:started',
  IDENTITY_SESSION_EXPIRED:  'identity:session:expired',
  IDENTITY_PERSON_CREATED:   'identity:person:created',
  IDENTITY_PERSON_UPDATED:   'identity:person:updated',
  IDENTITY_PERSON_DELETED:   'identity:person:deleted',

  // ─── CRM ─────────────────────────────────────────────────────────────────
  CRM_DEAL_CREATED:          'crm:deal:created',
  CRM_DEAL_UPDATED:          'crm:deal:updated',
  CRM_DEAL_STAGE_CHANGED:    'crm:deal:stage-changed',
  CRM_DEAL_WON:              'crm:deal:won',
  CRM_DEAL_LOST:             'crm:deal:lost',
  CRM_DEAL_PAUSED:           'crm:deal:paused',
  CRM_FOLLOWUP_ADDED:        'crm:followup:added',
  CRM_ACTIVITY_COMPLETED:    'crm:activity:completed',
  CRM_PROPOSAL_SENT:         'crm:proposal:sent',
  CRM_PROPOSAL_ACCEPTED:     'crm:proposal:accepted',

  // ─── Core ────────────────────────────────────────────────────────────────
  CORE_APP_INITIALIZED:      'core:app:initialized',
  CORE_ERROR_OCCURRED:       'core:error:occurred',
};

/**
 * Representa um evento interno imutável da plataforma ESA OS.
 */
export class CoreEvent {
  /**
   * @param {string} type      - Tipo do evento (use EVENT_TYPES.*)
   * @param {Object} payload   - Dados carregados pelo evento
   * @param {string} source    - Identificador do módulo que publicou (ex: 'CRMDomain')
   * @param {Object} metadata  - Dados extras para rastreabilidade
   */
  constructor(type, payload = {}, source = '', metadata = {}) {
    /** @type {string} Identificador único gerado no momento da criação */
    this.id = CoreEvent._generateId();

    /** @type {string} Tipo do evento no formato 'domain:entity:verb' */
    this.type = type;

    /** @type {Object} Dados transportados pelo evento */
    this.payload = payload;

    /** @type {string} Módulo ou classe que publicou o evento */
    this.source = source;

    /** @type {number} Timestamp de criação em ms desde epoch (imutável) */
    this.createdAt = Date.now();

    /**
     * @type {Object} Metadados para correlação e rastreamento.
     * Campos sugeridos: correlationId, traceId, userId, requestId
     *
     * TODO: Gerar correlationId automaticamente se não fornecido
     * TODO: Propagar traceId entre eventos causalmente relacionados
     */
    this.metadata = metadata;

    // Congela o objeto para garantir imutabilidade pós-construção
    // TODO: Descomentar quando os stubs forem removidos (rompe com Object.freeze em testes de stub)
    // Object.freeze(this);
  }

  /**
   * Retorna o domain de origem extraído do tipo do evento.
   * @returns {string} - Ex: 'crm' para 'crm:deal:created'
   *
   * TODO: Implementar extração via split(':')[0]
   */
  getDomain() {
    // TODO: implementar
    return '';
  }

  /**
   * Retorna a entidade extraída do tipo do evento.
   * @returns {string} - Ex: 'deal' para 'crm:deal:created'
   *
   * TODO: Implementar extração via split(':')[1]
   */
  getEntity() {
    // TODO: implementar
    return '';
  }

  /**
   * Retorna o verbo/ação extraído do tipo do evento.
   * @returns {string} - Ex: 'created' para 'crm:deal:created'
   *
   * TODO: Implementar extração via split(':')[2]
   */
  getVerb() {
    // TODO: implementar
    return '';
  }

  /**
   * Verifica se este evento é do tipo informado.
   * @param {string} type
   * @returns {boolean}
   */
  isType(type) {
    // TODO: implementar
    return false;
  }

  /**
   * Serializa o evento para objeto plano (para log ou transporte).
   * @returns {Object}
   *
   * TODO: Usar no AuditService para persistir trilha de eventos
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói um CoreEvent a partir de objeto serializado.
   * @param {Object} data
   * @returns {CoreEvent}
   *
   * TODO: Restaurar id e createdAt originais (não gerar novos)
   * TODO: Validar type contra EVENT_TYPES antes de instanciar
   */
  static fromJSON(data) {
    // TODO: implementar
    return new CoreEvent('');
  }

  /**
   * Gera um identificador único para o evento.
   * @returns {string}
   *
   * TODO: Usar crypto.randomUUID() quando disponível no ambiente
   * TODO: Fallback para Date.now() + Math.random() em ambientes sem crypto
   * @private
   */
  static _generateId() {
    // TODO: implementar com crypto.randomUUID() ou equivalente
    return '';
  }
}
