/**
 * ESA OS — Engines / Energy Billing
 * Contrato de resultado do Billing Engine.
 *
 * Imutável. Nunca lança exception para erros esperados de cálculo.
 */

export class EnergyBillingResult {

  static ok(snapshot, warnings = [], metadata = {}) {
    return Object.freeze({
      ok:       true,
      snapshot: Object.freeze(snapshot),
      errors:   [],
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
  }

  static fail(errors = [], warnings = [], metadata = {}) {
    return Object.freeze({
      ok:       false,
      snapshot: null,
      errors:   Array.isArray(errors) ? errors : [errors].filter(Boolean),
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
  }

  static makeError(code, message, field = null, value = null) {
    return Object.freeze({ code, message, field, value });
  }

  static makeWarning(code, message, field = null, value = null) {
    return Object.freeze({ code, message, field, value });
  }

  toJSON() {
    return this;
  }
}
