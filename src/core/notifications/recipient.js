/**
 * ESA OS — Core / Notifications
 * NotificationRecipient
 *
 * Representa um destinatário de notificação na plataforma ESA OS.
 * Encapsula os dados de contato e os canais preferidos de entrega.
 *
 * Responsabilidades:
 * - Armazenar dados de contato do destinatário
 * - Definir quais canais estão disponíveis e habilitados para este destinatário
 * - Ser reutilizável em múltiplas notificações
 * - Preparar estrutura para opt-in / opt-out por canal
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não envia mensagens reais. Não acessa dados de usuários do sistema legado.
 */

import { NOTIFICATION_CHANNEL } from './notification-channel.js';

/**
 * Destinatário de uma notificação.
 */
export class NotificationRecipient {
  /**
   * @param {string}   personId       - UID da Person no Identity Domain
   * @param {string}   organizationId - ID da organização do destinatário
   * @param {string}   email          - Endereço de e-mail para canal EMAIL
   * @param {string}   phone          - Telefone para canais WHATSAPP e SMS
   * @param {string[]} channels       - Canais habilitados: NOTIFICATION_CHANNEL.*
   * @param {Object}   metadata       - Dados extras (preferências, fuso horário, idioma)
   */
  constructor(
    personId       = '',
    organizationId = '',
    email          = '',
    phone          = '',
    channels       = [NOTIFICATION_CHANNEL.IN_APP],
    metadata       = {}
  ) {
    this.personId       = personId;
    this.organizationId = organizationId;
    this.email          = email;
    this.phone          = phone;
    this.channels       = channels;
    this.metadata       = metadata;
  }

  /**
   * Verifica se este destinatário aceita um canal específico.
   * @param {string} channel - NOTIFICATION_CHANNEL.*
   * @returns {boolean}
   *
   * TODO: Verificar opt-out e horário de silêncio (Do Not Disturb)
   */
  acceptsChannel(channel) {
    // TODO: implementar
    return false;
  }

  /**
   * Adiciona um canal de entrega a este destinatário.
   * @param {string} channel
   *
   * TODO: Validar canal contra NOTIFICATION_CHANNEL antes de adicionar
   * TODO: Persistir preferência via IdentityDomain
   */
  addChannel(channel) {
    // TODO: implementar
  }

  /**
   * Remove um canal de entrega (opt-out).
   * @param {string} channel
   *
   * TODO: Registrar data do opt-out para compliance (LGPD)
   */
  removeChannel(channel) {
    // TODO: implementar
  }

  /**
   * Verifica se o destinatário possui dados mínimos para o canal informado.
   * @param {string} channel
   * @returns {boolean}
   *
   * TODO: EMAIL exige email não vazio; WHATSAPP/SMS exigem phone não vazio
   */
  hasContactFor(channel) {
    // TODO: implementar
    return false;
  }

  /**
   * Serializa o destinatário para transporte.
   * @returns {Object}
   *
   * TODO: Nunca serializar dados sensíveis além do necessário para entrega
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Cria um NotificationRecipient a partir de uma Person do Identity Domain.
   * @param {Person} person
   * @returns {NotificationRecipient}
   *
   * TODO: Extrair email, phone e channels das preferências da Person
   */
  static fromPerson(person) {
    // TODO: implementar
    return new NotificationRecipient();
  }
}
