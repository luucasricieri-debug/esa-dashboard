/**
 * ESA OS — Core / Notifications
 * NotificationChannel
 *
 * Catálogo de canais de entrega de notificações da plataforma ESA OS.
 *
 * Responsabilidades:
 * - Definir os canais disponíveis para entrega de notificações
 * - Prover metadados de cada canal para decisão de roteamento
 * - Ser a única fonte de verdade — nunca usar strings literais
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Nenhuma integração real com qualquer canal está implementada aqui.
 */

/**
 * Canais de entrega disponíveis na plataforma.
 *
 * TODO: Habilitar canais progressivamente conforme integrações forem implementadas
 * TODO: Permitir que cada Organization configure quais canais estão ativos
 */
export const NOTIFICATION_CHANNEL = {
  IN_APP:   'IN_APP',    // Notificação dentro da plataforma (bell icon, feed)
  EMAIL:    'EMAIL',     // Envio por e-mail (SMTP / SendGrid)
  WHATSAPP: 'WHATSAPP',  // Mensagem via WhatsApp Business API
  SMS:      'SMS',       // SMS via Twilio ou similar
  PUSH:     'PUSH',      // Push notification (browser / mobile PWA)
  SOLANA:   'SOLANA',    // Notificação via Solana IA (chat proativo)
};

/**
 * Status de implementação de cada canal.
 * Usado para bloquear envio por canais ainda não disponíveis.
 *
 * TODO: Remover quando todos os canais estiverem implementados
 */
export const CHANNEL_AVAILABILITY = {
  [NOTIFICATION_CHANNEL.IN_APP]:   'planned',
  [NOTIFICATION_CHANNEL.EMAIL]:    'planned',
  [NOTIFICATION_CHANNEL.WHATSAPP]: 'planned',
  [NOTIFICATION_CHANNEL.SMS]:      'planned',
  [NOTIFICATION_CHANNEL.PUSH]:     'planned',
  [NOTIFICATION_CHANNEL.SOLANA]:   'planned',
};
