/**
 * ESA OS — Engines / Energy Billing
 * Currency Parser — pt-BR e US.
 *
 * Regra crítica: "0,60" significa R$ 0,60 (não R$ 60,00).
 * A vírgula isolada é separador decimal, não de milhar.
 *
 * NÃO usa Date.now, Math.random, Firebase, window, localStorage.
 */

/**
 * Converte string monetária para número.
 * Formatos suportados: 0,60 | 0.60 | R$ 0,60 | 1.234,56 | 1,234.56 | 1.250,50
 *
 * @param {*} raw
 * @returns {number|null}
 */
export function parseCurrency(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  let str = String(raw).trim().replace(/^R\$\s*/, '').replace(/\s+/g, '');
  if (!str) return null;

  const dotIdx   = str.lastIndexOf('.');
  const commaIdx = str.lastIndexOf(',');

  let normalized;
  if (dotIdx !== -1 && commaIdx !== -1) {
    normalized = dotIdx > commaIdx
      ? str.replace(/,/g, '')              // US: 1,234.56
      : str.replace(/\./g, '').replace(',', '.'); // BR: 1.234,56
  } else if (commaIdx !== -1) {
    normalized = str.replace(',', '.');    // decimal comma: 0,60 → 0.60
  } else if (dotIdx !== -1) {
    const afterDot = str.slice(dotIdx + 1);
    normalized = afterDot.length === 3 ? str.replace('.', '') : str; // thousands dot
  } else {
    normalized = str;
  }

  const num = Number(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Garante que um preço de kWh seja lido corretamente.
 * "0,60" → 0.60 (sessenta centavos)
 * "0.60" → 0.60
 * "R$ 0,60" → 0.60
 *
 * @param {*} raw
 * @returns {number|null}
 */
export function parseKwhPrice(raw) {
  return parseCurrency(raw);
}
