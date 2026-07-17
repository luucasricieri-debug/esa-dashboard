import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save, Lock, FileDown, FileText, RefreshCw, AlertTriangle, Info, Sparkles, Pencil } from 'lucide-react';
import { Card, SectionTitle, Button, KpiCard, Badge, CycleBadge, Modal, Field, inputClass } from '@/components/ui/index';
import { generatingUnits, months, demoProvider } from '@/lib/demo';
import { brl, kwh, num } from '@/lib/format';

type Mode = 'auto' | 'manual';

export function MonthlySettlement() {
  const [month, setMonth] = useState('2026-07');
  const [ugId, setUgId] = useState(generatingUnits[0].id);
  const [mode, setMode] = useState<Mode>('manual');
  const [cyclePriceOverride, setCyclePriceOverride] = useState<Record<string, number>>({});
  const [priceModal, setPriceModal] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, { allocationPct?: number; preventiveMargin?: number }>>({});

  const effectiveOverrides = useMemo(() => {
    if (mode === 'manual') return overrides;
    const base: typeof overrides = {};
    Object.entries(overrides).forEach(([k, v]) => {
      if (v.preventiveMargin !== undefined) base[k] = { preventiveMargin: v.preventiveMargin };
    });
    return base;
  }, [mode, overrides]);

  const cycle = demoProvider.getGeneratingUnitCycleSummary(ugId, { month, ugId });
  const plan = demoProvider.getCreditAllocationPlan(ugId, month, effectiveOverrides);

  if (!plan || !cycle) return null;

  const displayRows = plan.rows.map((r) => ({
    ...r,
    displayPct: mode === 'auto' ? r.recommendedAllocationPercentage : r.allocationPercentage,
    displayPlanned:
      mode === 'auto'
        ? cycle.generationKwh * r.recommendedAllocationPercentage
        : r.plannedCreditsReceivedKwh,
  }));

  const totalDisplayPct = displayRows.reduce((s, r) => s + r.displayPct, 0);
  const pctInvalid = Math.abs(totalDisplayPct - 1) > 0.0005;
  const partialManual =
    mode === 'manual' &&
    plan.rows.some((r) => !overrides[r.ub.id]?.allocationPct && r.allocationPercentage === 0);

  return (
    <div className="space-y-4">
      {/* Ciclo operacional */}
      <Card className="p-5">
        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                Mês de referência
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500 min-w-40"
              >
                {months.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                Unidade Geradora
              </label>
              <select
                value={ugId}
                onChange={(e) => setUgId(e.target.value)}
                className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500 min-w-64"
              >
                {generatingUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <CycleBadge status={cycle.cycleStatus} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Save className="h-4 w-4" /> Salvar
            </Button>
            <Button>
              <Lock className="h-4 w-4" /> Fechar mês
            </Button>
            <Button variant="outline">
              <FileText className="h-4 w-4" /> Relatórios
            </Button>
            <Button variant="outline">
              <FileDown className="h-4 w-4" /> Exportar
            </Button>
          </div>
        </div>
      </Card>

      {/* Resumo da UG */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard label="Geração disponível" value={kwh(cycle.generationKwh)} tone="accent" />
        <KpiCard label="Recomendado" value={kwh(cycle.totalRecommendedKwh)} />
        <KpiCard label="Planejado" value={kwh(cycle.totalPlannedKwh)} />
        <KpiCard label="Recebido" value={kwh(cycle.totalReceivedKwh)} />
        <KpiCard label="Compensado" value={kwh(cycle.totalCompensatedKwh)} tone="positive" />
        <div title="Soma dos créditos acumulados nas Unidades Consumidoras Beneficiárias.">
          <KpiCard label="Saldo total nas UCs" value={kwh(cycle.totalFinalBalanceKwh)} hint="Soma dos saldos das UCs beneficiárias" />
        </div>
        <KpiCard label="Beneficiárias" value={String(cycle.beneficiariesCount)} />
      </div>

      {/* Modo de Rateio */}
      <Card className="p-5">
        <SectionTitle
          title="Modo de Rateio"
          desc="Escolha como os percentuais de rateio serão definidos para esta apuração"
          right={
            <div className="flex items-center gap-2">
              <Badge tone={pctInvalid ? 'red' : 'green'}>Total: {(totalDisplayPct * 100).toFixed(2)}%</Badge>
              <Button variant="soft" onClick={() => setOverrides({ ...overrides })}>
                <RefreshCw className="h-4 w-4" /> Recalcular
              </Button>
            </div>
          }
        />
        <div className="flex gap-2">
          <ModeButton
            active={mode === 'auto'}
            onClick={() => setMode('auto')}
            icon={Sparkles}
            title="AUTOMÁTICO"
            desc="Percentuais calculados pelo sistema com base no crédito recomendado"
          />
          <ModeButton
            active={mode === 'manual'}
            onClick={() => setMode('manual')}
            icon={Pencil}
            title="MANUAL"
            desc="Operação define o percentual de cada beneficiária"
          />
        </div>

        {pctInvalid && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs text-rose-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold uppercase text-[10px] tracking-wider">ALLOCATION_PERCENTAGE_TOTAL_INVALID</div>
              A soma dos percentuais de rateio deve totalizar 100%.
            </div>
          </div>
        )}
        {partialManual && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold uppercase text-[10px] tracking-wider">PARTIAL_MANUAL_ALLOCATION_NOT_ALLOWED</div>
              O rateio manual deve ser informado para todas as beneficiárias.
            </div>
          </div>
        )}
      </Card>

      {/* Tabela de rateio */}
      <Card className="p-5">
        <SectionTitle
          title="Plano de rateio da geração"
          desc="Distribuição dos créditos entre as beneficiárias — nomenclatura alinhada ao ESA OS"
        />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                <th className="py-2.5 px-5 font-medium sticky left-0 bg-slate-50/95 z-10">Beneficiária / UC</th>
                <th className="py-2.5 font-medium text-right"><Tt hint="averageMonthlyConsumptionKwh">Média mensal</Tt></th>
                <th className="py-2.5 font-medium text-right"><Tt hint="preventiveMarginPercentage">Margem prev.</Tt></th>
                <th className="py-2.5 font-medium text-right"><Tt hint="targetCreditKwh">Crédito alvo</Tt></th>
                <th className="py-2.5 font-medium text-right"><Tt hint="currentBalanceKwh">Saldo atual</Tt></th>
                <th className="py-2.5 font-medium text-right"><Tt hint="recommendedCreditsToReceiveKwh">Recomendado add.</Tt></th>
                <th className="py-2.5 font-medium text-right"><Tt hint="allocationPercentage">% Rateio</Tt></th>
                <th className="py-2.5 font-medium text-right"><Tt hint="plannedCreditsReceivedKwh">Planejado</Tt></th>
                <th className="py-2.5 font-medium text-right">Δ Rec × Plan</th>
                <th className="py-2.5 font-medium text-right"><Tt hint="creditsReceivedKwh">Recebido</Tt></th>
                <th className="py-2.5 font-medium text-right"><Tt hint="monthlyConsumptionKwh">Consumo</Tt></th>
                <th className="py-2.5 font-medium text-right"><Tt hint="creditsCompensatedKwh">Compensado</Tt></th>
                <th className="py-2.5 font-medium text-right">Saldo final</th>
                <th className="py-2.5 px-5 font-medium text-right"><Tt hint="coverageMonths">Cobertura</Tt></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRows.map((r) => {
                const pctVal = r.displayPct;
                const planned = r.displayPlanned;
                const diff = planned - r.recommendedCreditsToReceiveKwh;
                const marginVal = r.preventiveMarginPercentage;
                return (
                  <tr key={r.ub.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 sticky left-0 bg-white z-10">
                      <div className="font-medium text-slate-900">{r.ub.name}</div>
                      <div className="text-[11px] text-slate-500">UC {r.ub.uc}</div>
                    </td>
                    <td className="py-3 text-right tabular-nums">{kwh(r.averageMonthlyConsumptionKwh)}</td>
                    <td className="py-3 text-right">
                      <input
                        type="number"
                        step="1"
                        min={0}
                        max={30}
                        value={Math.round(marginVal * 100)}
                        onChange={(e) =>
                          setOverrides((o) => ({
                            ...o,
                            [r.ub.id]: { ...o[r.ub.id], preventiveMargin: Number(e.target.value) / 100 },
                          }))
                        }
                        className="w-14 text-right tabular-nums border border-slate-200 rounded-md px-2 py-1 text-xs bg-white outline-none focus:border-emerald-500"
                      />
                      <span className="text-[11px] text-slate-500 ml-1">%</span>
                    </td>
                    <td className="py-3 text-right tabular-nums text-emerald-700 font-medium">{kwh(r.targetCreditKwh)}</td>
                    <td className="py-3 text-right tabular-nums text-slate-700">{kwh(r.currentBalanceKwh)}</td>
                    <td className="py-3 text-right tabular-nums text-slate-700">{kwh(r.recommendedCreditsToReceiveKwh)}</td>
                    <td className="py-3 text-right">
                      {mode === 'manual' ? (
                        <>
                          <input
                            type="number"
                            step="0.1"
                            min={0}
                            max={100}
                            value={(pctVal * 100).toFixed(2)}
                            onChange={(e) =>
                              setOverrides((o) => ({
                                ...o,
                                [r.ub.id]: { ...o[r.ub.id], allocationPct: Number(e.target.value) / 100 },
                              }))
                            }
                            className="w-20 text-right tabular-nums border border-slate-200 rounded-md px-2 py-1 text-xs bg-white outline-none focus:border-emerald-500"
                          />
                          <span className="text-[11px] text-slate-500 ml-1">%</span>
                        </>
                      ) : (
                        <span className="tabular-nums text-emerald-700 font-medium">{(pctVal * 100).toFixed(2)}%</span>
                      )}
                      <div className="text-[10px] text-slate-400 tabular-nums">
                        rec {(r.recommendedAllocationPercentage * 100).toFixed(2)}%
                      </div>
                    </td>
                    <td className="py-3 text-right tabular-nums text-emerald-700">{kwh(planned)}</td>
                    <td className={`py-3 text-right tabular-nums text-[11px] ${Math.abs(diff) < 1 ? 'text-slate-400' : diff > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {diff > 0 ? '+' : ''}{num(diff, 0)} kWh
                    </td>
                    <td className="py-3 text-right tabular-nums">{kwh(r.creditsReceivedKwh)}</td>
                    <td className="py-3 text-right tabular-nums">{kwh(r.monthlyConsumptionKwh)}</td>
                    <td className="py-3 text-right tabular-nums text-emerald-700 font-medium">{kwh(r.creditsCompensatedKwh)}</td>
                    <td className="py-3 text-right tabular-nums font-semibold">{kwh(r.finalBalanceKwh)}</td>
                    <td className="py-3 px-5 text-right"><CoverageBadge months={r.coverageMonths} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-emerald-50/40 font-semibold">
                <td className="py-3 px-5 text-slate-800 sticky left-0 bg-emerald-50/95 z-10">
                  Totais · Geração {kwh(plan.generation)}
                </td>
                <td colSpan={5}></td>
                <td className={`py-3 text-right tabular-nums ${pctInvalid ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {(totalDisplayPct * 100).toFixed(2)}%
                </td>
                <td className="py-3 text-right tabular-nums text-emerald-700">{kwh(cycle.totalPlannedKwh)}</td>
                <td></td>
                <td className="py-3 text-right tabular-nums">{kwh(cycle.totalReceivedKwh)}</td>
                <td className="py-3 text-right tabular-nums">{kwh(plan.totalConsumption)}</td>
                <td className="py-3 text-right tabular-nums text-emerald-700">{kwh(cycle.totalCompensatedKwh)}</td>
                <td className="py-3 text-right tabular-nums">{kwh(cycle.totalFinalBalanceKwh)}</td>
                <td className="py-3 px-5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-600">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-500" />
          <div>
            O saldo já acumulado na UC é descontado do crédito recomendado para evitar acúmulo excessivo.
            Cobertura ≤ 0,25 mês = Baixa · 0,26–1,50 = Adequada · &gt; 1,50 = Elevada.
          </div>
        </div>
      </Card>

      {/* Condição de compra da UG */}
      <Card className="p-5">
        <SectionTitle
          title="Condição de compra da UG"
          desc="Preço aplicado no repasse ao proprietário"
          right={
            <Button variant="outline" onClick={() => setPriceModal(true)}>
              <Pencil className="h-4 w-4" /> Alterar preço do ciclo
            </Button>
          }
        />
        {(() => {
          const terms = demoProvider.getGeneratingUnitCommercialTerms(ugId);
          const standard = terms?.purchasePricePerKwh ?? plan.ug.purchasePrice;
          const applied = cyclePriceOverride[`${ugId}-${month}`] ?? standard;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <InfoBlock label="Preço padrão de compra" value={`R$ ${num(standard, 2)}/kWh`} />
              <InfoBlock label="Preço aplicado no ciclo" value={`R$ ${num(applied, 2)}/kWh`} />
              <InfoBlock label="Vigência" value={terms?.effectiveDate ?? '—'} />
            </div>
          );
        })()}
      </Card>

      {/* Resumo financeiro */}
      <Card className="p-5 bg-gradient-to-br from-slate-50 to-emerald-50/50">
        <SectionTitle title="Resumo financeiro da apuração" desc="Repasse ao proprietário e receita bruta ESA no ciclo" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Preço aplicado"
            value={`R$ ${num(cyclePriceOverride[`${ugId}-${month}`] ?? plan.ug.purchasePrice, 2)}/kWh`}
          />
          <KpiCard label="Repasse ao proprietário" value={brl(plan.ownerPayment)} tone="negative" />
          <KpiCard label="Receita ESA" value={brl(plan.esaRevenue)} tone="positive" />
          <KpiCard label="Spread bruto" value={brl(plan.esaRevenue - plan.ownerPayment)} tone="accent" />
        </div>
      </Card>

      {priceModal && (
        <CyclePriceModal
          currentStandard={plan.ug.purchasePrice}
          currentCycle={cyclePriceOverride[`${ugId}-${month}`] ?? plan.ug.purchasePrice}
          onClose={() => setPriceModal(false)}
          onApply={(v) => {
            setCyclePriceOverride((o) => ({ ...o, [`${ugId}-${month}`]: v }));
            toast('Preço aplicado somente neste ciclo', { description: 'O preço padrão da UG não foi alterado.' });
            setPriceModal(false);
          }}
        />
      )}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className="text-slate-800 font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function CyclePriceModal({
  currentStandard,
  currentCycle,
  onClose,
  onApply,
}: {
  currentStandard: number;
  currentCycle: number;
  onClose: () => void;
  onApply: (v: number) => void;
}) {
  const [price, setPrice] = useState(currentCycle.toFixed(2));
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      title="Alterar preço do ciclo"
      desc="A alteração vale somente para o ciclo selecionado. O preço padrão da UG permanece inalterado."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onApply(Number(price.replace(',', '.')))}>Aplicar somente neste ciclo</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Preço padrão">
          <input className={inputClass} readOnly value={`R$ ${currentStandard.toFixed(2)}/kWh`} />
        </Field>
        <Field label="Preço do ciclo (R$/kWh)">
          <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Motivo da alteração" colSpan={2}>
          <textarea
            rows={3}
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: renegociação temporária para julho/2026"
          />
        </Field>
      </div>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
        O valor alterado será aplicado somente ao ciclo selecionado.
      </div>
    </Modal>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-left rounded-xl border p-3.5 transition-all ${active ? 'border-emerald-500 bg-emerald-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? 'text-emerald-600' : 'text-slate-500'}`} />
        <span className={`text-xs font-semibold tracking-wider ${active ? 'text-emerald-700' : 'text-slate-700'}`}>
          {title}
        </span>
      </div>
      <div className="text-[11px] text-slate-500 mt-1">{desc}</div>
    </button>
  );
}

function CoverageBadge({ months }: { months: number }) {
  if (months <= 0.25)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
        {months.toFixed(2)} mês · Baixa
      </span>
    );
  if (months > 1.5)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 tabular-nums">
        {months.toFixed(2)} mês · Elevada
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
      {months.toFixed(2)} mês · Adequada
    </span>
  );
}

function Tt({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <span title={hint} className="cursor-help">
      {children}
    </span>
  );
}
