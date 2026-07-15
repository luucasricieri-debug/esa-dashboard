/**
 * ESA OS — UI / Energy Credits
 * EnergyCreditsUINormalizer
 *
 * Remove campos proibidos de qualquer objeto antes de expor para a UI.
 * Aplica recursivamente em objetos e arrays.
 *
 * Campos proibidos (em qualquer nível de aninhamento):
 *   calculationMemory, _internal, _debug, __raw, __meta,
 *   password, passHash, sessionToken, sessionExpiresAt,
 *   serviceAccount, firebaseConfig, apiKey, secret,
 *   downloadUrl, stack, stackTrace, internalLog
 */

const FORBIDDEN_KEYS = new Set([
  'calculationMemory',
  '_internal',
  '_debug',
  '__raw',
  '__meta',
  'password',
  'passHash',
  'sessionToken',
  'sessionExpiresAt',
  'serviceAccount',
  'firebaseConfig',
  'apiKey',
  'secret',
  'downloadUrl',
  'stack',
  'stackTrace',
  'internalLog',
]);

export class EnergyCreditsUINormalizer {

  normalize(data) {
    return this._strip(data);
  }

  _strip(value) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(v => this._strip(v));
    if (typeof value !== 'object') return value;

    const result = {};
    for (const key of Object.keys(value)) {
      if (!FORBIDDEN_KEYS.has(key)) {
        result[key] = this._strip(value[key]);
      }
    }
    return result;
  }

}
