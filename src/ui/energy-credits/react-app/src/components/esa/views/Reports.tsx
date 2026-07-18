import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LineChart, Line,
} from 'recharts';
import {
  Copy, CheckCircle2, TrendingDown, Zap, QrCode, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, SectionTitle, StatusPill, CycleBadge, Button } from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import { brl, kwh, num } from '@/lib/esa/format';

type ReportTab = 'owner' | 'internal' | 'fin';

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'owner', label: 'Relatório do Proprietário' },
  { key: 'internal', label: 'Relatório Interno ESA' },
  { key: 'fin', label: 'Relatório Financeiro ESA' },
];

export function Reports() {
  const provider = useEsaProvider();
  const months = provider.listMonths();
  const ugs = provider.listGeneratingUnits();

  const [tab, setTab] = useState<ReportTab>('owner');
  const [ugId, setUgId] = useState(() => ugs[0]?.id ?? '');
  const [month, setMonth] = useState(() => months[0]?.value ?? '');
  const [rfStatusFilter, setRfStatusFilter] = useState('all');

  return (
    <div className="max-w-[1040px] mx-auto w-full space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'text-[13px] px-3.5 py-2 rounded-lg cursor-pointer border transition-colors',
              tab === t.key
                ? 'border-[#a9e4cb] bg-[#eaf8f1] text-[#00875a] font-semibold'
                : 'border-slate-200 bg-white text-slate-500 hover:border-[#a9e4cb]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'owner' && (
        <OwnerSection ugs={ugs} months={months} ugId={ugId} month={month} setUgId={setUgId} setMonth={setMonth} />
      )}
      {tab === 'internal' && (
        <InternalSection months={months} month={month} setMonth={setMonth} />
      )}
      {tab === 'fin' && (
        <FinSection
          months={months}
          month={month}
          setMonth={setMonth}
          statusFilter={rfStatusFilter}
          setStatusFilter={setRfStatusFilter}
        />
      )}
    </div>
  );
}

function ActionBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2">{children}</div>;
}

function DisabledBtn({ children }: { children: React.ReactNode }) {
  return (
    <button disabled className="text-[11px] font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/70 text-slate-400 cursor-not-allowed">
      {children}
    </button>
  );
}

function SoftBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] font-semibold px-3 py-2 rounded-lg border border-[#a9e4cb] bg-[#eaf8f1] text-[#00875a] hover:bg-[#d3f1e3] transition-colors">
      {children}
    </button>
  );
}

function ReportDocWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.05)] overflow-hidden">
      {children}
    </div>
  );
}

function DocHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-7 py-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-emerald-50/50">
      {children}
    </div>
  );
}

function DocBody({ children }: { children: React.ReactNode }) {
  return <div className="px-7 py-5 space-y-5">{children}</div>;
}

function SecLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-6 rounded-full bg-emerald-700" />
      <h3 className="text-[11px] uppercase tracking-[.14em] text-slate-500 font-bold">{label}</h3>
    </div>
  );
}

function DocStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-slate-50/50 p-3.5">
      <div className="text-[10px] uppercase tracking-[.08em] text-slate-500 font-semibold">{label}</div>
      <div className={cn('mt-1.5 text-[18px] font-semibold tabular-nums text-[#062e20]', color)}>{value}</div>
    </div>
  );
}

function DetailRow({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-[7px] border-b border-dashed border-slate-200 text-[13px] last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={cn('text-[#062e20] font-medium text-right break-all', strong && 'font-semibold')}>{children}</span>
    </div>
  );
}

// ────────── OWNER ──────────

function OwnerSection({
  ugs, months, ugId, month, setUgId, setMonth,
}: {
  ugs: any[];
  months: any[];
  ugId: string;
  month: string;
  setUgId: (v: string) => void;
  setMonth: (v: string) => void;
}) {
  const labelClass = 'text-[10px] uppercase tracking-[.08em] text-slate-500 font-semibold';
  const selClass = 'mt-1 h-9 border border-[#cbd5e1] rounded-lg px-2.5 text-[13px] text-[#1e293b] bg-white outline-none cursor-pointer min-w-[180px]';

  return (
    <>
      <ActionBar>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Unidade Geradora</label>
          <select value={ugId} onChange={(e) => setUgId(e.target.value)} className={selClass}>
            {ugs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            {ugs.length === 0 && <option value="">Nenhuma UG cadastrada</option>}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Ciclo</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={selClass}>
            {months.map((m: any) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2 flex-wrap items-end">
          <DisabledBtn>Baixar PDF — em breve</DisabledBtn>
          <DisabledBtn>Enviar por e-mail — em breve</DisabledBtn>
          <DisabledBtn>Enviar por WhatsApp — em breve</DisabledBtn>
          <SoftBtn>Entrega manual</SoftBtn>
        </div>
      </ActionBar>
      <OwnerReportDoc ugId={ugId} month={month} />
    </>
  );
}

export function OwnerReportDoc({ ugId, month }: { ugId: string; month: string }) {
  const provider = useEsaProvider();
  const report = provider.getGeneratingUnitCreditDestinationReport(ugId, month);
  const recipient = provider.getSettlementRecipient(ugId);
  const cycleStatus = provider.getCycleStatus(month);
  const [copied, setCopied] = useState(false);

  if (!ugId) {
    return (
      <ReportDocWrap>
        <div className="py-16 text-center text-sm text-slate-400">Selecione uma Unidade Geradora.</div>
      </ReportDocWrap>
    );
  }

  if (!report) {
    return (
      <ReportDocWrap>
        <div className="py-16 text-center text-sm text-slate-400">Sem dados de apuração para este ciclo.</div>
      </ReportDocWrap>
    );
  }

  const { ug, rows } = report;
  const max = Math.max(...rows.map((r: any) => r.received), 1);

  const copyPix = () => {
    if (!recipient?.pixKey) return;
    navigator.clipboard?.writeText(recipient.pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <ReportDocWrap>
      <DocHead>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="text-[10px] uppercase tracking-[.14em] text-[#00875a] font-bold">Relatório Mensal do Proprietário</div>
            <h2 className="text-[20px] font-semibold text-[#062e20] mt-1.5 mb-0.5">{ug.name}</h2>
            <p className="text-[12px] text-slate-500 m-0">
              Ciclo {month} · {ug.distributor} · UC {ug.uc}
            </p>
          </div>
          <div className="text-right">
            <CycleBadge status={cycleStatus} />
            <div className="text-[13px] font-semibold text-[#062e20] mt-2">{ug.owner}</div>
            <div className="text-[11px] text-slate-400 tabular-nums">{ug.document}</div>
          </div>
        </div>
      </DocHead>

      <DocBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DocStat label="Geração" value={kwh(report.generation)} />
          <DocStat label="Distribuído" value={kwh(report.totalDistributed)} />
          <DocStat label="Compensado" value={kwh(report.totalCompensated)} />
          <DocStat label="Saldo nas UCs" value={kwh(report.totalAccumulatedBalance)} />
          <DocStat label="Beneficiárias" value={String(report.beneficiariesCount)} />
          <DocStat label="Preço de compra" value={`R$ ${num(ug.purchasePrice)}/kWh`} />
          <DocStat label="Repasse do mês" value={brl(report.ownerPayment)} color="text-emerald-700" />
          <DocStat label="Total consumido" value={kwh(report.totalConsumed)} />
        </div>

        <div className="space-y-2.5">
          <SecLabel label="Destino dos créditos energéticos" />
          <p className="text-[12px] text-slate-500">
            Cada crédito gerado pela sua usina foi distribuído para as Unidades Consumidoras beneficiárias abaixo.
          </p>
          <div className="space-y-1.5 py-1">
            {rows.map((r: any) => (
              <div key={r.ub.id} className="flex items-center gap-2.5">
                <div className="w-[150px] text-[12px] text-slate-700 truncate shrink-0">{r.ub.name}</div>
                <div className="flex-1 h-3.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#00bd78] to-[#00875a]"
                    style={{ width: `${(r.received / max) * 100}%` }}
                  />
                </div>
                <div className="w-14 text-right text-[12px] font-semibold text-[#062e20] tabular-nums shrink-0">
                  {(r.allocationPct * 100).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-[10px] border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px] min-w-[860px]">
                <thead>
                  <tr>
                    {['Beneficiária', 'UC / Distribuidora', '% Rateio', 'Créditos recebidos', 'Consumo', 'Compensado', 'Saldo anterior', 'Saldo final', 'Cobertura'].map((h, i) => (
                      <th key={h} className={cn('py-[9px] px-3 text-[10px] uppercase tracking-[.06em] text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap', i >= 2 && 'text-right')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.ub.id} className="hover:bg-emerald-50/40 cursor-pointer">
                      <td className="py-2.5 px-3 font-semibold text-[#062e20] whitespace-nowrap">{r.ub.name}</td>
                      <td className="py-2.5 px-3 text-slate-500 tabular-nums whitespace-nowrap">{r.ub.uc} · {r.ub.distributor}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#062e20] whitespace-nowrap">{(r.allocationPct * 100).toFixed(2)}%</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#00875a] whitespace-nowrap">{kwh(r.received)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{kwh(r.consumption)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{kwh(r.compensated)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-500 whitespace-nowrap">{kwh(r.previousBalance)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{kwh(r.finalBalance)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {r.coverageMonths.toFixed(2)} mês
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[12px] text-slate-400">Sem beneficiárias vinculadas a este ciclo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Distribuição conforme o contrato oficial — os cálculos de rateio não são refeitos neste relatório.
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3.5">
          <div className="rounded-[10px] border border-slate-200 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              <div className="text-[11px] uppercase tracking-[.08em] font-bold text-[#00875a]">Recebedor do pagamento</div>
              {recipient && recipient.recipientName !== ug.owner && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">RECEBEDOR ≠ PROPRIETÁRIO</span>
              )}
            </div>
            <div className="px-3.5 py-2 pb-3">
              {recipient ? (
                <>
                  <DetailRow label="Nome">{recipient.recipientName}</DetailRow>
                  <DetailRow label="CPF/CNPJ">{recipient.recipientDocument}</DetailRow>
                  <DetailRow label="Tipo da chave PIX">{recipient.pixKeyType?.toUpperCase()}</DetailRow>
                  <DetailRow label="Chave PIX">{recipient.pixKey}</DetailRow>
                  <div className="pt-2 space-y-2">
                    <button onClick={copyPix} className="inline-flex items-center gap-1.5 rounded-lg text-[12px] font-semibold px-3.5 py-2 border border-[#a9e4cb] bg-[#eaf8f1] text-[#00875a] hover:bg-[#d3f1e3] transition-colors">
                      {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar chave PIX</>}
                    </button>
                    <div className="text-[11px] text-slate-400 leading-relaxed">O PIX refere-se exclusivamente ao pagamento do repasse ao proprietário.</div>
                  </div>
                </>
              ) : (
                <div className="py-4 text-[12px] text-slate-400 text-center">Sem recebedor cadastrado.</div>
              )}
            </div>
          </div>

          <div className="rounded-[10px] border border-slate-200 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-2">
              <div className="flex-1 text-[11px] uppercase tracking-[.08em] font-bold text-[#00875a]">Repasse do ciclo</div>
              <CycleBadge status={cycleStatus} />
            </div>
            <div className="px-3.5 py-2 pb-3">
              <DetailRow label="Geração">{kwh(report.generation)}</DetailRow>
              <DetailRow label="Preço de compra">R$ {num(ug.purchasePrice)}/kWh</DetailRow>
              <DetailRow label="Créditos compensados">{kwh(report.totalCompensated)}</DetailRow>
              <DetailRow label="Repasse total" strong>{brl(report.ownerPayment)}</DetailRow>
              <div className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Valores retornados pela apuração do ciclo — o relatório não recalcula o repasse.
              </div>
            </div>
          </div>
        </div>
      </DocBody>
    </ReportDocWrap>
  );
}

// ────────── INTERNAL ──────────

function InternalSection({ months, month, setMonth }: { months: any[]; month: string; setMonth: (v: string) => void }) {
  const provider = useEsaProvider();
  const cycleStatus = provider.getCycleStatus(month);
  const labelClass = 'text-[10px] uppercase tracking-[.08em] text-slate-500 font-semibold';
  const selClass = 'mt-1 h-9 border border-[#cbd5e1] rounded-lg px-2.5 text-[13px] text-[#1e293b] bg-white outline-none cursor-pointer min-w-[180px]';

  return (
    <>
      <ActionBar>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Mês</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={selClass}>
            {months.map((m: any) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2 pb-[3px]">
          <span className={labelClass}>Status do ciclo</span>
          <CycleBadge status={cycleStatus} />
        </div>
        <div className="flex-1" />
        <div className="flex gap-2 flex-wrap items-end">
          <DisabledBtn>Baixar PDF — em breve</DisabledBtn>
          <DisabledBtn>Enviar por e-mail — em breve</DisabledBtn>
          <SoftBtn>Entrega manual</SoftBtn>
        </div>
      </ActionBar>
      <InternalReportDoc month={month} />
    </>
  );
}

function InternalReportDoc({ month }: { month: string }) {
  const provider = useEsaProvider();
  const ugs = provider.listGeneratingUnits();
  const ubs = provider.listBeneficiaryUnits();
  const months = provider.listMonths();
  const summary = provider.getFinancialSummary({ month });
  const alerts = provider.getAlertsSummary({ month });
  const results = provider.computeAll();
  const cycleStatus = provider.getCycleStatus(month);

  const generation = results.reduce((s, r) => s + r.generation, 0);
  const compensated = results.reduce((s, r) => s + r.totalCompensated, 0);
  const balance = results.reduce((s, r) => s + r.currentBalance, 0);

  const criticalCount = alerts.filter((a) => a.severity === 'critico').length;
  const riscoCount = alerts.filter((a) => a.severity === 'risco').length;
  const atencaoCount = alerts.filter((a) => a.severity === 'atencao').length;
  const infoCount = alerts.filter((a) => a.severity === 'info').length;

  const lateCount = ubs.filter((u) => u.paymentStatus === 'vencido').length;
  const openCount = ubs.filter((u) => u.paymentStatus === 'aberto').length;

  const closedMonths = months.filter((m) => m.status === 'fechado').length;
  const apuracaoMonths = months.filter((m) => m.status === 'em_apuracao').length;
  const abertoMonths = months.filter((m) => m.status === 'aberto').length;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (k: string) => setOpenSections((prev) => ({ ...prev, [k]: !prev[k] }));

  const spreadPct = (summary?.revenue ?? 0) > 0
    ? (((summary?.spread ?? 0) / (summary?.revenue ?? 1)) * 100).toFixed(1)
    : '0.0';

  return (
    <ReportDocWrap>
      <DocHead>
        <div className="text-[10px] uppercase tracking-[.14em] text-[#00875a] font-bold">Relatório Interno ESA</div>
        <h2 className="text-[20px] font-semibold text-[#062e20] mt-1.5 mb-0.5">Resumo operacional, financeiro, alertas e pendências</h2>
        <p className="text-[12px] text-slate-500">Documento interno — códigos técnicos exibidos de forma discreta. A memória de cálculo não é exposta.</p>
      </DocHead>

      <DocBody>
        <div className="space-y-2.5">
          <SecLabel label="Operação energética" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <DocStat label="UGs ativas" value={ugs.filter((u) => u.status === 'ativa').length} />
            <DocStat label="UBs ativas" value={ubs.filter((u) => u.status === 'ativa').length} />
            <DocStat label="Geração total" value={kwh(generation)} />
            <DocStat label="Compensado total" value={kwh(compensated)} />
            <DocStat label="Saldo total" value={kwh(balance)} />
            <DocStat label="Status do ciclo" value={cycleStatus === 'fechado' ? 'Fechado' : cycleStatus === 'em_apuracao' ? 'Em apuração' : 'Aberto'} />
          </div>
        </div>

        <div className="space-y-2.5">
          <SecLabel label="Financeiro" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DocStat label="Receita ESA" value={brl(summary?.revenue ?? 0)} color="text-emerald-700" />
            <DocStat label="Repasses" value={brl(summary?.ownerPayment ?? 0)} color="text-rose-600" />
            <DocStat label="Spread bruto" value={brl(summary?.spread ?? 0)} color="text-emerald-700" />
            <DocStat label="Margem" value={`${spreadPct}%`} />
            <DocStat label="Economia clientes" value={brl(summary?.savings ?? 0)} />
            <DocStat label="Faturado total" value={brl(results.reduce((s, r) => s + r.esaRevenue, 0))} />
            <DocStat label="Faturas em aberto" value={openCount} />
            <DocStat label="Faturas vencidas" value={lateCount} color={lateCount > 0 ? 'text-rose-600' : undefined} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3.5">
          <div className="space-y-2.5">
            <SecLabel label="Status dos ciclos" />
            <div className="grid grid-cols-2 gap-2.5">
              <DocStat label="Total de meses" value={months.length} />
              <DocStat label="Fechados" value={closedMonths} />
              <DocStat label="Em apuração" value={apuracaoMonths} />
              <DocStat label="Abertos" value={abertoMonths} />
            </div>
          </div>
          <div className="space-y-2.5">
            <SecLabel label="Alertas do ciclo" />
            <div className="grid grid-cols-2 gap-2.5">
              <DocStat label="Críticos" value={criticalCount} color={criticalCount > 0 ? 'text-rose-600' : undefined} />
              <DocStat label="Risco" value={riscoCount} color={riscoCount > 0 ? 'text-amber-600' : undefined} />
              <DocStat label="Atenção" value={atencaoCount} />
              <DocStat label="Informação" value={infoCount} />
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <SecLabel label="Pendências operacionais" />
          <div className="rounded-[10px] border border-slate-200 bg-slate-50/50 px-3.5 py-2">
            <DetailRow label="Faturas vencidas">{lateCount}</DetailRow>
            <DetailRow label="Faturas em aberto">{openCount}</DetailRow>
            <DetailRow label="Alertas críticos">{criticalCount}</DetailRow>
            <DetailRow label="UGs em manutenção">{ugs.filter((u) => u.status === 'manutencao').length}</DetailRow>
            <DetailRow label="UBs inativas">{ubs.filter((u) => u.status === 'inativa').length}</DetailRow>
            <DetailRow label="Alertas de risco">{riscoCount}</DetailRow>
          </div>
        </div>

        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.ug.id} className="rounded-[10px] border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleSection(r.ug.id)}
                className="flex items-center gap-2 w-full border-none bg-slate-50/50 cursor-pointer px-3.5 py-[11px] text-left hover:bg-emerald-50/40 transition-colors"
              >
                <span className="text-[12px] text-[#00875a] font-bold">
                  {openSections[r.ug.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <span className="flex-1 text-[11px] uppercase tracking-[.08em] font-bold text-[#00875a]">{r.ug.name}</span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {kwh(r.generation)} · {brl(r.esaRevenue)}
                </span>
              </button>
              {openSections[r.ug.id] && (
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full border-collapse text-[12px] min-w-[640px]">
                    <thead>
                      <tr>
                        {['Beneficiária', 'Consumo', 'Compensado', 'Saldo', 'Fatura ESA', 'Status'].map((h) => (
                          <th key={h} className="py-2 px-3 text-[10px] uppercase tracking-[.06em] text-slate-500 font-semibold border-b border-slate-200 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.rows.map((row) => (
                        <tr key={row.ub.id} className="hover:bg-slate-50/70">
                          <td className="py-[9px] px-3 font-medium text-[#062e20] whitespace-nowrap">{row.ub.name}</td>
                          <td className="py-[9px] px-3 tabular-nums whitespace-nowrap">{kwh(row.ub.monthlyConsumption)}</td>
                          <td className="py-[9px] px-3 tabular-nums whitespace-nowrap">{kwh(row.compensated)}</td>
                          <td className="py-[9px] px-3 tabular-nums whitespace-nowrap">{kwh(row.ub.previousCreditBalance)}</td>
                          <td className="py-[9px] px-3 tabular-nums font-medium whitespace-nowrap">{brl(row.faturaEsa)}</td>
                          <td className="py-[9px] px-3 whitespace-nowrap">
                            <StatusPill status={row.ub.paymentStatus} />
                          </td>
                        </tr>
                      ))}
                      {r.rows.length === 0 && (
                        <tr><td colSpan={6} className="py-6 text-center text-[12px] text-slate-400">Sem beneficiárias neste ciclo.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <div className="rounded-[10px] border border-slate-200 py-10 text-center text-[12px] text-slate-400">
              Sem dados de apuração para este ciclo.
            </div>
          )}
        </div>
      </DocBody>
    </ReportDocWrap>
  );
}

// ────────── FINANCIAL REPORT ──────────

const RF_STATUS_OPTS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'pago', label: 'Pagos' },
  { value: 'aberto', label: 'Em aberto' },
  { value: 'vencido', label: 'Vencidos' },
];

function FinSection({
  months, month, setMonth, statusFilter, setStatusFilter,
}: {
  months: any[];
  month: string;
  setMonth: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}) {
  const labelClass = 'text-[10px] uppercase tracking-[.08em] text-slate-500 font-semibold';
  const selClass = 'mt-1 h-9 border border-[#cbd5e1] rounded-lg px-2.5 text-[13px] text-[#1e293b] bg-white outline-none cursor-pointer min-w-[180px]';

  return (
    <>
      <ActionBar>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Mês</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={selClass}>
            {months.map((m: any) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Status de pagamento</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selClass}>
            {RF_STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2 flex-wrap items-end">
          <DisabledBtn>Baixar PDF — em breve</DisabledBtn>
          <DisabledBtn>Enviar por e-mail — em breve</DisabledBtn>
          <SoftBtn>Entrega manual</SoftBtn>
        </div>
      </ActionBar>
      <FinancialReportDoc month={month} statusFilter={statusFilter} />
    </>
  );
}

function FinancialReportDoc({ month, statusFilter }: { month: string; statusFilter: string }) {
  const provider = useEsaProvider();
  const ubs = provider.listBeneficiaryUnits();
  const summary = provider.getFinancialSummary({ month });
  const trend = provider.getMonthlyTrend({});
  const results = provider.computeAll();

  const invoiceByUbId = useMemo(
    () => new Map(results.flatMap((r) => r.rows.map((row) => [row.ub.id, row.faturaEsa] as const))),
    [results],
  );

  const pagoTotal = ubs.filter((u) => u.paymentStatus === 'pago').reduce((s, u) => s + (invoiceByUbId.get(u.id) ?? 0), 0);
  const abertoTotal = ubs.filter((u) => u.paymentStatus === 'aberto').reduce((s, u) => s + (invoiceByUbId.get(u.id) ?? 0), 0);
  const vencidoTotal = ubs.filter((u) => u.paymentStatus === 'vencido').reduce((s, u) => s + (invoiceByUbId.get(u.id) ?? 0), 0);
  const totalFaturado = pagoTotal + abertoTotal + vencidoTotal;

  const spreadPct = (summary?.revenue ?? 0) > 0
    ? (((summary?.spread ?? 0) / (summary?.revenue ?? 1)) * 100).toFixed(1)
    : '0.0';

  const trendData = trend.map((r) => ({ m: r.label, Receita: r.Receita, Repasse: r.Repasse }));
  const spreadData = trend.map((r) => ({ m: r.label, Spread: r.Receita - r.Repasse }));

  const maxFat = Math.max(pagoTotal, abertoTotal, vencidoTotal, 1);

  const filteredUbs = statusFilter === 'all' ? ubs : ubs.filter((u) => u.paymentStatus === statusFilter);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ faturas: false, repasses: false });
  const toggle = (k: string) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));

  const recon: { label: string; value: string }[] = [
    { label: 'Receita ESA', value: brl(summary?.revenue ?? 0) },
    { label: 'Repasses aos proprietários', value: brl(summary?.ownerPayment ?? 0) },
    { label: 'Spread bruto', value: brl(summary?.spread ?? 0) },
    { label: `Margem bruta`, value: `${spreadPct}%` },
    { label: 'Total faturado', value: brl(totalFaturado) },
    { label: 'Recebido', value: brl(pagoTotal) },
    { label: 'Em aberto', value: brl(abertoTotal) },
    { label: 'Vencido', value: brl(vencidoTotal) },
  ];

  return (
    <ReportDocWrap>
      <DocHead>
        <div className="text-[10px] uppercase tracking-[.14em] text-[#00875a] font-bold">Relatório Financeiro ESA</div>
        <h2 className="text-[20px] font-semibold text-[#062e20] mt-1.5 mb-0.5">Receita, repasses, spread e inadimplência</h2>
        <p className="text-[12px] text-slate-500">
          Consolidação mensal — valores retornados pelos controles financeiros. invoiceAmount permanece separado de billingSnapshot.contaEsa.
        </p>
      </DocHead>

      <DocBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DocStat label="Receita ESA" value={brl(summary?.revenue ?? 0)} color="text-emerald-700" />
          <DocStat label="Repasses proprietários" value={brl(summary?.ownerPayment ?? 0)} color="text-rose-600" />
          <DocStat label="Spread bruto" value={brl(summary?.spread ?? 0)} color="text-emerald-700" />
          <DocStat label="Margem bruta" value={`${spreadPct}%`} />
          <DocStat label="Faturado total" value={brl(totalFaturado)} />
          <DocStat label="Recebido" value={brl(pagoTotal)} color="text-emerald-700" />
          <DocStat label="Valor em aberto" value={brl(abertoTotal)} color={abertoTotal > 0 ? 'text-amber-600' : undefined} />
          <DocStat label="Valor vencido" value={brl(vencidoTotal)} color={vencidoTotal > 0 ? 'text-rose-600' : undefined} />
        </div>

        <div className="grid md:grid-cols-3 gap-3.5">
          <div className="rounded-[10px] border border-slate-200 p-4">
            <h3 className="text-[12px] font-semibold text-[#062e20] m-0 mb-0.5">Receita × Repasse</h3>
            <p className="text-[10px] text-slate-400 m-0 mb-2">Histórico — sem projeções</p>
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid stroke="#eef2ef" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="Receita" name="Receita ESA" fill="#00a86b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Repasse" name="Repasses" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-3.5 mt-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#00a86b]" />Receita ESA</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" />Repasses</span>
            </div>
          </div>
          <div className="rounded-[10px] border border-slate-200 p-4">
            <h3 className="text-[12px] font-semibold text-[#062e20] m-0 mb-0.5">Spread mensal</h3>
            <p className="text-[10px] text-slate-400 m-0 mb-2">Ciclos apurados</p>
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spreadData}>
                  <CartesianGrid stroke="#eef2ef" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="Spread" stroke="#00a86b" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-[10px] border border-slate-200 p-4">
            <h3 className="text-[12px] font-semibold text-[#062e20] m-0 mb-2.5">Recebimento por status</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Pago', value: pagoTotal, color: '#00a86b' },
                { label: 'Em aberto', value: abertoTotal, color: '#f59e0b' },
                { label: 'Vencido', value: vencidoTotal, color: '#e11d48' },
              ].map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>{b.label}</span>
                    <span className="font-semibold text-[#062e20] tabular-nums">{brl(b.value)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ background: b.color, width: `${(b.value / maxFat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: 'faturas', title: 'Faturas ESA' },
            { key: 'repasses', title: 'Relatórios de repasse' },
          ].map((sec) => (
            <div key={sec.key} className="rounded-[10px] border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggle(sec.key)}
                className="flex items-center gap-2 w-full border-none bg-slate-50/50 cursor-pointer px-3.5 py-[11px] text-left hover:bg-emerald-50/40 transition-colors"
              >
                <span className="text-[12px] text-[#00875a] font-bold">
                  {openSections[sec.key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <span className="flex-1 text-[11px] uppercase tracking-[.08em] font-bold text-[#00875a]">{sec.title}</span>
              </button>
              {openSections[sec.key] && sec.key === 'faturas' && (
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full border-collapse text-[12px] min-w-[720px]">
                    <thead>
                      <tr>
                        {['Beneficiária', 'UC', 'Mês', 'Fatura ESA', 'Status'].map((h, i) => (
                          <th key={h} className={cn('py-2 px-3 text-[10px] uppercase tracking-[.06em] text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap', i === 3 && 'text-right')}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUbs.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/70">
                          <td className="py-[9px] px-3 font-semibold text-[#062e20] whitespace-nowrap">{u.name}</td>
                          <td className="py-[9px] px-3 text-slate-500 tabular-nums whitespace-nowrap">{u.uc}</td>
                          <td className="py-[9px] px-3 text-slate-700 whitespace-nowrap">{month}</td>
                          <td className="py-[9px] px-3 text-right tabular-nums font-semibold text-[#062e20] whitespace-nowrap">{brl(invoiceByUbId.get(u.id) ?? 0)}</td>
                          <td className="py-[9px] px-3 whitespace-nowrap"><StatusPill status={u.paymentStatus} /></td>
                        </tr>
                      ))}
                      {filteredUbs.length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-[12px] text-slate-400">Nenhuma fatura para os filtros selecionados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {openSections[sec.key] && sec.key === 'repasses' && (
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full border-collapse text-[12px] min-w-[640px]">
                    <thead>
                      <tr>
                        {['Unidade Geradora', 'Proprietário', 'Mês', 'Créditos compensados', 'Valor do repasse'].map((h, i) => (
                          <th key={h} className={cn('py-2 px-3 text-[10px] uppercase tracking-[.06em] text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap', i >= 3 && 'text-right')}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.ug.id} className="hover:bg-slate-50/70">
                          <td className="py-[9px] px-3 font-semibold text-[#062e20] whitespace-nowrap">{r.ug.name}</td>
                          <td className="py-[9px] px-3 text-slate-700 whitespace-nowrap">{r.ug.owner}</td>
                          <td className="py-[9px] px-3 text-slate-700 whitespace-nowrap">{month}</td>
                          <td className="py-[9px] px-3 text-right tabular-nums text-[#00875a] whitespace-nowrap">{kwh(r.totalCompensated)}</td>
                          <td className="py-[9px] px-3 text-right tabular-nums font-semibold text-rose-600 whitespace-nowrap">{brl(r.ownerPayment)}</td>
                        </tr>
                      ))}
                      {results.length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-[12px] text-slate-400">Sem repasses para este ciclo.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2.5">
          <SecLabel label="Conciliação financeira" />
          <div className="rounded-[10px] border border-slate-200 bg-slate-50/50 px-3.5 py-2">
            {recon.map((row) => (
              <DetailRow key={row.label} label={row.label} strong={row.label === 'Spread bruto'}>
                {row.value}
              </DetailRow>
            ))}
          </div>
          <div className="text-[11px] text-slate-400">
            Valores retornados pelos controles financeiros do ESA OS — nenhum cálculo é refeito neste relatório.
          </div>
        </div>
      </DocBody>
    </ReportDocWrap>
  );
}

// ────────── FATURA ESA (exportada para uso em Financial) ──────────

export function BeneficiaryInvoicePreview({ ubId, month }: { ubId: string; month: string }) {
  const provider = useEsaProvider();
  const [copied, setCopied] = useState(false);
  const data = provider.getBeneficiaryInvoice(ubId, month);
  if (!data) return (
    <div className="py-16 text-center text-sm text-slate-400">Sem dados de fatura para este beneficiário e ciclo.</div>
  );

  const { raw, billingSnapshot, creditBalance, settlementRecipient, beneficiarySavingsHistory } = data;
  const ub = raw.ub;
  const ug = raw.ug;

  const copy = () => {
    navigator.clipboard?.writeText(settlementRecipient.pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const positiveAdj = (creditBalance as any).positiveAdjustmentsKwh ?? 0;
  const negativeAdj = (creditBalance as any).negativeAdjustmentsKwh ?? 0;

  return (
    <div className="bg-gradient-to-b from-emerald-50/40 to-white">
      <div className="px-6 pt-6 pb-4 border-b border-emerald-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 grid place-items-center shadow-sm shadow-emerald-300/60">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold">ESA Energia</div>
              <div className="text-xl font-semibold text-slate-900 leading-tight">Fatura de Energia</div>
              <div className="text-xs text-slate-500 mt-0.5">Mês de referência: <strong>{raw.month}</strong> · Documento {raw.docNumber}</div>
            </div>
          </div>
          <StatusPill status={ub.paymentStatus} />
        </div>
      </div>

      <div className="px-6 py-4 grid md:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
        <FatRow label="Beneficiário">{ub.name}</FatRow>
        <FatRow label="Documento">{ub.document}</FatRow>
        <FatRow label="Unidade Consumidora (UC)">{ub.uc}</FatRow>
        <FatRow label="Distribuidora">{ub.distributor}</FatRow>
        <FatRow label="Unidade Geradora vinculada">{ug.name}</FatRow>
        <FatRow label="Cliente ESA desde">{raw.customerSince}</FatRow>
      </div>

      <div className="px-6 pb-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-5 shadow-lg shadow-emerald-200/60">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-100 font-semibold">Valor da Fatura ESA</div>
              <div className="text-4xl font-semibold mt-1 tabular-nums">{brl(raw.faturaEsa)}</div>
              <div className="text-xs text-emerald-100 mt-1">Vencimento: <strong>{raw.dueDate}</strong></div>
              <div className="text-[11px] text-emerald-100/80 mt-2 max-w-xs">Este é o valor efetivamente cobrado pela ESA. Pague via PIX usando os dados do recebedor ao lado.</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3.5 border border-white/20">
              <div className="text-[11px] uppercase tracking-wider text-emerald-100 font-semibold flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5" /> Recebedor do pagamento
              </div>
              <div className="mt-2 text-xs space-y-0.5">
                <div><span className="text-emerald-100">Nome:</span> <strong>{settlementRecipient.recipientName}</strong></div>
                <div><span className="text-emerald-100">CPF/CNPJ:</span> {settlementRecipient.recipientDocument}</div>
                <div><span className="text-emerald-100">Tipo da chave PIX:</span> {settlementRecipient.pixKeyType?.toUpperCase()}</div>
                <div className="break-all"><span className="text-emerald-100">Chave PIX:</span> <strong>{settlementRecipient.pixKey}</strong></div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs bg-white text-emerald-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                  {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar chave PIX</>}
                </button>
                <span className="text-[10px] text-emerald-100/80">QR Code PIX — em breve</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Movimentação de créditos</div>
        <div className="flex flex-wrap items-stretch gap-2">
          <EnergyBlock label="Saldo anterior" value={kwh(creditBalance.previousBalanceKwh)} />
          <EnergyOp op="+" />
          <EnergyBlock label="Recebidos" value={kwh(creditBalance.creditsReceivedKwh)} tone="accent" />
          {positiveAdj > 0 && <><EnergyOp op="+" /><EnergyBlock label="Ajustes positivos" value={kwh(positiveAdj)} tone="accent" /></>}
          <EnergyOp op="−" />
          <EnergyBlock label="Compensados" value={kwh(creditBalance.creditsCompensatedKwh)} tone="negative" />
          {negativeAdj > 0 && <><EnergyOp op="−" /><EnergyBlock label="Ajustes negativos" value={kwh(negativeAdj)} tone="negative" /></>}
          <EnergyOp op="=" />
          <EnergyBlock label="Saldo de créditos na UC" value={kwh(creditBalance.currentBalanceKwh)} tone="positive" strong />
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Consumo total da UC neste mês: <strong className="text-slate-700">{kwh(raw.consumption)}</strong> · Cobertura do saldo: <strong className="text-slate-700">{creditBalance.coverageMonths.toFixed(2)} mês</strong>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompareCard label="CUSTO TOTAL SEM ESA" value={brl(billingSnapshot.contaConcessionaria)} tone="neutral" />
        <CompareCard label="CUSTO TOTAL COM ESA" value={brl(billingSnapshot.contaEsa)} tone="accent" tooltip="Representa o custo total da operação no cenário ESA. Este valor pode incluir componentes que permanecem na distribuidora e não é o valor cobrado via PIX." />
        <CompareCard label="ECONOMIA NO MÊS" value={brl(billingSnapshot.economiaMensal)} tone="positive" />
        <CompareCard label="DESCONTO RECEBIDO" value={`${billingSnapshot.economiaPercentual.toFixed(2)}%`} tone="positive" strong />
      </div>

      <div className="px-6 py-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Composição da sua conta</div>
          {(billingSnapshot.componentesTarifarios as any[]).map((c) => <FatRow key={c.label} label={c.label}>{brl(c.value)}</FatRow>)}
          <FatRow label="Custo total com ESA" strong>{brl(billingSnapshot.contaEsa)}</FatRow>
          <div className="mt-1 text-[10px] text-slate-400">Valores exibidos exatamente conforme retornados pelo billingSnapshot oficial — sem recálculo na interface.</div>
        </Card>
      </div>

      <div className="px-6 py-4">
        <div className="rounded-2xl bg-white border border-emerald-200 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" /> Sua economia com a ESA
              </div>
              <div className="mt-1">
                <div className="text-xs text-slate-500">Economia no mês</div>
                <div className="text-2xl font-semibold text-emerald-700 tabular-nums">{brl(billingSnapshot.economiaMensal)}</div>
              </div>
              <div className="mt-2">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Economia acumulada</div>
                <div className="text-3xl font-semibold text-slate-900 tabular-nums">{brl(raw.accumulatedSavings)}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Cliente desde {raw.customerSince} · {raw.monthsAsCustomer} meses como cliente</div>
              </div>
            </div>
            <div className="h-32 w-full md:w-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={beneficiarySavingsHistory}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="accumulatedSavings" stroke="#059669" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-600 italic border-t border-slate-100 pt-3">
            "Desde que entrou para a ESA Energia, sua unidade já economizou <strong>{brl(raw.accumulatedSavings)}</strong> em energia."
          </div>
        </div>
      </div>

      <div className="px-6 py-3 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
        <span>Documento {raw.docNumber}</span>
        <span>Fonte do cálculo: {billingSnapshot.calculationSource}</span>
      </div>
    </div>
  );
}

function EnergyBlock({ label, value, tone, strong }: { label: string; value: string; tone?: 'accent' | 'positive' | 'negative'; strong?: boolean }) {
  const toneMap = { accent: 'text-emerald-600', positive: 'text-emerald-700', negative: 'text-slate-700' } as const;
  return (
    <div className={`rounded-lg border ${strong ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'} p-2.5`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums mt-0.5', tone ? toneMap[tone] : 'text-slate-900')}>{value}</div>
    </div>
  );
}

function EnergyOp({ op }: { op: string }) {
  return <div className="hidden md:grid place-items-center text-lg font-semibold text-slate-400">{op}</div>;
}

function CompareCard({ label, value, tone, strong, tooltip }: { label: string; value: string; tone: 'neutral' | 'accent' | 'positive'; strong?: boolean; tooltip?: string }) {
  const styleMap = { neutral: 'bg-white border-slate-200 text-slate-700', accent: 'bg-emerald-50 border-emerald-200 text-emerald-800', positive: 'bg-emerald-600 border-emerald-700 text-white' } as const;
  return (
    <div className={`rounded-xl border p-4 ${styleMap[tone]}`} title={tooltip}>
      <div className={cn('text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1', tone === 'positive' ? 'text-emerald-50' : 'text-slate-500')}>
        {label}
        {tooltip && <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current text-[9px] font-bold opacity-70 cursor-help" aria-label={tooltip}>?</span>}
      </div>
      <div className={cn('mt-1 tabular-nums font-semibold', strong ? 'text-2xl' : 'text-xl')}>{value}</div>
    </div>
  );
}

function FatRow({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={cn('tabular-nums', strong ? 'text-emerald-700 font-semibold' : 'text-slate-800')}>{children}</span>
    </div>
  );
}
