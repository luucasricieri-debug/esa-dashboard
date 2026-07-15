import { useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, LineChart, Line,
} from 'recharts';
import {
  FileText, Eye, Download, Mail, MessageCircle, X, Sun, Building2,
  Building, Wallet, Copy, QrCode, Zap, TrendingDown, CheckCircle2,
} from 'lucide-react';
import { Card, SectionTitle, Button, Badge, StatusPill } from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import { brl, kwh, num } from '@/lib/esa/format';

const REPORT_DEFS = [
  { key: 'owner', title: 'Relatório Mensal do Proprietário', desc: 'Geração, destino dos créditos por UC beneficiária e repasse.', icon: Sun, scope: 'ug' },
  { key: 'benef', title: 'Fatura ESA — Beneficiário', desc: 'Fatura premium: créditos, economia real e PIX de pagamento.', icon: Building2, scope: 'ub' },
  { key: 'internal', title: 'Relatório Interno ESA', desc: 'Resumo operacional, financeiro, alertas e pendências.', icon: Building, scope: 'none' },
  { key: 'fin', title: 'Relatório Financeiro ESA', desc: 'Receita, repasses, spread e inadimplência.', icon: Wallet, scope: 'none' },
] as const;

type ReportKey = 'owner' | 'benef' | 'internal' | 'fin';

export function Reports() {
  const [preview, setPreview] = useState<null | { key: ReportKey; ref: string; month: string }>(null);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {REPORT_DEFS.map((r) => (
          <ReportCard key={r.key} report={r} onPreview={(ref, month) => setPreview({ key: r.key as ReportKey, ref, month })} />
        ))}
      </div>
      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function ReportCard({
  report,
  onPreview,
}: {
  report: (typeof REPORT_DEFS)[number];
  onPreview: (ref: string, month: string) => void;
}) {
  const provider = useEsaProvider();
  const ugs = provider.listGeneratingUnits();
  const ubs = provider.listBeneficiaryUnits();
  const months = provider.listMonths();
  const Icon = report.icon;
  const [month, setMonth] = useState(months[0]?.value ?? '2026-07');
  const [ref, setRef] = useState(
    report.scope === 'ug' ? (ugs[0]?.id ?? '')
    : report.scope === 'ub' ? (ubs[0]?.id ?? '')
    : '',
  );

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white grid place-items-center shadow-sm shadow-emerald-200">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{report.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{report.desc}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Mês</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500">
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        {report.scope !== 'none' && (
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{report.scope === 'ug' ? 'UG' : 'UB'}</label>
            <select value={ref} onChange={(e) => setRef(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500">
              {(report.scope === 'ug' ? ugs : ubs).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => onPreview(ref, month)}><Eye className="h-4 w-4" /> Visualizar</Button>
        <Button variant="outline" disabled><Download className="h-4 w-4" /> PDF<Badge tone="slate">em breve</Badge></Button>
        <Button variant="outline" disabled><Mail className="h-4 w-4" /> E-mail<Badge tone="slate">em breve</Badge></Button>
        <Button variant="outline" disabled><MessageCircle className="h-4 w-4" /> WhatsApp<Badge tone="slate">em breve</Badge></Button>
      </div>
    </Card>
  );
}

function PreviewModal({ preview, onClose }: { preview: { key: ReportKey; ref: string; month: string }; onClose: () => void }) {
  const wide = preview.key === 'benef' || preview.key === 'owner';
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 grid place-items-center p-4">
      <Card className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] overflow-auto relative`}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Preview</h3>
              <p className="text-[11px] text-slate-500">Ciclo {preview.month}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        {preview.key === 'owner' && <OwnerReport ugId={preview.ref} month={preview.month} />}
        {preview.key === 'benef' && <BeneficiaryInvoicePreview ubId={preview.ref} month={preview.month} />}
        {preview.key === 'internal' && <InternalReport month={preview.month} />}
        {preview.key === 'fin' && <FinancialReport month={preview.month} />}
      </Card>
    </div>
  );
}

const PIE_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#065f46', '#047857'];

function OwnerReport({ ugId, month }: { ugId: string; month: string }) {
  const provider = useEsaProvider();
  const report = provider.getGeneratingUnitCreditDestinationReport(ugId, month);
  if (!report) return null;
  const { ug, rows } = report;
  const pieData = rows.map((r: any) => ({ name: r.ub.name, value: r.received, pct: r.allocationPct }));

  return (
    <div className="p-6 space-y-5 bg-slate-50/40">
      <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-emerald-100 font-semibold">Relatório do Proprietário</div>
            <h2 className="text-xl font-semibold mt-1">{ug.name}</h2>
            <div className="text-xs text-emerald-100 mt-1">Proprietário: {ug.owner} · Doc: {ug.document}</div>
            <div className="text-xs text-emerald-100">Distribuidora {ug.distributor} · UC {ug.uc}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-emerald-100">Ciclo</div>
            <div className="text-lg font-semibold">{month}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Geração" value={kwh(report.generation)} />
        <MiniStat label="Distribuído" value={kwh(report.totalDistributed)} />
        <MiniStat label="Compensado" value={kwh(report.totalCompensated)} />
        <MiniStat label="Saldo nas UCs" value={kwh(report.totalAccumulatedBalance)} />
        <MiniStat label="Beneficiárias" value={String(report.beneficiariesCount)} />
        <MiniStat label="Preço de compra" value={`R$ ${num(ug.purchasePrice)}/kWh`} />
        <MiniStat label="Repasse do mês" value={brl(report.ownerPayment)} strong />
        <MiniStat label="Total consumido" value={kwh(report.totalConsumed)} />
      </div>

      <Card className="p-5">
        <SectionTitle title="Destino dos créditos energéticos" desc="Cada crédito gerado pela sua usina foi distribuído para as UCs beneficiárias abaixo." />
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {pieData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => kwh(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {pieData.map((p: any, i: number) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="truncate text-slate-700">{p.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="tabular-nums text-slate-600">{(p.pct * 100).toFixed(2)}%</span>
                  <span className="tabular-nums text-emerald-700 font-medium w-20 text-right">{kwh(p.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wider text-[10px] text-slate-500 border-y border-slate-100 bg-slate-50/60">
                <th className="py-2 px-5 font-medium">Beneficiária</th>
                <th className="py-2 font-medium">UC</th>
                <th className="py-2 font-medium">Distr.</th>
                <th className="py-2 font-medium text-right">% Rateio</th>
                <th className="py-2 font-medium text-right">Recebidos</th>
                <th className="py-2 font-medium text-right">Consumo</th>
                <th className="py-2 font-medium text-right">Compensado</th>
                <th className="py-2 font-medium text-right">Saldo ant.</th>
                <th className="py-2 font-medium text-right">Saldo final</th>
                <th className="py-2 px-5 font-medium text-right">Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r: any) => (
                <tr key={r.ub.id}>
                  <td className="py-2 px-5 font-medium text-slate-800">{r.ub.name}</td>
                  <td className="py-2 text-slate-600">{r.ub.uc}</td>
                  <td className="py-2 text-slate-600">{r.ub.distributor}</td>
                  <td className="py-2 text-right tabular-nums">{(r.allocationPct * 100).toFixed(2)}%</td>
                  <td className="py-2 text-right tabular-nums text-emerald-700 font-medium">{kwh(r.received)}</td>
                  <td className="py-2 text-right tabular-nums">{kwh(r.consumption)}</td>
                  <td className="py-2 text-right tabular-nums">{kwh(r.compensated)}</td>
                  <td className="py-2 text-right tabular-nums text-slate-500">{kwh(r.previousBalance)}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{kwh(r.finalBalance)}</td>
                  <td className="py-2 px-5 text-right tabular-nums text-slate-600">{r.coverageMonths.toFixed(2)} mês</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Recebedor do pagamento" desc="Dados PIX cadastrados para repasse desta UG" />
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <Row label="Nome do recebedor">{ug.payee.name}</Row>
          <Row label="Documento">{ug.payee.document}</Row>
          <Row label="Tipo de chave PIX">{ug.payee.pixType.toUpperCase()}</Row>
          <Row label="Chave PIX">{ug.payee.pixKey}</Row>
          <Row label="Repasse do mês" strong>{brl(report.ownerPayment)}</Row>
        </div>
      </Card>
    </div>
  );
}

function BeneficiaryInvoicePreview({ ubId, month }: { ubId: string; month: string }) {
  const provider = useEsaProvider();
  const [copied, setCopied] = useState(false);
  const data = provider.getBeneficiaryInvoice(ubId, month);
  if (!data) return null;

  const { raw, billingSnapshot, creditBalance, settlementRecipient, beneficiarySavingsHistory } = data;
  const ub = raw.ub;
  const ug = raw.ug;

  const copy = () => {
    navigator.clipboard?.writeText(settlementRecipient.pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

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
        <Row label="Beneficiário">{ub.name}</Row>
        <Row label="Documento">{ub.document}</Row>
        <Row label="Unidade Consumidora (UC)">{ub.uc}</Row>
        <Row label="Distribuidora">{ub.distributor}</Row>
        <Row label="Unidade Geradora vinculada">{ug.name}</Row>
        <Row label="Cliente ESA desde">{raw.customerSince}</Row>
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
                <div><span className="text-emerald-100">Tipo da chave PIX:</span> {settlementRecipient.pixKeyType.toUpperCase()}</div>
                <div className="break-all"><span className="text-emerald-100">Chave PIX:</span> <strong>{settlementRecipient.pixKey}</strong></div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs bg-white text-emerald-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                  {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar chave PIX</>}
                </button>
                <span className="text-[10px] text-emerald-100/80">QR Code PIX — em breve</span>
              </div>
              <div className="mt-2 text-[10px] text-emerald-100/70 italic">PIX referente ao valor da Fatura ESA.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Movimentação de créditos</div>
        {(() => {
          const positiveAdj = (creditBalance as { positiveAdjustmentsKwh?: number }).positiveAdjustmentsKwh ?? 0;
          const negativeAdj = (creditBalance as { negativeAdjustmentsKwh?: number }).negativeAdjustmentsKwh ?? 0;
          return (
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
          );
        })()}
        <div className="mt-2 text-[11px] text-slate-500">
          Consumo total da UC neste mês: <strong className="text-slate-700">{kwh(raw.consumption)}</strong> · Cobertura do saldo: <strong className="text-slate-700">{creditBalance.coverageMonths.toFixed(2)} mês</strong>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompareCard label="CUSTO TOTAL SEM ESA" value={brl(billingSnapshot.contaConcessionaria)} tone="neutral" />
        <CompareCard label="CUSTO TOTAL COM ESA" value={brl(billingSnapshot.contaEsa)} tone="accent" tooltip="Representa o custo total da operação no cenário ESA, considerando os componentes retornados pela memória oficial de cálculo. Este valor pode incluir componentes que permanecem na distribuidora e não é o valor cobrado via PIX." />
        <CompareCard label="ECONOMIA NO MÊS" value={brl(billingSnapshot.economiaMensal)} tone="positive" />
        <CompareCard label="DESCONTO RECEBIDO" value={`${billingSnapshot.economiaPercentual.toFixed(2)}%`} tone="positive" strong />
      </div>

      <div className="px-6 py-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Composição da sua conta</div>
          {(billingSnapshot.componentesTarifarios as any[]).map((c) => <Row key={c.label} label={c.label}>{brl(c.value)}</Row>)}
          <Row label="Custo total com ESA" strong>{brl(billingSnapshot.contaEsa)}</Row>
          <div className="mt-1 text-[10px] text-slate-400">Valores exibidos exatamente conforme retornados pelo billingSnapshot oficial — sem recálculo na interface.</div>
        </Card>
      </div>

      <div className="px-6 py-2">
        <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-4 text-xs text-slate-700">
          <div className="font-semibold text-emerald-800 mb-1">Como sua economia é calculada?</div>
          A ESA Energia aplica desconto <strong>apenas sobre o valor da energia compensada</strong>. Impostos, iluminação pública e demais encargos da distribuidora continuam sendo cobrados normalmente.
        </div>
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

function InternalReport({ month }: { month: string }) {
  const provider = useEsaProvider();
  const ugs = provider.listGeneratingUnits();
  const ubs = provider.listBeneficiaryUnits();
  const summary = provider.getFinancialSummary({ month });
  const alertsList = provider.getAlertsSummary({ month });
  const criticalCount = (Array.isArray(alertsList) ? alertsList : (alertsList as any)?.alerts ?? []).filter((a: any) => a.severity === 'critico').length;
  const lateCount = ubs.filter((u) => u.paymentStatus === 'vencido').length;
  return (
    <div className="p-6 space-y-3">
      <SectionTitle title="Resumo operacional" />
      <Row label="Total UGs">{ugs.length}</Row>
      <Row label="Total UBs">{ubs.length}</Row>
      <Row label="Geração total">{kwh(summary?.generation ?? 0)}</Row>
      <SectionTitle title="Resumo financeiro" />
      <Row label="Receita total">{brl(summary?.revenue ?? 0)}</Row>
      <Row label="Repasse">{brl(summary?.ownerPayment ?? 0)}</Row>
      <Row label="Spread" strong>{brl(summary?.spread ?? 0)}</Row>
      <SectionTitle title="Pendências" />
      <Row label="Faturas vencidas">{lateCount}</Row>
      <Row label="Alertas críticos">{criticalCount}</Row>
    </div>
  );
}

function FinancialReport({ month }: { month: string }) {
  const provider = useEsaProvider();
  const ubs = provider.listBeneficiaryUnits();
  const summary = provider.getFinancialSummary({ month });
  const trend = provider.getMonthlyTrend({});
  const inadimplencia = ubs.filter((u) => u.paymentStatus === 'vencido').reduce((s, u) => s + u.monthlyConsumption * u.esaPrice, 0);
  const openCount = ubs.filter((u) => u.paymentStatus === 'aberto').length;
  return (
    <div className="p-6 space-y-4">
      <SectionTitle title="Financeiro consolidado" />
      <Row label="Receita ESA">{brl(summary?.revenue ?? 0)}</Row>
      <Row label="Repasses">{brl(summary?.ownerPayment ?? 0)}</Row>
      <Row label="Spread bruto" strong>{brl(summary?.spread ?? 0)}</Row>
      <Row label="Inadimplência">{brl(inadimplencia)}</Row>
      <Row label="Faturas em aberto">{openCount}</Row>
      <div className="h-56 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend ?? []}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Bar dataKey="Receita" fill="#059669" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Repasse" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EnergyBlock({ label, value, tone, strong }: { label: string; value: string; tone?: 'accent' | 'positive' | 'negative'; strong?: boolean }) {
  const toneMap = { accent: 'text-emerald-600', positive: 'text-emerald-700', negative: 'text-slate-700' } as const;
  return (
    <div className={`rounded-lg border ${strong ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'} p-2.5`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className={`text-sm font-semibold tabular-nums mt-0.5 ${tone ? toneMap[tone] : 'text-slate-900'}`}>{value}</div>
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
      <div className={`text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1 ${tone === 'positive' ? 'text-emerald-50' : 'text-slate-500'}`}>
        {label}
        {tooltip && <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current text-[9px] font-bold opacity-70 cursor-help" aria-label={tooltip}>?</span>}
      </div>
      <div className={`mt-1 tabular-nums font-semibold ${strong ? 'text-2xl' : 'text-xl'}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className={`mt-1 tabular-nums font-semibold ${strong ? 'text-emerald-700 text-lg' : 'text-slate-900 text-sm'}`}>{value}</div>
    </div>
  );
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${strong ? 'text-emerald-700 font-semibold' : 'text-slate-800'}`}>{children}</span>
    </div>
  );
}
