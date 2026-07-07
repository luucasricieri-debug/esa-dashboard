/**
 * ESA OS — Legacy Bridge
 * CRMLegacyEventBridge
 *
 * Traduz chamadas do CRM legado (index.html) para CoreEvents da ESA OS.
 * Permite que o código legado alimente o Event Bus sem acoplamento direto.
 *
 * Responsabilidades:
 * - Validar os dados recebidos do CRM legado antes de publicar
 * - Criar o CoreEvent com o vocabulário canônico da ESA OS
 * - Publicar no Event Bus via dependency injection
 * - Não acessar Firebase, Audit, CRMAuditIntegration ou globais do index.html
 *
 * Padrão: Adapter / Bridge
 * Instanciação: via ESAApplication.initialize() com injeção de eventBus
 * Exposição: window.ESA_OS.crmLegacyBridge
 *
 * IMPORTANTE:
 * Este arquivo NÃO tem acesso direto ao Dashboard legado.
 * Uma falha aqui nunca deve interromper a operação do CRM legado.
 */

import { CoreEvent } from '../core/events/event.js';

/**
 * Bridge entre o CRM legado e o Event Bus da ESA OS.
 */
export class CRMLegacyEventBridge {
  /**
   * @param {EventBus} eventBus - Instância do EventBus da ESA OS (injetada)
   */
  constructor(eventBus) {
    this._eventBus = eventBus;
  }

  /**
   * Publica um evento de mudança de etapa de Deal no Event Bus.
   *
   * Só publica quando fromStage !== toStage.
   * O evento é publicado APÓS o save do Firebase ter sido confirmado pelo chamador.
   *
   * @param {Object} data
   * @param {string} data.dealId         - ID do deal movido (obrigatório, não vazio)
   * @param {string} data.fromStage      - Etapa de origem
   * @param {string} data.toStage        - Etapa de destino
   * @param {Object} [data.deal]         - Snapshot atualizado do deal
   * @param {string} [data.organizationId]
   * @param {string} [data.personId]
   * @param {string} [data.userId]
   * @param {string} [data.sessionId]
   * @param {string} [data.userName]
   * @param {string} [data.userLevel]
   * @param {string} [data.funil]
   * @returns {Promise<CoreEvent|null>} O evento publicado, ou null se fromStage === toStage
   * @throws {Error} Se dealId for inválido
   */
  async publishStageChanged(data) {
    const {
      dealId,
      fromStage,
      toStage,
      deal  = null,
      funil = '',
    } = data || {};

    if (typeof dealId !== 'string' || !dealId.trim()) {
      throw new Error('[CRMLegacyEventBridge] dealId must be a non-empty string');
    }
    if (typeof fromStage !== 'string') {
      throw new Error('[CRMLegacyEventBridge] fromStage must be a string');
    }
    if (typeof toStage !== 'string') {
      throw new Error('[CRMLegacyEventBridge] toStage must be a string');
    }

    if (fromStage === toStage) return null;

    const event = new CoreEvent(
      'crm:deal:stage-changed',
      { id: dealId, dealId, fromStage, toStage, deal, funil },
      'LegacyCRM',
      this._buildLegacyMetadata(data),
    );

    await this._eventBus.publish(event);
    return event;
  }

  /**
   * Publica um evento de criação de Deal no Event Bus.
   * Deve ser chamado APÓS o save do Firebase ter sido confirmado.
   *
   * @param {Object} data
   * @param {string} data.dealId         - ID do deal criado (obrigatório, não vazio)
   * @param {Object} [data.deal]         - Snapshot completo do deal salvo
   * @param {string} [data.funil]
   * @param {string} [data.organizationId]
   * @param {string} [data.personId]
   * @param {string} [data.userId]
   * @param {string} [data.sessionId]
   * @param {string} [data.userName]
   * @param {string} [data.userLevel]
   * @returns {Promise<CoreEvent>}
   * @throws {Error} Se dealId for inválido
   */
  async publishDealCreated(data) {
    const {
      dealId,
      deal  = null,
      funil = '',
    } = data || {};

    if (typeof dealId !== 'string' || !dealId.trim()) {
      throw new Error('[CRMLegacyEventBridge] dealId must be a non-empty string');
    }

    const event = new CoreEvent(
      'crm:deal:created',
      { id: dealId, dealId, deal, funil },
      'LegacyCRM',
      this._buildLegacyMetadata(data),
    );

    await this._eventBus.publish(event);
    return event;
  }

  /**
   * Publica um evento de atualização de Deal no Event Bus.
   * Deve ser chamado APÓS o save do Firebase ter sido confirmado.
   * O diff é responsabilidade de AuditEntry.getDiff() — não calcular aqui.
   *
   * @param {Object} data
   * @param {string} data.dealId         - ID do deal atualizado (obrigatório, não vazio)
   * @param {Object} [data.before]       - Snapshot do deal ANTES da edição (capturado pelo chamador)
   * @param {Object} [data.after]        - Snapshot do deal APÓS a edição
   * @param {string} [data.funil]
   * @param {string} [data.organizationId]
   * @param {string} [data.personId]
   * @param {string} [data.userId]
   * @param {string} [data.sessionId]
   * @param {string} [data.userName]
   * @param {string} [data.userLevel]
   * @returns {Promise<CoreEvent>}
   * @throws {Error} Se dealId for inválido
   */
  async publishDealUpdated(data) {
    const {
      dealId,
      before = null,
      after  = null,
      funil  = '',
    } = data || {};

    if (typeof dealId !== 'string' || !dealId.trim()) {
      throw new Error('[CRMLegacyEventBridge] dealId must be a non-empty string');
    }

    const event = new CoreEvent(
      'crm:deal:updated',
      { id: dealId, dealId, before, after, deal: after, funil },
      'LegacyCRM',
      this._buildLegacyMetadata(data),
    );

    await this._eventBus.publish(event);
    return event;
  }

  /**
   * Publica um evento de adição de Follow-up no Event Bus.
   * Deve ser chamado APÓS o save do Firebase ter sido confirmado.
   *
   * @param {Object} data
   * @param {string} data.followupId     - ID do follow-up criado (obrigatório, não vazio)
   * @param {string} [data.dealId]       - ID do deal ao qual o follow-up pertence
   * @param {Object} [data.followup]     - Dados do follow-up salvo
   * @param {string} [data.funil]
   * @param {string} [data.organizationId]
   * @param {string} [data.personId]
   * @param {string} [data.userId]
   * @param {string} [data.sessionId]
   * @param {string} [data.userName]
   * @param {string} [data.userLevel]
   * @returns {Promise<CoreEvent>}
   * @throws {Error} Se followupId for inválido
   */
  async publishFollowUpAdded(data) {
    const {
      followupId,
      dealId   = '',
      followup = null,
      funil    = '',
    } = data || {};

    if (typeof followupId !== 'string' || !followupId.trim()) {
      throw new Error('[CRMLegacyEventBridge] followupId must be a non-empty string');
    }

    const event = new CoreEvent(
      'crm:followup:added',
      { id: followupId, followupId, dealId, followup, funil },
      'LegacyCRM',
      this._buildLegacyMetadata(data),
    );

    await this._eventBus.publish(event);
    return event;
  }

  /**
   * Constrói os metadata canônicos de um evento legado.
   * Todos os campos do usuário são opcionais e defaultam para ''.
   * @param {Object} data - Objeto de dados do chamador
   * @returns {Object}
   * @private
   */
  _buildLegacyMetadata(data) {
    const d = data || {};
    return {
      organizationId: d.organizationId || '',
      personId:       d.personId       || '',
      userId:         d.userId         || '',
      sessionId:      d.sessionId      || '',
      userName:       d.userName       || '',
      userLevel:      d.userLevel      || '',
      legacy:         true,
    };
  }
}
