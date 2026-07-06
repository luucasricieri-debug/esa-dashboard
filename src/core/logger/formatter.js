/**
 * ESA OS — Core / Logger
 * LogFormatter
 *
 * Responsável por transformar entradas de log (LogEntry) em
 * representações específicas para cada destino de saída.
 *
 * Responsabilidades:
 * - Formatar logs para exibição no console (desenvolvimento)
 * - Formatar logs para escrita em arquivo (produção)
 * - Formatar logs para trilha de auditoria (compliance)
 * - Preparar payload para análise pela Solana IA (futuro)
 * - Formatar para envio a ferramentas externas de monitoramento (Sentry, Datadog)
 *
 * Cada método de formatação é independente e sem efeitos colaterais.
 * O Formatter apenas transforma dados — nunca escreve, envia ou persiste.
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Nenhum método aqui produz saída real. Apenas modela a transformação.
 */

import { LOG_LEVEL_META } from './log-level.js';

/** Chaves cujos valores devem ser substituídos por [REDACTED] (case-insensitive). */
const SENSITIVE_KEYS = ['password', 'pass', 'passhash', 'token', 'secret', 'apikey', 'authorization'];

/** Mapeamento de LOG_LEVEL para severity de monitoramento externo. */
const SEVERITY_MAP = {
  CRITICAL: 'fatal',
  ERROR:    'error',
  WARN:     'warning',
  INFO:     'info',
  DEBUG:    'debug',
};

/**
 * Formata entradas de log para diferentes destinos de saída.
 */
export class LogFormatter {
  /**
   * @param {Object}  options
   * @param {boolean} options.includeTimestamp - Incluir timestamp nas saídas (padrão: true)
   * @param {boolean} options.includeSource    - Incluir source nas saídas (padrão: true)
   * @param {boolean} options.includeId        - Incluir id da entrada nas saídas (padrão: false)
   * @param {string}  options.timestampFormat  - 'iso' | 'locale' | 'ms'
   */
  constructor(options = {}) {
    this.options = {
      includeTimestamp: true,
      includeSource:    true,
      includeId:        false,
      timestampFormat:  'iso',
      ...options,
    };
  }

  /**
   * Formata uma LogEntry para exibição no console do browser/Node.
   * Formato: [LEVEL] TIMESTAMP [SOURCE] MESSAGE
   * @param {LogEntry} entry
   * @returns {string}
   */
  formatForConsole(entry) {
    const parts = [];
    if (this.options.includeId) parts.push(`(${entry.id})`);
    parts.push(`[${entry.level}]`);
    if (this.options.includeTimestamp) parts.push(this._formatTimestamp(entry.timestamp));
    if (this.options.includeSource && entry.source) parts.push(`[${entry.source}]`);
    parts.push(entry.message);
    return parts.join(' ');
  }

  /**
   * Formata uma LogEntry para escrita em arquivo de log (linha única, sem cores).
   * Formato: TIMESTAMP | LEVEL | SOURCE | MESSAGE | CONTEXT_JSON
   * @param {LogEntry} entry
   * @returns {string}
   */
  formatForFile(entry) {
    const ts  = this._formatTimestamp(entry.timestamp);
    const msg = String(entry.message).replace(/\r?\n/g, ' ');
    const ctx = this._serializeContext(entry.context);
    return `${ts} | ${entry.level} | ${entry.source || ''} | ${msg} | ${ctx}`;
  }

  /**
   * Formata uma LogEntry para registro na trilha de auditoria.
   * Retorna objeto estruturado com todos os campos relevantes para compliance.
   * @param {LogEntry} entry
   * @returns {Object}
   */
  formatForAudit(entry) {
    return {
      id:        entry.id,
      timestamp: entry.timestamp,
      level:     entry.level,
      message:   entry.message,
      source:    entry.source,
      context:   entry.context,
      metadata:  entry.metadata,
    };
  }

  /**
   * Prepara payload de uma LogEntry para análise pela Solana IA.
   * @param {LogEntry} entry
   * @returns {Object}
   */
  formatForIA(entry) {
    return {
      severity:  entry.level.toLowerCase(),
      message:   entry.message,
      source:    entry.source,
      context:   entry.context,
      timestamp: entry.timestamp,
    };
  }

  /**
   * Formata uma LogEntry para envio a ferramentas externas de monitoramento.
   * Estrutura compatível com formato comum (Sentry, Datadog, New Relic).
   * @param {LogEntry} entry
   * @returns {Object}
   */
  formatForMonitoring(entry) {
    return {
      eventId:   entry.id,
      level:     entry.level,
      severity:  SEVERITY_MAP[entry.level] || 'info',
      message:   entry.message,
      source:    entry.source,
      timestamp: entry.timestamp,
      tags:      { source: entry.source, level: entry.level },
      extra:     entry.context,
    };
  }

  /**
   * Formata o timestamp conforme options.timestampFormat.
   * Suporta: 'iso' (toISOString), 'locale' (pt-BR), 'ms' (raw ms)
   * @param {number} timestamp
   * @returns {string}
   * @private
   */
  _formatTimestamp(timestamp) {
    const fmt = this.options.timestampFormat;
    if (fmt === 'ms')     return String(timestamp);
    if (fmt === 'locale') return new Date(timestamp).toLocaleString('pt-BR');
    return new Date(timestamp).toISOString();
  }

  /**
   * Serializa o context de forma segura, removendo campos sensíveis.
   * Sanitização recursiva — suporta objetos e arrays aninhados.
   * Não muta o objeto original.
   * @param {Object} context
   * @returns {string} JSON string
   * @private
   */
  _serializeContext(context) {
    if (context === null || context === undefined) return '{}';

    const sanitize = (val) => {
      if (val === null || val === undefined) return val;
      if (Array.isArray(val)) return val.map(sanitize);
      if (typeof val === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(val)) {
          out[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? '[REDACTED]' : sanitize(v);
        }
        return out;
      }
      return val;
    };

    try {
      return JSON.stringify(sanitize(context));
    } catch {
      return '{}';
    }
  }
}
