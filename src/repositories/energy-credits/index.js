/**
 * ESA OS — Repositories / Energy Credits
 * Public API + Singletons
 */

export { EC_COLLECTIONS, EC_ROOT, EC_PATHS,
         buildEnergyCreditsPath,
         buildEnergyCreditsCollectionPath }                          from './energy-credits-paths.js';
export { EnergyCreditsRepositoryResult }                              from './energy-credits-repository-result.js';
export { EnergyCreditsMemoryRepository }                              from './energy-credits-memory-repository.js';
export { EnergyCreditsFirebaseRepository }                           from './energy-credits-firebase-repository.js';
export { EnergyCreditsRepositoryHydrator }                           from './energy-credits-repository-hydrator.js';

import { EnergyCreditsMemoryRepository }    from './energy-credits-memory-repository.js';
import { EnergyCreditsRepositoryHydrator }  from './energy-credits-repository-hydrator.js';
import { energyCreditsReadModel }           from '../../read-models/energy-credits/index.js';

export const energyCreditsRepository        = new EnergyCreditsMemoryRepository();
export const energyCreditsRepositoryHydrator = new EnergyCreditsRepositoryHydrator(
  energyCreditsRepository,
  energyCreditsReadModel,
);
