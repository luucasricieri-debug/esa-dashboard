/**
 * ESA OS — Core / Logger
 * Logger
 *
 * Sistema de registro centralizado da plataforma ESA OS.
 * Ponto único de entrada para produção de logs em qualquer módulo.
 *
 * Responsabilidades:
 * - Receber registros de log de qualquer Domain, Service ou Core module
 * - Criar LogEntry estruturada para cada chamada
 * - Aplicar filtro por nível mínimo configurado
 * - Manter histórico em memória (ring buffer) para diagnóstico
 * - Despachar entradas para os destinos configurados via LogFormatter
 * - Prover métodos semânticos por nível (debug, info, warn, error, critical)
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não usa localStorage, sessionStorage ou Firebase.
 * Não integrado com Event Bus nem Audit nesta fase.
 */

import { LOG_LEVEL, LOG_LEVEL_RANK, isAtLeast } from './log-level.js';
import { LogEntry }                              from './log-entry.js';
import { LogFormatter }                          from './formatter.js';

/**
 * Capacidade máxima do histórico em memória.
 * Ao atingir o limite, as entradas mais antigas são descartadas (ring buffer).
 *
 * TODO: Tornar configurável via ESA_CORE_CONFIG
 */
const DEFAULT_HISTORY_LIMIT = 1000;

/** Mapeamento de nível para método nativo do console. */
const CONSOLE_METHOD = {
  DEBUG:    'debug',
  INFO:     'info',
  WARN:     'warn',
  ERROR:    'error',
  CRITICAL: 'error',
};

/**
 * Sistema de log centralizado da plataforma ESA OS.
 */
export class Logger {
  /**
   * @param {string}       source       - Identificador do módulo dono desta instância
   * @param {string}       minLevel     - Nível mínimo a registrar: LOG_LEVEL.*
   * @param {number}       historyLimit - Máximo de entradas mantidas em memória
   * @param {LogEntry[]}   [_shared]    - Array compartilhado (uso interno de child())
   * @param {LogFormatter} [_formatter] - Formatter compartilhado (uso interno de child())
   */
  constructor(source = 'ESA OS', minLevel = LOG_LEVEL.DEBUG, historyLimit = DEFAULT_HISTORY_LIMIT, _shared = null, _formatter = null) {
    /** @type {string} Módulo de origem padrão para todas as entradas desta instância */
    this.source = source;

    /** @type {string} Nível mínimo de log */
    this.minLevel = minLevel;

    /** @type {number} */
    this.historyLimit = historyLimit;

    /**
     * @type {LogEntry[]} Histórico em memória (ring buffer).
     * Quando _shared é fornecido, pai e filho compartilham o mesmo array.
     */
    this._entries = _shared || [];

    /** @type {LogFormatter} */
    this._formatter = _formatter || new LogFormatter();

    /**
     * @type {boolean} Controla se logs são despachados para o console.
     * TODO: Ativar por padrão apenas em ESA_ENVIRONMENTS.DEVELOPMENT
     */
    this._consoleEnabled = false;
  }

  // ── Métodos semânticos ────────────────────────────────────────────────────

  /**
   * Registra uma entrada DEBUG.
   * @param {string} message
   * @param {Object} context
   * @param {Object} metadata
   * @returns {LogEntry|null}
   */
  debug(message, context = {}, metadata = {}) {
    return this.log(LOG_LEVEL.DEBUG, message, context, metadata);
  }

  /**
   * Registra uma entrada INFO.
   * @param {string} message
   * @param {Object} context
   * @param {Object} metadata
   * @returns {LogEntry|null}
   */
  info(message, context = {}, metadata = {}) {
    return this.log(LOG_LEVEL.INFO, message, context, metadata);
  }

  /**
   * Registra uma entrada WARN.
   * @param {string} message
   * @param {Object} context
   * @param {Object} metadata
   * @returns {LogEntry|null}
   */
  warn(message, context = {}, metadata = {}) {
    return this.log(LOG_LEVEL.WARN, message, context, metadata);
  }

  /**
   * Registra uma entrada ERROR.
   * Inclui automaticamente errorMessage, errorName e errorStack no context
   * quando error é uma instância de Error. Não muta o context original.
   *
   * @param {string}     message
   * @param {Error|null} error
   * @param {Object}     context
   * @param {Object}     metadata
   * @returns {LogEntry|null}
   */
  error(message, error = null, context = {}, metadata = {}) {
    const ctx = error instanceof Error
      ? { ...context, errorMessage: error.message, errorName: error.name, errorStack: error.stack }
      : context;
    return this.log(LOG_LEVEL.ERROR, message, ctx, metadata);
  }

  /**
   * Registra uma entrada CRITICAL.
   * Inclui automaticamente errorMessage, errorName e errorStack no context
   * quando error é uma instância de Error. Não muta o context original.
   *
   * @param {string}     message
   * @param {Error|null} error
   * @param {Object}     context
   * @param {Object}     metadata
   * @returns {LogEntry|null}
   */
  critical(message, error = null, context = {}, metadata = {}) {
    const ctx = error instanceof Error
      ? { ...context, errorMessage: error.message, errorName: error.name, errorStack: error.stack }
      : context;
    return this.log(LOG_LEVEL.CRITICAL, message, ctx, metadata);
  }

  // ── Método base ───────────────────────────────────────────────────────────

  /**
   * Método base de registro. Todos os métodos semânticos delegam para cá.
   *
   * @param {string} level    - LOG_LEVEL.*
   * @param {string} message
   * @param {Object} context
   * @param {Object} metadata
   * @returns {LogEntry|null} - A entrada criada, ou null se filtrada pelo minLevel
   */
  log(level, message, context = {}, metadata = {}) {
    if (LOG_LEVEL_RANK[level] === undefined) {
      throw new Error(`[Logger] Unknown log level: "${level}"`);
    }
    if (message === null || message === undefined) {
      throw new Error('[Logger] message must not be null or undefined');
    }
    if (!isAtLeast(level, this.minLevel)) return null;

    const entry = new LogEntry(level, String(message), this.source, context, metadata);

    this._entries.push(entry);
    if (this._entries.length > this.historyLimit) this._entries.shift();

    if (this._consoleEnabled) {
      const formatted = this._formatter.formatForConsole(entry);
      const method = CONSOLE_METHOD[level] || 'log';
      console[method](formatted);
    }

    return entry;
  }

  // ── Histórico e diagnóstico ───────────────────────────────────────────────

  /**
   * Retorna as entradas do histórico em memória.
   * Ordenadas por timestamp DESC (mais recente primeiro).
   * Retorna cópia — não expõe o array interno.
   *
   * @param {string} [level] - Filtro opcional por nível (LOG_LEVEL.*)
   * @param {number} [limit] - Máximo de entradas (0 = sem limite)
   * @returns {LogEntry[]}
   */
  getEntries(level = '', limit = 0) {
    let result = this._entries.slice().reverse();
    if (level) result = result.filter((e) => e.level === level);
    if (limit > 0) result = result.slice(0, limit);
    return result;
  }

  /**
   * Retorna somente entradas ERROR e CRITICAL, ordenadas por timestamp DESC.
   * @returns {LogEntry[]}
   */
  getErrors() {
    return this._entries
      .slice()
      .reverse()
      .filter((e) => e.level === LOG_LEVEL.ERROR || e.level === LOG_LEVEL.CRITICAL);
  }

  /**
   * Limpa o histórico em memória.
   * Não registra novo log durante a limpeza.
   */
  clear() {
    this._entries.length = 0;
  }

  // ── Configuração ──────────────────────────────────────────────────────────

  /**
   * Define o nível mínimo de log desta instância.
   * @param {string} level - LOG_LEVEL.*
   */
  setMinLevel(level) {
    if (LOG_LEVEL_RANK[level] === undefined) {
      throw new Error(`[Logger] Unknown log level: "${level}"`);
    }
    this.minLevel = level;
  }

  /**
   * Ativa ou desativa a saída no console.
   * @param {boolean} enabled
   */
  setConsoleEnabled(enabled) {
    this._consoleEnabled = Boolean(enabled);
  }

  /**
   * Cria um Logger filho com source diferente.
   * O filho herda minLevel, historyLimit, formatter e _consoleEnabled.
   * Compartilha o mesmo array de histórico — logs do filho aparecem em
   * parent.getEntries() e vice-versa.
   *
   * @param {string} childSource
   * @returns {Logger}
   */
  child(childSource) {
    const c = new Logger(childSource, this.minLevel, this.historyLimit, this._entries, this._formatter);
    c._consoleEnabled = this._consoleEnabled;
    return c;
  }

  /**
   * Retorna snapshot de diagnóstico desta instância do Logger.
   * @returns {{ source, minLevel, entryCount, historyLimit, consoleEnabled, errorCount, criticalCount }}
   */
  getStats() {
    const errorCount    = this._entries.filter((e) => e.level === LOG_LEVEL.ERROR).length;
    const criticalCount = this._entries.filter((e) => e.level === LOG_LEVEL.CRITICAL).length;
    return {
      source:         this.source,
      minLevel:       this.minLevel,
      entryCount:     this._entries.length,
      historyLimit:   this.historyLimit,
      consoleEnabled: this._consoleEnabled,
      errorCount,
      criticalCount,
    };
  }
}
