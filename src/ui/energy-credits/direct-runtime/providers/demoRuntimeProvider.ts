// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Provider Demo — dados extraídos do Project HTML (energy-credits-v2.html)
// Porta fiel dos arrays e funções de computação do DCLogic Component.
// NÃO recalcula billing. NÃO acessa Firebase. NÃO usa calculationMemory.
// ============================================================

import type { EnergyCreditsRuntimeContract } from '../contracts/EnergyCreditsRuntimeContract';
import type {
  GeneratingUnit,
  BeneficiaryUnit,
  MonthOption,
  CycleStatus,
  Payee,
  AlertRecord,
  AlertFilter,
  AllocationOverride,
  AllocationPlan,
  AllocationRow,
  BeneficiaryInvoice,
  ConsumptionAverage,
  CsvImportType,
  CsvTemplate,
  DashboardData,
  ExtractedBillData,
  FinancialData,
  FinancialReport,
  ImportHistoryRecord,
  InternalReport,
  MonthlyHistoryRow,
  MutationResult,
  OwnerReport,
  PaymentInput,
  PaymentRecord,
  SavingsHistoryRow,
  SettlementResult,
  TrendRow,
  AggregateMetrics,
} from '../contracts/types';

// ============================================================
// DADOS ESTÁTICOS (extraídos do DCLogic Component)
// ============================================================

const UGS: GeneratingUnit[] = [
  { id: 'UG-001', name: 'UG Solar Assaí', owner: 'João Pereira', document: '123.456.789-00', uc: '123456789', distributor: 'Copel', status: 'ativa', purchasePrice: 0.35, previousBalance: 2500, monthlyGeneration: 13000 },
  { id: 'UG-002', name: 'UG Solar Londrina', owner: 'Maria Silva', document: '987.654.321-00', uc: '987654321', distributor: 'Copel', status: 'ativa', purchasePrice: 0.34, previousBalance: 1800, monthlyGeneration: 9500 },
  { id: 'UG-003', name: 'UG Solar Maringá', owner: 'Construtora Norte Ltda', document: '12.345.678/0001-90', uc: '555666777', distributor: 'Copel', status: 'manutencao', purchasePrice: 0.36, previousBalance: 500, monthlyGeneration: 4200 },
];

const UBS: BeneficiaryUnit[] = [
  { id: 'UB-001', name: 'Mercado Central', document: '11.222.333/0001-44', uc: '111222333', distributor: 'Copel', ugId: 'UG-001', status: 'ativa', monthlyConsumption: 3950, annualAverage: 48000, previousCreditBalance: 350, allocationPct: 0.323, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 420, cip: 51.97, otherCharges: 0, paymentStatus: 'pago', customerSince: '2025-08', accumulatedSavings: 14870.45 },
  { id: 'UB-002', name: 'Panificadora Sol', document: '22.333.444/0001-55', uc: '222333444', distributor: 'Copel', ugId: 'UG-001', status: 'ativa', monthlyConsumption: 2900, annualAverage: 36000, previousCreditBalance: 180, allocationPct: 0.245, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 310, cip: 42.5, otherCharges: 0, paymentStatus: 'aberto', customerSince: '2025-10', accumulatedSavings: 8210.3 },
  { id: 'UB-003', name: 'Clínica Vida', document: '33.444.555/0001-66', uc: '333444555', distributor: 'Copel', ugId: 'UG-001', status: 'ativa', monthlyConsumption: 2050, annualAverage: 24000, previousCreditBalance: 120, allocationPct: 0.16, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 220, cip: 38.9, otherCharges: 0, paymentStatus: 'vencido', customerSince: '2025-06', accumulatedSavings: 9120.0 },
  { id: 'UB-004', name: 'Auto Posto Norte', document: '44.555.666/0001-77', uc: '444555666', distributor: 'Copel', ugId: 'UG-001', status: 'ativa', monthlyConsumption: 3500, annualAverage: 42000, previousCreditBalance: 280, allocationPct: 0.272, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.88, taxes: 380, cip: 55.2, otherCharges: 0, paymentStatus: 'pago', customerSince: '2025-09', accumulatedSavings: 11450.7 },
  { id: 'UB-005', name: 'Restaurante Sabor', document: '55.666.777/0001-88', uc: '555666777', distributor: 'Copel', ugId: 'UG-002', status: 'ativa', monthlyConsumption: 3800, annualAverage: 45000, previousCreditBalance: 210, allocationPct: 0.66, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 400, cip: 48.5, otherCharges: 0, paymentStatus: 'pago', customerSince: '2025-07', accumulatedSavings: 12980.0 },
  { id: 'UB-006', name: 'Farmácia Popular', document: '66.777.888/0001-99', uc: '666777888', distributor: 'Copel', ugId: 'UG-002', status: 'ativa', monthlyConsumption: 1800, annualAverage: 21600, previousCreditBalance: 90, allocationPct: 0.34, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.86, taxes: 195, cip: 32.0, otherCharges: 0, paymentStatus: 'aberto', customerSince: '2025-11', accumulatedSavings: 4820.15 },
  { id: 'UB-007', name: 'Escola Aprender', document: '77.888.999/0001-11', uc: '777888999', distributor: 'Copel', ugId: 'UG-003', status: 'ativa', monthlyConsumption: 2600, annualAverage: 30000, previousCreditBalance: 4800, allocationPct: 1.0, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.84, taxes: 280, cip: 40.0, otherCharges: 0, paymentStatus: 'aberto', customerSince: '2025-05', accumulatedSavings: 6850.9 },
];

const MONTHS_AV: MonthOption[] = [
  { value: '2026-07', label: 'Julho de 2026', status: 'em_apuracao' },
  { value: '2026-06', label: 'Junho de 2026', status: 'fechado' },
  { value: '2026-05', label: 'Maio de 2026', status: 'fechado' },
  { value: '2026-04', label: 'Abril de 2026', status: 'fechado' },
  { value: '2026-03', label: 'Março de 2026', status: 'fechado' },
];

const MONTH_FACTOR: Record<string, number> = {
  '2026-07': 1.0, '2026-06': 0.92, '2026-05': 0.88, '2026-04': 0.83, '2026-03': 0.79,
};

const CRITICAL: Record<string, number> = {
  '2026-07': 2, '2026-06': 3, '2026-05': 2, '2026-04': 4, '2026-03': 3,
};

const PAYEES: Record<string, Payee> = {
  'UG-001': { name: 'João Pereira', document: '123.456.789-00', pixKey: 'joao.pereira@esaenergia.com.br', pixType: 'email' },
  'UG-002': { name: 'Maria Silva', document: '987.654.321-00', pixKey: '987.654.321-00', pixType: 'cpf' },
  'UG-003': { name: 'Construtora Norte Ltda', document: '12.345.678/0001-90', pixKey: '12.345.678/0001-90', pixType: 'cnpj' },
};

const APPLIED_HIST: Record<string, Record<string, number>> = {
  'UG-001': { '2026-06': 0.34, '2026-05': 0.34, '2026-04': 0.33, '2026-03': 0.33 },
  'UG-002': { '2026-06': 0.33, '2026-05': 0.33, '2026-04': 0.32, '2026-03': 0.32 },
  'UG-003': { '2026-06': 0.35, '2026-05': 0.35, '2026-04': 0.34, '2026-03': 0.34 },
};

const UB_HIST_ORIGIN: Record<string, string> = {
  '2026-07': 'FATURA IMPORTADA', '2026-06': 'FATURA IMPORTADA',
  '2026-05': 'CSV', '2026-04': 'CSV', '2026-03': 'MANUAL',
};
const UB_HIST_FILE: Record<string, string> = {
  '2026-07': 'conta-copel-jul-2026.pdf', '2026-06': 'conta-copel-jun-2026.pdf',
  '2026-05': 'ubm-2026-05.csv', '2026-04': 'ubm-2026-04.csv', '2026-03': '—',
};
const UB_HIST_IMPORTED: Record<string, string> = {
  '2026-07': '08/07/2026', '2026-06': '05/06/2026',
  '2026-05': '06/05/2026', '2026-04': '05/04/2026', '2026-03': '10/03/2026',
};

const ALERT_TITLES: Record<string, string> = {
  ALLOCATION_PERCENTAGE_TOTAL_INVALID: 'Percentual de rateio inválido',
  HIGH_BENEFICIARY_CREDIT_BALANCE: 'Saldo elevado de créditos',
  LOW_BENEFICIARY_CREDIT_BALANCE: 'Saldo insuficiente de créditos',
  CONSUMPTION_ABOVE_AVERAGE: 'Consumo acima da média',
  CYCLE_CLOSE_REMINDER: 'Fechamento de ciclo pendente',
};
const ALERT_METRICS: Record<string, { detected: string; threshold: string }> = {
  'A-001': { detected: '98,7% de rateio', threshold: '100,00%' },
  'A-002': { detected: '1,85 mês de cobertura', threshold: '≤ 1,5 mês' },
  'A-003': { detected: '0,06 mês de cobertura', threshold: '≥ 0,25 mês' },
  'A-004': { detected: '112% da média mensal', threshold: '≤ 110%' },
  'A-005': { detected: '0,05 mês de cobertura', threshold: '≥ 0,25 mês' },
  'A-006': { detected: 'Ciclo em apuração', threshold: 'Fechado até 05/08' },
};
const ALERT_IMPACT: Record<string, string> = {
  'A-001': 'Sem 100% de rateio, parte dos créditos gerados fica sem destino e o ciclo não pode ser fechado.',
  'A-002': 'Créditos parados na UC representam capital energético ocioso e reduzem a eficiência da usina.',
  'A-003': 'A beneficiária pode compensar menos que o consumo e perder economia no próximo ciclo.',
  'A-004': 'Consumo acima do planejado pode esgotar o saldo e comprometer a cobertura das próximas faturas.',
  'A-005': 'Saldo mínimo insuficiente aumenta o risco de fatura cheia da distribuidora.',
  'A-006': 'Faturas e repasses do ciclo só podem ser liquidados após o fechamento.',
};

const STATIC_ALERTS = [
  { id: 'A-001', severity: 'critico' as const, code: 'ALLOCATION_PERCENTAGE_TOTAL_INVALID', message: 'A soma dos percentuais de rateio deve totalizar 100%.', unit: 'UG-002', month: '2026-07', action: 'Ajustar percentuais na tela de Apuração Mensal.' },
  { id: 'A-002', severity: 'risco' as const, code: 'HIGH_BENEFICIARY_CREDIT_BALANCE', message: 'Saldo acumulado superior a 1,5 mês da média de consumo.', unit: 'UB-007', month: '2026-07', action: 'Reduzir percentual de rateio ou margem preventiva.' },
  { id: 'A-003', severity: 'risco' as const, code: 'LOW_BENEFICIARY_CREDIT_BALANCE', message: 'Saldo disponível e crédito planejado abaixo do crédito alvo.', unit: 'UB-003', month: '2026-07', action: 'Aumentar percentual de rateio ou revisar margem preventiva.' },
  { id: 'A-004', severity: 'atencao' as const, code: 'CONSUMPTION_ABOVE_AVERAGE', message: 'Consumo real acima de 110% da média mensal.', unit: 'UB-004', month: '2026-07', action: 'Revisar média e planejamento de créditos.' },
  { id: 'A-005', severity: 'atencao' as const, code: 'LOW_BENEFICIARY_CREDIT_BALANCE', message: 'Cobertura do saldo inferior a 0,25 mês.', unit: 'UB-006', month: '2026-07', action: 'Aumentar percentual de rateio para elevar o saldo mínimo.' },
  { id: 'A-006', severity: 'info' as const, code: 'CYCLE_CLOSE_REMINDER', message: 'O ciclo de julho ainda não foi fechado.', unit: 'UG-001', month: '2026-07', action: 'Concluir a apuração e fechar o ciclo até 05/08.' },
];

const IMP_HISTORY: ImportHistoryRecord[] = [
  { file: 'conta-copel-jul-2026.pdf', uc: '111222333', ub: 'Mercado Central', month: '2026-07', origin: 'FATURA DISTRIBUIDORA', status: 'CONFIRMADO', date: '08/07/2026' },
  { file: 'conta-copel-jul-2026-v2.pdf', uc: '999888777', ub: '—', month: '2026-07', origin: 'FATURA DISTRIBUIDORA', status: 'PENDENTE', date: '10/07/2026' },
  { file: 'ubm-2026-06.csv', uc: '—', ub: 'Todas as beneficiárias', month: '2026-06', origin: 'CSV', status: 'VINCULADO', date: '05/06/2026' },
  { file: 'conta-copel-jun-2026.pdf', uc: '111222333', ub: 'Mercado Central', month: '2026-06', origin: 'FATURA DISTRIBUIDORA', status: 'DUPLICADO', date: '12/06/2026' },
  { file: 'conta-copel-mai-2026.pdf', uc: '444555666', ub: 'Auto Posto Norte', month: '2026-05', origin: 'FATURA DISTRIBUIDORA', status: 'DESCARTADO', date: '03/05/2026' },
];

// ============================================================
// MOTOR DE COMPUTAÇÃO (porta fiel das funções do DCLogic Component)
// ============================================================

function computeSettlement(ug: GeneratingUnit): SettlementResult {
  const ubs = UBS.filter((u) => u.ugId === ug.id);
  const available = ug.previousBalance + ug.monthlyGeneration;
  let remaining = available;
  const rows = ubs.map((ub) => {
    const allocated = Math.min(ub.monthlyConsumption, remaining);
    remaining -= allocated;
    const compensated = allocated;
    const pending = ub.monthlyConsumption - compensated;
    const contaSemEsa = ub.monthlyConsumption * ub.distributorTariff + ub.taxes + ub.cip + ub.otherCharges;
    const faturaEsa = compensated * ub.esaPrice;
    const contaComEsa = faturaEsa + pending * ub.distributorTariff + ub.taxes + ub.cip + ub.otherCharges;
    return { ub, allocated, compensated, pending, contaSemEsa, faturaEsa, economia: contaSemEsa - contaComEsa };
  });
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  const totalCompensated = rows.reduce((s, r) => s + r.compensated, 0);
  const esaRevenue = rows.reduce((s, r) => s + r.faturaEsa, 0);
  const ownerPayment = totalCompensated * ug.purchasePrice;
  return {
    ug, generation: ug.monthlyGeneration, available, totalAllocated, totalCompensated,
    currentBalance: available - totalAllocated, ownerPayment, esaRevenue,
    spread: esaRevenue - ownerPayment, rows,
  };
}

function scaledResults(month: string, ugId?: string): SettlementResult[] {
  const f = MONTH_FACTOR[month] ?? 1;
  let all = UGS.map((ug) => computeSettlement(ug));
  if (ugId) all = all.filter((r) => r.ug.id === ugId);
  return all.map((r) => ({
    ...r,
    generation: r.generation * f, available: r.available * f, totalAllocated: r.totalAllocated * f,
    totalCompensated: r.totalCompensated * f, currentBalance: r.currentBalance * f,
    ownerPayment: r.ownerPayment * f, esaRevenue: r.esaRevenue * f, spread: r.spread * f,
    rows: r.rows.map((row) => ({
      ...row,
      allocated: row.allocated * f, compensated: row.compensated * f,
      faturaEsa: row.faturaEsa * f, economia: row.economia * f,
    })),
  }));
}

function aggregate(results: SettlementResult[]): AggregateMetrics {
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

function computeAllocationPlan(ug: GeneratingUnit, overrides: Record<string, AllocationOverride> = {}): AllocationPlan {
  const ubs = UBS.filter((b) => b.ugId === ug.id);
  const gen = ug.monthlyGeneration;
  const avgs = ubs.map((u) => u.annualAverage / 12);
  const needs = ubs.map((u, i) => {
    const margin = overrides[u.id]?.preventiveMargin ?? u.preventiveMargin;
    return Math.max(0, avgs[i] * (1 + margin) - u.previousCreditBalance);
  });
  const sumRec = needs.reduce((a, b) => a + b, 0);
  const rows: AllocationRow[] = ubs.map((ub, i) => {
    const ov = overrides[ub.id] ?? {};
    const allocationPct = ov.allocationPct ?? ub.allocationPct;
    const preventiveMargin = ov.preventiveMargin ?? ub.preventiveMargin;
    const monthlyAverage = avgs[i];
    const targetCredit = monthlyAverage * (1 + preventiveMargin);
    const currentBalance = ub.previousCreditBalance;
    const recommendedAdd = Math.max(0, targetCredit - currentBalance);
    const recommendedPct = sumRec > 0 ? recommendedAdd / sumRec : 0;
    const planned = gen * allocationPct;
    const consumption = ub.monthlyConsumption;
    const avail = currentBalance + planned;
    const compensated = Math.min(consumption, avail);
    const finalBalance = avail - compensated;
    return {
      ub, monthlyAverage, preventiveMargin, targetCredit, currentBalance,
      recommendedAdd, recommendedPct, allocationPct, planned, received: planned,
      consumption, compensated, finalBalance, coverageMonths: monthlyAverage > 0 ? finalBalance / monthlyAverage : 0,
    };
  });
  const totalCompensated = rows.reduce((s, r) => s + r.compensated, 0);
  return {
    ug, generation: gen, rows,
    totalPct: rows.reduce((s, r) => s + r.allocationPct, 0),
    totalProjected: rows.reduce((s, r) => s + r.planned, 0),
    totalCompensated,
    totalFinalBalance: rows.reduce((s, r) => s + r.finalBalance, 0),
    totalRecommended: rows.reduce((s, r) => s + r.recommendedAdd, 0),
    totalConsumption: rows.reduce((s, r) => s + r.consumption, 0),
    ownerPayment: totalCompensated * ug.purchasePrice,
    esaRevenue: rows.reduce((s, r) => s + r.compensated * r.ub.esaPrice, 0),
  };
}

function buildInvoice(ubId: string, month: string): BeneficiaryInvoice | null {
  const ub = UBS.find((u) => u.id === ubId);
  if (!ub) return null;
  const ug = UGS.find((g) => g.id === ub.ugId);
  if (!ug) return null;
  const payee = PAYEES[ug.id];
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
  const [y, m] = month.split('-').map(Number);
  const dueDate = '10/' + String(m + 1).padStart(2, '0') + '/' + y;
  return {
    ubId: ub.id, ugId: ug.id, month,
    docNumber: 'ESA-' + month.replace('-', '') + '-' + ubId.replace('-', ''),
    dueDate, consumption: ub.monthlyConsumption, previousBalance,
    receivedCredits, compensated, finalBalance, faturaEsa,
    taxes: ub.taxes, cip: ub.cip, otherCharges: ub.otherCharges,
    totalWithEsa, totalWithoutEsa, monthlySavings,
    discountPct: totalWithoutEsa > 0 ? (monthlySavings / totalWithoutEsa) * 100 : 0,
    paymentStatus: ub.paymentStatus,
    payee: payee ?? { name: '', document: '', pixKey: '', pixType: 'cpf' },
    customerSince: ub.customerSince ?? '2025-08',
    accumulatedSavings: ub.accumulatedSavings ?? 0,
  };
}

function buildSavingsHistory(from: string, to: string, accumulated: number): SavingsHistoryRow[] {
  const list: Array<{ label: string }> = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const L = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  while (y < ty || (y === ty && m <= tm)) {
    list.push({ label: L[m - 1] + (m === 1 ? '/' + String(y).slice(2) : '') });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  const n = list.length;
  if (n === 0) return [];
  const base = accumulated / n;
  let cum = 0;
  return list.map((it, i) => {
    const monthly = base * (0.85 + (i / Math.max(1, n - 1)) * 0.3);
    cum += monthly;
    return { label: it.label, monthly, cumulative: cum };
  });
}

function appliedPrice(ugId: string, month: string): number {
  const h = APPLIED_HIST[ugId];
  if (h && h[month] !== undefined) return h[month];
  return UGS.find((u) => u.id === ugId)?.purchasePrice ?? 0.35;
}

function finBaseStatus(kind: 'fat' | 'rep', id: string, month: string): 'pago' | 'aberto' | 'vencido' {
  const closed = (MONTHS_AV.find((m) => m.value === month)?.status === 'fechado');
  if (closed) return 'pago';
  if (kind === 'fat') return (UBS.find((u) => u.id === id))?.paymentStatus ?? 'aberto';
  return id === 'UG-001' ? 'pago' : 'aberto';
}

function resolvedPaymentRecord(kind: 'fat' | 'rep', unitId: string, unitName: string, month: string, amount: number): PaymentRecord {
  const status = finBaseStatus(kind, unitId, month);
  return {
    id: kind + '-' + unitId + '-' + month,
    kind, unitId, unitName, month, amount, status,
    paidAt: status === 'pago' ? '05/' + month.split('-')[1] + '/2026' : null,
    paidBy: status === 'pago' ? 'Ana Costa' : null,
    reopenedAt: null, reason: null,
  };
}

const ok: MutationResult = { ok: true };

// ============================================================
// IMPLEMENTAÇÃO DO CONTRATO
// ============================================================

export const demoRuntimeProvider: EnergyCreditsRuntimeContract = {
  mode: 'demo',

  // ---- Months ----
  async listMonths() { return [...MONTHS_AV]; },
  async getCycleStatus(month: string): Promise<CycleStatus> {
    return MONTHS_AV.find((m) => m.value === month)?.status ?? 'aberto';
  },

  // ---- Dashboard ----
  async getDashboardData(filter): Promise<DashboardData> {
    const { month, ugId } = filter;
    const results = scaledResults(month, ugId);
    const mi = MONTHS_AV.findIndex((m) => m.value === month);
    const prevM = MONTHS_AV[mi + 1];
    const curr = aggregate(results);
    const previous = prevM ? aggregate(scaledResults(prevM.value, ugId)) : null;
    const cycleStatus: CycleStatus = MONTHS_AV[mi]?.status ?? 'aberto';
    const filteredUBS = ugId ? UBS.filter((b) => b.ugId === ugId) : UBS;
    const filteredUGS = ugId ? UGS.filter((u) => u.id === ugId) : UGS;
    const trend = [...MONTHS_AV].reverse().map((m) => {
      const agg = aggregate(scaledResults(m.value, ugId));
      return {
        month: m.value, label: m.label.split(' ')[0].slice(0, 3),
        Receita: agg.revenue, Repasse: agg.ownerPayment, Spread: agg.spread,
        Geracao: agg.generation, Consumo: agg.compensated + agg.generation * 0.05,
      };
    });
    return {
      month, cycleStatus, current: curr, previous,
      criticalAlerts: CRITICAL[month] ?? 0,
      generatingUnitCount: filteredUGS.length,
      beneficiaryUnitCount: filteredUBS.length,
      activeUGCount: filteredUGS.filter((u) => u.status === 'ativa').length,
      results, trendData: trend,
    };
  },
  async getMonthlyTrend(filter): Promise<TrendRow[]> {
    return [...MONTHS_AV].reverse().map((m) => {
      const agg = aggregate(scaledResults(m.value, filter.ugId));
      return {
        month: m.value, label: m.label.split(' ')[0].slice(0, 3),
        Receita: agg.revenue, Repasse: agg.ownerPayment, Spread: agg.spread,
        Geracao: agg.generation, Consumo: agg.compensated,
      };
    });
  },

  // ---- Generating Units ----
  async listGeneratingUnits(filter?) {
    const q = (filter?.search ?? '').toLowerCase();
    return UGS.filter((u) => !q || (u.name + ' ' + u.owner + ' ' + u.id + ' ' + u.uc).toLowerCase().includes(q));
  },
  async getGeneratingUnit(id) { return UGS.find((u) => u.id === id) ?? null; },
  async createGeneratingUnit(_input) { return ok; },
  async updateGeneratingUnit(_id, _input) { return ok; },
  async getGeneratingUnitPayee(ugId) { return PAYEES[ugId] ?? null; },
  async getAppliedPrice(ugId, month) { return appliedPrice(ugId, month); },
  async updateCyclePrice(_ugId, _month, _price, _reason) { return ok; },

  // ---- Beneficiary Units ----
  async listBeneficiaryUnits(filter?) {
    const q = (filter?.search ?? '').toLowerCase();
    let list = UBS;
    if (filter?.ugId) list = list.filter((u) => u.ugId === filter.ugId);
    return list.filter((u) => !q || (u.name + ' ' + u.uc + ' ' + u.id).toLowerCase().includes(q));
  },
  async getBeneficiaryUnit(id) { return UBS.find((u) => u.id === id) ?? null; },
  async createBeneficiaryUnit(_input) { return ok; },
  async updateBeneficiaryUnit(_id, _input) { return ok; },
  async getBeneficiaryConsumptionAverage(id): Promise<ConsumptionAverage | null> {
    const ub = UBS.find((u) => u.id === id);
    if (!ub) return null;
    const months: MonthlyHistoryRow[] = Object.keys(UB_HIST_ORIGIN)
      .sort()
      .reverse()
      .map((m) => ({
        month: m, origin: UB_HIST_ORIGIN[m], file: UB_HIST_FILE[m],
        importedAt: UB_HIST_IMPORTED[m], consumptionKwh: ub.monthlyConsumption,
      }));
    return {
      annualAverage: ub.annualAverage, monthlyAverage: ub.annualAverage / 12,
      hasSufficientHistory: true, months,
    };
  },
  async getBeneficiaryMonthlyHistory(id): Promise<MonthlyHistoryRow[]> {
    const ub = UBS.find((u) => u.id === id);
    if (!ub) return [];
    return Object.keys(UB_HIST_ORIGIN).sort().reverse().map((m) => ({
      month: m, origin: UB_HIST_ORIGIN[m], file: UB_HIST_FILE[m],
      importedAt: UB_HIST_IMPORTED[m], consumptionKwh: ub.monthlyConsumption,
    }));
  },
  async getBeneficiarySavingsHistory(id, upToMonth = '2026-07'): Promise<SavingsHistoryRow[]> {
    const ub = UBS.find((u) => u.id === id);
    if (!ub) return [];
    return buildSavingsHistory(ub.customerSince ?? '2025-08', upToMonth, ub.accumulatedSavings ?? 0);
  },

  // ---- Allocation Plan ----
  async getAllocationPlan(ugId, _month, overrides = {}): Promise<AllocationPlan | null> {
    const ug = UGS.find((u) => u.id === ugId);
    if (!ug) return null;
    return computeAllocationPlan(ug, overrides);
  },
  async saveAllocationOverrides(_ugId, _month, _overrides) { return ok; },
  async closeMonthlySettlement(_ugId, _month) { return ok; },

  // ---- Invoice ----
  async getBeneficiaryInvoice(ubId, month) { return buildInvoice(ubId, month); },

  // ---- CSV Import ----
  async getImportHistory() { return [...IMP_HISTORY]; },
  async getCsvTemplate(type: CsvImportType): Promise<CsvTemplate> {
    const headers: Record<CsvImportType, string[]> = {
      ug:  ['id', 'nome', 'proprietario', 'documento', 'uc', 'distribuidora', 'status', 'preco_compra', 'geracao_mensal'],
      ub:  ['id', 'nome', 'documento', 'uc', 'distribuidora', 'ugId', 'consumo_mensal', 'media_anual', 'preco_esa', 'tarifa_distribuidora', 'impostos', 'cip', 'percentual_rateio', 'margem_preventiva'],
      rug: ['ugId', 'mes_referencia', 'geracao_kwh', 'saldo_anterior', 'preco_compra'],
      rub: ['ubId', 'mes_referencia', 'consumo_kwh', 'origem', 'arquivo'],
    };
    const filenames: Record<CsvImportType, string> = {
      ug: 'modelo-unidades-geradoras.csv', ub: 'modelo-unidades-beneficiarias.csv',
      rug: 'modelo-registros-mensais-ug.csv', rub: 'modelo-registros-mensais-ub.csv',
    };
    return { importType: type, delimiter: ';', headers: headers[type] ?? [], exampleRows: [], aliases: {}, example: '', filename: filenames[type] };
  },
  async extractUtilityBill(scenario = 'matched'): Promise<ExtractedBillData | null> {
    const ub = UBS[0];
    const dup = scenario === 'duplicate';
    return {
      referenceMonth: '2026-07',
      consumptionKwh: dup ? ub.monthlyConsumption + 180 : ub.monthlyConsumption,
      te: 320.4, tusd: 512.75, fioB: 88.9, flag: 12.5, cip: ub.cip,
      taxes: dup ? ub.taxes + 22.4 : ub.taxes, minKwh: 30,
      total: (dup ? ub.monthlyConsumption + 180 : ub.monthlyConsumption) * ub.distributorTariff + ub.taxes + ub.cip,
    };
  },
  async getExistingBillData(_ubId, _month): Promise<ExtractedBillData | null> {
    const ub = UBS[0];
    return {
      referenceMonth: '2026-07', consumptionKwh: ub.monthlyConsumption,
      te: 320.4, tusd: 512.75, fioB: 88.9, flag: 12.5, cip: ub.cip,
      taxes: ub.taxes, minKwh: 30, total: ub.monthlyConsumption * ub.distributorTariff + ub.taxes + ub.cip,
    };
  },
  async confirmBillExtraction(_data) { return ok; },
  async matchBillToBeneficiary(uc): Promise<BeneficiaryUnit | null> {
    return UBS.find((u) => u.uc === uc) ?? null;
  },
  async linkBillToBeneficiary(_extractionId, _ubId) { return ok; },
  async replaceBillData(_extractionId, _reason) { return ok; },

  // ---- Reports ----
  async getOwnerReport(ugId, month): Promise<OwnerReport | null> {
    const ug = UGS.find((u) => u.id === ugId);
    if (!ug) return null;
    const settlement = computeSettlement(ug);
    const price = appliedPrice(ugId, month);
    const payee = PAYEES[ugId] ?? { name: '', document: '', pixKey: '', pixType: 'cpf' };
    return {
      ugId, ugName: ug.name, month, appliedPrice: price,
      totalCompensated: settlement.totalCompensated, ownerPayment: settlement.totalCompensated * price,
      beneficiaryBreakdown: settlement.rows.map((r) => ({
        ubId: r.ub.id, ubName: r.ub.name, compensated: r.compensated,
        share: settlement.totalCompensated > 0 ? r.compensated / settlement.totalCompensated : 0,
        repasse: r.compensated * price, status: r.ub.paymentStatus,
      })),
      payee,
    };
  },
  async getInternalReport(ugId, _month): Promise<InternalReport | null> {
    const ug = UGS.find((u) => u.id === ugId);
    if (!ug) return null;
    const settlement = computeSettlement(ug);
    const criticalAlerts = STATIC_ALERTS.filter((a) => a.severity === 'critico' && a.unit === ugId).length;
    return { ugId, month: _month, settlement, criticalAlerts, pendingPayments: 0 };
  },
  async getFinancialReport(_ugId, month): Promise<FinancialReport | null> {
    const fin = await demoRuntimeProvider.getFinancialData({ month });
    return {
      month, totalRevenue: fin.totalRevenue, totalOwnerPayment: fin.totalOwnerPayment,
      spread: fin.spread, invoices: fin.invoices,
    };
  },

  // ---- Financial ----
  async getFinancialData(filter): Promise<FinancialData> {
    const { month } = filter;
    const results = scaledResults(month);
    const invoices: PaymentRecord[] = results.flatMap((r) =>
      r.rows.map((row) => resolvedPaymentRecord('fat', row.ub.id, row.ub.name, month, row.faturaEsa)),
    );
    const ownerPayments: PaymentRecord[] = results.map((r) =>
      resolvedPaymentRecord('rep', r.ug.id, r.ug.name, month, r.ownerPayment),
    );
    const totalRevenue = invoices.reduce((s, p) => s + p.amount, 0);
    const totalOwnerPayment = ownerPayments.reduce((s, p) => s + p.amount, 0);
    return { month, invoices, ownerPayments, totalRevenue, totalOwnerPayment, spread: totalRevenue - totalOwnerPayment };
  },
  async confirmInvoicePayment(_ubId, _month, _payment) { return ok; },
  async reopenInvoicePayment(_ubId, _month, _reason) { return ok; },
  async confirmOwnerPayment(_ugId, _month, _payment: PaymentInput) { return ok; },

  // ---- Alerts ----
  async listAlerts(filter?: AlertFilter): Promise<AlertRecord[]> {
    let list = STATIC_ALERTS;
    if (filter?.month) list = list.filter((a) => a.month === filter.month);
    if (filter?.severity && filter.severity !== 'all') list = list.filter((a) => a.severity === filter.severity);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((a) => a.message.toLowerCase().includes(q) || a.unit.toLowerCase().includes(q));
    }
    return list.map((a) => ({
      ...a,
      title: ALERT_TITLES[a.code] ?? a.code,
      status: 'ativo' as const,
      detectedValue: ALERT_METRICS[a.id]?.detected,
      threshold: ALERT_METRICS[a.id]?.threshold,
      impact: ALERT_IMPACT[a.id],
      history: [{ at: '01/07/2026', label: 'Alerta gerado pelo motor de apuração' }],
    }));
  },
  async getAlertDetail(id): Promise<AlertRecord | null> {
    const alerts = await demoRuntimeProvider.listAlerts();
    return alerts.find((a) => a.id === id) ?? null;
  },
  async resolveAlert(_id, _note) { return ok; },
  async ignoreAlert(_id, _note) { return ok; },
  async markAlertInAnalysis(_id, _note) { return ok; },
};
