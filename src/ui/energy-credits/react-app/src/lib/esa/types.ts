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

export interface Alert {
  id: string;
  severity: 'critico' | 'risco' | 'atencao' | 'info';
  code: string;
  message: string;
  unit: string;
  month: string;
  action: string;
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

export interface KpiDelta {
  value: number;
  pct: number;
  direction: 'up' | 'down' | 'flat';
}

export interface PeriodFilter {
  month: string;
  ugId?: string;
}

export interface MonthOption {
  value: string;
  label: string;
  status: CycleStatus;
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

export interface FinancialSummary {
  generation: number;
  compensated: number;
  balance: number;
  revenue: number;
  ownerPayment: number;
  spread: number;
  savings: number;
}

export interface TrendRow {
  month: string;
  label: string;
  Receita: number;
  Repasse: number;
  Spread: number;
  Geracao: number;
  Consumo: number;
}
