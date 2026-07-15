import type { EsaProvider } from '../src/lib/esa/EsaProviderContext';
import type {
  GeneratingUnit, BeneficiaryUnit, Alert, SettlementResult, AllocationPlan,
  ExecutiveSummary, FinancialSummary, TrendRow, MonthOption, CycleStatus,
} from '../src/lib/esa/types';

const MONTHS: MonthOption[] = [
  { value: '2026-07', label: 'Julho 2026' },
  { value: '2026-06', label: 'Junho 2026' },
  { value: '2026-05', label: 'Maio 2026' },
  { value: '2026-04', label: 'Abril 2026' },
  { value: '2026-03', label: 'Março 2026' },
];

const UGS: GeneratingUnit[] = [
  {
    id: 'UG-001', name: 'Usina Solar Piauí', owner: 'João da Silva', document: '12.345.678/0001-90',
    uc: 'UC-001', distributor: 'EQUATORIAL', status: 'ativa', purchasePrice: 0.35,
    previousBalance: 2500, monthlyGeneration: 58500, beneficiaries: ['UB-001', 'UB-002', 'UB-003'],
    payee: { name: 'João da Silva', document: '123.456.789-00', pixType: 'cpf', pixKey: '123.456.789-00' },
  },
  {
    id: 'UG-002', name: 'Usina Solar Maranhão', owner: 'Maria Santos', document: '98.765.432/0001-10',
    uc: 'UC-002', distributor: 'EQUATORIAL', status: 'ativa', purchasePrice: 0.33,
    previousBalance: 1800, monthlyGeneration: 34200, beneficiaries: ['UB-004', 'UB-005'],
    payee: { name: 'Maria Santos', document: '987.654.321-00', pixType: 'email', pixKey: 'maria@exemplo.com' },
  },
];

const UBS: BeneficiaryUnit[] = [
  { id: 'UB-001', name: 'Mercado Central', document: '11.111.111/0001-11', uc: 'UC-101', distributor: 'EQUATORIAL', ugId: 'UG-001', status: 'ativa', paymentStatus: 'pago', monthlyConsumption: 3200, annualAverage: 37200, previousCreditBalance: 800, allocationPct: 0.20, preventiveMargin: 0.10, esaPrice: 0.72, distributorTariff: 0.98, taxes: 180, cip: 25, otherCharges: 0, customerSince: '2025-01', accumulatedSavings: 3200 },
  { id: 'UB-002', name: 'Condomínio Jardins', document: '22.222.222/0001-22', uc: 'UC-102', distributor: 'EQUATORIAL', ugId: 'UG-001', status: 'ativa', paymentStatus: 'aberto', monthlyConsumption: 4100, annualAverage: 48000, previousCreditBalance: 1200, allocationPct: 0.25, preventiveMargin: 0.10, esaPrice: 0.71, distributorTariff: 0.98, taxes: 220, cip: 25, otherCharges: 0, customerSince: '2025-02', accumulatedSavings: 4100 },
  { id: 'UB-003', name: 'Hospital São Lucas', document: '33.333.333/0001-33', uc: 'UC-103', distributor: 'EQUATORIAL', ugId: 'UG-001', status: 'ativa', paymentStatus: 'vencido', monthlyConsumption: 8500, annualAverage: 98400, previousCreditBalance: 2000, allocationPct: 0.55, preventiveMargin: 0.15, esaPrice: 0.69, distributorTariff: 0.98, taxes: 450, cip: 40, otherCharges: 0, customerSince: '2024-11', accumulatedSavings: 8500 },
  { id: 'UB-004', name: 'Escola Municipal', document: '44.444.444/0001-44', uc: 'UC-201', distributor: 'EQUATORIAL', ugId: 'UG-002', status: 'ativa', paymentStatus: 'aberto', monthlyConsumption: 1800, annualAverage: 21000, previousCreditBalance: 400, allocationPct: 0.35, preventiveMargin: 0.10, esaPrice: 0.70, distributorTariff: 0.98, taxes: 95, cip: 20, otherCharges: 0, customerSince: '2025-03', accumulatedSavings: 1800 },
  { id: 'UB-005', name: 'Supermercado Bom Preço', document: '55.555.555/0001-55', uc: 'UC-202', distributor: 'EQUATORIAL', ugId: 'UG-002', status: 'ativa', paymentStatus: 'pago', monthlyConsumption: 5200, annualAverage: 60000, previousCreditBalance: 1500, allocationPct: 0.65, preventiveMargin: 0.10, esaPrice: 0.68, distributorTariff: 0.98, taxes: 280, cip: 30, otherCharges: 0, customerSince: '2024-12', accumulatedSavings: 5200 },
];

const ALERTS: Alert[] = [
  { id: 'A-001', severity: 'critico', code: 'CREDIT_BALANCE_ZERO', message: 'Saldo de créditos zerado', unit: 'Hospital São Lucas', month: '2026-07', action: 'Alocar créditos adicionais imediatamente' },
  { id: 'A-002', severity: 'risco', code: 'PAYMENT_OVERDUE', message: 'Fatura vencida há 15 dias', unit: 'Hospital São Lucas', month: '2026-07', action: 'Entrar em contato com o cliente' },
  { id: 'A-003', severity: 'atencao', code: 'LOW_COVERAGE', message: 'Cobertura de créditos abaixo do recomendado', unit: 'Mercado Central', month: '2026-07', action: 'Revisar rateio na apuração' },
  { id: 'A-004', severity: 'info', code: 'NEW_CYCLE_OPEN', message: 'Ciclo de agosto disponível para apuração', unit: 'Usina Solar Piauí', month: '2026-08', action: 'Iniciar apuração de agosto' },
];

function makeCycleSummary(ugId: string) {
  return {
    ugId,
    month: '2026-07',
    cycleStatus: 'aberto' as CycleStatus,
    generationKwh: ugId === 'UG-001' ? 58500 : 34200,
    totalRecommendedKwh: ugId === 'UG-001' ? 56000 : 32000,
    totalPlannedKwh: ugId === 'UG-001' ? 55000 : 31500,
    totalReceivedKwh: ugId === 'UG-001' ? 54800 : 31200,
    totalCompensatedKwh: ugId === 'UG-001' ? 52000 : 29800,
    totalFinalBalanceKwh: ugId === 'UG-001' ? 3800 : 2900,
    beneficiariesCount: ugId === 'UG-001' ? 3 : 2,
    ownerPayment: ugId === 'UG-001' ? 19180 : 10296,
    esaRevenue: ugId === 'UG-001' ? 37440 : 20256,
  };
}

export const previewProvider: EsaProvider = {
  listMonths: () => MONTHS,
  getCycleStatus: (_month) => 'aberto' as CycleStatus,
  listGeneratingUnits: () => UGS,
  listBeneficiaryUnits: () => UBS,
  listAlerts: () => ALERTS,

  computeAll: (): SettlementResult[] =>
    UGS.map((ug) => {
      const ubsForUg = UBS.filter((u) => u.ugId === ug.id);
      const totalCompensated = ubsForUg.reduce((s, u) => s + u.monthlyConsumption * 0.92, 0);
      const ownerPayment = totalCompensated * ug.purchasePrice;
      const esaRevenue = ubsForUg.reduce((s, u) => s + u.monthlyConsumption * u.esaPrice, 0);
      const generation = ug.monthlyGeneration;
      const totalAllocated = generation * 0.95;
      return {
        ug,
        previousBalance: ug.previousBalance,
        generation,
        available: generation + ug.previousBalance,
        totalAllocated,
        totalCompensated,
        totalPending: totalAllocated - totalCompensated,
        currentBalance: ug.previousBalance + generation - totalCompensated,
        ownerPayment,
        esaRevenue,
        spread: esaRevenue - ownerPayment,
        rows: ubsForUg.map((u) => ({
          ub: u,
          allocated: u.allocationPct * generation,
          compensated: u.monthlyConsumption * 0.92,
          pending: u.allocationPct * generation - u.monthlyConsumption * 0.92,
          contaSemEsa: u.monthlyConsumption * u.distributorTariff,
          faturaEsa: u.monthlyConsumption * u.esaPrice,
          contaComEsa: u.monthlyConsumption * u.esaPrice + u.taxes + u.cip,
          economia: u.monthlyConsumption * (u.distributorTariff - u.esaPrice),
        })),
      };
    }),

  getExecutiveSummary: (filters): ExecutiveSummary => {
    const zd = { value: 0, pct: 0, direction: 'flat' as const };
    return {
      month: filters.month ?? '2026-07',
      cycleStatus: 'em_apuracao',
      operational: { generatingUnits: { total: 2, active: 2 }, beneficiaryUnits: { total: 5, active: 5 }, generation: 92700, compensated: 81800, balance: 10900 },
      financial: { revenue: 57696, ownerPayment: 29476, spread: 28220, savings: 14200, criticalAlerts: 1 },
      deltas: { generation: zd, compensated: zd, balance: zd, revenue: zd, ownerPayment: zd, spread: zd, savings: zd, criticalAlerts: zd },
      results: [],
    };
  },

  getAlertsSummary: (_filters): Alert[] => ALERTS,

  getMonthlyTrend: (_filters): TrendRow[] =>
    MONTHS.slice().reverse().map((m, i) => ({
      label: m.label.slice(0, 3),
      Receita: 45000 + i * 3200,
      Repasse: 27000 + i * 1800,
    })),

  getFinancialSummary: (_filters): FinancialSummary => ({
    generation: 92700,
    compensated: 81800,
    balance: 10900,
    revenue: 57696,
    ownerPayment: 29476,
    spread: 28220,
    savings: 14200,
  }),

  getGeneratingUnitCycleSummary: (ugId, _filters) => makeCycleSummary(ugId),

  getCreditAllocationPlan: (ugId, _month, overrides): AllocationPlan => {
    const ug = UGS.find((u) => u.id === ugId)!;
    const ubsForUg = UBS.filter((u) => u.ugId === ugId);
    const generation = ugId === 'UG-001' ? 58500 : 34200;
    const rows = ubsForUg.map((ub) => {
      const monthlyAvg = ub.annualAverage / 12;
      const totalMonthlyAvg = ubsForUg.reduce((s, u) => s + u.annualAverage / 12, 0);
      const recommendedPct = monthlyAvg / totalMonthlyAvg;
      const override = (overrides as any)?.[ub.id];
      const allocationPct = override?.allocationPct ?? recommendedPct;
      const marginPct = override?.preventiveMargin ?? ub.preventiveMargin;
      const targetKwh = monthlyAvg * (1 + marginPct);
      const currentBal = ub.previousCreditBalance;
      const received = generation * recommendedPct * 0.98;
      const finalBal = currentBal + received - ub.monthlyConsumption;
      return {
        ub,
        averageMonthlyConsumptionKwh: monthlyAvg,
        preventiveMarginPercentage: marginPct,
        targetCreditKwh: targetKwh,
        currentBalanceKwh: currentBal,
        recommendedCreditsToReceiveKwh: Math.max(0, targetKwh - currentBal),
        recommendedAllocationPercentage: recommendedPct,
        allocationPercentage: allocationPct,
        plannedCreditsReceivedKwh: generation * allocationPct,
        creditsReceivedKwh: received,
        monthlyConsumptionKwh: ub.monthlyConsumption,
        creditsCompensatedKwh: Math.min(ub.monthlyConsumption, currentBal + received),
        previousBalanceKwh: currentBal,
        finalBalanceKwh: finalBal,
        coverageMonths: finalBal / monthlyAvg,
        monthlyAverage: monthlyAvg,
        previousBalance: currentBal,
        preventiveMargin: marginPct,
        targetCredit: targetKwh,
        allocationPct,
        projectedCredits: generation * allocationPct,
        receivedCredits: received,
        consumption: ub.monthlyConsumption,
        compensated: Math.min(ub.monthlyConsumption, currentBal + received),
        finalBalance: finalBal,
        recommendedPct,
      };
    });
    const totalConsumption = ubsForUg.reduce((s, u) => s + u.monthlyConsumption, 0);
    return {
      ug,
      generation,
      rows,
      totalConsumption,
      ownerPayment: generation * ug.purchasePrice,
      esaRevenue: ubsForUg.reduce((s, u) => s + u.monthlyConsumption * u.esaPrice, 0),
    } as AllocationPlan;
  },

  getGeneratingUnitCommercialTerms: (ugId) => ({
    ugId,
    purchasePricePerKwh: UGS.find((u) => u.id === ugId)?.purchasePrice ?? 0.35,
    effectiveDate: '2026-01-01',
    contractType: 'fixo',
  }) as any,

  getSettlementRecipient: (ugId) => {
    const ug = UGS.find((u) => u.id === ugId);
    if (!ug) return null;
    return { recipientName: ug.payee.name, recipientDocument: ug.payee.document, pixKeyType: ug.payee.pixType, pixKey: ug.payee.pixKey } as any;
  },

  getGeneratingUnitCreditDestinationReport: (ugId, _month) => {
    const ug = UGS.find((u) => u.id === ugId);
    if (!ug) return null;
    const ubsForUg = UBS.filter((u) => u.ugId === ugId);
    const generation = ugId === 'UG-001' ? 58500 : 34200;
    const rows = ubsForUg.map((ub) => {
      const received = generation / ubsForUg.length;
      const finalBal = ub.previousCreditBalance + received - ub.monthlyConsumption;
      const monthlyAvg = ub.annualAverage / 12;
      return {
        ub,
        allocationPct: 1 / ubsForUg.length,
        received,
        consumption: ub.monthlyConsumption,
        compensated: Math.min(ub.monthlyConsumption, received),
        previousBalance: ub.previousCreditBalance,
        finalBalance: finalBal,
        coverageMonths: finalBal / monthlyAvg,
      };
    });
    return {
      ug, rows, generation,
      totalDistributed: generation,
      totalCompensated: rows.reduce((s, r) => s + r.compensated, 0),
      totalAccumulatedBalance: rows.reduce((s, r) => s + r.finalBalance, 0),
      totalConsumed: ubsForUg.reduce((s, u) => s + u.monthlyConsumption, 0),
      beneficiariesCount: ubsForUg.length,
      ownerPayment: generation * ug.purchasePrice,
    } as any;
  },

  createGeneratingUnit: (_data) => ({ id: `UG-${Date.now()}` }) as any,
  getBeneficiaryMonthlyHistory: (_ubId) => [] as any,
  getBeneficiaryAverageComposition: (_ubId) => ({ averageConsumptionKwh: 3000 }) as any,
  getBeneficiaryMonthlyRecord: (_ubId, _month) => ({
    consumptionKwh: 3200,
    teValue: 350,
    tusdValue: 480,
    fioB: 220,
    flagValue: 45,
    cipValue: 30,
    taxesValue: 180,
    totalBillValue: 1305,
  }) as any,
  createBeneficiaryUnit: (_data) => ({ id: `UB-${Date.now()}` }) as any,

  getBeneficiaryInvoice: (ubId, month) => {
    const ub = UBS.find((u) => u.id === ubId);
    const ug = ub ? UGS.find((g) => g.id === ub.ugId) : null;
    if (!ub || !ug) return null;
    return {
      raw: {
        ub, ug, month, docNumber: 'FAT-2026-07-001', dueDate: '15/08/2026',
        faturaEsa: ub.monthlyConsumption * ub.esaPrice,
        consumption: ub.monthlyConsumption,
        customerSince: '2025-01-01',
        monthsAsCustomer: 18,
        accumulatedSavings: 8500,
      },
      billingSnapshot: {
        contaConcessionaria: ub.monthlyConsumption * 0.98,
        contaEsa: ub.monthlyConsumption * ub.esaPrice,
        economiaMensal: ub.monthlyConsumption * (0.98 - ub.esaPrice),
        economiaPercentual: ((0.98 - ub.esaPrice) / 0.98) * 100,
        componentesTarifarios: [
          { label: 'Energia Elétrica (TE)', value: ub.monthlyConsumption * 0.35 },
          { label: 'Uso da Rede (TUSD)', value: ub.monthlyConsumption * 0.25 },
          { label: 'Fio B', value: ub.monthlyConsumption * 0.15 },
          { label: 'Bandeira tarifária', value: ub.monthlyConsumption * 0.02 },
          { label: 'CIP / Iluminação pública', value: 25 },
          { label: 'Impostos (ICMS + PIS/COFINS)', value: ub.monthlyConsumption * 0.12 },
        ],
        calculationSource: 'billing-engine-v2',
      },
      creditBalance: {
        previousBalanceKwh: ub.previousCreditBalance,
        creditsReceivedKwh: 2400,
        creditsCompensatedKwh: ub.monthlyConsumption,
        currentBalanceKwh: ub.previousCreditBalance + 2400 - ub.monthlyConsumption,
        coverageMonths: (ub.previousCreditBalance + 2400 - ub.monthlyConsumption) / (ub.annualAverage / 12),
      },
      settlementRecipient: { recipientName: ug.payee.name, recipientDocument: ug.payee.document, pixKeyType: ug.payee.pixType, pixKey: ug.payee.pixKey },
      beneficiarySavingsHistory: MONTHS.slice().reverse().map((m, i) => ({ label: m.label.slice(0, 3), accumulatedSavings: 3000 + i * 1100 })),
    } as any;
  },

  getSettlementRecipientForBeneficiary: (ubId) => {
    const ub = UBS.find((u) => u.id === ubId);
    if (!ub) return null;
    const ug = UGS.find((g) => g.id === ub.ugId);
    if (!ug) return null;
    return { recipientName: ug.payee.name, recipientDocument: ug.payee.document, pixKeyType: ug.payee.pixType, pixKey: ug.payee.pixKey } as any;
  },

  confirmInvoicePayment: (_invoiceId, _data) => ({ ok: true }) as any,
  confirmOwnerSettlementPayment: (_settlementId, _data) => ({ ok: true }) as any,

  getCsvTemplate: (type) => ({
    filename: `modelo-${type}.csv`,
    example: type === 'ug'
      ? 'id;nome;proprietario;documento;uc;distribuidora\nUG-001;Usina Solar Exemplo;João Silva;12.345.678/0001-90;UC-001;EQUATORIAL'
      : type === 'ub'
      ? 'id;nome;documento;uc;distribuidora;ugId\nUB-001;Mercado Central;11.111.111/0001-11;UC-101;EQUATORIAL;UG-001'
      : type === 'rug'
      ? 'ugId;mes;geracaoKwh\nUG-001;2026-07;58500'
      : 'ubId;mes;consumoKwh;creditosRecebidosKwh\nUB-001;2026-07;3200;2400',
  }) as any,

  simulateUtilityBillExtraction: (_file, scenario) => ({
    extractionId: `EXT-${Date.now()}`,
    fileName: 'fatura-exemplo.pdf',
    confidence: scenario === 'matched' ? 'high' : scenario === 'unmatched' ? 'review' : 'high',
    utilityConsumerUnit: scenario === 'matched' ? 'UC-101' : 'UC-999',
    distributor: 'EQUATORIAL',
    referenceMonth: '2026-07',
    consumptionKwh: 3200,
    teValue: 350, tusdValue: 480, fioB: 220, flagValue: 45, cipValue: 30, taxesValue: 180,
    minimumBillableKwh: 100,
    totalBillValue: 1305,
    beneficiaryName: scenario === 'matched' ? 'Mercado Central' : undefined,
  }) as any,

  matchUtilityBillToBeneficiary: ({ utilityConsumerUnit }) => {
    const ub = UBS.find((u) => u.uc === utilityConsumerUnit);
    if (!ub) return { matched: false, beneficiaryUnitId: '', beneficiaryName: '', beneficiaryDocument: '', uc: '', distributor: '', generatingUnitId: '', generatingUnitName: '' };
    const ug = UGS.find((g) => g.id === ub.ugId);
    return { matched: true, beneficiaryUnitId: ub.id, beneficiaryName: ub.name, beneficiaryDocument: ub.document, uc: ub.uc, distributor: ub.distributor, generatingUnitId: ub.ugId, generatingUnitName: ug?.name ?? '—' };
  },

  linkUtilityBillToBeneficiary: (_extractionId, _ubId) => ({ ok: true }) as any,
  confirmBeneficiaryMonthlyRecordFromUtilityBill: (_extractionId, _data) => ({ ok: true }) as any,
  replaceBeneficiaryMonthlyRecordFromUtilityBill: (_extractionId, _reason) => ({ ok: true }) as any,

  compareUtilityBillWithExistingRecord: (_extractionId, current, incoming) => ({
    fields: [
      { label: 'Consumo (kWh)', current: current.consumptionKwh, incoming: incoming.consumptionKwh, delta: incoming.consumptionKwh - current.consumptionKwh },
      { label: 'TE (R$)', current: current.teValue, incoming: incoming.teValue, delta: incoming.teValue - current.teValue },
      { label: 'TUSD (R$)', current: current.tusdValue, incoming: incoming.tusdValue, delta: incoming.tusdValue - current.tusdValue },
      { label: 'Fio B (R$)', current: current.fioB, incoming: incoming.fioB, delta: incoming.fioB - current.fioB },
      { label: 'Bandeira (R$)', current: current.flagValue, incoming: incoming.flagValue, delta: incoming.flagValue - current.flagValue },
      { label: 'CIP (R$)', current: current.cipValue, incoming: incoming.cipValue, delta: incoming.cipValue - current.cipValue },
      { label: 'Impostos (R$)', current: current.taxesValue, incoming: incoming.taxesValue, delta: incoming.taxesValue - current.taxesValue },
      { label: 'Total fatura (R$)', current: current.totalBillValue, incoming: incoming.totalBillValue, delta: incoming.totalBillValue - current.totalBillValue },
    ],
  }) as any,
};
