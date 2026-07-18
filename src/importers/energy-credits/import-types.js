/**
 * ESA OS — Importers / Energy Credits
 * Constantes de tipos de importação suportados.
 */

export const ENERGY_CREDITS_IMPORT_TYPE = Object.freeze({
  GENERATING_UNITS:                'generating-units',
  BENEFICIARY_UNITS:               'beneficiary-units',
  GENERATING_UNIT_MONTHLY_RECORDS: 'generating-unit-monthly-records',
  BENEFICIARY_MONTHLY_RECORDS:     'beneficiary-monthly-records',
});

export const EC_IMPORT_TYPES = Object.freeze(Object.values(ENERGY_CREDITS_IMPORT_TYPE));
