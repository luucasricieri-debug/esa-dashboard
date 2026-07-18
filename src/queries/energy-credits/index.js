/**
 * ESA OS — Energy Domain / Credits
 * Query Service — Public API + Singleton
 */

export { EnergyCreditsQueryResult }  from './energy-credits-query-result.js';
export { EnergyCreditsQueryService } from './energy-credits-query-service.js';

import { energyCreditsReadModel }    from '../../read-models/energy-credits/index.js';
import { EnergyCreditsQueryService } from './energy-credits-query-service.js';

export const energyCreditsQueryService = new EnergyCreditsQueryService(energyCreditsReadModel);
