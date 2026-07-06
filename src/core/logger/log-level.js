/**
 * ESA OS — Core / Logger
 * LogLevel
 *
 * Catálogo de níveis de severidade para o sistema de log da plataforma ESA OS.
 * Define a escala de criticidade e os metadados de exibição de cada nível.
 *
 * Responsabilidades:
 * - Centralizar a definição dos níveis de log disponíveis
 * - Prover valor numérico para comparação de severidade
 * - Prover label e cor para formatação visual
 * - Ser a única fonte de verdade sobre níveis — nunca usar strings literais
 *
 * Escala de severidade (crescente):
 *   DEBUG (0) → INFO (1) → WARN (2) → ERROR (3) → CRITICAL (4)
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não altera nenhum comportamento da aplicação em produção.
 */

/**
 * Enumeração dos níveis de log disponíveis na plataforma.
 *
 * TODO: Tornar o nível mínimo de log configurável via ESA_CORE_CONFIG
 * TODO: Suportar nível OFF (desabilitar logs por completo em produção se necessário)
 */
export const LOG_LEVEL = {
  /**
   * DEBUG (0) — Detalhes verbosos para diagnóstico em desenvolvimento.
   * Nunca deve aparecer em produção.
   * Ex: valores de variáveis intermediárias, fluxo de execução passo a passo.
   */
  DEBUG: 'DEBUG',

  /**
   * INFO (1) — Eventos normais do ciclo de vida da aplicação.
   * Ex: módulo inicializado, usuário autenticado, deal criado.
   */
  INFO: 'INFO',

  /**
   * WARN (2) — Situações inesperadas que não interrompem a operação.
   * Ex: configuração ausente com fallback aplicado, sessão próxima do vencimento.
   */
  WARN: 'WARN',

  /**
   * ERROR (3) — Falhas que afetam uma operação específica.
   * Ex: falha ao salvar deal, timeout de requisição, permissão negada.
   */
  ERROR: 'ERROR',

  /**
   * CRITICAL (4) — Falhas que comprometem a estabilidade da plataforma.
   * Ex: Event Bus não inicializado, perda de conexão com Firebase, erro fatal no boot.
   * TODO: Integrar com sistema de alertas externo (PagerDuty, Slack) quando disponível.
   */
  CRITICAL: 'CRITICAL',
};

/**
 * Valor numérico de cada nível para comparação de severidade.
 * Quanto maior o número, mais crítico o evento.
 *
 * Uso: LOG_LEVEL_RANK[LOG_LEVEL.ERROR] > LOG_LEVEL_RANK[LOG_LEVEL.INFO] // true
 */
export const LOG_LEVEL_RANK = {
  [LOG_LEVEL.DEBUG]:    0,
  [LOG_LEVEL.INFO]:     1,
  [LOG_LEVEL.WARN]:     2,
  [LOG_LEVEL.ERROR]:    3,
  [LOG_LEVEL.CRITICAL]: 4,
};

/**
 * Metadados de exibição para cada nível.
 * Usados pelo LogFormatter ao renderizar logs no console ou em UI.
 *
 * TODO: Suportar temas customizados por ambiente (dark mode, high contrast)
 */
export const LOG_LEVEL_META = {
  [LOG_LEVEL.DEBUG]: {
    label:  'DEBUG',
    color:  '#6C757D',
    prefix: '🔍',
  },
  [LOG_LEVEL.INFO]: {
    label:  'INFO',
    color:  '#0D6EFD',
    prefix: 'ℹ️',
  },
  [LOG_LEVEL.WARN]: {
    label:  'WARN',
    color:  '#FFC107',
    prefix: '⚠️',
  },
  [LOG_LEVEL.ERROR]: {
    label:  'ERROR',
    color:  '#DC3545',
    prefix: '❌',
  },
  [LOG_LEVEL.CRITICAL]: {
    label:  'CRITICAL',
    color:  '#6F0000',
    prefix: '🚨',
  },
};

/**
 * Verifica se um nível é igual ou mais severo que o nível de referência.
 * @param {string} level     - Nível a verificar (LOG_LEVEL.*)
 * @param {string} threshold - Nível mínimo de referência
 * @returns {boolean}
 * @throws {Error} Se level ou threshold forem desconhecidos
 */
export function isAtLeast(level, threshold) {
  if (LOG_LEVEL_RANK[level] === undefined) {
    throw new Error(`[isAtLeast] Unknown log level: "${level}"`);
  }
  if (LOG_LEVEL_RANK[threshold] === undefined) {
    throw new Error(`[isAtLeast] Unknown threshold level: "${threshold}"`);
  }
  return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[threshold];
}
