/**
 * ESA OS — Core / Notifications
 * Barrel export + singleton
 *
 * Ponto de entrada público do módulo de notificações.
 * Consumidores devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { notificationCenter, Notification, NotificationRecipient } from 'src/core/notifications/index.js'
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 */

export { NOTIFICATION_CHANNEL, CHANNEL_AVAILABILITY }   from './notification-channel.js';
export { NOTIFICATION_STATUS, NOTIFICATION_STATUS_RANK,
         isTerminalStatus }                              from './notification-status.js';
export { NotificationRecipient }                        from './recipient.js';
export { Notification, NOTIFICATION_PRIORITY }          from './notification.js';
export { NotificationCenter }                           from './notification-center.js';

import { NotificationCenter } from './notification-center.js';

/**
 * Singleton do centro de notificações do ESA OS.
 * Use este objeto em todos os módulos do ESA OS.
 *
 * @type {NotificationCenter}
 */
export const notificationCenter = new NotificationCenter();
