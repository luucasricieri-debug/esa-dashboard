// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Contrato de tipos do runtime de energy-credits-v2.html
// ============================================================

export type PaymentStatus = 'pago' | 'aberto' | 'vencido';
export type UGStatus = 'ativa' | 'inativa' | 'manutencao';
export type PixType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
export type CycleStatus = 'aberto' | 'em_apuracao' | 'fechado';
export type AlertSeverity = 'critico' | 'risco' | 'atencao' | 'info';
export type AlertStatus = 'ativo' | 'em_analise' | 'resolvido' | 'ignorado';
export type CsvImportType = 'ug' | 'ub' | 'rug' | 'rub';
export type ImportScenario = 'matched' | 'unmatched' | 'duplicate';
export type RuntimeMode = 'demo' | 'real';

// ---- Payee ----

export interface Payee {
  name: string;
  document: string;
  pixKey: string;
  pixType: PixType;
}

// ---- Generating Unit ----

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
  payee?: Payee;
}

export interface CreateGeneratingUnitInput {
  name: string;
  owner: string;
  document: string;
  uc: string;
  distributor: string;
  status: UGStatus;
  purchasePrice: number;
  payee: Payee;
  startDate?: string;
  notes?: string;
}

export type UpdateGeneratingUnitInput = Partial<CreateGeneratingUnitInput>;

// ---- Beneficiary Unit ----

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
  customerSince?: string;
  accumulatedSavings?: number;
}

export interface CreateBeneficiaryUnitInput {
  name: string;
  document: string;
  uc: string;
  distributor: string;
  ugId: string;
  status: 'ativa' | 'inativa';
  monthlyConsumption: number;
  annualAverage: number;
  esaPrice: number;
  distributorTariff: number;
  taxes: number;
  cip: number;
  preventiveMargin: number;
  entryDate?: string;
  notes?: string;
}

export type UpdateBeneficiaryUnitInput = Partial<CreateBeneficiaryUnitInput>;

// ---- Month / Cycle ----

export interface MonthOption {
  value: string;
  label: string;
  status: CycleStatus;
}

// ---- Settlement / Allocation ----

export interface SettlementRow {
  ub: BeneficiaryUnit;
  allocated: number;
  compensated: number;
  pending: number;
  contaSemEsa: number;
  faturaEsa: number;
  economia: number;
}

export interface SettlementResult {
  ug: GeneratingUnit;
  generation: number;
  available: number;
  totalAllocated: number;
  totalCompensated: number;
  currentBalance: number;
  ownerPayment: number;
  esaRevenue: number;
  spread: number;
  rows: SettlementRow[];
}

export interface AllocationOverride {
  allocationPct?: number;
  preventiveMargin?: number;
}

export interface AllocationRow {
  ub: BeneficiaryUnit;
  monthlyAverage: number;
  preventiveMargin: number;
  targetCredit: number;
  currentBalance: number;
  recommendedAdd: number;
  recommendedPct: number;
  allocationPct: number;
  planned: number;
  received: number;
  consumption: number;
  compensated: number;
  finalBalance: number;
  coverageMonths: number;
}

export interface AllocationPlan {
  ug: GeneratingUnit;
  generation: number;
  rows: AllocationRow[];
  totalPct: number;
  totalProjected: number;
  totalCompensated: number;
  totalFinalBalance: number;
  totalRecommended: number;
  totalConsumption: number;
  ownerPayment: number;
  esaRevenue: number;
}

// ---- Dashboard ----

export interface KpiDelta {
  pct: number;
  direction: 'up' | 'down' | 'flat';
}

export interface AggregateMetrics {
  generation: number;
  compensated: number;
  balance: number;
  revenue: number;
  ownerPayment: number;
  spread: number;
  savings: number;
}

export interface DashboardData {
  month: string;
  cycleStatus: CycleStatus;
  current: AggregateMetrics;
  previous: AggregateMetrics | null;
  criticalAlerts: number;
  generatingUnitCount: number;
  beneficiaryUnitCount: number;
  activeUGCount: number;
  results: SettlementResult[];
  trendData: TrendRow[];
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

// ---- Invoice / Bill ----

export interface BeneficiaryInvoice {
  ubId: string;
  ugId: string;
  month: string;
  docNumber: string;
  dueDate: string;
  consumption: number;
  previousBalance: number;
  receivedCredits: number;
  compensated: number;
  finalBalance: number;
  faturaEsa: number;
  taxes: number;
  cip: number;
  otherCharges: number;
  totalWithEsa: number;
  totalWithoutEsa: number;
  monthlySavings: number;
  discountPct: number;
  paymentStatus: PaymentStatus;
  payee: Payee;
  customerSince: string;
  accumulatedSavings: number;
}

// ---- Savings / History ----

export interface SavingsHistoryRow {
  label: string;
  monthly: number;
  cumulative: number;
}

export interface MonthlyHistoryRow {
  month: string;
  origin: string;
  file: string;
  importedAt: string;
  consumptionKwh: number;
}

export interface ConsumptionAverage {
  annualAverage: number;
  monthlyAverage: number;
  hasSufficientHistory: boolean;
  months: MonthlyHistoryRow[];
}

// ---- Financial ----

export interface PaymentRecord {
  id: string;
  kind: 'fat' | 'rep';
  unitId: string;
  unitName: string;
  month: string;
  amount: number;
  status: PaymentStatus;
  paidAt: string | null;
  paidBy: string | null;
  reopenedAt: string | null;
  reason: string | null;
}

export interface PaymentInput {
  paidAt: string;
  amount: number;
  note?: string;
}

export interface FinancialData {
  month: string;
  invoices: PaymentRecord[];
  ownerPayments: PaymentRecord[];
  totalRevenue: number;
  totalOwnerPayment: number;
  spread: number;
}

// ---- Reports ----

export interface OwnerReport {
  ugId: string;
  ugName: string;
  month: string;
  appliedPrice: number;
  totalCompensated: number;
  ownerPayment: number;
  beneficiaryBreakdown: Array<{
    ubId: string;
    ubName: string;
    compensated: number;
    share: number;
    repasse: number;
    status: PaymentStatus;
  }>;
  payee: Payee;
}

export interface InternalReport {
  ugId: string;
  month: string;
  settlement: SettlementResult | null;
  criticalAlerts: number;
  pendingPayments: number;
}

export interface FinancialReport {
  month: string;
  totalRevenue: number;
  totalOwnerPayment: number;
  spread: number;
  invoices: PaymentRecord[];
}

// ---- Alerts ----

export interface AlertRecord {
  id: string;
  severity: AlertSeverity;
  code: string;
  message: string;
  unit: string;
  month: string;
  action: string;
  title: string;
  status: AlertStatus;
  detectedValue?: string;
  threshold?: string;
  impact?: string;
  history: AlertHistoryEntry[];
  resolvedNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface AlertHistoryEntry {
  at: string;
  label: string;
}

export interface AlertFilter {
  month?: string;
  severity?: AlertSeverity | 'all';
  status?: AlertStatus | 'all';
  ugId?: string;
  ubId?: string;
  search?: string;
}

// ---- CSV Import ----

export interface CsvTemplate {
  importType: string;
  delimiter: string;
  headers: string[];
  exampleRows: string[][];
  aliases: Record<string, string[]>;
  example: string;
  filename: string;
}

// ---- Utility Bill Import ----

export interface ExtractedBillData {
  referenceMonth: string;
  consumptionKwh: number;
  te: number;
  tusd: number;
  fioB: number;
  flag: number;
  cip: number;
  taxes: number;
  minKwh: number;
  total: number;
}

export interface ImportHistoryRecord {
  file: string;
  uc: string;
  ub: string;
  month: string;
  origin: string;
  status: 'CONFIRMADO' | 'PENDENTE' | 'VINCULADO' | 'DUPLICADO' | 'DESCARTADO';
  date: string;
}

// ---- Mutations ----

export interface MutationResult {
  ok: boolean;
  error?: string;
}
