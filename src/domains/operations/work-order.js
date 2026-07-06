/**
 * ESA OS — Operations Domain
 * WorkOrder
 *
 * Entidade central do Operations Domain.
 * Representa uma ordem de serviço técnico em campo.
 *
 * Responsabilidades:
 * - Modelar todo o ciclo de vida de um atendimento técnico
 * - Vincular cliente, ativo, equipe, técnicos e SLA
 * - Rastrear datas reais vs. planejadas
 * - Preparar integrações futuras com CRM, Asset, Engineering e Financial
 *
 * Relações futuras:
 *   CRM        → dealId: origina WorkOrder a partir de um Deal fechado
 *   Asset      → assetId: equipamento/instalação atendida
 *   Engineering → projectId: vinculação ao projeto de engenharia
 *   Energy     → instalação fotovoltaica ou estação de recarga
 *   Financial  → contractId: contrato de O&M ou serviço
 *   Solana IA  → análise de padrões de manutenção e previsão de falhas
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não implementa lógica de negócio nesta versão.
 */

import { WORK_ORDER_STATUS } from './work-order-status.js';
import { SERVICE_TYPE } from './service-type.js';

/**
 * Prioridade da WorkOrder — afeta SLA e ordenação no painel.
 */
export const WORK_ORDER_PRIORITY = {
  LOW:      'LOW',
  MEDIUM:   'MEDIUM',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
};

/**
 * Ordem de serviço técnico.
 */
export class WorkOrder {
  /**
   * @param {string}      title          - Título descritivo (ex: 'Instalação UFV 10kWp - João Silva')
   * @param {string}      serviceType    - SERVICE_TYPE.*
   * @param {string}      organizationId - ID da organização responsável
   * @param {string}      customerId     - ID do cliente
   * @param {string}      customerName   - Nome do cliente (desnormalizado)
   * @param {string}      createdBy      - UID da Person que criou
   * @param {string}      priority       - WORK_ORDER_PRIORITY.*
   * @param {string}      description    - Descrição detalhada do serviço
   * @param {string}      address        - Endereço do atendimento
   * @param {number}      latitude       - Latitude do local de atendimento
   * @param {number}      longitude      - Longitude do local de atendimento
   * @param {string}      assetId        - ID no Asset Domain (futuro)
   * @param {string}      projectId      - ID no Engineering Domain (futuro)
   * @param {string}      contractId     - ID de contrato de serviço (futuro)
   * @param {string}      dealId         - ID do Deal no CRM Domain
   * @param {string}      slaId          - ID do SLA aplicável
   * @param {number}      scheduledStart - Timestamp de início planejado (ms)
   * @param {number}      scheduledEnd   - Timestamp de término planejado (ms)
   * @param {Object}      metadata       - Dados extras (notes, source, externalRef)
   */
  constructor(
    title,
    serviceType    = SERVICE_TYPE.TECHNICAL_VISIT,
    organizationId = '',
    customerId     = '',
    customerName   = '',
    createdBy      = '',
    priority       = WORK_ORDER_PRIORITY.MEDIUM,
    description    = '',
    address        = '',
    latitude       = null,
    longitude      = null,
    assetId        = null,
    projectId      = null,
    contractId     = null,
    dealId         = null,
    slaId          = null,
    scheduledStart = null,
    scheduledEnd   = null,
    metadata       = {}
  ) {
    /** @type {string} */
    this.id = WorkOrder._generateId();

    /**
     * @type {string} Número sequencial legível da OS.
     * TODO: Gerado pelo servidor/Firebase com sequência por organização (ex: OS-2024-0042)
     */
    this.number = '';

    this.title          = title;
    this.serviceType    = serviceType;
    this.organizationId = organizationId;
    this.customerId     = customerId;
    this.customerName   = customerName;
    this.createdBy      = createdBy;
    this.priority       = priority;
    this.description    = description;
    this.address        = address;
    this.latitude       = latitude;
    this.longitude      = longitude;

    // Referências externas (futuras integrações de domínio)
    this.assetId    = assetId;
    this.projectId  = projectId;
    this.contractId = contractId;
    this.dealId     = dealId;
    this.slaId      = slaId;

    // Datas planejadas
    this.scheduledStart = scheduledStart;
    this.scheduledEnd   = scheduledEnd;

    // Datas reais — preenchidas durante execução
    this.actualStart  = null;
    this.actualEnd    = null;
    this.completedAt  = null;

    // Alocação de equipe/técnicos
    /** @type {string|null} ID da FieldTeam alocada */
    this.teamId        = null;

    /** @type {string[]} IDs de Technicians adicionalmente alocados */
    this.technicianIds = [];

    this.status    = WORK_ORDER_STATUS.DRAFT;
    this.metadata  = metadata;

    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Move a WorkOrder para um novo status.
   * @param {string} newStatus - WORK_ORDER_STATUS.*
   *
   * TODO: Validar transição permitida (máquina de estados)
   * TODO: Atualizar updatedAt
   * TODO: Preencher actualStart quando entrar em IN_PROGRESS
   * TODO: Preencher completedAt quando entrar em COMPLETED ou CANCELED
   */
  transitionTo(newStatus) {
    // TODO: implementar
  }

  /**
   * Aloca uma FieldTeam à WorkOrder.
   * @param {string} teamId
   *
   * TODO: Validar que status permite alocação (OPEN ou SCHEDULED)
   * TODO: Atualizar this.teamId e updatedAt
   */
  assignTeam(teamId) {
    // TODO: implementar
  }

  /**
   * Adiciona um técnico adicional à WorkOrder.
   * @param {string} technicianId
   *
   * TODO: Validar que não está duplicado
   */
  addTechnician(technicianId) {
    // TODO: implementar
  }

  /**
   * Agenda a WorkOrder com data/hora definida.
   * @param {number} scheduledStart - Timestamp (ms)
   * @param {number} scheduledEnd   - Timestamp (ms)
   *
   * TODO: Validar scheduledStart < scheduledEnd
   * TODO: Transicionar para SCHEDULED
   */
  schedule(scheduledStart, scheduledEnd) {
    // TODO: implementar
  }

  /**
   * Verifica se a WorkOrder está encerrada.
   * @returns {boolean}
   *
   * TODO: Delegar para isClosedStatus(this.status)
   */
  isClosed() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se a WorkOrder está em campo.
   * @returns {boolean}
   *
   * TODO: Delegar para isFieldStatus(this.status)
   */
  isInField() {
    // TODO: implementar
    return false;
  }

  /**
   * Retorna a duração real do atendimento em minutos.
   * @returns {number|null}
   *
   * TODO: Calcular (actualEnd - actualStart) / 60000 se ambos preenchidos
   */
  getActualDurationMinutes() {
    // TODO: implementar
    return null;
  }

  /**
   * Retorna a idade da WorkOrder em dias desde a criação.
   * @returns {number}
   *
   * TODO: Calcular (Date.now() - createdAt) / 86400000
   */
  getAgeDays() {
    // TODO: implementar
    return 0;
  }

  /**
   * @returns {Object}
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {WorkOrder}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new WorkOrder('');
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
