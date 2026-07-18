(function() {
	//#region \0rolldown/runtime.js
	var __defProp = Object.defineProperty;
	var __esmMin = (fn, res, err) => () => {
		if (err) throw err[0];
		try {
			return fn && (res = fn(fn = 0)), res;
		} catch (e) {
			throw err = [e], e;
		}
	};
	var __exportAll = (all, no_symbols) => {
		let target = {};
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
		return target;
	};
	//#endregion
	//#region providers/demoRuntimeProvider.ts
	var UGS = [
		{
			id: "UG-001",
			name: "UG Solar Assaí",
			owner: "João Pereira",
			document: "123.456.789-00",
			uc: "123456789",
			distributor: "Copel",
			status: "ativa",
			purchasePrice: .35,
			previousBalance: 2500,
			monthlyGeneration: 13e3
		},
		{
			id: "UG-002",
			name: "UG Solar Londrina",
			owner: "Maria Silva",
			document: "987.654.321-00",
			uc: "987654321",
			distributor: "Copel",
			status: "ativa",
			purchasePrice: .34,
			previousBalance: 1800,
			monthlyGeneration: 9500
		},
		{
			id: "UG-003",
			name: "UG Solar Maringá",
			owner: "Construtora Norte Ltda",
			document: "12.345.678/0001-90",
			uc: "555666777",
			distributor: "Copel",
			status: "manutencao",
			purchasePrice: .36,
			previousBalance: 500,
			monthlyGeneration: 4200
		}
	];
	var UBS = [
		{
			id: "UB-001",
			name: "Mercado Central",
			document: "11.222.333/0001-44",
			uc: "111222333",
			distributor: "Copel",
			ugId: "UG-001",
			status: "ativa",
			monthlyConsumption: 3950,
			annualAverage: 48e3,
			previousCreditBalance: 350,
			allocationPct: .323,
			preventiveMargin: .05,
			esaPrice: .55,
			distributorTariff: .85,
			taxes: 420,
			cip: 51.97,
			otherCharges: 0,
			paymentStatus: "pago",
			customerSince: "2025-08",
			accumulatedSavings: 14870.45
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
			annualAverage: 36e3,
			previousCreditBalance: 180,
			allocationPct: .245,
			preventiveMargin: .05,
			esaPrice: .55,
			distributorTariff: .85,
			taxes: 310,
			cip: 42.5,
			otherCharges: 0,
			paymentStatus: "aberto",
			customerSince: "2025-10",
			accumulatedSavings: 8210.3
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
			annualAverage: 24e3,
			previousCreditBalance: 120,
			allocationPct: .16,
			preventiveMargin: .05,
			esaPrice: .55,
			distributorTariff: .85,
			taxes: 220,
			cip: 38.9,
			otherCharges: 0,
			paymentStatus: "vencido",
			customerSince: "2025-06",
			accumulatedSavings: 9120
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
			annualAverage: 42e3,
			previousCreditBalance: 280,
			allocationPct: .272,
			preventiveMargin: .05,
			esaPrice: .55,
			distributorTariff: .88,
			taxes: 380,
			cip: 55.2,
			otherCharges: 0,
			paymentStatus: "pago",
			customerSince: "2025-09",
			accumulatedSavings: 11450.7
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
			annualAverage: 45e3,
			previousCreditBalance: 210,
			allocationPct: .66,
			preventiveMargin: .05,
			esaPrice: .55,
			distributorTariff: .85,
			taxes: 400,
			cip: 48.5,
			otherCharges: 0,
			paymentStatus: "pago",
			customerSince: "2025-07",
			accumulatedSavings: 12980
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
			allocationPct: .34,
			preventiveMargin: .05,
			esaPrice: .55,
			distributorTariff: .86,
			taxes: 195,
			cip: 32,
			otherCharges: 0,
			paymentStatus: "aberto",
			customerSince: "2025-11",
			accumulatedSavings: 4820.15
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
			annualAverage: 3e4,
			previousCreditBalance: 4800,
			allocationPct: 1,
			preventiveMargin: .05,
			esaPrice: .55,
			distributorTariff: .84,
			taxes: 280,
			cip: 40,
			otherCharges: 0,
			paymentStatus: "aberto",
			customerSince: "2025-05",
			accumulatedSavings: 6850.9
		}
	];
	var MONTHS_AV = [
		{
			value: "2026-07",
			label: "Julho de 2026",
			status: "em_apuracao"
		},
		{
			value: "2026-06",
			label: "Junho de 2026",
			status: "fechado"
		},
		{
			value: "2026-05",
			label: "Maio de 2026",
			status: "fechado"
		},
		{
			value: "2026-04",
			label: "Abril de 2026",
			status: "fechado"
		},
		{
			value: "2026-03",
			label: "Março de 2026",
			status: "fechado"
		}
	];
	var MONTH_FACTOR = {
		"2026-07": 1,
		"2026-06": .92,
		"2026-05": .88,
		"2026-04": .83,
		"2026-03": .79
	};
	var CRITICAL = {
		"2026-07": 2,
		"2026-06": 3,
		"2026-05": 2,
		"2026-04": 4,
		"2026-03": 3
	};
	var PAYEES = {
		"UG-001": {
			name: "João Pereira",
			document: "123.456.789-00",
			pixKey: "joao.pereira@esaenergia.com.br",
			pixType: "email"
		},
		"UG-002": {
			name: "Maria Silva",
			document: "987.654.321-00",
			pixKey: "987.654.321-00",
			pixType: "cpf"
		},
		"UG-003": {
			name: "Construtora Norte Ltda",
			document: "12.345.678/0001-90",
			pixKey: "12.345.678/0001-90",
			pixType: "cnpj"
		}
	};
	var APPLIED_HIST = {
		"UG-001": {
			"2026-06": .34,
			"2026-05": .34,
			"2026-04": .33,
			"2026-03": .33
		},
		"UG-002": {
			"2026-06": .33,
			"2026-05": .33,
			"2026-04": .32,
			"2026-03": .32
		},
		"UG-003": {
			"2026-06": .35,
			"2026-05": .35,
			"2026-04": .34,
			"2026-03": .34
		}
	};
	var UB_HIST_ORIGIN = {
		"2026-07": "FATURA IMPORTADA",
		"2026-06": "FATURA IMPORTADA",
		"2026-05": "CSV",
		"2026-04": "CSV",
		"2026-03": "MANUAL"
	};
	var UB_HIST_FILE = {
		"2026-07": "conta-copel-jul-2026.pdf",
		"2026-06": "conta-copel-jun-2026.pdf",
		"2026-05": "ubm-2026-05.csv",
		"2026-04": "ubm-2026-04.csv",
		"2026-03": "—"
	};
	var UB_HIST_IMPORTED = {
		"2026-07": "08/07/2026",
		"2026-06": "05/06/2026",
		"2026-05": "06/05/2026",
		"2026-04": "05/04/2026",
		"2026-03": "10/03/2026"
	};
	var ALERT_TITLES = {
		ALLOCATION_PERCENTAGE_TOTAL_INVALID: "Percentual de rateio inválido",
		HIGH_BENEFICIARY_CREDIT_BALANCE: "Saldo elevado de créditos",
		LOW_BENEFICIARY_CREDIT_BALANCE: "Saldo insuficiente de créditos",
		CONSUMPTION_ABOVE_AVERAGE: "Consumo acima da média",
		CYCLE_CLOSE_REMINDER: "Fechamento de ciclo pendente"
	};
	var ALERT_METRICS = {
		"A-001": {
			detected: "98,7% de rateio",
			threshold: "100,00%"
		},
		"A-002": {
			detected: "1,85 mês de cobertura",
			threshold: "≤ 1,5 mês"
		},
		"A-003": {
			detected: "0,06 mês de cobertura",
			threshold: "≥ 0,25 mês"
		},
		"A-004": {
			detected: "112% da média mensal",
			threshold: "≤ 110%"
		},
		"A-005": {
			detected: "0,05 mês de cobertura",
			threshold: "≥ 0,25 mês"
		},
		"A-006": {
			detected: "Ciclo em apuração",
			threshold: "Fechado até 05/08"
		}
	};
	var ALERT_IMPACT = {
		"A-001": "Sem 100% de rateio, parte dos créditos gerados fica sem destino e o ciclo não pode ser fechado.",
		"A-002": "Créditos parados na UC representam capital energético ocioso e reduzem a eficiência da usina.",
		"A-003": "A beneficiária pode compensar menos que o consumo e perder economia no próximo ciclo.",
		"A-004": "Consumo acima do planejado pode esgotar o saldo e comprometer a cobertura das próximas faturas.",
		"A-005": "Saldo mínimo insuficiente aumenta o risco de fatura cheia da distribuidora.",
		"A-006": "Faturas e repasses do ciclo só podem ser liquidados após o fechamento."
	};
	var STATIC_ALERTS = [
		{
			id: "A-001",
			severity: "critico",
			code: "ALLOCATION_PERCENTAGE_TOTAL_INVALID",
			message: "A soma dos percentuais de rateio deve totalizar 100%.",
			unit: "UG-002",
			month: "2026-07",
			action: "Ajustar percentuais na tela de Apuração Mensal."
		},
		{
			id: "A-002",
			severity: "risco",
			code: "HIGH_BENEFICIARY_CREDIT_BALANCE",
			message: "Saldo acumulado superior a 1,5 mês da média de consumo.",
			unit: "UB-007",
			month: "2026-07",
			action: "Reduzir percentual de rateio ou margem preventiva."
		},
		{
			id: "A-003",
			severity: "risco",
			code: "LOW_BENEFICIARY_CREDIT_BALANCE",
			message: "Saldo disponível e crédito planejado abaixo do crédito alvo.",
			unit: "UB-003",
			month: "2026-07",
			action: "Aumentar percentual de rateio ou revisar margem preventiva."
		},
		{
			id: "A-004",
			severity: "atencao",
			code: "CONSUMPTION_ABOVE_AVERAGE",
			message: "Consumo real acima de 110% da média mensal.",
			unit: "UB-004",
			month: "2026-07",
			action: "Revisar média e planejamento de créditos."
		},
		{
			id: "A-005",
			severity: "atencao",
			code: "LOW_BENEFICIARY_CREDIT_BALANCE",
			message: "Cobertura do saldo inferior a 0,25 mês.",
			unit: "UB-006",
			month: "2026-07",
			action: "Aumentar percentual de rateio para elevar o saldo mínimo."
		},
		{
			id: "A-006",
			severity: "info",
			code: "CYCLE_CLOSE_REMINDER",
			message: "O ciclo de julho ainda não foi fechado.",
			unit: "UG-001",
			month: "2026-07",
			action: "Concluir a apuração e fechar o ciclo até 05/08."
		}
	];
	var IMP_HISTORY = [
		{
			file: "conta-copel-jul-2026.pdf",
			uc: "111222333",
			ub: "Mercado Central",
			month: "2026-07",
			origin: "FATURA DISTRIBUIDORA",
			status: "CONFIRMADO",
			date: "08/07/2026"
		},
		{
			file: "conta-copel-jul-2026-v2.pdf",
			uc: "999888777",
			ub: "—",
			month: "2026-07",
			origin: "FATURA DISTRIBUIDORA",
			status: "PENDENTE",
			date: "10/07/2026"
		},
		{
			file: "ubm-2026-06.csv",
			uc: "—",
			ub: "Todas as beneficiárias",
			month: "2026-06",
			origin: "CSV",
			status: "VINCULADO",
			date: "05/06/2026"
		},
		{
			file: "conta-copel-jun-2026.pdf",
			uc: "111222333",
			ub: "Mercado Central",
			month: "2026-06",
			origin: "FATURA DISTRIBUIDORA",
			status: "DUPLICADO",
			date: "12/06/2026"
		},
		{
			file: "conta-copel-mai-2026.pdf",
			uc: "444555666",
			ub: "Auto Posto Norte",
			month: "2026-05",
			origin: "FATURA DISTRIBUIDORA",
			status: "DESCARTADO",
			date: "03/05/2026"
		}
	];
	function computeSettlement(ug) {
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
			return {
				ub,
				allocated,
				compensated,
				pending,
				contaSemEsa,
				faturaEsa,
				economia: contaSemEsa - (faturaEsa + pending * ub.distributorTariff + ub.taxes + ub.cip + ub.otherCharges)
			};
		});
		const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
		const totalCompensated = rows.reduce((s, r) => s + r.compensated, 0);
		const esaRevenue = rows.reduce((s, r) => s + r.faturaEsa, 0);
		const ownerPayment = totalCompensated * ug.purchasePrice;
		return {
			ug,
			generation: ug.monthlyGeneration,
			available,
			totalAllocated,
			totalCompensated,
			currentBalance: available - totalAllocated,
			ownerPayment,
			esaRevenue,
			spread: esaRevenue - ownerPayment,
			rows
		};
	}
	function scaledResults(month, ugId) {
		const f = MONTH_FACTOR[month] ?? 1;
		let all = UGS.map((ug) => computeSettlement(ug));
		if (ugId) all = all.filter((r) => r.ug.id === ugId);
		return all.map((r) => ({
			...r,
			generation: r.generation * f,
			available: r.available * f,
			totalAllocated: r.totalAllocated * f,
			totalCompensated: r.totalCompensated * f,
			currentBalance: r.currentBalance * f,
			ownerPayment: r.ownerPayment * f,
			esaRevenue: r.esaRevenue * f,
			spread: r.spread * f,
			rows: r.rows.map((row) => ({
				...row,
				allocated: row.allocated * f,
				compensated: row.compensated * f,
				faturaEsa: row.faturaEsa * f,
				economia: row.economia * f
			}))
		}));
	}
	function aggregate(results) {
		return {
			generation: results.reduce((s, r) => s + r.generation, 0),
			compensated: results.reduce((s, r) => s + r.totalCompensated, 0),
			balance: results.reduce((s, r) => s + r.currentBalance, 0),
			revenue: results.reduce((s, r) => s + r.esaRevenue, 0),
			ownerPayment: results.reduce((s, r) => s + r.ownerPayment, 0),
			spread: results.reduce((s, r) => s + r.spread, 0),
			savings: results.reduce((s, r) => s + r.rows.reduce((a, x) => a + x.economia, 0), 0)
		};
	}
	function computeAllocationPlan(ug, overrides = {}) {
		const ubs = UBS.filter((b) => b.ugId === ug.id);
		const gen = ug.monthlyGeneration;
		const avgs = ubs.map((u) => u.annualAverage / 12);
		const sumRec = ubs.map((u, i) => {
			const margin = overrides[u.id]?.preventiveMargin ?? u.preventiveMargin;
			return Math.max(0, avgs[i] * (1 + margin) - u.previousCreditBalance);
		}).reduce((a, b) => a + b, 0);
		const rows = ubs.map((ub, i) => {
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
				ub,
				monthlyAverage,
				preventiveMargin,
				targetCredit,
				currentBalance,
				recommendedAdd,
				recommendedPct,
				allocationPct,
				planned,
				received: planned,
				consumption,
				compensated,
				finalBalance,
				coverageMonths: monthlyAverage > 0 ? finalBalance / monthlyAverage : 0
			};
		});
		const totalCompensated = rows.reduce((s, r) => s + r.compensated, 0);
		return {
			ug,
			generation: gen,
			rows,
			totalPct: rows.reduce((s, r) => s + r.allocationPct, 0),
			totalProjected: rows.reduce((s, r) => s + r.planned, 0),
			totalCompensated,
			totalFinalBalance: rows.reduce((s, r) => s + r.finalBalance, 0),
			totalRecommended: rows.reduce((s, r) => s + r.recommendedAdd, 0),
			totalConsumption: rows.reduce((s, r) => s + r.consumption, 0),
			ownerPayment: totalCompensated * ug.purchasePrice,
			esaRevenue: rows.reduce((s, r) => s + r.compensated * r.ub.esaPrice, 0)
		};
	}
	function buildInvoice(ubId, month) {
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
		const totalWithoutEsa = ub.monthlyConsumption * ub.distributorTariff + ub.taxes + ub.cip + ub.otherCharges;
		const monthlySavings = totalWithoutEsa - totalWithEsa;
		const [y, m] = month.split("-").map(Number);
		const dueDate = "10/" + String(m + 1).padStart(2, "0") + "/" + y;
		return {
			ubId: ub.id,
			ugId: ug.id,
			month,
			docNumber: "ESA-" + month.replace("-", "") + "-" + ubId.replace("-", ""),
			dueDate,
			consumption: ub.monthlyConsumption,
			previousBalance,
			receivedCredits,
			compensated,
			finalBalance,
			faturaEsa,
			taxes: ub.taxes,
			cip: ub.cip,
			otherCharges: ub.otherCharges,
			totalWithEsa,
			totalWithoutEsa,
			monthlySavings,
			discountPct: totalWithoutEsa > 0 ? monthlySavings / totalWithoutEsa * 100 : 0,
			paymentStatus: ub.paymentStatus,
			payee: payee ?? {
				name: "",
				document: "",
				pixKey: "",
				pixType: "cpf"
			},
			customerSince: ub.customerSince ?? "2025-08",
			accumulatedSavings: ub.accumulatedSavings ?? 0
		};
	}
	function buildSavingsHistory(from, to, accumulated) {
		const list = [];
		let [y, m] = from.split("-").map(Number);
		const [ty, tm] = to.split("-").map(Number);
		const L = [
			"Jan",
			"Fev",
			"Mar",
			"Abr",
			"Mai",
			"Jun",
			"Jul",
			"Ago",
			"Set",
			"Out",
			"Nov",
			"Dez"
		];
		while (y < ty || y === ty && m <= tm) {
			list.push({ label: L[m - 1] + (m === 1 ? "/" + String(y).slice(2) : "") });
			m += 1;
			if (m > 12) {
				m = 1;
				y += 1;
			}
		}
		const n = list.length;
		if (n === 0) return [];
		const base = accumulated / n;
		let cum = 0;
		return list.map((it, i) => {
			const monthly = base * (.85 + i / Math.max(1, n - 1) * .3);
			cum += monthly;
			return {
				label: it.label,
				monthly,
				cumulative: cum
			};
		});
	}
	function appliedPrice(ugId, month) {
		const h = APPLIED_HIST[ugId];
		if (h && h[month] !== void 0) return h[month];
		return UGS.find((u) => u.id === ugId)?.purchasePrice ?? .35;
	}
	function finBaseStatus(kind, id, month) {
		if (MONTHS_AV.find((m) => m.value === month)?.status === "fechado") return "pago";
		if (kind === "fat") return UBS.find((u) => u.id === id)?.paymentStatus ?? "aberto";
		return id === "UG-001" ? "pago" : "aberto";
	}
	function resolvedPaymentRecord(kind, unitId, unitName, month, amount) {
		const status = finBaseStatus(kind, unitId, month);
		return {
			id: kind + "-" + unitId + "-" + month,
			kind,
			unitId,
			unitName,
			month,
			amount,
			status,
			paidAt: status === "pago" ? "05/" + month.split("-")[1] + "/2026" : null,
			paidBy: status === "pago" ? "Ana Costa" : null,
			reopenedAt: null,
			reason: null
		};
	}
	var ok$1 = { ok: true };
	var demoRuntimeProvider = {
		mode: "demo",
		async listMonths() {
			return [...MONTHS_AV];
		},
		async getCycleStatus(month) {
			return MONTHS_AV.find((m) => m.value === month)?.status ?? "aberto";
		},
		async getDashboardData(filter) {
			const { month, ugId } = filter;
			const results = scaledResults(month, ugId);
			const mi = MONTHS_AV.findIndex((m) => m.value === month);
			const prevM = MONTHS_AV[mi + 1];
			const curr = aggregate(results);
			const previous = prevM ? aggregate(scaledResults(prevM.value, ugId)) : null;
			const cycleStatus = MONTHS_AV[mi]?.status ?? "aberto";
			const filteredUBS = ugId ? UBS.filter((b) => b.ugId === ugId) : UBS;
			const filteredUGS = ugId ? UGS.filter((u) => u.id === ugId) : UGS;
			const trend = [...MONTHS_AV].reverse().map((m) => {
				const agg = aggregate(scaledResults(m.value, ugId));
				return {
					month: m.value,
					label: m.label.split(" ")[0].slice(0, 3),
					Receita: agg.revenue,
					Repasse: agg.ownerPayment,
					Spread: agg.spread,
					Geracao: agg.generation,
					Consumo: agg.compensated + agg.generation * .05
				};
			});
			return {
				month,
				cycleStatus,
				current: curr,
				previous,
				criticalAlerts: CRITICAL[month] ?? 0,
				generatingUnitCount: filteredUGS.length,
				beneficiaryUnitCount: filteredUBS.length,
				activeUGCount: filteredUGS.filter((u) => u.status === "ativa").length,
				results,
				trendData: trend
			};
		},
		async getMonthlyTrend(filter) {
			return [...MONTHS_AV].reverse().map((m) => {
				const agg = aggregate(scaledResults(m.value, filter.ugId));
				return {
					month: m.value,
					label: m.label.split(" ")[0].slice(0, 3),
					Receita: agg.revenue,
					Repasse: agg.ownerPayment,
					Spread: agg.spread,
					Geracao: agg.generation,
					Consumo: agg.compensated
				};
			});
		},
		async listGeneratingUnits(filter) {
			const q = (filter?.search ?? "").toLowerCase();
			return UGS.filter((u) => !q || (u.name + " " + u.owner + " " + u.id + " " + u.uc).toLowerCase().includes(q));
		},
		async getGeneratingUnit(id) {
			return UGS.find((u) => u.id === id) ?? null;
		},
		async createGeneratingUnit(_input) {
			return ok$1;
		},
		async updateGeneratingUnit(_id, _input) {
			return ok$1;
		},
		async getGeneratingUnitPayee(ugId) {
			return PAYEES[ugId] ?? null;
		},
		async getAppliedPrice(ugId, month) {
			return appliedPrice(ugId, month);
		},
		async updateCyclePrice(_ugId, _month, _price, _reason) {
			return ok$1;
		},
		async listBeneficiaryUnits(filter) {
			const q = (filter?.search ?? "").toLowerCase();
			let list = UBS;
			if (filter?.ugId) list = list.filter((u) => u.ugId === filter.ugId);
			return list.filter((u) => !q || (u.name + " " + u.uc + " " + u.id).toLowerCase().includes(q));
		},
		async getBeneficiaryUnit(id) {
			return UBS.find((u) => u.id === id) ?? null;
		},
		async createBeneficiaryUnit(_input) {
			return ok$1;
		},
		async updateBeneficiaryUnit(_id, _input) {
			return ok$1;
		},
		async getBeneficiaryConsumptionAverage(id) {
			const ub = UBS.find((u) => u.id === id);
			if (!ub) return null;
			const months = Object.keys(UB_HIST_ORIGIN).sort().reverse().map((m) => ({
				month: m,
				origin: UB_HIST_ORIGIN[m],
				file: UB_HIST_FILE[m],
				importedAt: UB_HIST_IMPORTED[m],
				consumptionKwh: ub.monthlyConsumption
			}));
			return {
				annualAverage: ub.annualAverage,
				monthlyAverage: ub.annualAverage / 12,
				hasSufficientHistory: true,
				months
			};
		},
		async getBeneficiaryMonthlyHistory(id) {
			const ub = UBS.find((u) => u.id === id);
			if (!ub) return [];
			return Object.keys(UB_HIST_ORIGIN).sort().reverse().map((m) => ({
				month: m,
				origin: UB_HIST_ORIGIN[m],
				file: UB_HIST_FILE[m],
				importedAt: UB_HIST_IMPORTED[m],
				consumptionKwh: ub.monthlyConsumption
			}));
		},
		async getBeneficiarySavingsHistory(id, upToMonth = "2026-07") {
			const ub = UBS.find((u) => u.id === id);
			if (!ub) return [];
			return buildSavingsHistory(ub.customerSince ?? "2025-08", upToMonth, ub.accumulatedSavings ?? 0);
		},
		async getAllocationPlan(ugId, _month, overrides = {}) {
			const ug = UGS.find((u) => u.id === ugId);
			if (!ug) return null;
			return computeAllocationPlan(ug, overrides);
		},
		async saveAllocationOverrides(_ugId, _month, _overrides) {
			return ok$1;
		},
		async closeMonthlySettlement(_ugId, _month) {
			return ok$1;
		},
		async getBeneficiaryInvoice(ubId, month) {
			return buildInvoice(ubId, month);
		},
		async getImportHistory() {
			return [...IMP_HISTORY];
		},
		async getCsvTemplate(type) {
			return {
				importType: type,
				delimiter: ";",
				headers: {
					ug: [
						"id",
						"nome",
						"proprietario",
						"documento",
						"uc",
						"distribuidora",
						"status",
						"preco_compra",
						"geracao_mensal"
					],
					ub: [
						"id",
						"nome",
						"documento",
						"uc",
						"distribuidora",
						"ugId",
						"consumo_mensal",
						"media_anual",
						"preco_esa",
						"tarifa_distribuidora",
						"impostos",
						"cip",
						"percentual_rateio",
						"margem_preventiva"
					],
					rug: [
						"ugId",
						"mes_referencia",
						"geracao_kwh",
						"saldo_anterior",
						"preco_compra"
					],
					rub: [
						"ubId",
						"mes_referencia",
						"consumo_kwh",
						"origem",
						"arquivo"
					]
				}[type] ?? [],
				exampleRows: [],
				aliases: {},
				example: "",
				filename: {
					ug: "modelo-unidades-geradoras.csv",
					ub: "modelo-unidades-beneficiarias.csv",
					rug: "modelo-registros-mensais-ug.csv",
					rub: "modelo-registros-mensais-ub.csv"
				}[type]
			};
		},
		async extractUtilityBill(scenario = "matched") {
			const ub = UBS[0];
			const dup = scenario === "duplicate";
			return {
				referenceMonth: "2026-07",
				consumptionKwh: dup ? ub.monthlyConsumption + 180 : ub.monthlyConsumption,
				te: 320.4,
				tusd: 512.75,
				fioB: 88.9,
				flag: 12.5,
				cip: ub.cip,
				taxes: dup ? ub.taxes + 22.4 : ub.taxes,
				minKwh: 30,
				total: (dup ? ub.monthlyConsumption + 180 : ub.monthlyConsumption) * ub.distributorTariff + ub.taxes + ub.cip
			};
		},
		async getExistingBillData(_ubId, _month) {
			const ub = UBS[0];
			return {
				referenceMonth: "2026-07",
				consumptionKwh: ub.monthlyConsumption,
				te: 320.4,
				tusd: 512.75,
				fioB: 88.9,
				flag: 12.5,
				cip: ub.cip,
				taxes: ub.taxes,
				minKwh: 30,
				total: ub.monthlyConsumption * ub.distributorTariff + ub.taxes + ub.cip
			};
		},
		async confirmBillExtraction(_data) {
			return ok$1;
		},
		async matchBillToBeneficiary(uc) {
			return UBS.find((u) => u.uc === uc) ?? null;
		},
		async linkBillToBeneficiary(_extractionId, _ubId) {
			return ok$1;
		},
		async replaceBillData(_extractionId, _reason) {
			return ok$1;
		},
		async getOwnerReport(ugId, month) {
			const ug = UGS.find((u) => u.id === ugId);
			if (!ug) return null;
			const settlement = computeSettlement(ug);
			const price = appliedPrice(ugId, month);
			const payee = PAYEES[ugId] ?? {
				name: "",
				document: "",
				pixKey: "",
				pixType: "cpf"
			};
			return {
				ugId,
				ugName: ug.name,
				month,
				appliedPrice: price,
				totalCompensated: settlement.totalCompensated,
				ownerPayment: settlement.totalCompensated * price,
				beneficiaryBreakdown: settlement.rows.map((r) => ({
					ubId: r.ub.id,
					ubName: r.ub.name,
					compensated: r.compensated,
					share: settlement.totalCompensated > 0 ? r.compensated / settlement.totalCompensated : 0,
					repasse: r.compensated * price,
					status: r.ub.paymentStatus
				})),
				payee
			};
		},
		async getInternalReport(ugId, _month) {
			const ug = UGS.find((u) => u.id === ugId);
			if (!ug) return null;
			return {
				ugId,
				month: _month,
				settlement: computeSettlement(ug),
				criticalAlerts: STATIC_ALERTS.filter((a) => a.severity === "critico" && a.unit === ugId).length,
				pendingPayments: 0
			};
		},
		async getFinancialReport(_ugId, month) {
			const fin = await demoRuntimeProvider.getFinancialData({ month });
			return {
				month,
				totalRevenue: fin.totalRevenue,
				totalOwnerPayment: fin.totalOwnerPayment,
				spread: fin.spread,
				invoices: fin.invoices
			};
		},
		async getFinancialData(filter) {
			const { month } = filter;
			const results = scaledResults(month);
			const invoices = results.flatMap((r) => r.rows.map((row) => resolvedPaymentRecord("fat", row.ub.id, row.ub.name, month, row.faturaEsa)));
			const ownerPayments = results.map((r) => resolvedPaymentRecord("rep", r.ug.id, r.ug.name, month, r.ownerPayment));
			const totalRevenue = invoices.reduce((s, p) => s + p.amount, 0);
			const totalOwnerPayment = ownerPayments.reduce((s, p) => s + p.amount, 0);
			return {
				month,
				invoices,
				ownerPayments,
				totalRevenue,
				totalOwnerPayment,
				spread: totalRevenue - totalOwnerPayment
			};
		},
		async confirmInvoicePayment(_ubId, _month, _payment) {
			return ok$1;
		},
		async reopenInvoicePayment(_ubId, _month, _reason) {
			return ok$1;
		},
		async confirmOwnerPayment(_ugId, _month, _payment) {
			return ok$1;
		},
		async listAlerts(filter) {
			let list = STATIC_ALERTS;
			if (filter?.month) list = list.filter((a) => a.month === filter.month);
			if (filter?.severity && filter.severity !== "all") list = list.filter((a) => a.severity === filter.severity);
			if (filter?.search) {
				const q = filter.search.toLowerCase();
				list = list.filter((a) => a.message.toLowerCase().includes(q) || a.unit.toLowerCase().includes(q));
			}
			return list.map((a) => ({
				...a,
				title: ALERT_TITLES[a.code] ?? a.code,
				status: "ativo",
				detectedValue: ALERT_METRICS[a.id]?.detected,
				threshold: ALERT_METRICS[a.id]?.threshold,
				impact: ALERT_IMPACT[a.id],
				history: [{
					at: "01/07/2026",
					label: "Alerta gerado pelo motor de apuração"
				}]
			}));
		},
		async getAlertDetail(id) {
			return (await demoRuntimeProvider.listAlerts()).find((a) => a.id === id) ?? null;
		},
		async resolveAlert(_id, _note) {
			return ok$1;
		},
		async ignoreAlert(_id, _note) {
			return ok$1;
		},
		async markAlertInAnalysis(_id, _note) {
			return ok$1;
		}
	};
	//#endregion
	//#region providers/esaRuntimeProvider.ts
	var esaRuntimeProvider_exports = /* @__PURE__ */ __exportAll({ createEsaRuntimeProvider: () => createEsaRuntimeProvider });
	function unwrap(result) {
		const r = result;
		if (!r || !r.ok || r.data == null) return null;
		return r.data;
	}
	function safeCall(fn) {
		try {
			return unwrap(fn());
		} catch {
			return null;
		}
	}
	function ok() {
		return { ok: true };
	}
	function emptyAggregateMetrics() {
		return {
			generation: 0,
			compensated: 0,
			balance: 0,
			revenue: 0,
			ownerPayment: 0,
			spread: 0,
			savings: 0
		};
	}
	function createEsaRuntimeProvider(uiProvider) {
		return {
			mode: "real",
			async listMonths() {
				return [...AVAILABLE_MONTHS];
			},
			async getCycleStatus(month) {
				return AVAILABLE_MONTHS.find((m) => m.value === month)?.status ?? "aberto";
			},
			async getDashboardData(filter) {
				const { month, ugId } = filter;
				const cycleStatus = AVAILABLE_MONTHS.find((m) => m.value === month)?.status ?? "aberto";
				const s = safeCall(() => uiProvider.getExecutiveSummary({
					referenceMonth: month,
					ugId
				}));
				const toMetrics = (r) => r ? {
					generation: r.totalGenerationKwh ?? 0,
					compensated: r.totalCompensatedKwh ?? 0,
					balance: r.totalCurrentBalanceKwh ?? 0,
					revenue: r.totalEsaRevenue ?? 0,
					ownerPayment: r.totalOwnerReturn ?? 0,
					spread: r.grossSpread ?? 0,
					savings: r.totalMonthlyDiscount ?? 0
				} : emptyAggregateMetrics();
				const current = toMetrics(s);
				const mi = AVAILABLE_MONTHS.findIndex((m) => m.value === month);
				const prevM = AVAILABLE_MONTHS[mi + 1];
				const sPrev = prevM ? safeCall(() => uiProvider.getExecutiveSummary({
					referenceMonth: prevM.value,
					ugId
				})) : null;
				const previous = sPrev ? toMetrics(sPrev) : null;
				const trendData = AVAILABLE_MONTHS.slice().reverse().map((m) => {
					const d = safeCall(() => uiProvider.getFinancialSummary({
						referenceMonth: m.value,
						ugId
					}));
					return {
						month: m.value,
						label: m.label.split(" ")[0].slice(0, 3),
						Receita: d?.totalEsaRevenue ?? 0,
						Repasse: d?.totalOwnerReturn ?? 0,
						Spread: d?.grossSpread ?? 0,
						Geracao: 0,
						Consumo: 0
					};
				});
				return {
					month,
					cycleStatus,
					current,
					previous,
					criticalAlerts: s?.criticalAlertCount ?? 0,
					generatingUnitCount: s?.generatingUnitCount ?? 0,
					beneficiaryUnitCount: s?.beneficiaryUnitCount ?? 0,
					activeUGCount: s?.generatingUnitCount ?? 0,
					results: [],
					trendData
				};
			},
			async getMonthlyTrend(filter) {
				return AVAILABLE_MONTHS.slice().reverse().map((m) => {
					const d = safeCall(() => uiProvider.getFinancialSummary({
						referenceMonth: m.value,
						ugId: filter.ugId
					}));
					return {
						month: m.value,
						label: m.label.split(" ")[0].slice(0, 3),
						Receita: d?.totalEsaRevenue ?? 0,
						Repasse: d?.totalOwnerReturn ?? 0,
						Spread: d?.grossSpread ?? 0,
						Geracao: 0,
						Consumo: 0
					};
				});
			},
			async listGeneratingUnits(filter) {
				const d = safeCall(() => uiProvider.searchGeneratingUnits({ search: filter?.search ?? "" }));
				return Array.isArray(d) ? d : d?.items ?? [];
			},
			async getGeneratingUnit(id) {
				return (await this.listGeneratingUnits()).find((u) => u.id === id) ?? null;
			},
			async createGeneratingUnit(input) {
				return unwrap(uiProvider.createGeneratingUnit(input)) ?? ok();
			},
			async updateGeneratingUnit(id, input) {
				return unwrap(uiProvider.updateGeneratingUnit(id, input)) ?? ok();
			},
			async getGeneratingUnitPayee(ugId) {
				const d = unwrap(uiProvider.getSettlementRecipient(ugId));
				if (!d) return null;
				return {
					name: d.name ?? "",
					document: d.document ?? "",
					pixKey: d.pixKey ?? "",
					pixType: d.pixType ?? "cpf"
				};
			},
			async getAppliedPrice(_ugId, _month) {
				return 0;
			},
			async updateCyclePrice(_ugId, _month, _price, _reason) {
				return ok();
			},
			async listBeneficiaryUnits(filter) {
				const d = safeCall(() => uiProvider.searchBeneficiaryUnits({
					search: filter?.search ?? "",
					ugId: filter?.ugId
				}));
				return Array.isArray(d) ? d : d?.items ?? [];
			},
			async getBeneficiaryUnit(id) {
				return (await this.listBeneficiaryUnits()).find((u) => u.id === id) ?? null;
			},
			async createBeneficiaryUnit(input) {
				return unwrap(uiProvider.createBeneficiaryUnit(input)) ?? ok();
			},
			async updateBeneficiaryUnit(id, input) {
				return unwrap(uiProvider.updateBeneficiaryUnit(id, input)) ?? ok();
			},
			async getBeneficiaryConsumptionAverage(id) {
				const d = safeCall(() => uiProvider.getBeneficiaryConsumptionAverage(id, {}));
				if (!d) return null;
				return {
					annualAverage: d.annualAverage ?? 0,
					monthlyAverage: d.monthlyAverage ?? (d.annualAverage ?? 0) / 12,
					hasSufficientHistory: d.hasSufficientHistory ?? false,
					months: d.months ?? []
				};
			},
			async getBeneficiaryMonthlyHistory(id) {
				return safeCall(() => uiProvider.getBeneficiaryHistory(id, {}))?.months ?? [];
			},
			async getBeneficiarySavingsHistory(id, upToMonth = "2026-07") {
				return unwrap(uiProvider.getBeneficiaryHistory(id, { upToMonth }))?.months ?? [];
			},
			async getAllocationPlan(ugId, month, overrides = {}) {
				if (!unwrap(uiProvider.getAllocationPlan(ugId, month, { overrides }))) return null;
				return null;
			},
			async saveAllocationOverrides(_ugId, _month, _overrides) {
				return ok();
			},
			async closeMonthlySettlement(_ugId, _month) {
				return ok();
			},
			async getBeneficiaryInvoice(ubId, month) {
				try {
					return unwrap(uiProvider.getBeneficiaryMonthlyReport(ubId, month));
				} catch {
					return null;
				}
			},
			async getImportHistory() {
				return [];
			},
			async getCsvTemplate(type) {
				const coreType = CSV_TYPE_MAP[type] ?? type;
				const d = unwrap(uiProvider.getCsvTemplate(coreType));
				if (!d) return {
					importType: type,
					delimiter: ";",
					headers: [],
					exampleRows: [],
					aliases: {},
					example: "",
					filename: CSV_FILENAME[type]
				};
				return {
					importType: d.importType ?? type,
					delimiter: d.delimiter ?? ";",
					headers: d.headers ?? [],
					exampleRows: d.exampleRows ?? [],
					aliases: d.aliases ?? {},
					example: d.csvText ?? "",
					filename: CSV_FILENAME[type]
				};
			},
			async extractUtilityBill(scenario = "matched") {
				return unwrap(uiProvider.createUtilityBillImport({
					file: null,
					scenario
				}));
			},
			async getExistingBillData(_ubId, _month) {
				return null;
			},
			async confirmBillExtraction(data) {
				return unwrap(uiProvider.confirmUtilityBillExtraction(data)) ?? ok();
			},
			async matchBillToBeneficiary(uc) {
				return unwrap(uiProvider.matchUtilityBillToBeneficiary(uc));
			},
			async linkBillToBeneficiary(extractionId, ubId) {
				return unwrap(uiProvider.linkUtilityBillToBeneficiary(extractionId, ubId)) ?? ok();
			},
			async replaceBillData(_extractionId, _reason) {
				return ok();
			},
			async getOwnerReport(ugId, month) {
				try {
					return unwrap(uiProvider.getOwnerMonthlyReport(ugId, month));
				} catch (err) {
					const msg = err?.message ?? "";
					if (/\[buildOwnerMonthlyReport\]/.test(msg) && /não encontrada/.test(msg)) return null;
					throw err;
				}
			},
			async getInternalReport(_ugId, _month) {
				return null;
			},
			async getFinancialReport(_ugId, _month) {
				return null;
			},
			async getFinancialData(filter) {
				return {
					month: filter.month,
					invoices: [],
					ownerPayments: [],
					totalRevenue: 0,
					totalOwnerPayment: 0,
					spread: 0
				};
			},
			async confirmInvoicePayment(ubId, _month, payment) {
				return unwrap(uiProvider.confirmInvoicePayment(ubId, payment)) ?? ok();
			},
			async reopenInvoicePayment(ubId, _month, _reason) {
				return unwrap(uiProvider.reopenInvoicePayment(ubId, _reason)) ?? ok();
			},
			async confirmOwnerPayment(ugId, _month, payment) {
				return unwrap(uiProvider.confirmOwnerSettlementPayment(ugId, payment)) ?? ok();
			},
			async listAlerts(filter) {
				return unwrap(uiProvider.getAlertsSummary({ referenceMonth: filter?.month }))?.alerts ?? [];
			},
			async getAlertDetail(_id) {
				return null;
			},
			async resolveAlert(_id, _note) {
				return ok();
			},
			async ignoreAlert(_id, _note) {
				return ok();
			},
			async markAlertInAnalysis(_id, _note) {
				return ok();
			}
		};
	}
	var AVAILABLE_MONTHS, CSV_TYPE_MAP, CSV_FILENAME;
	var init_esaRuntimeProvider = __esmMin((() => {
		AVAILABLE_MONTHS = [
			{
				value: "2026-07",
				label: "Julho de 2026",
				status: "em_apuracao"
			},
			{
				value: "2026-06",
				label: "Junho de 2026",
				status: "fechado"
			},
			{
				value: "2026-05",
				label: "Maio de 2026",
				status: "fechado"
			},
			{
				value: "2026-04",
				label: "Abril de 2026",
				status: "fechado"
			},
			{
				value: "2026-03",
				label: "Março de 2026",
				status: "fechado"
			}
		];
		CSV_TYPE_MAP = {
			ug: "generating-units",
			ub: "beneficiary-units",
			rug: "generating-unit-monthly-records",
			rub: "beneficiary-monthly-records"
		};
		CSV_FILENAME = {
			ug: "modelo-unidades-geradoras.csv",
			ub: "modelo-unidades-beneficiarias.csv",
			rug: "modelo-registros-mensais-ug.csv",
			rub: "modelo-registros-mensais-ub.csv"
		};
	}));
	//#endregion
	//#region bridge/runtimeBridge.ts
	function resolveMode() {
		try {
			if (new URLSearchParams(window.location.search).get("runtime") === "real") return "real";
		} catch {}
		return "demo";
	}
	async function resolveRealProvider() {
		if (!window.__ESA_UI_PROVIDER__) {
			console.warn("[ESA-Bridge] ?runtime=real requested but window.__ESA_UI_PROVIDER__ not set — falling back to demo");
			return demoRuntimeProvider;
		}
		try {
			const { createEsaRuntimeProvider } = await Promise.resolve().then(() => (init_esaRuntimeProvider(), esaRuntimeProvider_exports));
			return createEsaRuntimeProvider(window.__ESA_UI_PROVIDER__);
		} catch (err) {
			console.error("[ESA-Bridge] Failed to initialize real provider — falling back to demo", err);
			return demoRuntimeProvider;
		}
	}
	async function initBridge() {
		if (resolveMode() === "demo") window.ESA_ENERGY_CREDITS_RUNTIME = demoRuntimeProvider;
		else window.ESA_ENERGY_CREDITS_RUNTIME = await resolveRealProvider();
		window.dispatchEvent(new CustomEvent("esa:runtime:ready", { detail: { mode: window.ESA_ENERGY_CREDITS_RUNTIME.mode } }));
	}
	if (resolveMode() === "demo") {
		window.ESA_ENERGY_CREDITS_RUNTIME = demoRuntimeProvider;
		window.dispatchEvent(new CustomEvent("esa:runtime:ready", { detail: { mode: "demo" } }));
	} else initBridge().catch((err) => console.error("[ESA-Bridge] Fatal init error", err));
	//#endregion
})();
