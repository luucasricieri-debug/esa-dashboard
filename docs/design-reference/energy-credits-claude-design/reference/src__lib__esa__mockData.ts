export type PaymentStatus = "pago" | "aberto" | "vencido";
export type UGStatus = "ativa" | "inativa" | "manutencao";
export type PixType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export interface Payee {
  name: string;
  document: string;
  pixKey: string;
  pixType: PixType;
}

export interface GeneratingUnit {
  id: string;
  name: string;
  owner: string;
  document: string;
  uc: string;
  distributor: string;
  status: UGStatus;
  purchasePrice: number; // R$/kWh
  previousBalance: number; // kWh
  monthlyGeneration: number; // kWh
  beneficiaries: string[]; // UB ids
  payee: Payee;
}

export interface BeneficiaryUnit {
  id: string;
  name: string;
  document: string;
  uc: string;
  distributor: string;
  ugId: string;
  status: "ativa" | "inativa";
  monthlyConsumption: number; // consumo real do mês (kWh)
  annualAverage: number; // média anual histórica (kWh/ano)
  previousCreditBalance: number; // saldo anterior na UC (kWh)
  allocationPct: number; // 0-1 (percentual de rateio configurado)
  preventiveMargin: number; // 0-1 (margem preventiva)
  esaPrice: number; // R$/kWh
  distributorTariff: number; // R$/kWh componente energia
  taxes: number; // R$ impostos do mês
  cip: number; // R$ iluminação pública / CIP
  otherCharges: number; // R$ outros encargos
  paymentStatus: PaymentStatus;
  customerSince: string; // "2025-08"
  accumulatedSavings: number; // R$ acumulado desde o cadastro
}

export const generatingUnits: GeneratingUnit[] = [
  {
    id: "UG-001",
    name: "UG Solar Assaí",
    owner: "João Pereira",
    document: "123.456.789-00",
    uc: "123456789",
    distributor: "Copel",
    status: "ativa",
    purchasePrice: 0.35,
    previousBalance: 2500,
    monthlyGeneration: 13000,
    beneficiaries: ["UB-001", "UB-002", "UB-003", "UB-004"],
    payee: {
      name: "João Pereira",
      document: "123.456.789-00",
      pixKey: "joao.pereira@esaenergia.com.br",
      pixType: "email",
    },
  },
  {
    id: "UG-002",
    name: "UG Solar Londrina",
    owner: "Maria Silva",
    document: "987.654.321-00",
    uc: "987654321",
    distributor: "Copel",
    status: "ativa",
    purchasePrice: 0.34,
    previousBalance: 1800,
    monthlyGeneration: 9500,
    beneficiaries: ["UB-005", "UB-006"],
    payee: {
      name: "Maria Silva",
      document: "987.654.321-00",
      pixKey: "987.654.321-00",
      pixType: "cpf",
    },
  },
  {
    id: "UG-003",
    name: "UG Solar Maringá",
    owner: "Construtora Norte Ltda",
    document: "12.345.678/0001-90",
    uc: "555666777",
    distributor: "Copel",
    status: "manutencao",
    purchasePrice: 0.36,
    previousBalance: 500,
    monthlyGeneration: 4200,
    beneficiaries: ["UB-007"],
    payee: {
      name: "Construtora Norte Ltda",
      document: "12.345.678/0001-90",
      pixKey: "12.345.678/0001-90",
      pixType: "cnpj",
    },
  },
];

export const beneficiaryUnits: BeneficiaryUnit[] = [
  {
    id: "UB-001",
    name: "Mercado Central",
    document: "11.222.333/0001-44",
    uc: "111222333",
    distributor: "Copel",
    ugId: "UG-001",
    status: "ativa",
    monthlyConsumption: 3950,
    annualAverage: 48000,
    previousCreditBalance: 350,
    allocationPct: 0.323,
    preventiveMargin: 0.05,
    esaPrice: 0.55,
    distributorTariff: 0.85,
    taxes: 420,
    cip: 51.97,
    otherCharges: 0,
    paymentStatus: "pago",
    customerSince: "2025-08",
    accumulatedSavings: 14870.45,
  },
  {
    id: "UB-002",
    name: "Panificadora Sol",
    document: "22.333.444/0001-55",
    uc: "222333444",
    distributor: "Copel",
    ugId: "UG-001",
    status: "ativa",
    monthlyConsumption: 2900,
    annualAverage: 36000,
    previousCreditBalance: 180,
    allocationPct: 0.245,
    preventiveMargin: 0.05,
    esaPrice: 0.55,
    distributorTariff: 0.85,
    taxes: 310,
    cip: 42.5,
    otherCharges: 0,
    paymentStatus: "aberto",
    customerSince: "2025-10",
    accumulatedSavings: 8210.3,
  },
  {
    id: "UB-003",
    name: "Clínica Vida",
    document: "33.444.555/0001-66",
    uc: "333444555",
    distributor: "Copel",
    ugId: "UG-001",
    status: "ativa",
    monthlyConsumption: 2050,
    annualAverage: 24000,
    previousCreditBalance: 120,
    allocationPct: 0.16,
    preventiveMargin: 0.05,
    esaPrice: 0.55,
    distributorTariff: 0.85,
    taxes: 220,
    cip: 38.9,
    otherCharges: 0,
    paymentStatus: "vencido",
    customerSince: "2025-06",
    accumulatedSavings: 9120.0,
  },
  {
    id: "UB-004",
    name: "Auto Posto Norte",
    document: "44.555.666/0001-77",
    uc: "444555666",
    distributor: "Copel",
    ugId: "UG-001",
    status: "ativa",
    monthlyConsumption: 3500,
    annualAverage: 42000,
    previousCreditBalance: 280,
    allocationPct: 0.272,
    preventiveMargin: 0.05,
    esaPrice: 0.55,
    distributorTariff: 0.88,
    taxes: 380,
    cip: 55.2,
    otherCharges: 0,
    paymentStatus: "pago",
    customerSince: "2025-09",
    accumulatedSavings: 11450.7,
  },
  {
    id: "UB-005",
    name: "Restaurante Sabor",
    document: "55.666.777/0001-88",
    uc: "555666777",
    distributor: "Copel",
    ugId: "UG-002",
    status: "ativa",
    monthlyConsumption: 3800,
    annualAverage: 45000,
    previousCreditBalance: 210,
    allocationPct: 0.66,
    preventiveMargin: 0.05,
    esaPrice: 0.55,
    distributorTariff: 0.85,
    taxes: 400,
    cip: 48.5,
    otherCharges: 0,
    paymentStatus: "pago",
    customerSince: "2025-07",
    accumulatedSavings: 12980.0,
  },
  {
    id: "UB-006",
    name: "Farmácia Popular",
    document: "66.777.888/0001-99",
    uc: "666777888",
    distributor: "Copel",
    ugId: "UG-002",
    status: "ativa",
    monthlyConsumption: 1800,
    annualAverage: 21600,
    previousCreditBalance: 90,
    allocationPct: 0.34,
    preventiveMargin: 0.05,
    esaPrice: 0.55,
    distributorTariff: 0.86,
    taxes: 195,
    cip: 32.0,
    otherCharges: 0,
    paymentStatus: "aberto",
    customerSince: "2025-11",
    accumulatedSavings: 4820.15,
  },
  {
    id: "UB-007",
    name: "Escola Aprender",
    document: "77.888.999/0001-11",
    uc: "777888999",
    distributor: "Copel",
    ugId: "UG-003",
    status: "ativa",
    monthlyConsumption: 2600,
    annualAverage: 30000,
    previousCreditBalance: 4800, // saldo elevado para dispararmos alerta
    allocationPct: 1.0,
    preventiveMargin: 0.05,
    esaPrice: 0.55,
    distributorTariff: 0.84,
    taxes: 280,
    cip: 40.0,
    otherCharges: 0,
    paymentStatus: "aberto",
    customerSince: "2025-05",
    accumulatedSavings: 6850.9,
  },
];

export const months = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
];

// ==========================================================================
// LEGACY SETTLEMENT (mantido para compatibilidade com telas existentes)
// ==========================================================================

export interface SettlementRow {
  ub: BeneficiaryUnit;
  allocated: number;
  compensated: number;
  pending: number;
  contaSemEsa: number;
  faturaEsa: number;
  contaComEsa: number;
  economia: number;
}

export interface SettlementResult {
  ug: GeneratingUnit;
  previousBalance: number;
  generation: number;
  available: number;
  totalAllocated: number;
  totalCompensated: number;
  totalPending: number;
  currentBalance: number;
  ownerPayment: number;
  esaRevenue: number;
  spread: number;
  rows: SettlementRow[];
}

export function computeSettlement(ug: GeneratingUnit, ubs: BeneficiaryUnit[]): SettlementResult {
  const available = ug.previousBalance + ug.monthlyGeneration;
  let remaining = available;
  const rows: SettlementRow[] = ubs.map((ub) => {
    const allocated = Math.min(ub.monthlyConsumption, remaining);
    remaining -= allocated;
    const compensated = allocated;
    const pending = ub.monthlyConsumption - compensated;
    const contaSemEsa =
      ub.monthlyConsumption * ub.distributorTariff + ub.taxes + ub.cip + ub.otherCharges;
    const faturaEsa = compensated * ub.esaPrice;
    const contaComEsa =
      faturaEsa + pending * ub.distributorTariff + ub.taxes + ub.cip + ub.otherCharges;
    const economia = contaSemEsa - contaComEsa;
    return { ub, allocated, compensated, pending, contaSemEsa, faturaEsa, contaComEsa, economia };
  });
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  const totalCompensated = rows.reduce((s, r) => s + r.compensated, 0);
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const currentBalance = available - totalAllocated;
  const ownerPayment = totalCompensated * ug.purchasePrice;
  const esaRevenue = rows.reduce((s, r) => s + r.faturaEsa, 0);
  return {
    ug,
    previousBalance: ug.previousBalance,
    generation: ug.monthlyGeneration,
    available,
    totalAllocated,
    totalCompensated,
    totalPending,
    currentBalance,
    ownerPayment,
    esaRevenue,
    spread: esaRevenue - ownerPayment,
    rows,
  };
}

export function computeAll() {
  return generatingUnits.map((ug) =>
    computeSettlement(
      ug,
      beneficiaryUnits.filter((u) => u.ugId === ug.id),
    ),
  );
}

// ==========================================================================
// NEW: RATEIO PERCENTUAL / MOTOR DE CRÉDITOS
// ==========================================================================

export interface AllocationRow {
  ub: BeneficiaryUnit;
  // === Nomes conceituais alinhados ao contrato do ESA OS ===
  averageMonthlyConsumptionKwh: number;
  preventiveMarginPercentage: number; // 0-1
  targetCreditKwh: number;
  currentBalanceKwh: number;
  recommendedCreditsToReceiveKwh: number; // max(0, target - saldo atual)
  recommendedAllocationPercentage: number; // % sugerido pelo sistema
  allocationPercentage: number; // 0-1 (auto ou manual)
  plannedCreditsReceivedKwh: number; // geração * %
  creditsReceivedKwh: number; // no mock igual ao planejado
  monthlyConsumptionKwh: number;
  creditsCompensatedKwh: number;
  previousBalanceKwh: number;
  finalBalanceKwh: number;
  coverageMonths: number; // finalBalance / média mensal

  // aliases legados (mantidos p/ retrocompatibilidade)
  monthlyAverage: number;
  previousBalance: number;
  preventiveMargin: number;
  targetCredit: number;
  allocationPct: number;
  projectedCredits: number;
  receivedCredits: number;
  consumption: number;
  compensated: number;
  finalBalance: number;
  recommendedPct: number;
}

export interface AllocationPlan {
  ug: GeneratingUnit;
  generation: number;
  rows: AllocationRow[];
  totalPct: number;
  totalProjected: number;
  totalCompensated: number;
  totalFinalBalance: number;
  ownerPayment: number;
  esaRevenue: number;
  totalRecommended: number;
  totalTargetCredit: number;
  totalConsumption: number;
}

export function computeAllocationPlan(
  ug: GeneratingUnit,
  ubs: BeneficiaryUnit[],
  overrides?: Record<string, { allocationPct?: number; preventiveMargin?: number }>,
): AllocationPlan {
  const gen = ug.monthlyGeneration;
  const monthlyAverages = ubs.map((u) => u.annualAverage / 12);

  // % recomendado = fração do "recommendedCreditsToReceive" no total (proporcional ao déficit)
  const recommendedNeeds = ubs.map((u, i) => {
    const margin = overrides?.[u.id]?.preventiveMargin ?? u.preventiveMargin;
    const target = monthlyAverages[i] * (1 + margin);
    return Math.max(0, target - u.previousCreditBalance);
  });
  const sumRec = recommendedNeeds.reduce((a, b) => a + b, 0);

  const rows: AllocationRow[] = ubs.map((ub, i) => {
    const ov = overrides?.[ub.id] ?? {};
    const allocationPct = ov.allocationPct ?? ub.allocationPct;
    const preventiveMargin = ov.preventiveMargin ?? ub.preventiveMargin;
    const monthlyAverage = monthlyAverages[i];
    const targetCredit = monthlyAverage * (1 + preventiveMargin);
    const currentBalance = ub.previousCreditBalance;
    const recommendedAdd = Math.max(0, targetCredit - currentBalance);
    const recommendedPct = sumRec > 0 ? recommendedAdd / sumRec : 0;
    const plannedCredits = gen * allocationPct;
    const receivedCredits = plannedCredits;
    const consumption = ub.monthlyConsumption;
    const available = currentBalance + receivedCredits;
    const compensated = Math.min(consumption, available);
    const finalBalance = available - compensated;
    const coverageMonths = monthlyAverage > 0 ? finalBalance / monthlyAverage : 0;

    return {
      ub,
      averageMonthlyConsumptionKwh: monthlyAverage,
      preventiveMarginPercentage: preventiveMargin,
      targetCreditKwh: targetCredit,
      currentBalanceKwh: currentBalance,
      recommendedCreditsToReceiveKwh: recommendedAdd,
      recommendedAllocationPercentage: recommendedPct,
      allocationPercentage: allocationPct,
      plannedCreditsReceivedKwh: plannedCredits,
      creditsReceivedKwh: receivedCredits,
      monthlyConsumptionKwh: consumption,
      creditsCompensatedKwh: compensated,
      previousBalanceKwh: currentBalance,
      finalBalanceKwh: finalBalance,
      coverageMonths,
      // aliases legados
      monthlyAverage,
      previousBalance: currentBalance,
      preventiveMargin,
      targetCredit,
      allocationPct,
      projectedCredits: plannedCredits,
      receivedCredits,
      consumption,
      compensated,
      finalBalance,
      recommendedPct,
    };
  });

  const totalPct = rows.reduce((s, r) => s + r.allocationPercentage, 0);
  const totalProjected = rows.reduce((s, r) => s + r.plannedCreditsReceivedKwh, 0);
  const totalCompensated = rows.reduce((s, r) => s + r.creditsCompensatedKwh, 0);
  const totalFinalBalance = rows.reduce((s, r) => s + r.finalBalanceKwh, 0);
  const totalRecommended = rows.reduce((s, r) => s + r.recommendedCreditsToReceiveKwh, 0);
  const totalTargetCredit = rows.reduce((s, r) => s + r.targetCreditKwh, 0);
  const totalConsumption = rows.reduce((s, r) => s + r.monthlyConsumptionKwh, 0);
  const ownerPayment = totalCompensated * ug.purchasePrice;
  const esaRevenue = rows.reduce((s, r) => s + r.creditsCompensatedKwh * r.ub.esaPrice, 0);

  return {
    ug,
    generation: gen,
    rows,
    totalPct,
    totalProjected,
    totalCompensated,
    totalFinalBalance,
    ownerPayment,
    esaRevenue,
    totalRecommended,
    totalTargetCredit,
    totalConsumption,
  };
}


// ==========================================================================
// FATURA ESA — cálculo pela nova regra
// ==========================================================================

export interface BeneficiaryInvoice {
  ub: BeneficiaryUnit;
  ug: GeneratingUnit;
  month: string;
  docNumber: string;
  dueDate: string;
  // energia
  consumption: number;
  previousBalance: number;
  receivedCredits: number;
  availableCredits: number;
  compensated: number;
  finalBalance: number;
  // financeiro
  faturaEsa: number;
  taxes: number;
  cip: number;
  otherCharges: number;
  totalWithEsa: number;
  energyWithoutEsa: number;
  totalWithoutEsa: number;
  monthlySavings: number;
  discountPct: number;
  // acumulado
  customerSince: string;
  monthsAsCustomer: number;
  accumulatedSavings: number;
  savingsHistory: { month: string; label: string; monthly: number; cumulative: number }[];
}

export function buildInvoice(ubId: string, month: string): BeneficiaryInvoice | null {
  const ub = beneficiaryUnits.find((u) => u.id === ubId);
  if (!ub) return null;
  const ug = generatingUnits.find((g) => g.id === ub.ugId)!;
  const receivedCredits = ug.monthlyGeneration * ub.allocationPct;
  const previousBalance = ub.previousCreditBalance;
  const availableCredits = previousBalance + receivedCredits;
  const compensated = Math.min(ub.monthlyConsumption, availableCredits);
  const finalBalance = availableCredits - compensated;

  const faturaEsa = compensated * ub.esaPrice;
  const totalWithEsa = faturaEsa + ub.taxes + ub.cip + ub.otherCharges;
  const energyWithoutEsa = ub.monthlyConsumption * ub.distributorTariff;
  const totalWithoutEsa = energyWithoutEsa + ub.taxes + ub.cip + ub.otherCharges;
  const monthlySavings = totalWithoutEsa - totalWithEsa;
  const discountPct = totalWithoutEsa > 0 ? (monthlySavings / totalWithoutEsa) * 100 : 0;

  // histórico simulado
  const monthsAsCustomer = monthsBetween(ub.customerSince, month);
  const savingsHistory = buildSavingsHistory(ub.customerSince, month, ub.accumulatedSavings);

  const [y, m] = month.split("-").map(Number);
  const dueDate = `10/${String(m + 1).padStart(2, "0")}/${y}`;

  return {
    ub,
    ug,
    month,
    docNumber: `ESA-${month.replace("-", "")}-${ub.id.replace("-", "")}`,
    dueDate,
    consumption: ub.monthlyConsumption,
    previousBalance,
    receivedCredits,
    availableCredits,
    compensated,
    finalBalance,
    faturaEsa,
    taxes: ub.taxes,
    cip: ub.cip,
    otherCharges: ub.otherCharges,
    totalWithEsa,
    energyWithoutEsa,
    totalWithoutEsa,
    monthlySavings,
    discountPct,
    customerSince: ub.customerSince,
    monthsAsCustomer,
    accumulatedSavings: ub.accumulatedSavings,
    savingsHistory,
  };
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

function buildSavingsHistory(from: string, to: string, accumulated: number) {
  const monthsList: { month: string; label: string }[] = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const monthStr = `${y}-${String(m).padStart(2, "0")}`;
    const label = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m - 1];
    monthsList.push({ month: monthStr, label });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const n = monthsList.length;
  if (n === 0) return [];
  // distribui o acumulado com pequena variação
  const base = accumulated / n;
  let cum = 0;
  return monthsList.map((it, i) => {
    const factor = 0.85 + (i / Math.max(1, n - 1)) * 0.3;
    const monthly = base * factor;
    cum += monthly;
    return { month: it.month, label: it.label, monthly, cumulative: cum };
  });
}

// ==========================================================================
// ALERTAS
// ==========================================================================

export interface Alert {
  id: string;
  severity: "critico" | "risco" | "atencao" | "info";
  code: string;
  message: string;
  unit: string;
  month: string;
  action: string;
}

export const alerts: Alert[] = [
  {
    id: "A-001",
    severity: "critico",
    code: "ALLOCATION_PERCENTAGE_TOTAL_INVALID",
    message: "A soma dos percentuais de rateio deve totalizar 100%.",
    unit: "UG-002",
    month: "2026-07",
    action: "Ajustar percentuais na tela de Apuração Mensal.",
  },
  {
    id: "A-002",
    severity: "risco",
    code: "HIGH_BENEFICIARY_CREDIT_BALANCE",
    message: "Saldo acumulado superior a 1,5 mês da média de consumo.",
    unit: "UB-007",
    month: "2026-07",
    action: "Reduzir percentual de rateio ou margem preventiva.",
  },
  {
    id: "A-003",
    severity: "risco",
    code: "LOW_BENEFICIARY_CREDIT_BALANCE",
    message:
      "Saldo disponível e crédito planejado abaixo do crédito alvo.",
    unit: "UB-003",
    month: "2026-07",
    action: "Aumentar percentual de rateio ou revisar margem preventiva.",
  },
  {
    id: "A-004",
    severity: "atencao",
    code: "CONSUMPTION_ABOVE_AVERAGE",
    message: "Consumo real acima de 110% da média mensal.",
    unit: "UB-004",
    month: "2026-07",
    action: "Revisar média e planejamento de créditos.",
  },
  {
    id: "A-005",
    severity: "atencao",
    code: "LOW_BENEFICIARY_CREDIT_BALANCE",
    message: "Cobertura do saldo inferior a 0,25 mês.",
    unit: "UB-006",
    month: "2026-07",
    action: "Aumentar percentual de rateio para elevar o saldo mínimo.",
  },
  {
    id: "A-006",
    severity: "info",
    code: "HIGH_BENEFICIARY_CREDIT_BALANCE",
    message: "Cobertura do saldo elevada — acima de 2 meses.",
    unit: "UB-001",
    month: "2026-06",
    action: "Considerar reduzir margem preventiva no próximo ciclo.",
  },
];

