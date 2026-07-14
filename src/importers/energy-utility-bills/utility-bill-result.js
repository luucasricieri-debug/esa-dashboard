/**
 * ESA OS — Importers / Energy Utility Bills
 * Contrato de resultado para todas as operações de importação de faturas.
 * Nunca lança exception para erros esperados de negócio.
 */

export class UtilityBillResult {

  static ok(data, warnings = [], metadata = {}) {
    return Object.freeze({
      ok:       true,
      data,
      errors:   [],
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: (metadata && typeof metadata === 'object') ? metadata : {},
    });
  }

  static fail(errors, warnings = [], metadata = {}) {
    const errs = Array.isArray(errors) ? errors : [errors].filter(Boolean);
    return Object.freeze({
      ok:       false,
      data:     null,
      errors:   errs,
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: (metadata && typeof metadata === 'object') ? metadata : {},
    });
  }

  static makeError(code, message, field = null, metadata = {}) {
    return Object.freeze({
      code,
      message,
      field,
      metadata: (metadata && typeof metadata === 'object') ? metadata : {},
    });
  }

  static makeWarning(code, message, field = null, metadata = {}) {
    return Object.freeze({
      code,
      message,
      field,
      metadata: (metadata && typeof metadata === 'object') ? metadata : {},
    });
  }
}
