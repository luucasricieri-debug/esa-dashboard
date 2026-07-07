/**
 * ESA OS — Integrations
 * CRMEventMapper
 *
 * Converte CoreEvents do domínio CRM em comandos de auditoria.
 * Atua como camada de tradução entre o vocabulário do Event Bus
 * e o vocabulário do módulo de Audit.
 *
 * Responsabilidades:
 * - Mapear tipo de evento CRM → AUDIT_ACTION
 * - Inferir resource e resourceId a partir do payload
 * - Extrair before/after relevantes para cada tipo de evento
 * - Construir metadata canônico para rastreabilidade
 *
 * Retorna null quando:
 * - O tipo de evento não é reconhecido
 * - Nenhum resourceId pode ser extraído do payload
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não integra com Logger. Não integra com Firebase.
 */

import { AUDIT_ACTION } from '../core/audit/audit-action.js';

/**
 * Tabela de mapeamento: tipo de evento → { action, resource }
 */
const EVENT_MAP = {
  'crm:deal:created':       { action: AUDIT_ACTION.CREATE,  resource: 'deal' },
  'crm:deal:updated':       { action: AUDIT_ACTION.UPDATE,  resource: 'deal' },
  'crm:deal:stage-changed': { action: AUDIT_ACTION.MOVE,    resource: 'deal' },
  'crm:deal:won':           { action: AUDIT_ACTION.APPROVE, resource: 'deal' },
  'crm:deal:lost':          { action: AUDIT_ACTION.REJECT,  resource: 'deal' },
  'crm:deal:paused':        { action: AUDIT_ACTION.UPDATE,  resource: 'deal' },
  'crm:followup:added':     { action: AUDIT_ACTION.CREATE,  resource: 'followup' },
  'crm:activity:completed': { action: AUDIT_ACTION.EXECUTE, resource: 'activity' },
  'crm:proposal:sent':      { action: AUDIT_ACTION.EXECUTE, resource: 'proposal' },
  'crm:proposal:accepted':  { action: AUDIT_ACTION.APPROVE, resource: 'proposal' },
};

/**
 * Converte CoreEvents CRM em descritores de auditoria.
 */
export class CRMEventMapper {
  /**
   * Mapeia um CoreEvent para um descritor de auditoria.
   *
   * @param {CoreEvent} event
   * @returns {{ action, resource, resourceId, before, after, metadata } | null}
   *   null quando o evento não é mapeável ou não possui resourceId identificável.
   */
  map(event) {
    const mapping = EVENT_MAP[event.type];
    if (!mapping) return null;

    const payload    = event.payload || {};
    const resourceId = this._extractResourceId(payload);
    if (resourceId === null) return null;

    const { before, after } = this._extractBeforeAfter(event.type, payload);
    const metadata           = this._buildMetadata(event);

    return {
      action:     mapping.action,
      resource:   mapping.resource,
      resourceId,
      before,
      after,
      metadata,
    };
  }

  // ── Privado ───────────────────────────────────────────────────────────────

  /**
   * Extrai o resourceId do payload na ordem de prioridade definida.
   * Retorna null se nenhum dos campos estiver presente.
   * @private
   */
  _extractResourceId(payload) {
    if (payload.id          != null) return String(payload.id);
    if (payload.dealId      != null) return String(payload.dealId);
    if (payload.followupId  != null) return String(payload.followupId);
    if (payload.activityId  != null) return String(payload.activityId);
    if (payload.proposalId  != null) return String(payload.proposalId);
    return null;
  }

  /**
   * Extrai before e after conforme a semântica de cada tipo de evento.
   * Não muta o payload original.
   * @private
   */
  _extractBeforeAfter(type, payload) {
    switch (type) {
      case 'crm:deal:created':
        return {
          before: null,
          after:  payload.deal || payload,
        };

      case 'crm:deal:updated':
        return {
          before: payload.before || null,
          after:  payload.after  || payload.deal || null,
        };

      case 'crm:deal:stage-changed':
        return {
          before: { stage: payload.fromStage },
          after:  { stage: payload.toStage },
        };

      case 'crm:deal:won':
      case 'crm:deal:lost':
      case 'crm:deal:paused':
        return {
          before: payload.before || null,
          after:  payload.after  || payload.deal || payload,
        };

      // followup, activity, proposal — e qualquer outro mapeado
      default:
        return {
          before: null,
          after:  payload,
        };
    }
  }

  /**
   * Constrói o metadata canônico para a AuditEntry.
   * Campos canônicos prevalecem sobre os campos de event.metadata em caso de conflito.
   * Não muta event.metadata.
   * @private
   */
  _buildMetadata(event) {
    const sourceMeta = event.metadata || {};
    return {
      ...sourceMeta,
      eventId:        event.id,
      eventType:      event.type,
      eventSource:    event.source,
      eventCreatedAt: event.createdAt,
      correlationId:  sourceMeta.correlationId || '',
    };
  }
}
