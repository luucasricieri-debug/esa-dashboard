/**
 * ESA OS — Operations Domain
 * WorkOrderStatus
 *
 * Catálogo de status do ciclo de vida de uma WorkOrder.
 *
 * Responsabilidades:
 * - Definir todos os estados possíveis de uma ordem de serviço
 * - Classificar estados em: ativos, de fechamento e de espera
 * - Ser a única fonte de verdade sobre estados de WorkOrder
 *
 * Ciclo de vida principal:
 *   DRAFT → OPEN → SCHEDULED → DISPATCHED → ON_ROUTE → CHECKED_IN
 *        → IN_PROGRESS → [PAUSED | WAITING_*] → COMPLETED
 *                                              ↘ CANCELED
 *
 * IMPORTANTE:
 * Máquina de estados NÃO implementada nesta versão.
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 */

/**
 * Todos os estados possíveis de uma WorkOrder.
 */
export const WORK_ORDER_STATUS = {
  DRAFT:              'DRAFT',              // Rascunho — ainda não publicada
  OPEN:               'OPEN',              // Publicada, aguardando alocação
  SCHEDULED:          'SCHEDULED',          // Agendada com data/hora definida
  DISPATCHED:         'DISPATCHED',         // Equipe/técnico despachado ao local
  ON_ROUTE:           'ON_ROUTE',           // Equipe a caminho do cliente
  CHECKED_IN:         'CHECKED_IN',         // Técnico no local, ainda não iniciou
  IN_PROGRESS:        'IN_PROGRESS',        // Serviço em execução
  PAUSED:             'PAUSED',             // Pausado por decisão da equipe
  WAITING_CUSTOMER:   'WAITING_CUSTOMER',   // Aguardando ação do cliente
  WAITING_MATERIAL:   'WAITING_MATERIAL',   // Aguardando material/peça
  WAITING_APPROVAL:   'WAITING_APPROVAL',   // Aguardando aprovação interna
  COMPLETED:          'COMPLETED',          // Concluída com sucesso
  CANCELED:           'CANCELED',           // Cancelada
};

/**
 * Estados que representam encerramento da WorkOrder (positivo ou negativo).
 * Não aceita mais transições após atingir estes estados.
 *
 * TODO: Usar em validações de transição na máquina de estados
 */
export const CLOSED_STATUSES = [
  WORK_ORDER_STATUS.COMPLETED,
  WORK_ORDER_STATUS.CANCELED,
];

/**
 * Estados em que a WorkOrder está aguardando algo externo.
 * Podem ser retomados automaticamente quando a condição é resolvida.
 *
 * TODO: Usar em alertas de SLA e dashboards de operação
 */
export const WAITING_STATUSES = [
  WORK_ORDER_STATUS.WAITING_CUSTOMER,
  WORK_ORDER_STATUS.WAITING_MATERIAL,
  WORK_ORDER_STATUS.WAITING_APPROVAL,
];

/**
 * Estados em que a WorkOrder está com equipe alocada e em campo.
 *
 * TODO: Usar em mapa de operações em tempo real
 */
export const FIELD_STATUSES = [
  WORK_ORDER_STATUS.DISPATCHED,
  WORK_ORDER_STATUS.ON_ROUTE,
  WORK_ORDER_STATUS.CHECKED_IN,
  WORK_ORDER_STATUS.IN_PROGRESS,
  WORK_ORDER_STATUS.PAUSED,
];

/**
 * Todos os estados considerados ativos (não fechados).
 *
 * TODO: Usar em queries de WorkOrders abertas
 */
export const ACTIVE_STATUSES = Object.values(WORK_ORDER_STATUS).filter(
  (s) => !CLOSED_STATUSES.includes(s),
);

/**
 * Verifica se um status representa encerramento da WorkOrder.
 * @param {string} status - WORK_ORDER_STATUS.*
 * @returns {boolean}
 *
 * TODO: Implementar
 */
export function isClosedStatus(status) {
  // TODO: implementar
  return false;
}

/**
 * Verifica se um status representa uma WorkOrder ativa.
 * @param {string} status - WORK_ORDER_STATUS.*
 * @returns {boolean}
 *
 * TODO: Implementar
 */
export function isActiveStatus(status) {
  // TODO: implementar
  return false;
}

/**
 * Verifica se um status representa estado de espera.
 * @param {string} status - WORK_ORDER_STATUS.*
 * @returns {boolean}
 *
 * TODO: Implementar
 */
export function isWaitingStatus(status) {
  // TODO: implementar
  return false;
}
