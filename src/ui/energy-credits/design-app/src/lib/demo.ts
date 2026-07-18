// ============================================================
// DEMO DATA — standalone, no real provider connection
// ============================================================

export type PaymentStatus = 'pago' | 'aberto' | 'vencido';
export type UGStatus = 'ativa' | 'inativa' | 'manutencao';
export type PixType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
export type CycleStatus = 'aberto' | 'em_apuracao' | 'fechado';

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
  purchasePrice: number;
  previousBalance: number;
  monthlyGeneration: number;
  beneficiaries: string[];
  payee: Payee;
}

export interface BeneficiaryUnit {
  id: string;
  name: string;
  document: string;
  uc: string;
  distributor: string;
  ugId: string;
  status: 'ativa' | 'inativa';
  monthlyConsumption: number;
  annualAverage: number;
  previousCreditBalance: number;
  allocationPct: number;
  preventiveMargin: number;
  esaPrice: number;
  distributorTariff: number;
  taxes: number;
  cip: number;
  otherCharges: number;
  paymentStatus: PaymentStatus;
  customerSince: string;
  accumulatedSavings: number;
}

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

export interface AllocationRow {
  ub: BeneficiaryUnit;
  averageMonthlyConsumptionKwh: number;
  preventiveMarginPercentage: number;
  targetCreditKwh: number;
  currentBalanceKwh: number;
  recommendedCreditsToReceiveKwh: number;
  recommendedAllocationPercentage: number;
  allocationPercentage: number;
  plannedCreditsReceivedKwh: number;
  creditsReceivedKwh: number;
  monthlyConsumptionKwh: number;
  creditsCompensatedKwh: number;
  previousBalanceKwh: number;
  finalBalanceKwh: number;
  coverageMonths: number;
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

export interface BeneficiaryInvoice {
  ub: BeneficiaryUnit;
  ug: GeneratingUnit;
  month: string;
  docNumber: string;
  dueDate: string;
  consumption: number;
  previousBalance: number;
  receivedCredits: number;
  availableCredits: number;
  compensated: number;
  finalBalance: number;
  faturaEsa: number;
  taxes: number;
  cip: number;
  otherCharges: number;
  totalWithEsa: number;
  energyWithoutEsa: number;
  totalWithoutEsa: number;
  monthlySavings: number;
  discountPct: number;
  customerSince: string;
  monthsAsCustomer: number;
  accumulatedSavings: number;
  savingsHistory: { month: string; label: string; monthly: number; cumulative: number }[];
}

export interface Alert {
  id: string;
  severity: 'critico' | 'risco' | 'atencao' | 'info';
  code: string;
  message: string;
  unit: string;
  month: string;
  action: string;
}

export interface KpiDelta {
  value: number;
  pct: number;
  direction: 'up' | 'down' | 'flat';
}

export interface PeriodFilter {
  month: string;
  ugId?: string;
}

export interface ExecutiveSummary {
  month: string;
  cycleStatus: CycleStatus;
  operational: {
    generatingUnits: { total: number; active: number };
    beneficiaryUnits: { total: number; active: number };
    generation: number;
    compensated: number;
    balance: number;
  };
  financial: {
    revenue: number;
    ownerPayment: number;
    spread: number;
    savings: number;
    criticalAlerts: number;
  };
  deltas: {
    generation: KpiDelta;
    compensated: KpiDelta;
    balance: KpiDelta;
    revenue: KpiDelta;
    ownerPayment: KpiDelta;
    spread: KpiDelta;
    savings: KpiDelta;
    criticalAlerts: KpiDelta;
  };
  results: SettlementResult[];
}

// ============================================================
// STATIC DATA
// ============================================================

export const generatingUnits: GeneratingUnit[] = [
  {
    id: 'UG-001',
    name: 'UG Solar Assaí',
    owner: 'João Pereira',
    document: '123.456.789-00',
    uc: '123456789',
    distributor: 'Copel',
    status: 'ativa',
    purchasePrice: 0.35,
    previousBalance: 2500,
    monthlyGeneration: 13000,
    beneficiaries: ['UB-001', 'UB-002', 'UB-003', 'UB-004'],
    payee: {
      name: 'João Pereira',
      document: '123.456.789-00',
      pixKey: 'joao.pereira@esaenergia.com.br',
      pixType: 'email',
    },
  },
  {
    id: 'UG-002',
    name: 'UG Solar Londrina',
    owner: 'Maria Silva',
    document: '987.654.321-00',
    uc: '987654321',
    distributor: 'Copel',
    status: 'ativa',
    purchasePrice: 0.34,
    previousBalance: 1800,
    monthlyGeneration: 9500,
    beneficiaries: ['UB-005', 'UB-006'],
    payee: {
      name: 'Maria Silva',
      document: '987.654.321-00',
      pixKey: '987.654.321-00',
      pixType: 'cpf',
    },
  },
  {
    id: 'UG-003',
    name: 'UG Solar Maringá',
    owner: 'Construtora Norte Ltda',
    document: '12.345.678/0001-90',
    uc: '555666777',
    distributor: 'Copel',
    status: 'manutencao',
    purchasePrice: 0.36,
    previousBalance: 500,
    monthlyGeneration: 4200,
    beneficiaries: ['UB-007'],
    payee: {
      name: 'Construtora Norte Ltda',
      document: '12.345.678/0001-90',
      pixKey: '12.345.678/0001-90',
      pixType: 'cnpj',
    },
  },
];

export const beneficiaryUnits: BeneficiaryUnit[] = [
  {
    id: 'UB-001',
    name: 'Mercado Central',
    document: '11.222.333/0001-44',
    uc: '111222333',
    distributor: 'Copel',
    ugId: 'UG-001',
    status: 'ativa',
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
    paymentStatus: 'pago',
    customerSince: '2025-08',
    accumulatedSavings: 14870.45,
  },
  {
    id: 'UB-002',
    name: 'Panificadora Sol',
    document: '22.333.444/0001-55',
    uc: '222333444',
    distributor: 'Copel',
    ugId: 'UG-001',
    status: 'ativa',
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
    paymentStatus: 'aberto',
    customerSince: '2025-10',
    accumulatedSavings: 8210.3,
  },
  {
    id: 'UB-003',
    name: 'Clínica Vida',
    document: '33.444.555/0001-66',
    uc: '333444555',
    distributor: 'Copel',
    ugId: 'UG-001',
    status: 'ativa',
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
    paymentStatus: 'vencido',
    customerSince: '2025-06',
    accumulatedSavings: 9120.0,
  },
  {
    id: 'UB-004',
    name: 'Auto Posto Norte',
    document: '44.555.666/0001-77',
    uc: '444555666',
    distributor: 'Copel',
    ugId: 'UG-001',
    status: 'ativa',
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
    paymentStatus: 'pago',
    customerSince: '2025-09',
    accumulatedSavings: 11450.7,
  },
  {
    id: 'UB-005',
    name: 'Restaurante Sabor',
    document: '55.666.777/0001-88',
    uc: '555666777',
    distributor: 'Copel',
    ugId: 'UG-002',
    status: 'ativa',
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
    paymentStatus: 'pago',
    customerSince: '2025-07',
    accumulatedSavings: 12980.0,
  },
  {
    id: 'UB-006',
    name: 'Farmácia Popular',
    document: '66.777.888/0001-99',
    uc: '666777888',
    distributor: 'Copel',
    ugId: 'UG-002',
    status: 'ativa',
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
    paymentStatus: 'aberto',
    customerSince: '2025-11',
    accumulatedSavings: 4820.15,
  },
  {
    id: 'UB-007',
    name: 'Escola Aprender',
    document: '77.888.999/0001-11',
    uc: '777888999',
    distributor: 'Copel',
    ugId: 'UG-003',
    status: 'ativa',
    monthlyConsumption: 2600,
    annualAverage: 30000,
    previousCreditBalance: 4800,
    allocationPct: 1.0,
    preventiveMargin: 0.05,
    esaPrice: 0.55,
    distributorTariff: 0.84,
    taxes: 280,
    cip: 40.0,
    otherCharges: 0,
    paymentStatus: 'aberto',
    customerSince: '2025-05',
    accumulatedSavings: 6850.9,
  },
];

export const months = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
];

export const alerts: Alert[] = [
  {
    id: 'A-001',
    severity: 'critico',
    code: 'ALLOCATION_PERCENTAGE_TOTAL_INVALID',
    message: 'A soma dos percentuais de rateio deve totalizar 100%.',
    unit: 'UG-002',
    month: '2026-07',
    action: 'Ajustar percentuais na tela de Apuração Mensal.',
  },
  {
    id: 'A-002',
    severity: 'risco',
    code: 'HIGH_BENEFICIARY_CREDIT_BALANCE',
    message: 'Saldo acumulado superior a 1,5 mês da média de consumo.',
    unit: 'UB-007',
    month: '2026-07',
    action: 'Reduzir percentual de rateio ou margem preventiva.',
  },
  {
    id: 'A-003',
    severity: 'risco',
    code: 'LOW_BENEFICIARY_CREDIT_BALANCE',
    message: 'Saldo disponível e crédito planejado abaixo do crédito alvo.',
    unit: 'UB-003',
    month: '2026-07',
    action: 'Aumentar percentual de rateio ou revisar margem preventiva.',
  },
  {
    id: 'A-004',
    severity: 'atencao',
    code: 'CONSUMPTION_ABOVE_AVERAGE',
    message: 'Consumo real acima de 110% da média mensal.',
    unit: 'UB-004',
    month: '2026-07',
    action: 'Revisar média e planejamento de créditos.',
  },
  {
    id: 'A-005',
    severity: 'atencao',
    code: 'LOW_BENEFICIARY_CREDIT_BALANCE',
    message: 'Cobertura do saldo inferior a 0,25 mês.',
    unit: 'UB-006',
    month: '2026-07',
    action: 'Aumentar percentual de rateio para elevar o saldo mínimo.',
  },
  {
    id: 'A-006',
    severity: 'info',
    code: 'HIGH_BENEFICIARY_CREDIT_BALANCE',
    message: 'Cobertura do saldo elevada — acima de 2 meses.',
    unit: 'UB-001',
    month: '2026-06',
    action: 'Considerar reduzir margem preventiva no próximo ciclo.',
  },
];

export const availableMonths = [
  { value: '2026-07', label: 'Julho de 2026', status: 'em_apuracao' as CycleStatus },
  { value: '2026-06', label: 'Junho de 2026', status: 'fechado' as CycleStatus },
  { value: '2026-05', label: 'Maio de 2026', status: 'fechado' as CycleStatus },
  { value: '2026-04', label: 'Abril de 2026', status: 'fechado' as CycleStatus },
  { value: '2026-03', label: 'Março de 2026', status: 'fechado' as CycleStatus },
];

// ============================================================
// COMPUTATION FUNCTIONS
// ============================================================

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

export function computeAllocationPlan(
  ug: GeneratingUnit,
  ubs: BeneficiaryUnit[],
  overrides?: Record<string, { allocationPct?: number; preventiveMargin?: number }>,
): AllocationPlan {
  const gen = ug.monthlyGeneration;
  const monthlyAverages = ubs.map((u) => u.annualAverage / 12);
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

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

function buildSavingsHistory(from: string, to: string, accumulated: number) {
  const monthsList: { month: string; label: string }[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const label = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1];
    monthsList.push({ month: monthStr, label });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const n = monthsList.length;
  if (n === 0) return [];
  const base = accumulated / n;
  let cum = 0;
  return monthsList.map((it, i) => {
    const factor = 0.85 + (i / Math.max(1, n - 1)) * 0.3;
    const monthly = base * factor;
    cum += monthly;
    return { month: it.month, label: it.label, monthly, cumulative: cum };
  });
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
  const monthsAsCustomer = monthsBetween(ub.customerSince, month);
  const savingsHistory = buildSavingsHistory(ub.customerSince, month, ub.accumulatedSavings);

  const [y, m] = month.split('-').map(Number);
  const dueDate = `10/${String(m + 1).padStart(2, '0')}/${y}`;

  return {
    ub,
    ug,
    month,
    docNumber: `ESA-${month.replace('-', '')}-${ubId.replace('-', '')}`,
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

// ============================================================
// DEMO PROVIDER
// ============================================================

const monthFactor: Record<string, number> = {
  '2026-07': 1.0,
  '2026-06': 0.92,
  '2026-05': 0.88,
  '2026-04': 0.83,
  '2026-03': 0.79,
};

const criticalByMonth: Record<string, number> = {
  '2026-07': 2,
  '2026-06': 3,
  '2026-05': 2,
  '2026-04': 4,
  '2026-03': 3,
};

function delta(current: number, previous: number): KpiDelta {
  if (previous === 0)
    return { value: current, pct: 0, direction: current > 0 ? 'up' : 'flat' };
  const diff = current - previous;
  const pct = (diff / Math.abs(previous)) * 100;
  const direction: KpiDelta['direction'] =
    Math.abs(pct) < 0.5 ? 'flat' : diff > 0 ? 'up' : 'down';
  return { value: diff, pct, direction };
}

function scaledResults(month: string, ugId?: string): SettlementResult[] {
  const factor = monthFactor[month] ?? 1;
  const all = computeAll();
  const filtered = ugId ? all.filter((r) => r.ug.id === ugId) : all;
  return filtered.map((r) => ({
    ...r,
    generation: r.generation * factor,
    available: r.available * factor,
    totalAllocated: r.totalAllocated * factor,
    totalCompensated: r.totalCompensated * factor,
    totalPending: r.totalPending * factor,
    currentBalance: r.currentBalance * factor,
    ownerPayment: r.ownerPayment * factor,
    esaRevenue: r.esaRevenue * factor,
    spread: r.spread * factor,
    rows: r.rows.map((row) => ({
      ...row,
      allocated: row.allocated * factor,
      compensated: row.compensated * factor,
      faturaEsa: row.faturaEsa * factor,
      economia: row.economia * factor,
    })),
  }));
}

function previousMonth(month: string): string | undefined {
  const idx = availableMonths.findIndex((m) => m.value === month);
  return availableMonths[idx + 1]?.value;
}

function aggregate(results: SettlementResult[]) {
  return {
    generation: results.reduce((s, r) => s + r.generation, 0),
    compensated: results.reduce((s, r) => s + r.totalCompensated, 0),
    balance: results.reduce((s, r) => s + r.currentBalance, 0),
    revenue: results.reduce((s, r) => s + r.esaRevenue, 0),
    ownerPayment: results.reduce((s, r) => s + r.ownerPayment, 0),
    spread: results.reduce((s, r) => s + r.spread, 0),
    savings: results.reduce((s, r) => s + r.rows.reduce((a, x) => a + x.economia, 0), 0),
  };
}

export const demoProvider = {
  listMonths() {
    return availableMonths;
  },

  getCycleStatus(month: string): CycleStatus {
    return availableMonths.find((m) => m.value === month)?.status ?? 'aberto';
  },

  listGeneratingUnits(): GeneratingUnit[] {
    return generatingUnits;
  },

  listBeneficiaryUnits(): BeneficiaryUnit[] {
    return beneficiaryUnits;
  },

  listAlerts(): Alert[] {
    return alerts;
  },

  getExecutiveSummary(filters: PeriodFilter): ExecutiveSummary {
    const results = scaledResults(filters.month, filters.ugId);
    const curr = aggregate(results);
    const prevMonth = previousMonth(filters.month);
    const prev = prevMonth ? aggregate(scaledResults(prevMonth, filters.ugId)) : curr;
    const currCritical = criticalByMonth[filters.month] ?? 0;
    const prevCritical = prevMonth ? (criticalByMonth[prevMonth] ?? currCritical) : currCritical;
    const activeUgs = filters.ugId
      ? generatingUnits.filter((u) => u.id === filters.ugId && u.status === 'ativa').length
      : generatingUnits.filter((u) => u.status === 'ativa').length;
    const totalUgs = filters.ugId ? 1 : generatingUnits.length;
    const ubList = filters.ugId
      ? beneficiaryUnits.filter((b) => b.ugId === filters.ugId)
      : beneficiaryUnits;

    return {
      month: filters.month,
      cycleStatus: this.getCycleStatus(filters.month),
      operational: {
        generatingUnits: { total: totalUgs, active: activeUgs },
        beneficiaryUnits: {
          total: ubList.length,
          active: ubList.filter((u) => u.status === 'ativa').length,
        },
        generation: curr.generation,
        compensated: curr.compensated,
        balance: curr.balance,
      },
      financial: {
        revenue: curr.revenue,
        ownerPayment: curr.ownerPayment,
        spread: curr.spread,
        savings: curr.savings,
        criticalAlerts: currCritical,
      },
      deltas: {
        generation: delta(curr.generation, prev.generation),
        compensated: delta(curr.compensated, prev.compensated),
        balance: delta(curr.balance, prev.balance),
        revenue: delta(curr.revenue, prev.revenue),
        ownerPayment: delta(curr.ownerPayment, prev.ownerPayment),
        spread: delta(curr.spread, prev.spread),
        savings: delta(curr.savings, prev.savings),
        criticalAlerts: delta(currCritical, prevCritical),
      },
      results,
    };
  },

  getAlertsSummary(filters: PeriodFilter): Alert[] {
    return alerts.filter(
      (a) => a.month === filters.month && (!filters.ugId || a.unit === filters.ugId),
    );
  },

  getMonthlyTrend(filters: Pick<PeriodFilter, 'ugId'>) {
    return [...availableMonths].reverse().map((m) => {
      const agg = aggregate(scaledResults(m.value, filters.ugId));
      return {
        month: m.value,
        label: m.label.split(' ')[0].slice(0, 3),
        Receita: agg.revenue,
        Repasse: agg.ownerPayment,
        Spread: agg.spread,
        Geracao: agg.generation,
        Consumo: agg.compensated + agg.generation * 0.05,
      };
    });
  },

  getCreditAllocationPlan(
    generatingUnitId: string,
    _month: string,
    overrides?: Record<string, { allocationPct?: number; preventiveMargin?: number }>,
  ): AllocationPlan | null {
    const ug = generatingUnits.find((u) => u.id === generatingUnitId);
    if (!ug) return null;
    const ubs = beneficiaryUnits.filter((b) => b.ugId === generatingUnitId);
    return computeAllocationPlan(ug, ubs, overrides);
  },

  getGeneratingUnitCycleSummary(id: string, filters: PeriodFilter) {
    const ug = generatingUnits.find((u) => u.id === id);
    if (!ug) return null;
    const plan = this.getCreditAllocationPlan(id, filters.month);
    if (!plan) return null;
    return {
      ug,
      month: filters.month,
      cycleStatus: this.getCycleStatus(filters.month),
      generationKwh: plan.generation,
      totalRecommendedKwh: plan.totalRecommended,
      totalPlannedKwh: plan.totalProjected,
      totalReceivedKwh: plan.totalProjected,
      totalCompensatedKwh: plan.totalCompensated,
      totalFinalBalanceKwh: plan.totalFinalBalance,
      beneficiariesCount: plan.rows.length,
      allocationPercentageTotal: plan.totalPct,
    };
  },

  getGeneratingUnitCommercialTerms(id: string) {
    const ug = generatingUnits.find((u) => u.id === id);
    if (!ug) return null;
    return {
      purchasePricePerKwh: ug.purchasePrice,
      effectiveDate: '2026-01-01',
      lastAppliedPricePerKwh: ug.purchasePrice,
      lastAppliedMonth: '2026-07',
      observation: 'Valor padrão utilizado para cálculo do repasse ao proprietário.',
    };
  },

  getSettlementRecipient(generatingUnitId: string) {
    const ug = generatingUnits.find((u) => u.id === generatingUnitId);
    if (!ug) return null;
    return {
      recipientName: ug.payee.name,
      recipientDocument: ug.payee.document,
      pixKey: ug.payee.pixKey,
      pixKeyType: ug.payee.pixType,
    };
  },

  getBeneficiaryInvoice(id: string, month: string) {
    const inv = buildInvoice(id, month);
    if (!inv) return null;
    const componentesTarifarios = [
      { label: 'Créditos cobrados pela ESA', value: inv.faturaEsa },
      { label: 'Impostos', value: inv.taxes },
      { label: 'Iluminação Pública / CIP', value: inv.cip },
      { label: 'Outros encargos', value: inv.otherCharges },
    ];
    const billingSnapshot = {
      contaConcessionaria: inv.totalWithoutEsa,
      contaEsa: inv.totalWithEsa,
      economiaMensal: inv.monthlySavings,
      economiaPercentual: inv.discountPct,
      economiaAnual: inv.monthlySavings * 12,
      componentesTarifarios,
      creditos: {
        previousBalanceKwh: inv.previousBalance,
        creditsReceivedKwh: inv.receivedCredits,
        creditsCompensatedKwh: inv.compensated,
        finalBalanceKwh: inv.finalBalance,
        consumptionKwh: inv.consumption,
      },
      calculationSource: 'legacy-copel-calculator' as const,
    };
    const creditBalance = {
      previousBalanceKwh: inv.previousBalance,
      creditsReceivedKwh: inv.receivedCredits,
      creditsCompensatedKwh: inv.compensated,
      currentBalanceKwh: inv.finalBalance,
      coverageMonths:
        inv.ub.monthlyConsumption > 0 ? inv.finalBalance / inv.ub.monthlyConsumption : 0,
    };
    const settlementRecipient = {
      recipientName: inv.ug.payee.name,
      recipientDocument: inv.ug.payee.document,
      pixKey: inv.ug.payee.pixKey,
      pixKeyType: inv.ug.payee.pixType,
    };
    return {
      raw: inv,
      billingSnapshot,
      creditBalance,
      settlementRecipient,
      beneficiarySavingsHistory: inv.savingsHistory.map((h) => ({
        referenceMonth: h.month,
        label: h.label,
        billWithoutEsa: inv.totalWithoutEsa,
        billWithEsa: inv.totalWithEsa,
        monthlySavings: h.monthly,
        savingsPercentage: inv.discountPct,
        accumulatedSavings: h.cumulative,
      })),
    };
  },

  getCsvTemplate(importType: 'ug' | 'ub' | 'rug' | 'rub') {
    const templates: Record<string, { filename: string; headers: string[]; example: string }> = {
      ug: {
        filename: 'modelo-unidades-geradoras.csv',
        headers: ['id', 'nome', 'proprietario', 'documento', 'unidadeConsumidora', 'distribuidora', 'status'],
        example:
          'id;nome;proprietario;documento;unidadeConsumidora;distribuidora;status\nug-assai;UG Solar Assaí;João Pereira;12345678900;123456789;Copel;active',
      },
      ub: {
        filename: 'modelo-unidades-beneficiarias.csv',
        headers: ['id', 'unidadeGeradoraId', 'nome', 'documento', 'unidadeConsumidora', 'distribuidora', 'status'],
        example:
          'id;unidadeGeradoraId;nome;documento;unidadeConsumidora;distribuidora;status\nub-001;ug-assai;Mercado Central;12222333000144;111222333;Copel;active',
      },
      rug: {
        filename: 'modelo-registros-mensais-ug.csv',
        headers: ['id', 'unidadeGeradoraId', 'mesReferencia', 'saldoAnteriorKwh', 'geracaoMensalKwh', 'precoCompraKwh', 'status'],
        example:
          'id;unidadeGeradoraId;mesReferencia;saldoAnteriorKwh;geracaoMensalKwh;precoCompraKwh;status\nugm-ug-assai-2026-07;ug-assai;2026-07;2500;13000;0,35;review',
      },
      rub: {
        filename: 'modelo-registros-mensais-ub.csv',
        headers: ['id', 'unidadeBeneficiariaId', 'unidadeGeradoraId', 'mesReferencia', 'consumoMensalKwh', 'creditosAlocadosKwh', 'creditosCompensadosKwh', 'precoEsaKwh', 'tarifaDistribuidoraKwh', 'statusPagamento'],
        example:
          'id;unidadeBeneficiariaId;unidadeGeradoraId;mesReferencia;consumoMensalKwh;creditosAlocadosKwh;creditosCompensadosKwh;precoEsaKwh;tarifaDistribuidoraKwh;statusPagamento\nubm-ub-001-2026-07;ub-001;ug-assai;2026-07;3950;4199;3950;0,55;0,85;paid',
      },
    };
    return templates[importType];
  },

  simulateUtilityBillExtraction(
    _file: { name: string; size?: number } | null,
    scenario: 'matched' | 'unmatched' | 'duplicate' = 'matched',
  ) {
    const ub = beneficiaryUnits[0];
    const ug = generatingUnits.find((g) => g.id === ub.ugId)!;
    const base = {
      extractionId: `EXT-${Date.now()}`,
      confidence: 'review' as 'high' | 'review' | 'unknown',
      fileName: _file?.name ?? 'conta-copel-jul-2026.pdf',
      referenceMonth: '2026-07',
      teValue: 320.4,
      tusdValue: 512.75,
      fioB: 88.9,
      flagValue: 12.5,
      minimumBillableKwh: 30,
      scenario,
    };
    if (scenario === 'unmatched') {
      return {
        ...base,
        confidence: 'unknown' as const,
        utilityConsumerUnit: '999888777',
        beneficiaryUnitId: null as string | null,
        beneficiaryName: 'PADARIA NOVO HORIZONTE LTDA',
        beneficiaryDocument: '31.222.444/0001-90',
        distributor: 'Copel',
        consumptionKwh: 2840,
        cipValue: 24.5,
        taxesValue: 380.15,
        totalBillValue: 2840 * 0.85 + 380.15 + 24.5,
      };
    }
    return {
      ...base,
      confidence: 'high' as const,
      utilityConsumerUnit: ub.uc,
      beneficiaryUnitId: ub.id,
      beneficiaryName: ub.name,
      beneficiaryDocument: ub.document,
      distributor: ug.distributor,
      consumptionKwh: scenario === 'duplicate' ? ub.monthlyConsumption + 180 : ub.monthlyConsumption,
      cipValue: ub.cip,
      taxesValue: scenario === 'duplicate' ? ub.taxes + 22.4 : ub.taxes,
      totalBillValue:
        (scenario === 'duplicate' ? ub.monthlyConsumption + 180 : ub.monthlyConsumption) *
          ub.distributorTariff +
        ub.taxes +
        ub.cip,
    };
  },

  matchUtilityBillToBeneficiary(extracted: { utilityConsumerUnit: string; distributor?: string }) {
    const ub = beneficiaryUnits.find((u) => u.uc === extracted.utilityConsumerUnit);
    if (!ub) return { matched: false as const };
    const ug = generatingUnits.find((g) => g.id === ub.ugId);
    return {
      matched: true as const,
      beneficiaryUnitId: ub.id,
      beneficiaryName: ub.name,
      beneficiaryDocument: ub.document,
      uc: ub.uc,
      distributor: ub.distributor,
      generatingUnitId: ub.ugId,
      generatingUnitName: ug?.name ?? '—',
    };
  },

  confirmBeneficiaryMonthlyRecordFromUtilityBill(
    extractionId: string,
    correctedData: { beneficiaryUnitId: string; referenceMonth: string; consumptionKwh: number },
  ) {
    return {
      extractionId,
      beneficiaryUnitId: correctedData.beneficiaryUnitId,
      referenceMonth: correctedData.referenceMonth,
      recordId: `UBM-${correctedData.beneficiaryUnitId}-${correctedData.referenceMonth}`,
      status: 'confirmado' as const,
      source: 'utility_bill_import' as const,
      mock: true,
    };
  },

  linkUtilityBillToBeneficiary(extractionId: string, beneficiaryUnitId: string) {
    return { extractionId, beneficiaryUnitId, ok: true, mock: true };
  },

  getBeneficiaryMonthlyRecord(beneficiaryUnitId: string, referenceMonth: string) {
    const ub = beneficiaryUnits.find((u) => u.id === beneficiaryUnitId);
    if (!ub) return null;
    return {
      beneficiaryUnitId,
      referenceMonth,
      utilityConsumerUnit: ub.uc,
      consumptionKwh: ub.monthlyConsumption,
      teValue: 320.4,
      tusdValue: 512.75,
      fioB: 88.9,
      flagValue: 12.5,
      cipValue: ub.cip,
      taxesValue: ub.taxes,
      minimumBillableKwh: 30,
      totalBillValue: ub.monthlyConsumption * ub.distributorTariff + ub.taxes + ub.cip,
      fileName: 'conta-copel-jul-2026.pdf',
      importedAt: '2026-07-08',
      source: 'utility_bill_import' as const,
    };
  },

  compareUtilityBillWithExistingRecord(
    _extractionId: string,
    existing: { consumptionKwh: number; teValue: number; tusdValue: number; fioB: number; flagValue: number; cipValue: number; taxesValue: number; totalBillValue: number },
    incoming: { consumptionKwh: number; teValue: number; tusdValue: number; fioB: number; flagValue: number; cipValue: number; taxesValue: number; totalBillValue: number },
  ) {
    const diff = (a: number, b: number) => +(b - a).toFixed(2);
    return {
      fields: [
        { label: 'Consumo (kWh)', current: existing.consumptionKwh, incoming: incoming.consumptionKwh, delta: diff(existing.consumptionKwh, incoming.consumptionKwh) },
        { label: 'TE', current: existing.teValue, incoming: incoming.teValue, delta: diff(existing.teValue, incoming.teValue) },
        { label: 'TUSD', current: existing.tusdValue, incoming: incoming.tusdValue, delta: diff(existing.tusdValue, incoming.tusdValue) },
        { label: 'Fio B', current: existing.fioB, incoming: incoming.fioB, delta: diff(existing.fioB, incoming.fioB) },
        { label: 'Bandeira', current: existing.flagValue, incoming: incoming.flagValue, delta: diff(existing.flagValue, incoming.flagValue) },
        { label: 'CIP', current: existing.cipValue, incoming: incoming.cipValue, delta: diff(existing.cipValue, incoming.cipValue) },
        { label: 'Impostos', current: existing.taxesValue, incoming: incoming.taxesValue, delta: diff(existing.taxesValue, incoming.taxesValue) },
        { label: 'Valor total', current: existing.totalBillValue, incoming: incoming.totalBillValue, delta: diff(existing.totalBillValue, incoming.totalBillValue) },
      ],
    };
  },

  replaceBeneficiaryMonthlyRecordFromUtilityBill(extractionId: string, reason: string) {
    return { extractionId, status: 'replaced' as const, reason, replacedAt: new Date().toISOString(), mock: true };
  },

  confirmInvoicePayment(invoiceId: string, payment: { paidAt: string; amount: number; note?: string }) {
    return { invoiceId, paymentStatus: 'paid' as const, paidAt: payment.paidAt, mock: true };
  },

  reopenInvoicePayment(invoiceId: string) {
    return { invoiceId, paymentStatus: 'open' as const, mock: true };
  },

  createGeneratingUnit(input: Record<string, unknown>) {
    return { id: (input.id as string) ?? `UG-${Date.now()}`, ok: true, mock: true };
  },

  updateGeneratingUnit(id: string, _input: Record<string, unknown>) {
    return { id, ok: true, mock: true };
  },

  createBeneficiaryUnit(input: Record<string, unknown>) {
    return { id: (input.id as string) ?? `UB-${Date.now()}`, ok: true, mock: true };
  },

  updateBeneficiaryUnit(id: string, _input: Record<string, unknown>) {
    return { id, ok: true, mock: true };
  },
};
