/**
 * ESA OS — Core / Audit
 * Barrel export + singleton
 *
 * Ponto de entrada público do módulo de auditoria.
 * Consumidores devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { audit, Audit, AuditEntry, AuditContext, AUDIT_ACTION } from 'src/core/audit/index.js'
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 */

export { AUDIT_ACTION, AUDIT_ACTION_CATEGORY } from './audit-action.js';
export { AuditContext }                         from './audit-context.js';
export { AuditEntry }                           from './audit-entry.js';
export { Audit }                                from './audit.js';

import { Audit } from './audit.js';

/**
 * Singleton do módulo de auditoria.
 * Use este objeto em todos os módulos do ESA OS.
 *
 * @type {Audit}
 */
export const audit = new Audit();
