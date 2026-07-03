/**
 * ESA OS — Core / Events
 * Public API (Barrel Export)
 *
 * Ponto de entrada único do módulo de eventos do Core.
 * Consumidores externos devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { EventBus, Publisher, Subscriber, CoreEvent, EVENT_TYPES } from '@/core/events';
 *   import { eventBus } from '@/core/events';  // instância singleton
 *
 * Responsabilidades:
 * - Re-exportar todas as classes e constantes públicas do módulo
 * - Expor a instância singleton do EventBus para uso na plataforma
 * - Manter API pública estável enquanto os internals evoluem
 * - Não conter lógica — apenas exports e singleton
 *
 * Arquitetura de integração futura:
 *   ESAApplication (app.js)
 *     └─ inicializa eventBus
 *     └─ injeta eventBus nos Domains via Publisher
 *     └─ CRMDomain registra Subscribers no eventBus
 *     └─ IdentityDomain publica eventos no eventBus
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * O singleton 'eventBus' exportado não está vinculado a nenhum Domain ainda.
 *
 * TODO: Conectar o singleton ao ESAApplication.initialize() no bootstrap
 * TODO: Adicionar exports de middlewares de evento quando implementados
 * TODO: Versionar a API pública com CHANGELOG ao estabilizar
 */

export { CoreEvent, EVENT_TYPES }   from './event.js';
export { EventBus }                 from './event-bus.js';
export { Publisher }                from './publisher.js';
export { Subscriber }               from './subscriber.js';

// ─── Singleton ───────────────────────────────────────────────────────────────

import { EventBus } from './event-bus.js';

/**
 * Instância singleton do EventBus da plataforma ESA OS.
 *
 * Use esta instância em toda a plataforma para garantir
 * que todos os Domains compartilhem o mesmo barramento.
 *
 * TODO: Inicializar via ESAApplication ao invés de eager instantiation
 * TODO: Expor como window.ESA_OS.eventBus para diagnóstico em dev mode
 */
export const eventBus = new EventBus();
