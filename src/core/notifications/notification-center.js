/**
 * ESA OS — Core / Notifications
 * NotificationCenter (Facade)
 *
 * Fachada principal do módulo de notificações da plataforma ESA OS.
 * É o único ponto de entrada para criar, enviar e gerenciar notificações.
 *
 * Responsabilidades:
 * - Criar Notification a partir de parâmetros simples
 * - Rotear notificações para os canais corretos (IN_APP, EMAIL, WHATSAPP, etc.)
 * - Gerenciar fila de envio e notificações agendadas
 * - Prover feed de notificações por destinatário
 * - NÃO enviar mensagens reais — toda integração com canais externos é stub
 *
 * Padrão: Facade
 * Consumo: import { notificationCenter } from 'src/core/notifications/index.js'
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não envia WhatsApp, e-mail, SMS ou push real.
 * Não altere nenhum arquivo existente.
 */

import { Notification } from './notification.js';
import { NotificationRecipient } from './recipient.js';
import { NOTIFICATION_CHANNEL } from './notification-channel.js';
import { NOTIFICATION_STATUS } from './notification-status.js';

/**
 * Limite máximo de notificações mantidas em memória por destinatário.
 *
 * TODO: Mover para src/core/config.js quando integrado
 */
const DEFAULT_FEED_LIMIT = 200;

/**
 * Facade de notificações do ESA OS.
 * Instanciada como singleton no index.js.
 */
export class NotificationCenter {
  constructor() {
    /** @type {Notification[]} Todas as notificações em memória */
    this._notifications = [];

    /** @type {number} Limite total do feed */
    this._feedLimit = DEFAULT_FEED_LIMIT;
  }

  /**
   * Cria uma nova notificação e a adiciona à fila.
   *
   * @param {string}                  type        - Tipo semântico (ex: 'crm:deal:stage-changed')
   * @param {string}                  title       - Título
   * @param {string}                  message     - Corpo da notificação
   * @param {NotificationRecipient[]} recipients  - Destinatários
   * @param {Object}                  options     - Opções opcionais (channels, priority, source, metadata)
   * @returns {Notification}
   *
   * TODO: Validar recipients não vazio antes de criar
   * TODO: Adicionar à _notifications respeitando _feedLimit
   * TODO: Retornar a Notification criada para que o chamador possa rastrear o ID
   */
  create(type, title, message, recipients = [], options = {}) {
    // TODO: implementar
    return new Notification(type, title, message);
  }

  /**
   * Envia uma notificação imediatamente.
   * Despacha para cada canal de cada destinatário.
   *
   * @param {Notification} notification
   * @returns {Promise<void>}
   *
   * TODO: Para cada recipient, verificar acceptsChannel() e hasContactFor()
   * TODO: Rotear para handler do canal (IN_APP = armazenar; demais = stub)
   * TODO: Marcar notification.markAsSent() após despacho
   * TODO: Em caso de falha por canal, marcar notification.markAsFailed()
   * TODO: NUNCA enviar mensagem real — handlers de canal são todos stubs
   */
  async send(notification) {
    // TODO: implementar
  }

  /**
   * Agenda uma notificação para envio futuro.
   *
   * @param {Notification} notification
   * @param {number}       sendAt - Timestamp de envio (ms)
   * @returns {Notification}
   *
   * TODO: Setar notification.scheduledAt = sendAt
   * TODO: Adicionar à fila de agendados (implementar scheduler futuramente)
   * TODO: Status deve permanecer PENDING até o momento do envio
   */
  schedule(notification, sendAt) {
    // TODO: implementar
    return notification;
  }

  /**
   * Cancela uma notificação antes do envio.
   *
   * @param {string} notificationId - ID da notificação a cancelar
   * @param {string} [reason]
   * @returns {boolean} - true se cancelada com sucesso
   *
   * TODO: Localizar notificação pelo ID
   * TODO: Validar que não está em status terminal
   * TODO: Chamar notification.cancel(reason)
   */
  cancel(notificationId, reason = '') {
    // TODO: implementar
    return false;
  }

  /**
   * Marca uma notificação como lida por um destinatário.
   *
   * @param {string} notificationId
   * @param {string} personId       - Quem leu
   * @returns {boolean}
   *
   * TODO: Localizar notificação e chamar notification.markAsRead(personId)
   */
  markAsRead(notificationId, personId) {
    // TODO: implementar
    return false;
  }

  /**
   * Retorna todas as notificações, com filtros opcionais.
   *
   * @param {Object} filters
   * @param {string} [filters.type]     - Filtrar por tipo semântico
   * @param {string} [filters.status]   - Filtrar por NOTIFICATION_STATUS.*
   * @param {string} [filters.source]   - Filtrar por módulo de origem
   * @param {number} [limit=50]
   * @returns {Notification[]}
   *
   * TODO: Aplicar filtros e retornar ordenado por createdAt DESC
   */
  getNotifications(filters = {}, limit = 50) {
    // TODO: implementar
    return [];
  }

  /**
   * Retorna notificações não lidas (status !== READ e !== CANCELED e !== FAILED).
   *
   * @param {number} [limit=20]
   * @returns {Notification[]}
   *
   * TODO: Delegar para getNotifications({ status: não-terminal, não-lida })
   */
  getUnread(limit = 20) {
    // TODO: implementar
    return [];
  }

  /**
   * Retorna todas as notificações de um destinatário específico.
   *
   * @param {string} personId
   * @param {number} [limit=50]
   * @returns {Notification[]}
   *
   * TODO: Filtrar notificações onde recipients contém personId
   */
  getByRecipient(personId, limit = 50) {
    // TODO: implementar
    return [];
  }

  /**
   * Retorna notificações aguardando envio (status PENDING ou QUEUED).
   *
   * @returns {Notification[]}
   *
   * TODO: Delegar para getNotifications({ status: PENDING | QUEUED })
   * TODO: Retornar ordenado por priority DESC, createdAt ASC
   */
  getPending() {
    // TODO: implementar
    return [];
  }

  /**
   * Retorna estatísticas do centro de notificações.
   * @returns {Object}
   *
   * TODO: Retornar: total, unreadCount, pendingCount, byStatus (mapa status → count), byChannel (mapa channel → count)
   */
  getStats() {
    // TODO: implementar
    return {};
  }
}
