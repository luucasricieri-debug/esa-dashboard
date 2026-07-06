/**
 * ESA OS — Core / Logger
 * Public API (Barrel Export)
 *
 * Ponto de entrada único do módulo de log do Core.
 * Consumidores externos devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { Logger, LogEntry, LogFormatter, LOG_LEVEL } from '@/core/logger';
 *   import { logger } from '@/core/logger';  // instância singleton da plataforma
 *
 * Para módulos que precisam de source próprio:
 *   import { logger } from '@/core/logger';
 *   const crmLogger = logger.child('CRMDomain');
 *
 * Responsabilidades:
 * - Re-exportar todas as classes e constantes públicas do módulo
 * - Expor a instância singleton do Logger para uso em toda a plataforma
 * - Manter API pública estável enquanto os internals evoluem
 * - Não conter lógica — apenas exports e singleton
 *
 * Arquitetura de integração futura:
 *   ESAApplication (app.js)
 *     └─ inicializa logger com configurações do ambiente
 *     └─ Domains usam logger.child('NomeDomain') para source rastreável
 *     └─ EventBus usa logger.child('EventBus') internamente
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * O singleton 'logger' não produz saída real nesta fase — todos os métodos são stubs.
 *
 * TODO: Conectar ao ESAApplication.initialize() para configurar minLevel por ambiente
 * TODO: Adicionar exports de transports quando implementados (ConsoleTransport, AuditTransport)
 * TODO: Versionar a API pública com CHANGELOG ao estabilizar
 */

export { LOG_LEVEL, LOG_LEVEL_RANK, LOG_LEVEL_META, isAtLeast }  from './log-level.js';
export { LogEntry }                                               from './log-entry.js';
export { LogFormatter }                                           from './formatter.js';
export { Logger }                                                 from './logger.js';

// ─── Singleton ───────────────────────────────────────────────────────────────

import { Logger }    from './logger.js';
import { LOG_LEVEL } from './log-level.js';

/**
 * Instância singleton do Logger da plataforma ESA OS.
 *
 * Use esta instância diretamente ou crie instâncias filhas via logger.child().
 * Nunca instancie Logger diretamente fora dos testes.
 *
 * TODO: Configurar minLevel com base em ESA_CURRENT_ENVIRONMENT (DEBUG em dev, WARN em prod)
 * TODO: Inicializar via ESAApplication ao invés de eager instantiation
 */
export const logger = new Logger('ESA OS', LOG_LEVEL.DEBUG);
