/**
 * ESA OS — Energy Domain / Credits
 * Rounding Helpers
 *
 * Política centralizada de arredondamento:
 *   kWh  → 3 casas decimais
 *   R$   → 2 casas decimais
 *
 * Lança TypeError para valores inválidos — erro de programação, não de negócio.
 */

export function roundKwh(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new TypeError(`roundKwh: valor inválido recebido: ${value}`);
  }
  return Math.round(value * 1000) / 1000;
}

export function roundMoney(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new TypeError(`roundMoney: valor inválido recebido: ${value}`);
  }
  return Math.round(value * 100) / 100;
}
