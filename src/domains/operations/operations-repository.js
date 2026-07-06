/**
 * ESA OS — Operations Domain
 * OperationsRepository
 *
 * Contrato de persistência do Operations Domain.
 * Define todos os métodos de acesso a dados como stubs.
 *
 * Responsabilidades:
 * - Ser o único ponto de acesso ao storage para o Operations Domain
 * - Documentar os contratos de dados esperados por entidade
 * - Preparar caminhos de migração para Firebase RTDB
 *
 * Firebase RTDB paths previstos (referência futura — NÃO implementar agora):
 *   operations/workOrders/{orgId}/{workOrderId}
 *   operations/teams/{orgId}/{teamId}
 *   operations/technicians/{orgId}/{technicianId}
 *   operations/assignments/{workOrderId}/{assignmentId}
 *   operations/checkIns/{workOrderId}/{checkInId}
 *   operations/forms/{orgId}/{formId}
 *   operations/formResponses/{workOrderId}/{responseId}
 *   operations/inspections/{workOrderId}/{inspectionId}
 *   operations/attachments/{workOrderId}/{attachmentId}
 *   operations/signatures/{workOrderId}/{signatureId}
 *   operations/slas/{orgId}/{slaId}
 *   operations/equipment/{orgId}/{equipmentId}
 *
 * IMPORTANTE:
 * NÃO usa Firebase nesta versão.
 * NÃO importa FirebaseService.
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 */

export class OperationsRepository {

  // ─── WorkOrders ────────────────────────────────────────────────────────────

  /**
   * @param {string} organizationId
   * @param {string} workOrderId
   * @returns {Promise<WorkOrder|null>}
   *
   * TODO: Firebase: get operations/workOrders/{organizationId}/{workOrderId}
   */
  async getWorkOrder(organizationId, workOrderId) {
    // TODO: implementar
    return null;
  }

  /**
   * @param {string} organizationId
   * @param {Object} [filters] - { status, teamId, technicianId, customerId, from, to }
   * @returns {Promise<WorkOrder[]>}
   *
   * TODO: Firebase: query operations/workOrders/{organizationId} com filtros
   */
  async getWorkOrders(organizationId, filters = {}) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string}    organizationId
   * @param {WorkOrder} workOrder
   * @returns {Promise<void>}
   *
   * TODO: Firebase: set operations/workOrders/{organizationId}/{workOrder.id}
   */
  async saveWorkOrder(organizationId, workOrder) {
    // TODO: implementar
  }

  /**
   * @param {string} organizationId
   * @param {string} workOrderId
   * @returns {Promise<void>}
   *
   * TODO: Soft delete — setar status = CANCELED em vez de remover
   */
  async deleteWorkOrder(organizationId, workOrderId) {
    // TODO: implementar
  }

  // ─── FieldTeams ────────────────────────────────────────────────────────────

  /**
   * @param {string} organizationId
   * @returns {Promise<FieldTeam[]>}
   *
   * TODO: Firebase: get operations/teams/{organizationId}
   */
  async getTeams(organizationId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string} organizationId
   * @param {string} teamId
   * @returns {Promise<FieldTeam|null>}
   */
  async getTeam(organizationId, teamId) {
    // TODO: implementar
    return null;
  }

  /**
   * @param {string}    organizationId
   * @param {FieldTeam} team
   * @returns {Promise<void>}
   */
  async saveTeam(organizationId, team) {
    // TODO: implementar
  }

  // ─── Technicians ───────────────────────────────────────────────────────────

  /**
   * @param {string} organizationId
   * @param {Object} [filters] - { teamId, active, skill, certification }
   * @returns {Promise<Technician[]>}
   *
   * TODO: Firebase: query operations/technicians/{organizationId}
   */
  async getTechnicians(organizationId, filters = {}) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string} organizationId
   * @param {string} technicianId
   * @returns {Promise<Technician|null>}
   */
  async getTechnician(organizationId, technicianId) {
    // TODO: implementar
    return null;
  }

  /**
   * @param {string}     organizationId
   * @param {Technician} technician
   * @returns {Promise<void>}
   */
  async saveTechnician(organizationId, technician) {
    // TODO: implementar
  }

  // ─── Assignments ───────────────────────────────────────────────────────────

  /**
   * @param {string} workOrderId
   * @returns {Promise<Assignment[]>}
   *
   * TODO: Firebase: get operations/assignments/{workOrderId}
   */
  async getAssignmentsByWorkOrder(workOrderId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string}     workOrderId
   * @param {Assignment} assignment
   * @returns {Promise<void>}
   */
  async saveAssignment(workOrderId, assignment) {
    // TODO: implementar
  }

  // ─── CheckIns ──────────────────────────────────────────────────────────────

  /**
   * @param {string} workOrderId
   * @returns {Promise<FieldCheckIn[]>}
   *
   * TODO: Firebase: get operations/checkIns/{workOrderId}
   */
  async getCheckInsByWorkOrder(workOrderId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string}       workOrderId
   * @param {FieldCheckIn} checkIn
   * @returns {Promise<void>}
   */
  async saveCheckIn(workOrderId, checkIn) {
    // TODO: implementar
  }

  // ─── TechnicalForms ────────────────────────────────────────────────────────

  /**
   * @param {string} organizationId
   * @param {string} [serviceType] - Filtrar por SERVICE_TYPE.*
   * @returns {Promise<TechnicalForm[]>}
   *
   * TODO: Firebase: query operations/forms/{organizationId}
   */
  async getForms(organizationId, serviceType = null) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string} organizationId
   * @param {string} formId
   * @returns {Promise<TechnicalForm|null>}
   */
  async getForm(organizationId, formId) {
    // TODO: implementar
    return null;
  }

  /**
   * @param {string}        organizationId
   * @param {TechnicalForm} form
   * @returns {Promise<void>}
   */
  async saveForm(organizationId, form) {
    // TODO: implementar
  }

  // ─── FormResponses ─────────────────────────────────────────────────────────

  /**
   * @param {string} workOrderId
   * @returns {Promise<TechnicalFormResponse[]>}
   *
   * TODO: Firebase: get operations/formResponses/{workOrderId}
   */
  async getFormResponsesByWorkOrder(workOrderId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string}               workOrderId
   * @param {TechnicalFormResponse} response
   * @returns {Promise<void>}
   */
  async saveFormResponse(workOrderId, response) {
    // TODO: implementar
  }

  // ─── Inspections ───────────────────────────────────────────────────────────

  /**
   * @param {string} workOrderId
   * @returns {Promise<Inspection[]>}
   *
   * TODO: Firebase: get operations/inspections/{workOrderId}
   */
  async getInspectionsByWorkOrder(workOrderId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string}     workOrderId
   * @param {Inspection} inspection
   * @returns {Promise<void>}
   */
  async saveInspection(workOrderId, inspection) {
    // TODO: implementar
  }

  // ─── Attachments ───────────────────────────────────────────────────────────

  /**
   * @param {string} workOrderId
   * @returns {Promise<OperationsAttachment[]>}
   *
   * TODO: Firebase: get operations/attachments/{workOrderId}
   */
  async getAttachmentsByWorkOrder(workOrderId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string}               workOrderId
   * @param {OperationsAttachment} attachment
   * @returns {Promise<void>}
   */
  async saveAttachment(workOrderId, attachment) {
    // TODO: implementar
  }

  // ─── CustomerSignatures ────────────────────────────────────────────────────

  /**
   * @param {string} workOrderId
   * @returns {Promise<CustomerSignature|null>}
   *
   * TODO: Firebase: get operations/signatures/{workOrderId}
   */
  async getSignatureByWorkOrder(workOrderId) {
    // TODO: implementar
    return null;
  }

  /**
   * @param {string}            workOrderId
   * @param {CustomerSignature} signature
   * @returns {Promise<void>}
   */
  async saveSignature(workOrderId, signature) {
    // TODO: implementar
  }

  // ─── SLAs ──────────────────────────────────────────────────────────────────

  /**
   * @param {string} organizationId
   * @returns {Promise<SLA[]>}
   *
   * TODO: Firebase: get operations/slas/{organizationId}
   */
  async getSLAs(organizationId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string} organizationId
   * @param {string} slaId
   * @returns {Promise<SLA|null>}
   */
  async getSLA(organizationId, slaId) {
    // TODO: implementar
    return null;
  }

  /**
   * @param {string} organizationId
   * @param {SLA}    sla
   * @returns {Promise<void>}
   */
  async saveSLA(organizationId, sla) {
    // TODO: implementar
  }

  // ─── Equipment ─────────────────────────────────────────────────────────────

  /**
   * @param {string} organizationId
   * @param {Object} [filters] - { customerId, assetId, type, status }
   * @returns {Promise<Equipment[]>}
   *
   * TODO: Firebase: query operations/equipment/{organizationId}
   */
  async getEquipment(organizationId, filters = {}) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string} organizationId
   * @param {string} equipmentId
   * @returns {Promise<Equipment|null>}
   */
  async getEquipmentById(organizationId, equipmentId) {
    // TODO: implementar
    return null;
  }

  /**
   * @param {string}    organizationId
   * @param {Equipment} equipment
   * @returns {Promise<void>}
   */
  async saveEquipment(organizationId, equipment) {
    // TODO: implementar
  }
}
