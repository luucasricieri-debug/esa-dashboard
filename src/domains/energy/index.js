/**
 * ESA OS — Energy Domain
 * Barrel export + singleton
 *
 * Ponto de entrada público do Energy Domain.
 * Consumidores devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { energy, EnergyOperation, OPERATION_TYPE } from 'src/domains/energy/index.js'
 *
 * IMPORTANTE: NÃO conectado ao Dashboard legado (index.html).
 */

// Catalogs & Status
export { OPERATION_TYPE, OPERATION_STATUS }                      from './energy-operation.js';
export { CREDIT_STATUS }                                         from './energy-credit.js';
export { ALLOCATION_STATUS }                                     from './credit-allocation.js';
export { COMPENSATION_STATUS }                                   from './compensation-record.js';
export { TARIFF_CLASS, CONNECTION_TYPE }                         from './consumer-unit.js';
export { GENERATION_TYPE }                                       from './generation-unit.js';
export { ENERGY_CONTRACT_TYPE, CONTRACT_STATUS }                 from './energy-contract.js';
export { INVOICE_STATUS }                                        from './energy-invoice.js';
export { SETTLEMENT_STATUS }                                     from './energy-settlement.js';
export { REPORT_TYPE, REPORT_STATUS }                            from './energy-report.js';
export { ENERGY_METRIC_TYPE }                                    from './energy-metric.js';

// Entities
export { EnergyOperation }                                       from './energy-operation.js';
export { GenerationRecord }                                      from './generation-record.js';
export { ConsumptionRecord }                                     from './consumption-record.js';
export { EnergyCredit }                                          from './energy-credit.js';
export { CreditAllocation }                                      from './credit-allocation.js';
export { CompensationRecord }                                    from './compensation-record.js';
export { ConsumerUnit }                                          from './consumer-unit.js';
export { GenerationUnit }                                        from './generation-unit.js';
export { EnergyContract }                                        from './energy-contract.js';
export { EnergyInvoice }                                         from './energy-invoice.js';
export { EnergySettlement }                                      from './energy-settlement.js';
export { EnergyReport }                                          from './energy-report.js';
export { EnergyMetric }                                          from './energy-metric.js';

// Infrastructure
export { EnergyRepository }                                      from './energy-repository.js';

// Facade
export { Energy }                                                from './energy.js';

import { Energy } from './energy.js';

/**
 * Singleton do Energy Domain.
 * Use este objeto em todos os módulos do ESA OS.
 *
 * @type {Energy}
 */
export const energy = new Energy();
