/**
 * ESA OS — Operations Domain
 * Barrel export + singleton
 *
 * Ponto de entrada público do Operations Domain.
 * Consumidores devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { operations, WorkOrder, SERVICE_TYPE, WORK_ORDER_STATUS } from 'src/domains/operations/index.js'
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 */

// Status & Types
export { WORK_ORDER_STATUS, CLOSED_STATUSES, ACTIVE_STATUSES,
         WAITING_STATUSES, FIELD_STATUSES,
         isClosedStatus, isActiveStatus, isWaitingStatus } from './work-order-status.js';

export { SERVICE_TYPE, SERVICE_TYPE_LABEL,
         REQUIRES_TECHNICAL_FORM,
         REQUIRES_CUSTOMER_SIGNATURE,
         getServiceTypeLabel }                             from './service-type.js';

// Entities
export { WorkOrder, WORK_ORDER_PRIORITY }                  from './work-order.js';
export { FieldTeam }                                       from './field-team.js';
export { Technician, TECHNICIAN_CERTIFICATION }            from './technician.js';
export { Assignment, ASSIGNMENT_STATUS }                   from './assignment.js';
export { FieldCheckIn, CHECKIN_TYPE }                      from './checkin.js';
export { TechnicalForm, FORM_FIELD_TYPE }                  from './technical-form.js';
export { TechnicalFormResponse, FORM_RESPONSE_STATUS }     from './technical-form-response.js';
export { Inspection, INSPECTION_TYPE,
         INSPECTION_RESULT, INSPECTION_SEVERITY }          from './inspection.js';
export { OperationsAttachment, ATTACHMENT_TYPE }           from './attachment.js';
export { CustomerSignature, SIGNATURE_STATUS }             from './customer-signature.js';
export { SLA, SLA_PRIORITY }                               from './sla.js';
export { Equipment, EQUIPMENT_TYPE, EQUIPMENT_STATUS }     from './equipment.js';

// Infrastructure
export { OperationsRepository }                            from './operations-repository.js';

// Facade
export { Operations }                                      from './operations.js';

import { Operations } from './operations.js';

/**
 * Singleton do Operations Domain.
 * Use este objeto em todos os módulos do ESA OS.
 *
 * @type {Operations}
 */
export const operations = new Operations();
