/**
 * ESA OS — Importers / Energy Credits
 * ImportService: orquestra parse → map → validate → persist → hydrate.
 *
 * NÃO acessa filesystem.
 * NÃO acessa Firebase real.
 * NÃO usa Date.now(), Math.random(), crypto.randomUUID().
 * persist=false por padrão; hydrateReadModel=false por padrão.
 */

import { parseCsv }                      from './csv-parser.js';
import { EnergyCreditsImportMapper }     from './energy-credits-import-mapper.js';
import { EnergyCreditsImportValidator }  from './energy-credits-import-validator.js';
import { EnergyCreditsImportResult }     from './energy-credits-import-result.js';
import { ENERGY_CREDITS_IMPORT_TYPE, EC_IMPORT_TYPES } from './import-types.js';

const T = ENERGY_CREDITS_IMPORT_TYPE;

// method name suffix that, when capitalized and prefixed with "save", gives the repository method
const SAVE_MAP = Object.freeze({
  [T.GENERATING_UNITS]:                'GeneratingUnit',
  [T.BENEFICIARY_UNITS]:               'BeneficiaryUnit',
  [T.GENERATING_UNIT_MONTHLY_RECORDS]: 'GeneratingUnitMonthlyRecord',
  [T.BENEFICIARY_MONTHLY_RECORDS]:     'BeneficiaryMonthlyRecord',
});

export class EnergyCreditsImportService {

  constructor(mapper = null, validator = null, parser = null) {
    this._mapper    = mapper    || new EnergyCreditsImportMapper();
    this._validator = validator || new EnergyCreditsImportValidator();
    this._parser    = parser    || parseCsv;
  }

  importFromCsv(importType, csvText, options = {}) {
    const parsed = this._parser(csvText, options.csv || {});
    if (!parsed.ok) return EnergyCreditsImportResult.fail(parsed.errors, parsed.warnings, { importType, stage: 'parse' });
    return this._processImport(importType, parsed.data, options, { ...parsed.metadata, stage: 'import' });
  }

  importFromRows(importType, rows, options = {}) {
    if (!Array.isArray(rows)) {
      return EnergyCreditsImportResult.fail(
        [EnergyCreditsImportResult.makeError('INVALID_ROWS', 'rows deve ser Array')],
        [],
        { importType, stage: 'validate-input' },
      );
    }
    if (!EC_IMPORT_TYPES.includes(importType)) {
      return EnergyCreditsImportResult.fail(
        [EnergyCreditsImportResult.makeError('UNKNOWN_TYPE', `Tipo desconhecido: ${importType}`)],
        [],
        { importType, stage: 'validate-input' },
      );
    }
    return this._processImport(importType, rows, options, { totalRows: rows.length, stage: 'import' });
  }

  _processImport(importType, rows, options, baseMeta) {
    const { entities, errors, warnings } = this._mapAndValidate(importType, rows);
    const allErrors   = [...errors];
    const allWarnings = [...warnings];
    if (options.persist && entities.length > 0) {
      const persistErrs = this._persist(importType, entities, options.repository);
      allErrors.push(...persistErrs);
    }
    if (options.hydrateReadModel && entities.length > 0 && options.hydrator) {
      const hydrateErrs = this._hydrate(importType, entities, options.hydrator);
      allWarnings.push(...hydrateErrs);
    }
    return this._wrapResult(entities, allErrors, allWarnings, baseMeta, importType);
  }

  _mapAndValidate(importType, rows) {
    const entities = [];
    const errors   = [];
    const warnings = [];
    for (let i = 0; i < rows.length; i++) {
      const mapped = this._mapper.mapRow(importType, rows[i], i);
      if (!mapped.ok) { errors.push(...mapped.errors); continue; }
      const validated = this._validator.validate(importType, mapped.entity, i);
      warnings.push(...validated.warnings);
      if (!validated.ok) { errors.push(...validated.errors); continue; }
      entities.push(mapped.entity);
    }
    return { entities, errors, warnings };
  }

  _persist(importType, entities, repository) {
    const errors = [];
    const saveMethod = SAVE_MAP[importType];
    if (!repository || typeof repository[`save${saveMethod}`] !== 'function') {
      errors.push(EnergyCreditsImportResult.makeError('NO_REPOSITORY', `Repository não suporta save para: ${importType}`));
      return errors;
    }
    const method = `save${saveMethod}`;
    for (const entity of entities) {
      try {
        const result = repository[method](entity);
        if (result && result.ok === false) errors.push(EnergyCreditsImportResult.makeError('PERSIST_ERROR', result.error || 'Erro ao salvar entidade', null, 'id', entity.id));
      } catch (e) {
        errors.push(EnergyCreditsImportResult.makeError('PERSIST_EXCEPTION', String(e.message || e), null, 'id', entity.id));
      }
    }
    return errors;
  }

  _hydrate(importType, entities, hydrator) {
    const warnings = [];
    if (typeof hydrator.hydrate !== 'function') {
      warnings.push(EnergyCreditsImportResult.makeWarning('NO_HYDRATOR', 'Hydrator não possui método hydrate — ignorando'));
      return warnings;
    }
    try {
      hydrator.hydrate();
    } catch (e) {
      warnings.push(EnergyCreditsImportResult.makeWarning('HYDRATE_FAILED', String(e.message || e)));
    }
    return warnings;
  }

  _wrapResult(entities, errors, warnings, meta, importType) {
    const ok = errors.length === 0;
    const metadata = Object.assign({}, meta, { importType, totalEntities: entities.length, totalErrors: errors.length, totalWarnings: warnings.length });
    return ok
      ? EnergyCreditsImportResult.ok(entities, [], warnings, metadata)
      : EnergyCreditsImportResult.fail(errors, warnings, metadata);
  }
}

function _capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
