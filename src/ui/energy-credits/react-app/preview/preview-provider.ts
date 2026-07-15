/**
 * preview-provider.ts
 *
 * Réplica fiel do energyCreditsProvider (Lovable original).
 * Usa exatamente os mesmos dados, lógica de cálculo e shapes do mock original.
 * Propósito exclusivo: preview/teste visual. Não conecta Firebase.
 * Não expõe calculationMemory. Não usa localStorage para dados operacionais.
 */
import type { EsaProvider } from '../src/lib/esa/EsaProviderContext';
import type {
  GeneratingUnit,
  BeneficiaryUnit,
  Alert,
  SettlementResult,
  SettlementRow,
  AllocationPlan,
  AllocationRow,
  ExecutiveSummary,
  FinancialSummary,
  TrendRow,
  MonthOption,
  KpiDelta,
  PeriodFilter,
} from '../src/lib/esa/types';

// ============================================================
// DADOS — cópia exata do Lovable mockData.ts
// ============================================================

const UGS: GeneratingUnit[] = [
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
    payee: { name: 'João Pereira', document: '123.456.789-00', pixKey: 'joao.pereira@esaenergia.com.br', pixType: 'email' },
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
    payee: { name: 'Maria Silva', document: '987.654.321-00', pixKey: '987.654.321-00', pixType: 'cpf' },
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
    payee: { name: 'Construtora Norte Ltda', document: '12.345.678/0001-90', pixKey: '12.345.678/0001-90', pixType: 'cnpj' },
  },
];

const UBS: BeneficiaryUnit[] = [
  { id: 'UB-001', name: 'Mercado Central', document: '11.222.333/0001-44', uc: '111222333', distributor: 'Copel', ugId: 'UG-001', status: 'ativa', monthlyConsumption: 3950, annualAverage: 48000, previousCreditBalance: 350, allocationPct: 0.323, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 420, cip: 51.97, otherCharges: 0, paymentStatus: 'pago', customerSince: '2025-08', accumulatedSavings: 14870.45 },
  { id: 'UB-002', name: 'Panificadora Sol', document: '22.333.444/0001-55', uc: '222333444', distributor: 'Copel', ugId: 'UG-001', status: 'ativa', monthlyConsumption: 2900, annualAverage: 36000, previousCreditBalance: 180, allocationPct: 0.245, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 310, cip: 42.5, otherCharges: 0, paymentStatus: 'aberto', customerSince: '2025-10', accumulatedSavings: 8210.30 },
  { id: 'UB-003', name: 'Clínica Vida', document: '33.444.555/0001-66', uc: '333444555', distributor: 'Copel', ugId: 'UG-001', status: 'ativa', monthlyConsumption: 2050, annualAverage: 24000, previousCreditBalance: 120, allocationPct: 0.16, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 220, cip: 38.9, otherCharges: 0, paymentStatus: 'vencido', customerSince: '2025-06', accumulatedSavings: 9120.00 },
  { id: 'UB-004', name: 'Auto Posto Norte', document: '44.555.666/0001-77', uc: '444555666', distributor: 'Copel', ugId: 'UG-001', status: 'ativa', monthlyConsumption: 3500, annualAverage: 42000, previousCreditBalance: 280, allocationPct: 0.272, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.88, taxes: 380, cip: 55.2, otherCharges: 0, paymentStatus: 'pago', customerSince: '2025-09', accumulatedSavings: 11450.70 },
  { id: 'UB-005', name: 'Restaurante Sabor', document: '55.666.777/0001-88', uc: '555666777', distributor: 'Copel', ugId: 'UG-002', status: 'ativa', monthlyConsumption: 3800, annualAverage: 45000, previousCreditBalance: 210, allocationPct: 0.66, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.85, taxes: 400, cip: 48.5, otherCharges: 0, paymentStatus: 'pago', customerSince: '2025-07', accumulatedSavings: 12980.00 },
  { id: 'UB-006', name: 'Farmácia Popular', document: '66.777.888/0001-99', uc: '666777888', distributor: 'Copel', ugId: 'UG-002', status: 'ativa', monthlyConsumption: 1800, annualAverage: 21600, previousCreditBalance: 90, allocationPct: 0.34, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.86, taxes: 195, cip: 32.0, otherCharges: 0, paymentStatus: 'aberto', customerSince: '2025-11', accumulatedSavings: 4820.15 },
  { id: 'UB-007', name: 'Escola Aprender', document: '77.888.999/0001-11', uc: '777888999', distributor: 'Copel', ugId: 'UG-003', status: 'ativa', monthlyConsumption: 2600, annualAverage: 30000, previousCreditBalance: 4800, allocationPct: 1.0, preventiveMargin: 0.05, esaPrice: 0.55, distributorTariff: 0.84, taxes: 280, cip: 40.0, otherCharges: 0, paymentStatus: 'aberto', customerSince: '2025-05', accumulatedSavings: 6850.90 },
];

const ALERTS: Alert[] = [
  { id: 'A-001', severity: 'critico', code: 'ALLOCATION_PERCENTAGE_TOTAL_INVALID', message: 'A soma dos percentuais de rateio deve totalizar 100%.', unit: 'UG-002', month: '2026-07', action: 'Ajustar percentuais na tela de Apuração Mensal.' },
  { id: 'A-002', severity: 'risco', code: 'HIGH_BENEFICIARY_CREDIT_BALANCE', message: 'Saldo acumulado superior a 1,5 mês da média de consumo.', unit: 'UB-007', month: '2026-07', action: 'Reduzir percentual de rateio ou margem preventiva.' },
  { id: 'A-003', severity: 'risco', code: 'LOW_BENEFICIARY_CREDIT_BALANCE', message: 'Saldo disponível e crédito planejado abaixo do crédito alvo.', unit: 'UB-003', month: '2026-07', action: 'Aumentar percentual de rateio ou revisar margem preventiva.' },
  { id: 'A-004', severity: 'atencao', code: 'CONSUMPTION_ABOVE_AVERAGE', message: 'Consumo real acima de 110% da média mensal.', unit: 'UB-004', month: '2026-07', action: 'Revisar média e planejamento de créditos.' },
  { id: 'A-005', severity: 'atencao', code: 'LOW_BENEFICIARY_CREDIT_BALANCE', message: 'Cobertura do saldo inferior a 0,25 mês.', unit: 'UB-006', month: '2026-07', action: 'Aumentar percentual de rateio para elevar o saldo mínimo.' },
  { id: 'A-006', severity: 'info', code: 'HIGH_BENEFICIARY_CREDIT_BALANCE', message: 'Cobertura do saldo elevada — acima de 2 meses.', unit: 'UB-001', month: '2026-06', action: 'Considerar reduzir margem preventiva no próximo ciclo.' },
];

const AVAILABLE_MONTHS: MonthOption[] = [
  { value: '2026-07', label: 'Julho de 2026', status: 'em_apuracao' },
  { value: '2026-06', label: 'Junho de 2026', status: 'fechado' },
  { value: '2026-05', label: 'Maio de 2026', status: 'fechado' },
  { value: '2026-04', label: 'Abril de 2026', status: 'fechado' },
  { value: '2026-03', label: 'Março de 2026', status: 'fechado' },
];

// Fator determinístico por mês — idêntico ao Lovable
const MONTH_FACTOR: Record<string, number> = {
  '2026-07': 1.0,
  '2026-06': 0.92,
  '2026-05': 0.88,
  '2026-04': 0.83,
  '2026-03': 0.79,
};

// criticalByMonth — idêntico ao Lovable
const CRITICAL_BY_MONTH: Record<string, number> = {
  '2026-07': 2,
  '2026-06': 3,
  '2026-05': 2,
  '2026-04': 4,
  '2026-03': 3,
};

// ============================================================
// MOTOR DE LIQUIDAÇÃO — idêntico ao Lovable computeSettlement
// ============================================================

function computeSettlement(ug: GeneratingUnit, ubs: BeneficiaryUnit[]): SettlementResult {
  const available = ug.previousBalance + ug.monthlyGeneration;
  let remaining = available;
  const rows: SettlementRow[] = ubs.map((ub) => {
    const allocated = Math.min(ub.monthlyConsumption, remaining);
    remaining -= allocated;
    const compensated = allocated;
    const pending = ub.monthlyConsumption - compensated;
    const contaSemEsa = ub.monthlyConsumption * ub.distributorTariff + ub.taxes + ub.cip + ub.otherCharges;
    const faturaEsa = compensated * ub.esaPrice;
    const contaComEsa = faturaEsa + pending * ub.distributorTariff + ub.taxes + ub.cip + ub.otherCharges;
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

function computeAllResults(): SettlementResult[] {
  return UGS.map((ug) => computeSettlement(ug, UBS.filter((u) => u.ugId === ug.id)));
}

function scaledResults(month: string, ugId?: string): SettlementResult[] {
  const factor = MONTH_FACTOR[month] ?? 1;
  const all = computeAllResults();
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

function makeDelta(current: number, previous: number): KpiDelta {
  if (previous === 0) return { value: current, pct: 0, direction: current > 0 ? 'up' : 'flat' };
  const diff = current - previous;
  const pct = (diff / Math.abs(previous)) * 100;
  const direction: KpiDelta['direction'] = Math.abs(pct) < 0.5 ? 'flat' : diff > 0 ? 'up' : 'down';
  return { value: diff, pct, direction };
}

function prevMonthOf(month: string): string | undefined {
  const idx = AVAILABLE_MONTHS.findIndex((m) => m.value === month);
  return AVAILABLE_MONTHS[idx + 1]?.value;
}

// ============================================================
// MOTOR DE RATEIO — idêntico ao Lovable computeAllocationPlan
// ============================================================

function computeAllocationPlan(
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
    ug, generation: gen, rows, totalPct, totalProjected, totalCompensated,
    totalFinalBalance, ownerPayment, esaRevenue, totalRecommended,
    totalTargetCredit, totalConsumption,
  };
}

// ============================================================
// FATURA — idêntico ao Lovable buildInvoice
// ============================================================

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

function buildSavingsHistory(from: string, to: string, accumulated: number) {
  const LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const list: { month: string; label: string }[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy; let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    list.push({ month: `${y}-${String(m).padStart(2, '0')}`, label: LABELS[m - 1] });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  const n = list.length;
  if (n === 0) return [];
  const base = accumulated / n;
  let cum = 0;
  return list.map((it, i) => {
    const factor = 0.85 + (i / Math.max(1, n - 1)) * 0.3;
    const monthly = base * factor;
    cum += monthly;
    return { month: it.month, label: it.label, monthly, cumulative: cum };
  });
}

function buildInvoice(ubId: string, month: string) {
  const ub = UBS.find((u) => u.id === ubId);
  if (!ub) return null;
  const ug = UGS.find((g) => g.id === ub.ugId)!;
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
  const [y, m2] = month.split('-').map(Number);
  const dueDate = `10/${String(m2 + 1).padStart(2, '0')}/${y}`;
  return {
    ub, ug, month,
    docNumber: `ESA-${month.replace('-', '')}-${ub.id.replace('-', '')}`,
    dueDate,
    consumption: ub.monthlyConsumption, previousBalance, receivedCredits,
    availableCredits, compensated, finalBalance, faturaEsa,
    taxes: ub.taxes, cip: ub.cip, otherCharges: ub.otherCharges,
    totalWithEsa, energyWithoutEsa, totalWithoutEsa,
    monthlySavings, discountPct,
    customerSince: ub.customerSince, monthsAsCustomer,
    accumulatedSavings: ub.accumulatedSavings, savingsHistory,
  };
}

function getBeneficiaryMonthlyHistoryLocal(id: string) {
  const ub = UBS.find((u) => u.id === id);
  const base = ub?.monthlyConsumption ?? 3800;
  return [
    { month: '2026-07', label: 'Jul/2026', consumptionKwh: Math.round(base), source: 'utility_bill_import' as const, sourceLabel: 'Fatura importada', fileName: 'conta-copel-jul-2026.pdf', importedAt: '2026-07-08', status: 'confirmado' as const, includedInAverage: true },
    { month: '2026-06', label: 'Jun/2026', consumptionKwh: Math.round(base * 0.965), source: 'csv_import' as const, sourceLabel: 'CSV', fileName: 'ubm-2026-06.csv', importedAt: '2026-06-05', status: 'confirmado' as const, includedInAverage: true },
    { month: '2026-05', label: 'Mai/2026', consumptionKwh: Math.round(base * 1.04), source: 'manual_entry' as const, sourceLabel: 'Manual', fileName: null as string | null, importedAt: '2026-05-03', status: 'confirmado' as const, includedInAverage: true },
  ];
}

// ============================================================
// PREVIEW PROVIDER — EsaProvider completo
// ============================================================

export const previewProvider: EsaProvider = {
  listMonths: () => AVAILABLE_MONTHS,

  getCycleStatus: (month) => AVAILABLE_MONTHS.find((m) => m.value === month)?.status ?? 'aberto',

  listGeneratingUnits: () => UGS,
  listBeneficiaryUnits: () => UBS,
  listAlerts: () => ALERTS,

  computeAll: (): SettlementResult[] => computeAllResults(),

  getExecutiveSummary: (filters: PeriodFilter): ExecutiveSummary => {
    const results = scaledResults(filters.month, filters.ugId);
    const curr = aggregate(results);
    const prevM = prevMonthOf(filters.month);
    const prev = prevM ? aggregate(scaledResults(prevM, filters.ugId)) : curr;

    const currCritical = CRITICAL_BY_MONTH[filters.month] ?? 0;
    const prevCritical = prevM ? (CRITICAL_BY_MONTH[prevM] ?? currCritical) : currCritical;

    const activeUgs = filters.ugId
      ? UGS.filter((u) => u.id === filters.ugId && u.status === 'ativa').length
      : UGS.filter((u) => u.status === 'ativa').length;
    const totalUgs = filters.ugId ? 1 : UGS.length;
    const ubList = filters.ugId ? UBS.filter((b) => b.ugId === filters.ugId) : UBS;

    return {
      month: filters.month,
      cycleStatus: AVAILABLE_MONTHS.find((m) => m.value === filters.month)?.status ?? 'aberto',
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
        generation: makeDelta(curr.generation, prev.generation),
        compensated: makeDelta(curr.compensated, prev.compensated),
        balance: makeDelta(curr.balance, prev.balance),
        revenue: makeDelta(curr.revenue, prev.revenue),
        ownerPayment: makeDelta(curr.ownerPayment, prev.ownerPayment),
        spread: makeDelta(curr.spread, prev.spread),
        savings: makeDelta(curr.savings, prev.savings),
        criticalAlerts: makeDelta(currCritical, prevCritical),
      },
      results,
    };
  },

  getAlertsSummary: (filters: PeriodFilter): Alert[] =>
    ALERTS.filter(
      (a) => a.month === filters.month && (!filters.ugId || a.unit === filters.ugId),
    ),

  // TrendRow exige: month, label, Receita, Repasse, Spread, Geracao, Consumo
  getMonthlyTrend: (filters): TrendRow[] =>
    [...AVAILABLE_MONTHS].reverse().map((m) => {
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
    }),

  getFinancialSummary: (filters: PeriodFilter): FinancialSummary => {
    return aggregate(scaledResults(filters.month, filters.ugId));
  },

  getGeneratingUnitCycleSummary: (id, filters) => {
    const ug = UGS.find((u) => u.id === id);
    if (!ug) return null;
    const ubs = UBS.filter((u) => u.ugId === id);
    const plan = computeAllocationPlan(ug, ubs);
    return {
      ug,
      month: filters.month,
      cycleStatus: AVAILABLE_MONTHS.find((m) => m.value === filters.month)?.status ?? 'aberto',
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

  getCreditAllocationPlan: (ugId, _month, overrides): AllocationPlan | null => {
    const ug = UGS.find((u) => u.id === ugId);
    if (!ug) return null;
    return computeAllocationPlan(ug, UBS.filter((u) => u.ugId === ugId), overrides);
  },

  getGeneratingUnitCommercialTerms: (id) => {
    const ug = UGS.find((u) => u.id === id);
    if (!ug) return null;
    return {
      purchasePricePerKwh: ug.purchasePrice,
      effectiveDate: '2026-01-01',
      lastAppliedPricePerKwh: ug.purchasePrice,
      lastAppliedMonth: '2026-07',
      observation: 'Valor padrão utilizado para cálculo do repasse ao proprietário.',
    };
  },

  getGeneratingUnitCreditDestinationReport: (id, month) => {
    const ug = UGS.find((u) => u.id === id);
    if (!ug) return null;
    const plan = computeAllocationPlan(ug, UBS.filter((u) => u.ugId === id));
    return {
      ug, month,
      generation: plan.generation,
      totalDistributed: plan.totalProjected,
      totalConsumed: plan.totalConsumption,
      totalCompensated: plan.totalCompensated,
      totalAccumulatedBalance: plan.totalFinalBalance,
      beneficiariesCount: plan.rows.length,
      ownerPayment: plan.ownerPayment,
      rows: plan.rows.map((r) => ({
        ub: r.ub,
        allocationPct: r.allocationPercentage,
        received: r.creditsReceivedKwh,
        consumption: r.monthlyConsumptionKwh,
        compensated: r.creditsCompensatedKwh,
        previousBalance: r.previousBalanceKwh,
        finalBalance: r.finalBalanceKwh,
        coverageMonths: r.coverageMonths,
      })),
    };
  },

  createGeneratingUnit: (input) => ({ id: (input.id as string) ?? `UG-${Date.now()}`, ok: true }),
  updateGeneratingUnit: (id, _input) => ({ id, ok: true }),

  getBeneficiaryConsumptionAverage: (id) => {
    const ub = UBS.find((u) => u.id === id);
    if (!ub) return null;
    return { annual: ub.annualAverage, monthly: ub.annualAverage / 12 };
  },

  getBeneficiaryCreditBalance: (id, month) => {
    const inv = buildInvoice(id, month);
    if (!inv) return null;
    return {
      previous: inv.previousBalance,
      received: inv.receivedCredits,
      compensated: inv.compensated,
      final: inv.finalBalance,
      coverageMonths: inv.ub.monthlyConsumption > 0 ? inv.finalBalance / inv.ub.monthlyConsumption : 0,
    };
  },

  getBeneficiaryMonthlyHistory: (id) => getBeneficiaryMonthlyHistoryLocal(id),

  getBeneficiaryAverageComposition: (id) => {
    const history = getBeneficiaryMonthlyHistoryLocal(id);
    const considered = history.filter((h) => h.includedInAverage);
    const bySource = considered.reduce(
      (acc: Record<string, number>, r) => { acc[r.source] = (acc[r.source] ?? 0) + 1; return acc; },
      {},
    );
    const avg = considered.reduce((s, r) => s + r.consumptionKwh, 0) / Math.max(1, considered.length);
    return {
      monthsConsidered: considered.length,
      monthlyAverageKwh: Math.round(avg),
      bySource: {
        utility_bill_import: bySource.utility_bill_import ?? 0,
        csv_import: bySource.csv_import ?? 0,
        manual_entry: bySource.manual_entry ?? 0,
      },
    };
  },

  getBeneficiaryMonthlyRecord: (id, month) => {
    const ub = UBS.find((u) => u.id === id);
    if (!ub) return null;
    return {
      beneficiaryUnitId: id,
      referenceMonth: month,
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

  getBeneficiarySavingsHistory: (id, upToMonth = '2026-07') => {
    const inv = buildInvoice(id, upToMonth);
    return inv?.savingsHistory ?? [];
  },

  createBeneficiaryUnit: (input) => ({ id: (input.id as string) ?? `UB-${Date.now()}`, ok: true }),
  updateBeneficiaryUnit: (id, _input) => ({ id, ok: true }),

  getBeneficiaryInvoice: (ubId, month) => {
    const inv = buildInvoice(ubId, month);
    if (!inv) return null;

    const componentesTarifarios = [
      { label: 'Créditos cobrados pela ESA', value: inv.faturaEsa },
      { label: 'Impostos', value: inv.taxes },
      { label: 'Iluminação Pública / CIP', value: inv.cip },
      { label: 'Outros encargos', value: inv.otherCharges },
    ];

    // billingSnapshot.contaEsa = totalWithEsa (inclui impostos/CIP/outros)
    // Separado de faturaEsa (só a energia — compensated × esaPrice)
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
      coverageMonths: inv.ub.monthlyConsumption > 0 ? inv.finalBalance / inv.ub.monthlyConsumption : 0,
    };

    const settlementRecipient = {
      recipientName: inv.ug.payee.name,
      recipientDocument: inv.ug.payee.document,
      pixKey: inv.ug.payee.pixKey,
      pixKeyType: inv.ug.payee.pixType,
    };

    const beneficiarySavingsHistory = inv.savingsHistory.map((h) => ({
      referenceMonth: h.month,
      label: h.label,
      billWithoutEsa: inv.totalWithoutEsa,
      billWithEsa: inv.totalWithEsa,
      monthlySavings: h.monthly,
      savingsPercentage: inv.discountPct,
      accumulatedSavings: h.cumulative,
    }));

    return { raw: inv, billingSnapshot, creditBalance, settlementRecipient, beneficiarySavingsHistory };
  },

  getSettlementRecipient: (ugId) => {
    const ug = UGS.find((u) => u.id === ugId);
    if (!ug) return null;
    return {
      recipientName: ug.payee.name,
      recipientDocument: ug.payee.document,
      pixKey: ug.payee.pixKey,
      pixKeyType: ug.payee.pixType,
    };
  },

  confirmInvoicePayment: (_id, _payment) => ({ ok: true }),
  reopenInvoicePayment: (_id) => ({ ok: true }),
  confirmOwnerSettlementPayment: (_id, _payment) => ({ ok: true }),

  getCsvTemplate: (type) => {
    const templates: Record<string, { filename: string; headers: string[]; example: string }> = {
      ug: { filename: 'modelo-unidades-geradoras.csv', headers: ['id','nome','proprietario','documento','unidadeConsumidora','distribuidora','status'], example: 'id;nome;proprietario;documento;unidadeConsumidora;distribuidora;status\nug-assai;UG Solar Assaí;João Pereira;12345678900;123456789;Copel;active' },
      ub: { filename: 'modelo-unidades-beneficiarias.csv', headers: ['id','unidadeGeradoraId','nome','documento','unidadeConsumidora','distribuidora','status'], example: 'id;unidadeGeradoraId;nome;documento;unidadeConsumidora;distribuidora;status\nub-001;ug-assai;Mercado Central;12222333000144;111222333;Copel;active' },
      rug: { filename: 'modelo-registros-mensais-ug.csv', headers: ['id','unidadeGeradoraId','mesReferencia','saldoAnteriorKwh','geracaoMensalKwh','precoCompraKwh','status'], example: 'id;unidadeGeradoraId;mesReferencia;saldoAnteriorKwh;geracaoMensalKwh;precoCompraKwh;status\nugm-ug-assai-2026-07;ug-assai;2026-07;2500;13000;0,35;review' },
      rub: { filename: 'modelo-registros-mensais-ub.csv', headers: ['id','unidadeBeneficiariaId','unidadeGeradoraId','mesReferencia','consumoMensalKwh','creditosAlocadosKwh','creditosCompensadosKwh','precoEsaKwh','tarifaDistribuidoraKwh','statusPagamento'], example: 'id;unidadeBeneficiariaId;unidadeGeradoraId;mesReferencia;consumoMensalKwh;creditosAlocadosKwh;creditosCompensadosKwh;precoEsaKwh;tarifaDistribuidoraKwh;statusPagamento\nubm-ub-001-2026-07;ub-001;ug-assai;2026-07;3950;4199;3950;0,55;0,85;paid' },
    };
    return templates[type];
  },

  simulateUtilityBillExtraction: (_file, scenario = 'matched') => {
    const ub = UBS[0];
    const ug = UGS.find((g) => g.id === ub.ugId)!;
    const base = {
      extractionId: `EXT-${Date.now()}`,
      confidence: 'review' as const,
      fileName: (_file as { name?: string } | null)?.name ?? 'conta-copel-jul-2026.pdf',
      referenceMonth: '2026-07',
      teValue: 320.4, tusdValue: 512.75, fioB: 88.9, flagValue: 12.5, minimumBillableKwh: 30,
      scenario,
    };
    if (scenario === 'unmatched') {
      return { ...base, confidence: 'unknown' as const, utilityConsumerUnit: '999888777', beneficiaryUnitId: null as string | null, beneficiaryName: 'PADARIA NOVO HORIZONTE LTDA', beneficiaryDocument: '31.222.444/0001-90', distributor: 'Copel', consumptionKwh: 2840, cipValue: 24.5, taxesValue: 380.15, totalBillValue: 2840 * 0.85 + 380.15 + 24.5 };
    }
    const dupAdj = scenario === 'duplicate';
    return { ...base, confidence: 'high' as const, utilityConsumerUnit: ub.uc, beneficiaryUnitId: ub.id, beneficiaryName: ub.name, beneficiaryDocument: ub.document, distributor: ug.distributor, consumptionKwh: dupAdj ? ub.monthlyConsumption + 180 : ub.monthlyConsumption, cipValue: ub.cip, taxesValue: dupAdj ? ub.taxes + 22.4 : ub.taxes, totalBillValue: (dupAdj ? ub.monthlyConsumption + 180 : ub.monthlyConsumption) * ub.distributorTariff + ub.taxes + ub.cip };
  },

  confirmUtilityBillExtraction: (extractionId, _data) => ({ extractionId, ok: true }),

  matchUtilityBillToBeneficiary: ({ utilityConsumerUnit }) => {
    const ub = UBS.find((u) => u.uc === utilityConsumerUnit);
    if (!ub) return { matched: false as const };
    const ug = UGS.find((g) => g.id === ub.ugId);
    return { matched: true as const, beneficiaryUnitId: ub.id, beneficiaryName: ub.name, beneficiaryDocument: ub.document, uc: ub.uc, distributor: ub.distributor, generatingUnitId: ub.ugId, generatingUnitName: ug?.name ?? '—' };
  },

  linkUtilityBillToBeneficiary: (_extractionId, _ubId) => ({ ok: true }),

  prepareBeneficiaryFromUtilityBill: (extractionId) => ({
    extractionId,
    prefill: { name: '', document: '', uc: '', distributor: '' },
  }),

  confirmBeneficiaryMonthlyRecordFromUtilityBill: (extractionId, data) => ({
    extractionId,
    beneficiaryUnitId: data.beneficiaryUnitId,
    referenceMonth: data.referenceMonth,
    recordId: `UBM-${data.beneficiaryUnitId}-${data.referenceMonth}`,
    status: 'confirmado' as const,
    source: 'utility_bill_import' as const,
  }),

  replaceBeneficiaryMonthlyRecordFromUtilityBill: (extractionId, reason) => ({
    extractionId, status: 'replaced' as const, reason, replacedAt: new Date().toISOString(),
  }),

  compareUtilityBillWithExistingRecord: (_extractionId, existing, incoming) => {
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

  getUnlinkedUtilityBills: () => [],

  shouldEmitLowBalanceAlert: ({ currentBalanceKwh, plannedCreditsReceivedKwh, targetCreditKwh }) =>
    currentBalanceKwh + plannedCreditsReceivedKwh < targetCreditKwh,
};
