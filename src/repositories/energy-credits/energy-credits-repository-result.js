/**
 * ESA OS — Repositories / Energy Credits
 * Contrato de resultado para operações de repositório.
 *
 * Nunca lança exceção para erros de negócio — erros de domínio são valores.
 * Somente erros de programação (null passado onde objeto é esperado) devem
 * propagar como exception nos métodos estáticos de construção.
 *
 * Contrato: { ok, data, errors, warnings, metadata }
 */

export class EnergyCreditsRepositoryResult {

  /**
   * Cria resultado de sucesso.
   *
   * @param {*}        data
   * @param {Array}    warnings
   * @param {object}   metadata
   */
  static ok(data, warnings = [], metadata = {}) {
    return Object.freeze({
      ok:       true,
      data:     data,
      errors:   [],
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
  }

  /**
   * Cria resultado de falha.
   *
   * @param {Array}    errors
   * @param {Array}    warnings
   * @param {object}   metadata
   */
  static fail(errors = [], warnings = [], metadata = {}) {
    return Object.freeze({
      ok:       false,
      data:     null,
      errors:   Array.isArray(errors) ? errors : [errors].filter(Boolean),
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
  }

  /**
   * Cria estrutura de erro individual.
   *
   * @param {string}      code     - Código de erro (ex: 'REQUIRED', 'NOT_FOUND')
   * @param {string}      message  - Mensagem legível por humanos
   * @param {string|null} field    - Campo que gerou o erro (opcional)
   */
  static makeError(code, message, field = null) {
    return Object.freeze({ code, message, field: field !== undefined ? field : null });
  }
}
