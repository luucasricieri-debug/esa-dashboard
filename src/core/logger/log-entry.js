/**
 * ESA OS — Core / Logger
 * LogEntry
 *
 * Representa um registro de log imutável da plataforma ESA OS.
 * É a unidade fundamental transportada pelo sistema de log.
 *
 * Responsabilidades:
 * - Armazenar todos os dados de um evento de log em estrutura coesa
 * - Identificar a origem (source) e o nível de severidade
 * - Carregar contexto estruturado para diagnóstico e auditoria
 * - Ser serializável para persistência, transporte e formatação
 * - Ser imutável após construção — logs são fatos, não estados mutáveis
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não grava nada em console, storage ou rede. Apenas modela o dado.
 */

import { LOG_LEVEL, LOG_LEVEL_RANK } from './log-level.js';

/**
 * Representa uma entrada de log imutável.
 */
export class LogEntry {
  /**
   * @param {string} level     - Severidade: LOG_LEVEL.*
   * @param {string} message   - Mensagem principal legível por humanos
   * @param {string} source    - Módulo ou classe de origem (ex: 'CRMDomain', 'EventBus')
   * @param {Object} context   - Dados estruturados relevantes ao evento
   * @param {Object} metadata  - Dados extras para rastreabilidade (correlationId, traceId, userId)
   */
  constructor(level, message, source = '', context = {}, metadata = {}) {
    /** @type {string} Identificador único desta entrada de log */
    this.id = LogEntry._generateId();

    /** @type {string} Nível de severidade: LOG_LEVEL.* */
    this.level = level;

    /** @type {string} Mensagem descritiva do evento */
    this.message = message;

    /** @type {string} Módulo ou classe que gerou o log */
    this.source = source;

    /**
     * @type {Object} Dados estruturados adicionais.
     * TODO: Sanitizar campos sensíveis (senhas, tokens) antes de armazenar
     */
    this.context = context;

    /**
     * @type {number} Timestamp em milissegundos desde epoch (imutável após criação).
     * Registrado no momento da construção, não do despacho.
     */
    this.timestamp = Date.now();

    /**
     * @type {Object} Metadados de rastreamento transversal.
     * Campos sugeridos: correlationId, traceId, userId, requestId, sessionId
     *
     * TODO: Propagar correlationId entre entradas causalmente relacionadas
     */
    this.metadata = metadata;
  }

  /**
   * Verifica se esta entrada é de um nível específico.
   * @param {string} level - LOG_LEVEL.*
   * @returns {boolean}
   */
  isLevel(level) {
    return this.level === level;
  }

  /**
   * Verifica se esta entrada é de severidade ERROR ou CRITICAL.
   * @returns {boolean}
   */
  isCriticalOrError() {
    return LOG_LEVEL_RANK[this.level] >= LOG_LEVEL_RANK[LOG_LEVEL.ERROR];
  }

  /**
   * Retorna a idade desta entrada em milissegundos.
   * @returns {number}
   */
  getAgeMs() {
    return Date.now() - this.timestamp;
  }

  /**
   * Serializa a entrada para objeto plano.
   * Usado pelo LogFormatter e por integrações de persistência.
   * @returns {Object}
   */
  toJSON() {
    return {
      id:        this.id,
      level:     this.level,
      message:   this.message,
      source:    this.source,
      context:   this.context,
      timestamp: this.timestamp,
      metadata:  this.metadata,
    };
  }

  /**
   * Reconstrói uma LogEntry a partir de objeto serializado.
   * Preserva id e timestamp originais — não gera novos.
   * @param {Object} data
   * @returns {LogEntry}
   */
  static fromJSON(data) {
    const entry = new LogEntry(
      data.level    || LOG_LEVEL.INFO,
      data.message  || '',
      data.source   || '',
      data.context  || {},
      data.metadata || {},
    );
    entry.id        = data.id        || entry.id;
    entry.timestamp = data.timestamp || entry.timestamp;
    return entry;
  }

  /**
   * Gera um identificador único para a entrada.
   * Usa crypto.randomUUID() quando disponível; fallback para ambientes sem suporte.
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
