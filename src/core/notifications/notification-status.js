/**
 * ESA OS — Core / Notifications
 * NotificationStatus
 *
 * Catálogo de status do ciclo de vida de uma notificação na plataforma ESA OS.
 *
 * Responsabilidades:
 * - Definir todos os estados possíveis de uma Notification
 * - Prover rank numérico para verificação de progressão
 * - Ser a única fonte de verdade sobre estados de notificação
 *
 * Ciclo de vida:
 *   PENDING → QUEUED → SENT → DELIVERED → READ
 *                          ↘ FAILED
 *   (qualquer estado antes de SENT) → CANCELED
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não altera nenhum comportamento da aplicação em produção.
 */

/**
 * Status possíveis de uma Notification ao longo do ciclo de entrega.
 *
 * TODO: Adicionar EXPIRED para notificações com scheduledAt vencido sem envio
 */
export const NOTIFICATION_STATUS = {
  PENDING:   'PENDING',    // Criada, aguardando ser colocada na fila
  QUEUED:    'QUEUED',     // Na fila de envio, aguardando processamento
  SENT:      'SENT',       // Despachada ao canal — sem confirmação de entrega
  DELIVERED: 'DELIVERED',  // Confirmação de entrega recebida do canal
  READ:      'READ',       // Destinatário abriu ou visualizou a notificação
  FAILED:    'FAILED',     // Falha no envio — ver metadata para diagnóstico
  CANCELED:  'CANCELED',   // Cancelada antes do envio
};

/**
 * Rank numérico de progressão do status.
 * Permite verificar se um status é posterior a outro.
 *
 * TODO: Usar em NotificationCenter para bloquear transições inválidas
 */
export const NOTIFICATION_STATUS_RANK = {
  [NOTIFICATION_STATUS.PENDING]:   0,
  [NOTIFICATION_STATUS.QUEUED]:    1,
  [NOTIFICATION_STATUS.SENT]:      2,
  [NOTIFICATION_STATUS.DELIVERED]: 3,
  [NOTIFICATION_STATUS.READ]:      4,
  [NOTIFICATION_STATUS.FAILED]:    2,
  [NOTIFICATION_STATUS.CANCELED]:  1,
};

/**
 * Verifica se um status representa um estado terminal (sem progressão possível).
 * @param {string} status - NOTIFICATION_STATUS.*
 * @returns {boolean}
 *
 * TODO: Usar em NotificationCenter para bloquear ações em notificações terminais
 */
export function isTerminalStatus(status) {
  // TODO: implementar
  return false;
}
