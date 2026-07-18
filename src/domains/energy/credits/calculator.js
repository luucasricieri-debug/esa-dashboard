/**
 * ESA OS — Energy Domain / Credits
 * EnergyCreditsCalculator
 *
 * Fórmulas puras de cálculo do módulo de créditos.
 * Sem estado. Sem efeitos colaterais. Sem acesso a Firebase/window/localStorage.
 * Todas as funções retornam valores arredondados pela política centralizada.
 */

import { roundKwh, roundMoney } from './rounding.js';

export class EnergyCreditsCalculator {

  /** Fórmula 1: Saldo disponível antes das alocações (kWh) */
  availableKwhBeforeAllocation(previousBalance, monthlyGeneration) {
    return roundKwh(previousBalance + monthlyGeneration);
  }

  /** Fórmula 2: Total alocado (soma allocatedKwh dos registros) */
  totalAllocatedKwh(records) {
    return roundKwh(records.reduce((s, r) => s + (r.allocatedKwh || 0), 0));
  }

  /** Fórmula 3: Total compensado (soma compensatedKwh dos registros) */
  totalCompensatedKwh(records) {
    return roundKwh(records.reduce((s, r) => s + (r.compensatedKwh || 0), 0));
  }

  /** Fórmula 4: Total pendente (soma pendingKwh dos registros) */
  totalPendingKwh(records) {
    return roundKwh(records.reduce((s, r) => s + (r.pendingKwh || 0), 0));
  }

  /** Fórmula 5: Saldo acumulado atual */
  currentAccumulatedBalance(previousBalance, monthlyGeneration, totalAllocated) {
    return roundKwh(previousBalance + monthlyGeneration - totalAllocated);
  }

  /** Fórmula 6: Residual da beneficiária (nunca negativo) */
  residualKwh(monthlyConsumption, compensated) {
    return roundKwh(Math.max(0, monthlyConsumption - compensated));
  }

  /** Fórmula 7: Fatura sem ESA */
  billWithoutEsa(consumption, utilityTariff) {
    return roundMoney(consumption * utilityTariff);
  }

  /** Fórmula 8: Fatura ESA */
  esaInvoiceAmount(compensated, esaPrice) {
    return roundMoney(compensated * esaPrice);
  }

  /** Fórmula auxiliar: Parcela residual da distribuidora */
  residualUtilityAmount(residual, utilityTariff) {
    return roundMoney(residual * utilityTariff);
  }

  /** Fórmula 9: Fatura com ESA */
  billWithEsa(esaInvoice, residualUtility) {
    return roundMoney(esaInvoice + residualUtility);
  }

  /** Fórmula 10: Desconto mensal */
  monthlyDiscount(billWithoutEsa, billWithEsa) {
    return roundMoney(billWithoutEsa - billWithEsa);
  }

  /** Fórmula 11: Desconto acumulado total */
  accumulatedDiscountTotal(previousAccumulated, monthly) {
    return roundMoney(previousAccumulated + monthly);
  }

  /** Fórmula 12: Retorno mensal ao proprietário */
  monthlyOwnerReturn(totalCompensated, purchasePrice) {
    return roundMoney(totalCompensated * purchasePrice);
  }

  /** Fórmula 13: Receita ESA (soma esaInvoiceAmount dos registros) */
  totalEsaRevenue(records) {
    return roundMoney(records.reduce((s, r) => s + (r.esaInvoiceAmount || 0), 0));
  }

  /** Fórmula 14: Spread bruto ESA */
  grossSpread(totalEsaRevenue, totalOwnerReturn) {
    return roundMoney(totalEsaRevenue - totalOwnerReturn);
  }
}
