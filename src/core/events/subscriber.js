/**
 * ESA OS — Core / Events
 * Subscriber
 *
 * Representa um consumidor de eventos no Event Bus da plataforma ESA OS.
 * Encapsula o handler de processamento e os metadados de inscrição.
 *
 * Responsabilidades:
 * - Representar a inscrição de um módulo em um ou mais tipos de evento
 * - Armazenar o handler (callback) a ser invocado quando o evento ocorrer
 * - Controlar o estado ativo/inativo da inscrição
 * - Suportar inscrição pontual (once) — auto-remove após primeiro disparo
 * - Prover identificação rastreável para remoção pelo EventBus
 *
 * Wildcards suportados em eventTypes:
 *   '*'              — todos os eventos da plataforma
 *   'domain:*'       — todos os eventos de um domain (ex: 'crm:*')
 *   'domain:entity:*'— todos os eventos de uma entidade (ex: 'crm:deal:*')
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não processa eventos reais. Não altera nenhum comportamento da aplicação.
 */

/**
 * Representa um consumidor de eventos registrado no EventBus.
 */
export class Subscriber {
  /**
   * @param {string}          id          - Identificador único desta inscrição
   * @param {string|string[]} eventTypes  - Tipo(s) de evento que este Subscriber consome
   * @param {Function}        handler     - Callback chamado com (CoreEvent) ao publicar
   * @param {string}          owner       - Identificador do módulo dono desta inscrição (ex: 'CRMDomain')
   * @param {boolean}         once        - Se true, remove-se automaticamente após o primeiro disparo
   */
  constructor(id, eventTypes, handler, owner = '', once = false) {
    /** @type {string} */
    this.id = id;

    /** @type {string[]} Tipos de evento aceitos — normalizado sempre como array */
    this.eventTypes = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    /**
     * @type {Function} Callback de processamento.
     * Assinatura esperada: (event: CoreEvent) => void | Promise<void>
     */
    this.handler = handler;

    /** @type {string} Módulo que registrou esta inscrição (para debug e auditoria) */
    this.owner = owner;

    /** @type {boolean} Se true, este Subscriber se auto-remove após o primeiro disparo */
    this.once = once;

    /** @type {boolean} Controla se a inscrição está ativa */
    this.active = true;

    /** @type {number} Quantas vezes o handler foi invocado */
    this.invokeCount = 0;

    /** @type {number} Timestamp de criação da inscrição */
    this.createdAt = Date.now();
  }

  /**
   * Verifica se este Subscriber aceita um determinado tipo de evento.
   * Suporta matching exato, '*', 'domain:*' e 'domain:entity:*'.
   * @param {string} eventType
   * @returns {boolean}
   */
  handles(eventType) {
    return this.eventTypes.some((pattern) => {
      if (pattern === '*') return true;
      if (pattern === eventType) return true;
      if (pattern.endsWith(':*')) return eventType.startsWith(pattern.slice(0, -1));
      return false;
    });
  }

  /**
   * Invoca o handler com o evento recebido.
   * Suporta handlers síncronos e assíncronos.
   * Erros propagam para o EventBus — não são engolidos aqui.
   * @param {CoreEvent} event
   * @returns {Promise<void>}
   */
  async dispatch(event) {
    if (!this.active) return;
    await this.handler(event);
    this.invokeCount++;
    if (this.once) this.deactivate();
  }

  /**
   * Ativa esta inscrição (reativa após desativação).
   */
  activate() {
    this.active = true;
  }

  /**
   * Desativa esta inscrição sem removê-la do EventBus.
   * Eventos continuam sendo roteados, mas o handler não é invocado.
   */
  deactivate() {
    this.active = false;
  }

  /**
   * Verifica se esta inscrição está ativa.
   * @returns {boolean}
   */
  isActive() {
    return this.active;
  }

  /**
   * Serializa o Subscriber para log ou diagnóstico.
   * Nunca inclui o handler (não serializável).
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      eventTypes: this.eventTypes,
      owner: this.owner,
      once: this.once,
      active: this.active,
      invokeCount: this.invokeCount,
      createdAt: this.createdAt,
    };
  }
}
