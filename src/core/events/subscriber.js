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

    /**
     * @type {string[]} Tipos de evento aceitos — normalizado sempre como array.
     *
     * TODO: Suportar wildcards (ex: 'crm:*' para todos os eventos do CRM)
     */
    this.eventTypes = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    /**
     * @type {Function} Callback de processamento.
     * Assinatura esperada: (event: CoreEvent) => void | Promise<void>
     *
     * TODO: Suportar handlers assíncronos com tratamento de erro isolado
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
   * @param {string} eventType
   * @returns {boolean}
   *
   * TODO: Implementar matching com wildcards (ex: 'crm:*')
   * TODO: Suportar prefixos de domínio (ex: 'crm:' corresponde a qualquer evento CRM)
   */
  handles(eventType) {
    // TODO: implementar includes() + matching de wildcards
    return false;
  }

  /**
   * Invoca o handler com o evento recebido.
   * @param {CoreEvent} event
   *
   * TODO: Incrementar invokeCount após cada chamada
   * TODO: Capturar e logar erros sem propagar (handler isolado)
   * TODO: Se once === true, chamar deactivate() após o primeiro dispatch
   * TODO: Suportar handlers assíncronos (await handler(event))
   */
  dispatch(event) {
    // TODO: implementar
  }

  /**
   * Ativa esta inscrição (reativa após desativação).
   *
   * TODO: Registrar log de reativação com timestamp
   */
  activate() {
    // TODO: implementar this.active = true
  }

  /**
   * Desativa esta inscrição sem removê-la do EventBus.
   * Eventos continuam sendo roteados, mas o handler não é invocado.
   *
   * TODO: Implementar this.active = false
   * TODO: Útil para pausar consumo durante operações críticas
   */
  deactivate() {
    // TODO: implementar this.active = false
  }

  /**
   * Verifica se esta inscrição está ativa.
   * @returns {boolean}
   */
  isActive() {
    // TODO: implementar
    return false;
  }

  /**
   * Serializa o Subscriber para log ou diagnóstico.
   * Nunca inclui o handler (não serializável).
   * @returns {Object}
   */
  toJSON() {
    // TODO: implementar sem expor this.handler
    return {};
  }
}
