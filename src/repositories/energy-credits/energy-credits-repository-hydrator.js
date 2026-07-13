/**
 * ESA OS — Repositories / Energy Credits
 * Adapter: Repository → Read Model
 *
 * Responsabilidade única: chamar repository.getSnapshot() e passar o resultado
 * para readModel.hydrate(). Nenhuma lógica de transformação — apenas ponte.
 */

import { EnergyCreditsRepositoryResult } from './energy-credits-repository-result.js';

export class EnergyCreditsRepositoryHydrator {

  constructor(repository = null, readModel = null) {
    this._repository = repository;
    this._readModel  = readModel;
  }

  hydrateReadModel(options = {}) {
    if (!this._repository || typeof this._repository.getSnapshot !== 'function') {
      return EnergyCreditsRepositoryResult.fail([
        EnergyCreditsRepositoryResult.makeError('INVALID_REPOSITORY', 'repository inválido ou não fornecido'),
      ]);
    }
    if (!this._readModel || typeof this._readModel.hydrate !== 'function') {
      return EnergyCreditsRepositoryResult.fail([
        EnergyCreditsRepositoryResult.makeError('INVALID_READ_MODEL', 'readModel inválido ou não fornecido'),
      ]);
    }
    const snapshotResult = this._repository.getSnapshot(options);
    if (!snapshotResult.ok) return snapshotResult;

    const hydrateStats = this._readModel.hydrate(snapshotResult.data, options);
    return EnergyCreditsRepositoryResult.ok(hydrateStats, [], {
      source:       'memory-repository',
      hydrateStats: hydrateStats,
    });
  }
}
