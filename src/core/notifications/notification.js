/**
 * ESA OS — Core / Notifications
 * Notification
 *
 * Representa uma notificação na plataforma ESA OS.
 * É a entidade central do módulo de notificações.
 *
 * Responsabilidades:
 * - Modelar todos os dados de uma notificação (conteúdo, destinatários, canais)
 * - Gerenciar o ciclo de vida (PENDING → SENT → READ / FAILED)
 * - Suportar envio imediato e agendado
 * - Ser agnóstica ao canal — o roteamento é responsabilidade do NotificationCenter
 *
 * Casos de uso previstos:
 *   CRM      → "Deal movido para Negociação"
 *   Agenda   → "Reunião em 30 minutos"
 *   Engenharia → "Laudo técnico disponível"
 *   Financeiro → "Pagamento recebido"
 *   SLA      → "Deal sem atividade há 7 dias"
 *   Solana IA → Mensagem proativa da consultora
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não envia mensagens reais. Não integra com WhatsApp, e-mail ou Solana.
 */

import { NOTIFICATION_STATUS } from './notification-status.js';
import { NOTIFICATION_CHANNEL } from './notification-channel.js';

/**
 * Prioridade de entrega de uma notificação.
 *
 * TODO: Usar prioridade para ordenação na fila e no feed IN_APP
 */
export const NOTIFICATION_PRIORITY = {
  LOW:      'LOW',
  NORMAL:   'NORMAL',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
};

/**
 * Representa uma notificação da plataforma ESA OS.
 */
export class Notification {
  /**
   * @param {string}                   type        - Tipo semântico (ex: 'crm:deal:stage-changed')
   * @param {string}                   title       - Título curto exibido no feed
   * @param {string}                   message     - Corpo da notificação
   * @param {NotificationRecipient[]}  recipients  - Destinatários
   * @param {string[]}                 channels    - Canais de entrega: NOTIFICATION_CHANNEL.*
   * @param {string}                   priority    - NOTIFICATION_PRIORITY.*
   * @param {string}                   source      - Módulo de origem (ex: 'CRMDomain')
   * @param {number|null}              scheduledAt - Timestamp de envio agendado (null = imediato)
   * @param {Object}                   metadata    - Dados extras (dealId, eventId, correlationId)
   */
  constructor(
    type,
    title,
    message,
    recipients  = [],
    channels    = [NOTIFICATION_CHANNEL.IN_APP],
    priority    = NOTIFICATION_PRIORITY.NORMAL,
    source      = '',
    scheduledAt = null,
    metadata    = {}
  ) {
    /** @type {string} */
    this.id = Notification._generateId();

    this.type       = type;
    this.title      = title;
    this.message    = message;
    this.recipients = recipients;
    this.channels   = channels;
    this.priority   = priority;
    this.source     = source;
    this.scheduledAt = scheduledAt;
    this.metadata   = metadata;

    /** @type {string} Status inicial */
    this.status    = NOTIFICATION_STATUS.PENDING;

    /** @type {number} */
    this.createdAt = Date.now();

    /** @type {number|null} Preenchido quando despachada ao canal */
    this.sentAt    = null;
  }

  /**
   * Verifica se a notificação está agendada para o futuro.
   * @returns {boolean}
   *
   * TODO: Comparar scheduledAt com Date.now()
   */
  isScheduled() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se a notificação atingiu um estado terminal.
   * @returns {boolean}
   *
   * TODO: Delegar para isTerminalStatus(this.status)
   */
  isTerminal() {
    // TODO: implementar
    return false;
  }

  /**
   * Marca a notificação como enviada.
   *
   * TODO: Setar status = SENT e sentAt = Date.now()
   * TODO: Disparar evento 'notification:sent' no EventBus quando integrado
   */
  markAsSent() {
    // TODO: implementar
  }

  /**
   * Marca a notificação como lida pelo destinatário.
   * @param {string} personId - Quem leu
   *
   * TODO: Setar status = READ
   * TODO: Registrar qual destinatário leu (para notificações multi-destinatário)
   */
  markAsRead(personId = '') {
    // TODO: implementar
  }

  /**
   * Cancela a notificação antes do envio.
   * @param {string} reason
   *
   * TODO: Validar que status é PENDING ou QUEUED antes de cancelar
   * TODO: Setar status = CANCELED
   */
  cancel(reason = '') {
    // TODO: implementar
  }

  /**
   * Registra falha na entrega.
   * @param {string} errorDetail
   *
   * TODO: Setar status = FAILED e armazenar errorDetail em metadata
   * TODO: Incrementar contador de tentativas para retry futuro
   */
  markAsFailed(errorDetail = '') {
    // TODO: implementar
  }

  /**
   * Serializa a notificação para persistência ou transporte.
   * @returns {Object}
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói uma Notification a partir de objeto serializado.
   * @param {Object} data
   * @returns {Notification}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Notification('', '', '');
  }

  /**
   * @returns {string}
   * @private
   * TODO: Usar crypto.randomUUID() quando disponível
   */
  static _generateId() {
    // TODO: implementar
    return '';
  }
}
