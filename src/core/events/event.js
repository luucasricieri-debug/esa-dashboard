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
  }

  /**
   * Retorna o domain de origem extraído do tipo do evento.
   * @returns {string} - Ex: 'crm' para 'crm:deal:created'
   */
  getDomain() {
    return this.type.split(':')[0] || '';
  }

  /**
   * Retorna a entidade extraída do tipo do evento.
   * @returns {string} - Ex: 'deal' para 'crm:deal:created'
   */
  getEntity() {
    return this.type.split(':')[1] || '';
  }

  /**
   * Retorna o verbo/ação extraído do tipo do evento.
   * @returns {string} - Ex: 'created' para 'crm:deal:created'
   */
  getVerb() {
    return this.type.split(':')[2] || '';
  }

  /**
   * Verifica se este evento é do tipo informado.
   * @param {string} type
   * @returns {boolean}
   */
  isType(type) {
    return this.type === type;
  }

  /**
   * Serializa o evento para objeto plano (para log ou transporte).
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      payload: this.payload,
      source: this.source,
      createdAt: this.createdAt,
      metadata: this.metadata,
    };
  }

  /**
   * Reconstrói um CoreEvent a partir de objeto serializado.
   * Preserva id e createdAt originais — não gera novos.
   * @param {Object} data
   * @returns {CoreEvent}
   */
  static fromJSON(data) {
    const event = new CoreEvent(
      data.type || '',
      data.payload || {},
      data.source || '',
      data.metadata || {},
    );
    event.id = data.id || event.id;
    event.createdAt = data.createdAt || event.createdAt;
    return event;
  }

  /**
   * Gera um identificador único para o evento.
   * Usa crypto.randomUUID() quando disponível; fallback seguro para ambientes sem suporte.
   * @returns {string}
   * @private
   */
  static _generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
}
