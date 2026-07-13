/**
 * ESA OS — Importers / Energy Credits
 * Contrato de resultado para operações de importação.
 *
 * Nunca lança exception para erro esperado de importação.
 * Contrato: { ok, data, errors, warnings, metadata }
 */

export class EnergyCreditsImportResult {

  static ok(data, errors = [], warnings = [], metadata = {}) {
    return Object.freeze({
      ok:       true,
      data:     data,
      errors:   Array.isArray(errors)   ? errors   : [],
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
  }

  static fail(errors = [], warnings = [], metadata = {}) {
    return Object.freeze({
      ok:       false,
      data:     null,
      errors:   Array.isArray(errors)   ? errors   : [errors].filter(Boolean),
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
  }

  static makeError(code, message, row = null, field = null, value = null, meta = {}) {
    return Object.freeze({
      code, message,
      row:      row   !== undefined ? row   : null,
      field:    field !== undefined ? field : null,
      value:    value !== undefined ? value : null,
      metadata: meta && typeof meta === 'object' ? meta : {},
    });
  }

  static makeWarning(code, message, row = null, field = null, value = null, meta = {}) {
    return Object.freeze({
      code, message,
      row:      row   !== undefined ? row   : null,
      field:    field !== undefined ? field : null,
      value:    value !== undefined ? value : null,
      metadata: meta && typeof meta === 'object' ? meta : {},
    });
  }
}
