import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Sun,
  Building2,
  Zap,
  TrendingUp,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, KpiCard, SectionTitle, Badge, Button, CycleBadge, StatusPill } from "../ui";
import {
  energyCreditsProvider,
  type SettlementResult,
  type Alert,
} from "@/lib/esa/provider";
import { brl, kwh } from "@/lib/esa/format";

type DrillKey =
  | { kind: "compensated" }
  | { kind: "revenue" }
  | { kind: "owner" }
  | { kind: "balance" }
  | { kind: "generation" }
  | { kind: "critical" }
  | { kind: "ug"; id: string }
  | { kind: "ub"; id: string }
  | { kind: "alert"; id: string };

export function Dashboard({ onNavigate }: { onNavigate: (v: any) => void }) {
  const months = energyCreditsProvider.listMonths();
  const ugs = energyCreditsProvider.listGeneratingUnits();

  const [month, setMonth] = useState(months[0].value);
  const [ugFilter, setUgFilter] = useState<string>("all");
  const [chartMode, setChartMode] = useState<"por_ug" | "consolidado">("por_ug");
  const [drill, setDrill] = useState<DrillKey | null>(null);

  const filters = { month, ugId: ugFilter === "all" ? undefined : ugFilter };

  const summary = useMemo(
    () => energyCreditsProvider.getExecutiveSummary(filters),
    [month, ugFilter],
  );
  const alerts = useMemo(
    () => energyCreditsProvider.getAlertsSummary(filters),
    [month, ugFilter],
  );
  const trend = useMemo(
    () => energyCreditsProvider.getMonthlyTrend({ ugId: filters.ugId }),
    [ugFilter],
  );

  const monthLabel = months.find((m) => m.value === month)?.label ?? month;
  const prevMonthLabel = months[months.findIndex((m) => m.value === month) + 1]?.label;
  const isClosed = summary.cycleStatus === "fechado";

  const chartGenVsCons = summary.results.map((r) => ({
    name: r.ug.name.replace("UG Solar ", ""),
    fullName: r.ug.name,
    Geração: Math.round(r.generation),
    Consumo: Math.round(r.rows.reduce((s, x) => s + x.ub.monthlyConsumption, 0)),
  }));

  const ugRanking = [...summary.results].sort((a, b) => b.generation - a.generation);
  const ubRanking = summary.results
    .flatMap((r) => r.rows.map((row) => ({ ...row, ugName: r.ug.name })))
    .sort((a, b) => b.ub.monthlyConsumption - a.ub.monthlyConsumption)
    .slice(0, 5);

  const totalGen = summary.operational.generation;
  const spreadPct =
    summary.financial.revenue > 0
      ? (summary.financial.spread / summary.financial.revenue) * 100
      : 0;

  return (
    <div className="space-y-5">
      {/* Period filter bar */}
      <Card className="p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-[10px] md:text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Mês de referência
            </div>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9 w-[180px] text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Filter className="h-3.5 w-3.5 text-slate-400 hidden md:block" />
            <Select value={ugFilter} onValueChange={setUgFilter}>
              <SelectTrigger className="h-9 w-[180px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as UGs</SelectItem>
                {ugs.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <div className="text-[10px] md:text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Ciclo
            </div>
            <CycleBadge status={summary.cycleStatus} />
          </div>
        </div>
        {isClosed && (
          <div className="mt-3 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Mês fechado. Reabertura necessária para alterar dados.
          </div>
        )}
      </Card>

      {/* Operação Energética */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="h-1 w-6 rounded-full bg-emerald-500" />
          <h3 className="text-[11px] uppercase tracking-widest text-slate-600 font-bold">
            Operação Energética
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 md:gap-3">
          <KpiCard
            label="Unidades Geradoras"
            value={String(summary.operational.generatingUnits.total)}
            hint={`${summary.operational.generatingUnits.active} ativas`}
            icon={<Sun className="h-4 w-4" />}
          />
          <KpiCard
            label="Unidades Beneficiárias"
            value={String(summary.operational.beneficiaryUnits.total)}
            hint={`${summary.operational.beneficiaryUnits.active} ativas`}
            icon={<Building2 className="h-4 w-4" />}
          />
          <KpiCard
            label="Créditos gerados"
            value={kwh(summary.operational.generation)}
            delta={summary.deltas.generation}
            deltaLabel={`vs. ${prevMonthLabel ?? "—"}`}
            icon={<Zap className="h-4 w-4" />}
            onClick={() => setDrill({ kind: "generation" })}
          />
          <KpiCard
            label="Créditos compensados"
            value={kwh(summary.operational.compensated)}
            delta={summary.deltas.compensated}
            deltaLabel={`vs. ${prevMonthLabel ?? "—"}`}
            tone="accent"
            icon={<TrendingUp className="h-4 w-4" />}
            onClick={() => setDrill({ kind: "compensated" })}
          />
          <KpiCard
            label="Saldo atual"
            value={kwh(summary.operational.balance)}
            delta={summary.deltas.balance}
            deltaLabel={`vs. ${prevMonthLabel ?? "—"}`}
            icon={<Wallet className="h-4 w-4" />}
            onClick={() => setDrill({ kind: "balance" })}
          />
        </div>
      </section>

      {/* Resultado Financeiro */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="h-1 w-6 rounded-full bg-emerald-700" />
          <h3 className="text-[11px] uppercase tracking-widest text-slate-600 font-bold">
            Resultado Financeiro
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 md:gap-3">
          <KpiCard
            label="Receita ESA"
            value={brl(summary.financial.revenue)}
            delta={summary.deltas.revenue}
            deltaLabel={`vs. ${prevMonthLabel ?? "—"}`}
            tone="positive"
            onClick={() => setDrill({ kind: "revenue" })}
          />
          <KpiCard
            label="Repasse proprietário"
            value={brl(summary.financial.ownerPayment)}
            delta={summary.deltas.ownerPayment}
            deltaLabel={`vs. ${prevMonthLabel ?? "—"}`}
            tone="negative"
            invertDelta
            onClick={() => setDrill({ kind: "owner" })}
          />
          <KpiCard
            label="Spread bruto ESA"
            value={brl(summary.financial.spread)}
            delta={summary.deltas.spread}
            deltaLabel={`margem ${spreadPct.toFixed(1)}%`}
            tone="accent"
          />
          <KpiCard
            label="Economia dos clientes"
            value={brl(summary.financial.savings)}
            delta={summary.deltas.savings}
            deltaLabel={`vs. ${prevMonthLabel ?? "—"}`}
            tone="positive"
          />
          <KpiCard
            label="Alertas críticos"
            value={String(summary.financial.criticalAlerts)}
            delta={summary.deltas.criticalAlerts}
            deltaLabel={`vs. ${prevMonthLabel ?? "—"}`}
            tone="negative"
            invertDelta
            icon={<AlertTriangle className="h-4 w-4" />}
            onClick={() => setDrill({ kind: "critical" })}
          />
        </div>
      </section>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 md:p-5 lg:col-span-2">
          <SectionTitle
            title="Geração vs. Consumo"
            desc={
              chartMode === "por_ug"
                ? `Por unidade geradora — ${monthLabel}`
                : "Evolução consolidada dos últimos ciclos"
            }
            right={
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 text-xs">
                <button
                  onClick={() => setChartMode("por_ug")}
                  className={`px-2.5 py-1 rounded-md font-medium ${chartMode === "por_ug" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}
                >
                  Por UG
                </button>
                <button
                  onClick={() => setChartMode("consolidado")}
                  className={`px-2.5 py-1 rounded-md font-medium ${chartMode === "consolidado" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}
                >
                  Consolidado
                </button>
              </div>
            }
          />
          <div className="h-64">
            <ResponsiveContainer>
              {chartMode === "por_ug" ? (
                <BarChart data={chartGenVsCons}>
                  <CartesianGrid stroke="#eef2ef" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(v: number) => kwh(v)}
                    labelFormatter={(l, payload) =>
                      payload?.[0]?.payload?.fullName ?? l
                    }
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Bar dataKey="Geração" fill="#059669" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Consumo" fill="#a7f3d0" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={trend}>
                  <CartesianGrid stroke="#eef2ef" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(v: number) => kwh(v)}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Line
                    type="monotone"
                    dataKey="Geracao"
                    name="Geração"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Consumo"
                    name="Consumo"
                    stroke="#a7f3d0"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <SectionTitle
            title="Receita vs. Repasse"
            desc="Evolução dos últimos ciclos"
            right={
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Spread acumulado
                </div>
                <div className="text-sm font-semibold text-emerald-700 tabular-nums">
                  {brl(trend.reduce((s, r) => s + r.Spread, 0))}
                </div>
              </div>
            }
          />
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid stroke="#eef2ef" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(v: number, name) => [brl(v), name as string]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                <Line
                  type="monotone"
                  dataKey="Receita"
                  name="Receita ESA"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Repasse"
                  name="Repasse UG"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Spread"
                  name="Spread"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Rankings + alerts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <SectionTitle title="Ranking UGs" desc="Por geração no mês" />
          <div className="space-y-3">
            {ugRanking.map((r, i) => {
              const max = ugRanking[0]?.generation || 1;
              return (
                <div key={r.ug.id} className="group">
                  <div className="flex justify-between text-xs mb-1 items-center gap-2">
                    <span className="font-medium text-slate-700 truncate">
                      #{i + 1} {r.ug.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums text-slate-600">{kwh(r.generation)}</span>
                      <button
                        onClick={() => setDrill({ kind: "ug", id: r.ug.id })}
                        className="text-[10px] font-semibold text-emerald-700 hover:underline"
                      >
                        Ver unidade
                      </button>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                      style={{ width: `${(r.generation / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Top Beneficiárias" desc="Maior consumo" />
          <div className="space-y-2.5">
            {ubRanking.map((row, i) => (
              <button
                key={row.ub.id}
                onClick={() => setDrill({ kind: "ub", id: row.ub.id })}
                className="w-full flex items-center justify-between text-sm gap-2 rounded-lg p-1.5 hover:bg-slate-50 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 truncate">
                    #{i + 1} {row.ub.name}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{kwh(row.ub.monthlyConsumption)}</span>
                    <span className="text-emerald-600">
                      Economia {brl(row.economia)}
                    </span>
                  </div>
                </div>
                <div className="text-right tabular-nums shrink-0">
                  <div className="text-sm font-semibold text-slate-800">
                    {brl(row.faturaEsa)}
                  </div>
                  <div className="mt-0.5">
                    <StatusPill status={row.ub.paymentStatus} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Alertas operacionais
              </h2>
              <p className="text-xs text-slate-500">{monthLabel}</p>
            </div>
            <button
              onClick={() => onNavigate("alertas")}
              className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1 hover:underline"
            >
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2.5">
            {alerts.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-6">
                Nenhum alerta neste mês
              </div>
            )}
            {alerts.slice(0, 4).map((a) => {
              const tone: Record<string, string> = {
                critico: "bg-rose-50 border-rose-200 text-rose-700",
                risco: "bg-amber-50 border-amber-200 text-amber-800",
                atencao: "bg-sky-50 border-sky-200 text-sky-700",
                info: "bg-slate-50 border-slate-200 text-slate-600",
              };
              return (
                <div
                  key={a.id}
                  className={`text-xs border rounded-lg px-3 py-2 ${tone[a.severity]}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      {a.severity}
                    </span>
                    <span className="text-[10px] opacity-70">{a.unit}</span>
                  </div>
                  <div className="mt-1 mb-1.5">{a.message}</div>
                  <button
                    onClick={() => setDrill({ kind: "alert", id: a.id })}
                    className="text-[11px] font-semibold underline-offset-2 hover:underline inline-flex items-center gap-0.5"
                  >
                    Analisar <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Drill-down Sheet */}
      <Sheet open={!!drill} onOpenChange={(v) => !v && setDrill(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {drill && (
            <DrillContent
              drill={drill}
              summary={summary.results}
              alerts={alerts}
              onNavigate={onNavigate}
              close={() => setDrill(null)}
              isClosed={isClosed}
              monthLabel={monthLabel}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DrillContent({
  drill,
  summary,
  alerts,
  onNavigate,
  close,
  isClosed,
  monthLabel,
}: {
  drill: DrillKey;
  summary: SettlementResult[];
  alerts: Alert[];
  onNavigate: (v: any) => void;
  close: () => void;
  isClosed: boolean;
  monthLabel: string;
}) {
  if (drill.kind === "compensated" || drill.kind === "generation" || drill.kind === "balance") {
    const titleMap: Record<string, string> = {
      compensated: "Créditos compensados",
      generation: "Créditos gerados",
      balance: "Saldo atual",
    };
    const pick = (r: SettlementResult) =>
      drill.kind === "generation"
        ? r.generation
        : drill.kind === "balance"
          ? r.currentBalance
          : r.totalCompensated;
    return (
      <>
        <SheetHeader>
          <SheetTitle>{titleMap[drill.kind]}</SheetTitle>
          <SheetDescription>Composição por unidade geradora — {monthLabel}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-2">
          {summary.map((r) => (
            <div
              key={r.ug.id}
              className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2.5"
            >
              <div>
                <div className="text-sm font-medium text-slate-900">{r.ug.name}</div>
                <div className="text-[11px] text-slate-500">{r.ug.owner}</div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-slate-800">
                {kwh(pick(r))}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (drill.kind === "revenue" || drill.kind === "owner") {
    const isRevenue = drill.kind === "revenue";
    return (
      <>
        <SheetHeader>
          <SheetTitle>{isRevenue ? "Receita ESA" : "Repasse ao proprietário"}</SheetTitle>
          <SheetDescription>
            {isRevenue
              ? `Detalhamento por beneficiária — ${monthLabel}`
              : `Detalhamento por UG — ${monthLabel}`}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-2">
          {isRevenue
            ? summary.flatMap((r) =>
                r.rows.map((row) => (
                  <div
                    key={row.ub.id}
                    className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">{row.ub.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {kwh(row.compensated)} · {row.ub.esaPrice.toFixed(2)}/kWh
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-emerald-700">
                      {brl(row.faturaEsa)}
                    </div>
                  </div>
                )),
              )
            : summary.map((r) => (
                <div
                  key={r.ug.id}
                  className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">{r.ug.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {kwh(r.totalCompensated)} · {r.ug.purchasePrice.toFixed(2)}/kWh
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-rose-600">
                    {brl(r.ownerPayment)}
                  </div>
                </div>
              ))}
        </div>
      </>
    );
  }

  if (drill.kind === "critical") {
    close();
    onNavigate("alertas");
    return null;
  }

  if (drill.kind === "ug") {
    const r = summary.find((x) => x.ug.id === drill.id);
    if (!r) return null;
    const ubs = r.rows;
    return (
      <>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {r.ug.name}
            <StatusPill status={r.ug.status} />
          </SheetTitle>
          <SheetDescription>
            {r.ug.id} · {r.ug.owner}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="UC" value={r.ug.uc} />
            <FieldRow label="Distribuidora" value={r.ug.distributor} />
            <FieldRow label="Saldo anterior" value={kwh(r.previousBalance)} />
            <FieldRow label="Geração mensal" value={kwh(r.generation)} />
            <FieldRow label="Disponível" value={kwh(r.available)} />
            <FieldRow label="Alocado" value={kwh(r.totalAllocated)} />
            <FieldRow label="Compensado" value={kwh(r.totalCompensated)} />
            <FieldRow label="Saldo atual" value={kwh(r.currentBalance)} />
            <FieldRow label="Repasse mensal" value={brl(r.ownerPayment)} tone="rose" />
            <FieldRow label="Receita ESA" value={brl(r.esaRevenue)} tone="emerald" />
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Beneficiárias vinculadas
            </div>
            <div className="space-y-1.5">
              {ubs.map((row) => (
                <div
                  key={row.ub.id}
                  className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2"
                >
                  <div className="text-sm text-slate-800">{row.ub.name}</div>
                  <div className="text-xs text-slate-600 tabular-nums">
                    {kwh(row.compensated)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => onNavigate("ug")}>
              Abrir cadastro
            </Button>
            <Button
              variant="soft"
              size="sm"
              onClick={() => onNavigate("apuracao")}
              disabled={isClosed}
            >
              Apurar mês
            </Button>
            <Button variant="soft" size="sm" onClick={() => onNavigate("relatorios")}>
              Gerar relatório
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (drill.kind === "ub") {
    const found = summary
      .flatMap((r) => r.rows.map((row) => ({ row, ug: r.ug })))
      .find((x) => x.row.ub.id === drill.id);
    if (!found) return null;
    const { row, ug } = found;
    return (
      <>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {row.ub.name}
            <StatusPill status={row.ub.paymentStatus} />
          </SheetTitle>
          <SheetDescription>
            {row.ub.id} · vinculada a {ug.name}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <FieldRow label="UC" value={row.ub.uc} />
          <FieldRow label="Distribuidora" value={row.ub.distributor} />
          <FieldRow label="Consumo mensal" value={kwh(row.ub.monthlyConsumption)} />
          <FieldRow label="Compensado" value={kwh(row.compensated)} />
          <FieldRow label="Pendente" value={kwh(row.pending)} />
          <FieldRow label="Preço ESA" value={brl(row.ub.esaPrice)} />
          <FieldRow label="Tarifa dist." value={brl(row.ub.distributorTariff)} />
          <FieldRow label="Conta sem ESA" value={brl(row.contaSemEsa)} />
          <FieldRow label="Fatura ESA" value={brl(row.faturaEsa)} tone="emerald" />
          <FieldRow label="Economia" value={brl(row.economia)} tone="emerald" />
        </div>
        <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => onNavigate("ub")}>
            Abrir cadastro
          </Button>
          <Button variant="soft" size="sm" onClick={() => onNavigate("relatorios")}>
            Gerar relatório
          </Button>
        </div>
      </>
    );
  }

  if (drill.kind === "alert") {
    const a = alerts.find((x) => x.id === drill.id);
    if (!a) return null;
    return (
      <>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge tone="neutral">{a.code}</Badge>
            <span className="uppercase text-xs">{a.severity}</span>
          </SheetTitle>
          <SheetDescription>{monthLabel}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          <div className="text-sm text-slate-900 font-medium">{a.message}</div>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Unidade" value={a.unit} />
            <FieldRow label="Mês" value={a.month} />
          </div>
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
              Ação recomendada
            </div>
            <div className="text-sm text-emerald-900 mt-1">{a.action}</div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onNavigate("alertas")}>
              Abrir central de alertas
            </Button>
          </div>
        </div>
      </>
    );
  }

  return null;
}

function FieldRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-600"
        : "text-slate-900";
  return (
    <div className="border border-slate-200 rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        {label}
      </div>
      <div className={`text-sm font-semibold tabular-nums mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
