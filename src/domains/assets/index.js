/**
 * ESA OS — Assets Domain
 * Barrel export + singleton
 *
 * Ponto de entrada público do Assets Domain.
 * Consumidores devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { assets, Asset, SolarPlant, ASSET_TYPE, ASSET_STATUS } from 'src/domains/assets/index.js'
 *
 * IMPORTANTE: NÃO conectado ao Dashboard legado (index.html).
 */

// Catalogs
export { ASSET_TYPE, ASSET_TYPE_LABEL }                         from './asset-type.js';
export { ASSET_STATUS, ACTIVE_STATUSES,
         NON_OPERATIONAL_STATUSES, TERMINAL_STATUSES,
         isActiveStatus, isTerminalStatus }                      from './asset-status.js';
export { ASSET_DOCUMENT_TYPE }                                   from './asset-document.js';
export { ASSET_METRIC_TYPE, METRIC_QUALITY }                     from './asset-metric.js';
export { OWNERSHIP_TYPE }                                        from './asset-owner.js';

// Entities
export { Asset }                                                 from './asset.js';
export { SolarPlant, HOMOLOGATION_STATUS,
         GRID_CONNECTION_TYPE }                                   from './solar-plant.js';
export { BatterySystem, BATTERY_CHEMISTRY,
         BATTERY_OPERATING_MODE }                                 from './battery-system.js';
export { EVCharger, CONNECTOR_TYPE,
         CHARGING_MODE, CHARGING_PROTOCOL }                       from './ev-charger.js';
export { AssetOwner }                                            from './asset-owner.js';
export { AssetLocation }                                         from './asset-location.js';
export { AssetDocument }                                         from './asset-document.js';
export { AssetMetric }                                           from './asset-metric.js';

// Infrastructure
export { AssetRepository }                                       from './asset-repository.js';

// Facade
export { Assets }                                                from './assets.js';

import { Assets } from './assets.js';

/**
 * Singleton do Assets Domain.
 * Use este objeto em todos os módulos do ESA OS.
 *
 * @type {Assets}
 */
export const assets = new Assets();
