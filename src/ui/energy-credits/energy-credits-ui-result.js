/**
 * ESA OS — UI / Energy Credits
 * UIResult
 *
 * Contrato único de resultado para toda a camada de UI de créditos ESA Energia.
 * Normaliza EnergyCreditsQueryResult, EnergyBillingResult, EnergyCreditsResult,
 * UtilityBillResult e EnergyCreditsRepositoryResult para um único envelope.
 *
 * { ok, data, errors, warnings, metadata }
 */

export class UIResult {

  static ok(data, metadata = {}, warnings = []) {
    return Object.freeze({
      ok:       true,
      data,
      errors:   [],
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: (metadata && typeof metadata === 'object') ? metadata : {},
    });
  }

  static fail(errors, metadata = {}, warnings = []) {
    const errs = Array.isArray(errors) ? errors : [errors].filter(Boolean);
    return Object.freeze({
      ok:       false,
      data:     null,
      errors:   errs,
      warnings: Array.isArray(warnings) ? warnings : [],
      metadata: (metadata && typeof metadata === 'object') ? metadata : {},
    });
  }

  static makeError(code, message, field = null, meta = {}) {
    return { code, message, field: field || null, metadata: meta || {} };
  }

  /**
   * Converte qualquer resultado da camada de aplicação para UIResult.
   *
   * Suporta:
   *  - EnergyCreditsQueryResult  { data, metadata, generatedAt } — sem .ok
   *  - EnergyBillingResult       { ok, snapshot, errors, warnings, metadata }
   *  - EnergyCreditsResult       { ok, data, errors, warnings, metadata }
   *  - UtilityBillResult         { ok, data, errors, warnings, metadata }
   *  - EnergyCreditsRepositoryResult { ok, data, errors, warnings, metadata }
   */
  static fromApplicationResult(result) {
    if (result === null || result === undefined) {
      return UIResult.fail([UIResult.makeError('NULL_RESULT', 'Resultado nulo retornado pela aplicação')]);
    }

    // EnergyCreditsQueryResult: tem .toJSON(), tem .generatedAt e NÃO tem .ok
    if (result.ok === undefined && typeof result.toJSON === 'function') {
      const json = result.toJSON();
      return UIResult.ok(json.data, Object.assign({}, json.metadata, { generatedAt: json.generatedAt }));
    }

    // EnergyCreditsQueryResult já serializado via .toJSON(): { data, metadata, generatedAt }
    if (result.ok === undefined && result.generatedAt !== undefined && 'data' in result && 'metadata' in result) {
      return UIResult.ok(result.data, Object.assign({}, result.metadata, { generatedAt: result.generatedAt }));
    }

    // EnergyBillingResult: tem .ok e .snapshot (não .data)
    if (result.ok !== undefined && 'snapshot' in result && !('data' in result)) {
      if (!result.ok) {
        return UIResult.fail(result.errors || [], result.metadata || {}, result.warnings || []);
      }
      return UIResult.ok(result.snapshot, result.metadata || {}, result.warnings || []);
    }

    // EnergyCreditsResult / UtilityBillResult / EnergyCreditsRepositoryResult: tem .ok e .data
    if (result.ok !== undefined) {
      if (!result.ok) {
        return UIResult.fail(result.errors || [], result.metadata || {}, result.warnings || []);
      }
      return UIResult.ok(result.data, result.metadata || {}, result.warnings || []);
    }

    // Plain object sem envelope — envelopa diretamente
    return UIResult.ok(result, {});
  }

}
