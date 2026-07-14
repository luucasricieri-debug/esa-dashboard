/**
 * ESA OS — Energy Domain / Credits / Allocation
 * CreditAllocationResult
 *
 * Contrato de resultado consistente para operações de rateio e saldo de créditos.
 * Espelha o padrão de EnergyCreditsResult — nunca lança exceção para erros de negócio.
 */

export class CreditAllocationResult {

  static ok(data, warnings = [], metadata = {}) {
    return { ok: true, data, errors: [], warnings, metadata };
  }

  static fail(errors, warnings = [], metadata = {}) {
    const errs = Array.isArray(errors) ? errors : [errors];
    return { ok: false, data: null, errors: errs, warnings, metadata };
  }

  static makeError(code, message, field = null, metadata = {}) {
    return { code, message, field, metadata };
  }

  static makeWarning(code, message, field = null, metadata = {}) {
    return { code, message, field, metadata };
  }
}
