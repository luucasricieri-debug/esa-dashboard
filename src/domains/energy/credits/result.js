/**
 * ESA OS — Energy Domain / Credits
 * EnergyCreditsResult
 *
 * Contrato de resultado consistente para todas as operações do módulo.
 * Nunca lança exceção para erros de negócio — retorna ok:false com errors[].
 * Exceções são reservadas para erros de programação (TypeError, etc.).
 *
 * Estrutura ok:
 *   { ok: true, data, errors: [], warnings: [], metadata: {} }
 *
 * Estrutura fail:
 *   { ok: false, data: null, errors: [{ code, message, field, metadata }], warnings: [], metadata: {} }
 */

export class EnergyCreditsResult {

  /**
   * @param {*}       data
   * @param {Array}   [warnings]
   * @param {Object}  [metadata]
   * @returns {{ ok: true, data, errors: [], warnings, metadata }}
   */
  static ok(data, warnings = [], metadata = {}) {
    return { ok: true, data, errors: [], warnings, metadata };
  }

  /**
   * @param {Array|Object} errors    - Um erro ou array de erros
   * @param {Array}        [warnings]
   * @param {Object}       [metadata]
   * @returns {{ ok: false, data: null, errors, warnings, metadata }}
   */
  static fail(errors, warnings = [], metadata = {}) {
    const errs = Array.isArray(errors) ? errors : [errors];
    return { ok: false, data: null, errors: errs, warnings, metadata };
  }

  /**
   * Cria um objeto de erro padronizado para uso em errors[].
   *
   * @param {string} code
   * @param {string} message
   * @param {string|null} [field]
   * @param {Object}      [metadata]
   * @returns {{ code, message, field, metadata }}
   */
  static makeError(code, message, field = null, metadata = {}) {
    return { code, message, field, metadata };
  }

  /**
   * Cria um objeto de warning padronizado para uso em warnings[].
   *
   * @param {string} code
   * @param {string} message
   * @param {string|null} [field]
   * @param {Object}      [metadata]
   * @returns {{ code, message, field, metadata }}
   */
  static makeWarning(code, message, field = null, metadata = {}) {
    return { code, message, field, metadata };
  }
}
