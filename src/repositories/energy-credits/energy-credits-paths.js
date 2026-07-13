/**
 * ESA OS — Repositories / Energy Credits
 * Constantes de paths lógicos e builder de path.
 *
 * Paths são lógicos — não acoplados ao Firebase diretamente.
 * Validação defensiva: path traversal e caracteres inválidos são rejeitados.
 */

/** Coleções permitidas no módulo Energy Credits. */
export const EC_COLLECTIONS = Object.freeze([
  'generatingUnits',
  'beneficiaryUnits',
  'generatingUnitMonthlyRecords',
  'beneficiaryMonthlyRecords',
  'creditAllocations',
  'ownerSettlements',
  'esaInvoices',
  'monthlyReports',
  'creditDocuments',
  'creditAuditLog',
]);

const _ALLOWED = new Set(EC_COLLECTIONS);

/** Prefixo raiz de todos os paths do módulo. */
export const EC_ROOT = 'energyCredits';

/** Paths base por coleção (sem id). */
export const EC_PATHS = Object.freeze(
  Object.fromEntries(EC_COLLECTIONS.map(c => [c, `${EC_ROOT}/${c}`])),
);

/** Caracteres proibidos em IDs (Firebase + path traversal). */
const INVALID_ID_PATTERNS = ['/', '..', '#', '$', '[', ']'];

/**
 * Constrói o path lógico de uma coleção (sem id).
 * Útil para listagens que precisam do path da collection inteira.
 *
 * @param {string} collection - Nome da coleção (deve estar em EC_COLLECTIONS)
 * @returns {string}          - "energyCredits/{collection}"
 * @throws {TypeError}        - Se collection for inválida
 */
export function buildEnergyCreditsCollectionPath(collection) {
  if (!_ALLOWED.has(collection)) {
    throw new TypeError(
      `[buildEnergyCreditsCollectionPath] collection inválida: "${collection}". ` +
      `Válidas: ${EC_COLLECTIONS.join(', ')}`,
    );
  }
  return `${EC_ROOT}/${collection}`;
}

/**
 * Constrói o path lógico de um item em uma coleção.
 *
 * @param {string} collection - Nome da coleção (deve estar em EC_COLLECTIONS)
 * @param {string} id         - ID do item (obrigatório, sem caracteres inválidos)
 * @returns {string}          - "energyCredits/{collection}/{id}"
 * @throws {TypeError}        - Se collection ou id forem inválidos
 */
export function buildEnergyCreditsPath(collection, id) {
  if (!_ALLOWED.has(collection)) {
    throw new TypeError(
      `[buildEnergyCreditsPath] collection inválida: "${collection}". ` +
      `Válidas: ${EC_COLLECTIONS.join(', ')}`,
    );
  }
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new TypeError('[buildEnergyCreditsPath] id é obrigatório e deve ser string não-vazia');
  }
  for (const pattern of INVALID_ID_PATTERNS) {
    if (id.includes(pattern)) {
      throw new TypeError(
        `[buildEnergyCreditsPath] id contém caractere inválido: "${pattern}" em "${id}"`,
      );
    }
  }
  return `${EC_ROOT}/${collection}/${id}`;
}
