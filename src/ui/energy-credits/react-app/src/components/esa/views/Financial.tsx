import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis,
  Tooltip, Line, LineChart,
} from 'recharts';
import { CheckCircle2, RotateCcw, Upload, Copy, Eye, FileText } from 'lucide-react';
import { Card, KpiCard, SectionTitle, Button, Badge, Modal, Field, inputClass } from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import type { BeneficiaryUnit } from '@/lib/esa/types';
import { brl, kwh } from '@/lib/esa/format';
import { BeneficiaryInvoicePreview } from './Reports';

interface InvoiceRow {
  id: string;
  ub: BeneficiaryUnit;
  month: string;
  value: number;
  dueDate: string;
  status: 'aberto' | 'pago' | 'vencido' | 'cancelado';
  paidAt?: string;
}

interface SettlementFinRow {
  id: string;
  ugId: string;
  ugName: string;
  owner: string;
  month: string;
  pricePerKwh: number;
  compensatedKwh: number;
  value: number;
  status: 'aberto' | 'pago' | 'cancelado';
  paidAt?: string;
}

function computeDueDate(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 15);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function Financial({ onNavigate }: { onNavigate?: (v: string) => void }) {
  const provider = useEsaProvider();
  const months = provider.listMonths();
  const ubs = provider.listBeneficiaryUnits();
  const results = provider.computeAll();

  const [selectedMonth, setSelectedMonth] = useState(() => months[0]?.value ?? '');

  const invoiceValueByUbId = useMemo(
    () => new Map(results.flatMap((r) => r.rows.map((row) => [row.ub.id, row.faturaEsa] as const))),
    [results],
  );

  const [invOverrides, setInvOverrides] = useState<Record<string, { status: InvoiceRow['status']; paidAt?: string }>>({});
  const [setOverrides, setSetOverrides] = useState<Record<string, { status: SettlementFinRow['status']; paidAt?: string }>>({});

  const invoices: InvoiceRow[] = useMemo(
    () =>
      ubs.map((u) => {
        const id = `INV-${u.id}-${selectedMonth}`;
        const override = invOverrides[id];
        const baseStatus: InvoiceRow['status'] =
          u.paymentStatus === 'pago' ? 'pago' : u.paymentStatus === 'vencido' ? 'vencido' : 'aberto';
        return {
          id,
          ub: u,
          month: selectedMonth,
          value: invoiceValueByUbId.get(u.id) ?? 0,
          dueDate: computeDueDate(selectedMonth),
          status: override?.status ?? baseStatus,
          paidAt: override?.paidAt,
        };
      }),
    [ubs, selectedMonth, invoiceValueByUbId, invOverrides],
  );

  const settlements: SettlementFinRow[] = useMemo(
    () =>
      results.map((r) => {
        const id = `SET-${r.ug.id}-${selectedMonth}`;
        const override = setOverrides[id];
        return {
          id,
          ugId: r.ug.id,
          ugName: r.ug.name,
          owner: r.ug.owner,
          month: selectedMonth,
          pricePerKwh: r.ug.purchasePrice,
          compensatedKwh: r.totalCompensated,
          value: r.ownerPayment,
          status: override?.status ?? 'aberto',
          paidAt: override?.paidAt,
        };
      }),
    [results, selectedMonth, setOverrides],
  );

  const revenue = results.reduce((s, r) => s + r.esaRevenue, 0);
  const ownerTotal = results.reduce((s, r) => s + r.ownerPayment, 0);
  const paidCount = invoices.filter((i) => i.status === 'pago').length;
  const openCount = invoices.filter((i) => i.status === 'aberto').length;
  const lateCount = invoices.filter((i) => i.status === 'vencido').length;
  const openValue = invoices.filter((i) => i.status !== 'pago').reduce((s, i) => s + i.value, 0);

  const trend = provider.getMonthlyTrend({}).map((r) => ({ m: r.label, Receita: r.Receita, Repasse: r.Repasse }));
  const spreadTrend = trend.map((t) => ({ m: t.m, Spread: t.Receita - t.Repasse }));

  const [tab, setTab] = useState<'faturas' | 'repasses'>('faturas');
  const [invModal, setInvModal] = useState<InvoiceRow | null>(null);
  const [setModal, setSetModal] = useState<SettlementFinRow | null>(null);
  const [faturaSheet, setFaturaSheet] = useState<{ ubId: string; month: string } | null>(null);
  const [pixSheet, setPixSheet] = useState<SettlementFinRow | null>(null);

  const selClass = 'h-9 border border-slate-200 rounded-lg px-2.5 text-[13px] text-[#1e293b] bg-white outline-none cursor-pointer';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[.08em] text-slate-500 font-semibold">Mês de referência</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={selClass}>
            {months.map((m: any) => <option key={m.value} value={m.value}>{m.label}</option>)}
            {months.length === 0 && <option value="">Nenhum ciclo</option>}
          </select>
        </div>
        <div className="flex-1" />
        {onNavigate && (
          <button
            onClick={() => onNavigate('relatorios')}
            className="inline-flex items-center gap-2 rounded-lg border border-[#a9e4cb] bg-[#eaf8f1] px-3.5 py-2 text-[13px] font-semibold text-[#00875a] hover:bg-[#d3f1e3] transition-colors"
          >
            <FileText className="h-4 w-4" /> Relatório do proprietário
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Receita ESA" value={brl(revenue)} tone="positive" />
        <KpiCard label="Repasses proprietários" value={brl(ownerTotal)} tone="negative" />
        <KpiCard label="Spread bruto" value={brl(revenue - ownerTotal)} tone="accent" />
        <KpiCard label="Faturas emitidas" value={String(invoices.length)} />
        <KpiCard label="Faturas pagas" value={String(paidCount)} tone="positive" />
        <KpiCard label="Em aberto" value={String(openCount)} />
        <KpiCard label="Vencidas" value={String(lateCount)} tone="negative" />
        <KpiCard label="Valor em aberto" value={brl(openValue)} tone="negative" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle title="Receita × Repasse" desc="Histórico dos ciclos apurados — sem projeções" />
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={trend}>
                <CartesianGrid stroke="#eef2ef" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="Receita" name="Receita ESA" fill="#00a86b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Repasse" name="Repasses" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3.5 mt-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#00a86b]" />Receita ESA</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" />Repasses</span>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Spread mensal" desc="Histórico dos ciclos apurados — sem projeções" />
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={spreadTrend}>
                <CartesianGrid stroke="#eef2ef" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="Spread" stroke="#00a86b" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Movimentação financeira"
          desc="Faturas ESA e repasses aos proprietários são controles distintos"
          right={
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <TabBtn active={tab === 'faturas'} onClick={() => setTab('faturas')}>Faturas ESA</TabBtn>
              <TabBtn active={tab === 'repasses'} onClick={() => setTab('repasses')}>Repasses aos proprietários</TabBtn>
            </div>
          }
        />
        {tab === 'faturas' ? (
          <InvoicesTable
            rows={invoices}
            onConfirm={(row) => setInvModal(row)}
            onReopen={(row) => {
              setInvOverrides((prev) => ({ ...prev, [row.id]: { status: 'aberto', paidAt: undefined } }));
              provider.reopenInvoicePayment(row.id);
              toast('Pagamento reaberto');
            }}
            onViewFatura={(row) => setFaturaSheet({ ubId: row.ub.id, month: row.month })}
            onViewUb={(row) => onNavigate?.('beneficiarias')}
          />
        ) : (
          <SettlementsTable
            rows={settlements}
            onConfirm={(row) => setSetModal(row)}
            onReopen={(row) => {
              setSetOverrides((prev) => ({ ...prev, [row.id]: { status: 'aberto', paidAt: undefined } }));
              toast('Repasse reaberto');
            }}
            onViewPix={(row) => setPixSheet(row)}
            onViewUg={() => onNavigate?.('unidades-geradoras')}
          />
        )}
      </Card>

      {invModal && (
        <ConfirmInvoicePayment
          invoice={invModal}
          onClose={() => setInvModal(null)}
          onConfirm={(paidAt) => {
            provider.confirmInvoicePayment(invModal.id, { paidAt, amount: invModal.value });
            setInvOverrides((prev) => ({ ...prev, [invModal.id]: { status: 'pago', paidAt } }));
            toast.success('Pagamento confirmado.');
            setInvModal(null);
          }}
        />
      )}

      {setModal && (
        <ConfirmSettlementPayment
          settlement={setModal}
          onClose={() => setSetModal(null)}
          onConfirm={(paidAt) => {
            provider.confirmOwnerSettlementPayment(setModal.id, { paidAt, amount: setModal.value });
            setSetOverrides((prev) => ({ ...prev, [setModal.id]: { status: 'pago', paidAt } }));
            toast.success('Repasse confirmado.');
            setSetModal(null);
          }}
        />
      )}

      {faturaSheet && (
        <Modal
          open
          onClose={() => setFaturaSheet(null)}
          title="Fatura ESA — Beneficiário"
          desc=""
          footer={<Button variant="outline" onClick={() => setFaturaSheet(null)}>Fechar</Button>}
        >
          <BeneficiaryInvoicePreview ubId={faturaSheet.ubId} month={faturaSheet.month} />
        </Modal>
      )}

      {pixSheet && (
        <PixModal settlement={pixSheet} onClose={() => setPixSheet(null)} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`text-xs px-3 py-1 rounded-md ${active ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-600'}`}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'green' | 'amber' | 'red' | 'slate'> = { pago: 'green', aberto: 'amber', vencido: 'red', cancelado: 'slate' };
  const label: Record<string, string> = { pago: 'PAGA', aberto: 'EM ABERTO', vencido: 'VENCIDA', cancelado: 'CANCELADA' };
  return <Badge tone={map[status] ?? 'slate'}>{label[status] ?? status}</Badge>;
}

function RecipientCell({ ugId, owner }: { ugId: string; owner: string }) {
  const provider = useEsaProvider();
  const rec = useMemo(() => provider.getSettlementRecipient(ugId), [ugId]);
  if (!rec) return <span className="text-slate-400">—</span>;
  const differs = rec.recipientName !== owner;
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      <span className="text-slate-700">{rec.recipientName}</span>
      {differs && (
        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">RECEBEDOR ≠ PROPRIETÁRIO</span>
      )}
    </span>
  );
}

function InvoicesTable({
  rows, onConfirm, onReopen, onViewFatura, onViewUb,
}: {
  rows: InvoiceRow[];
  onConfirm: (r: InvoiceRow) => void;
  onReopen: (r: InvoiceRow) => void;
  onViewFatura: (r: InvoiceRow) => void;
  onViewUb: (r: InvoiceRow) => void;
}) {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-400">Nenhuma fatura para o mês selecionado.</div>;
  }
  return (
    <>
      <div className="hidden md:block overflow-x-auto -mx-5">
        <table className="w-full text-sm" style={{ minWidth: 1020 }}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
              <th className="py-2.5 px-5 font-medium">Beneficiária</th>
              <th className="py-2.5 font-medium">UC</th>
              <th className="py-2.5 font-medium">Mês</th>
              <th className="py-2.5 font-medium text-right">Valor Fatura ESA</th>
              <th className="py-2.5 font-medium">Vencimento</th>
              <th className="py-2.5 font-medium">Status</th>
              <th className="py-2.5 font-medium">Pago em</th>
              <th className="py-2.5 px-5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50/60">
                <td className="py-3 px-5">
                  <div className="font-medium text-slate-900">{i.ub.name}</div>
                  <div className="text-[11px] text-slate-500">{i.ub.id}</div>
                </td>
                <td className="py-3 tabular-nums">{i.ub.uc}</td>
                <td className="py-3">{i.month}</td>
                <td className="py-3 text-right tabular-nums font-medium">{brl(i.value)}</td>
                <td className="py-3 tabular-nums">{i.dueDate}</td>
                <td className="py-3"><StatusBadge status={i.status} /></td>
                <td className="py-3 text-slate-500">{i.paidAt ?? '—'}</td>
                <td className="py-3 px-5">
                  <div className="flex items-center gap-1.5 justify-end flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => onViewFatura(i)}><Eye className="h-3.5 w-3.5" /> Ver Fatura ESA</Button>
                    <Button variant="ghost" size="sm" onClick={() => onViewUb(i)}><Eye className="h-3.5 w-3.5" /> Ver beneficiária</Button>
                    {i.status === 'pago' ? (
                      <Button variant="ghost" size="sm" onClick={() => onReopen(i)}><RotateCcw className="h-3.5 w-3.5" /> Reabrir</Button>
                    ) : (
                      <Button size="sm" onClick={() => onConfirm(i)}><CheckCircle2 className="h-3.5 w-3.5" /> Marcar paga</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2">
        {rows.map((i) => (
          <div key={i.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">{i.ub.name}</div>
                <div className="text-[11px] text-slate-500">{i.ub.id} · UC {i.ub.uc}</div>
              </div>
              <StatusBadge status={i.status} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <div className="text-slate-500">Mês {i.month} · Venc {i.dueDate}</div>
              <div className="font-semibold text-slate-800">{brl(i.value)}</div>
            </div>
            <div className="mt-2 flex justify-end gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => onViewFatura(i)}><Eye className="h-3.5 w-3.5" /> Fatura ESA</Button>
              {i.status === 'pago' ? (
                <Button variant="ghost" size="sm" onClick={() => onReopen(i)}><RotateCcw className="h-3.5 w-3.5" /> Reabrir</Button>
              ) : (
                <Button size="sm" onClick={() => onConfirm(i)}><CheckCircle2 className="h-3.5 w-3.5" /> Marcar paga</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SettlementsTable({
  rows, onConfirm, onReopen, onViewPix, onViewUg,
}: {
  rows: SettlementFinRow[];
  onConfirm: (r: SettlementFinRow) => void;
  onReopen: (r: SettlementFinRow) => void;
  onViewPix: (r: SettlementFinRow) => void;
  onViewUg: (r: SettlementFinRow) => void;
}) {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-400">Nenhum repasse para o mês selecionado.</div>;
  }
  return (
    <>
      <div className="hidden md:block overflow-x-auto -mx-5">
        <table className="w-full text-sm" style={{ minWidth: 1120 }}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
              <th className="py-2.5 px-5 font-medium">Unidade Geradora</th>
              <th className="py-2.5 font-medium">Proprietário</th>
              <th className="py-2.5 font-medium">Recebedor</th>
              <th className="py-2.5 font-medium">Mês</th>
              <th className="py-2.5 font-medium text-right">Preço/kWh</th>
              <th className="py-2.5 font-medium text-right">Créditos</th>
              <th className="py-2.5 font-medium text-right">Valor repasse</th>
              <th className="py-2.5 font-medium">Status</th>
              <th className="py-2.5 font-medium">Pago em</th>
              <th className="py-2.5 px-5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="py-3 px-5 font-medium text-slate-900">{r.ugName}</td>
                <td className="py-3 text-slate-700">{r.owner}</td>
                <td className="py-3"><RecipientCell ugId={r.ugId} owner={r.owner} /></td>
                <td className="py-3">{r.month}</td>
                <td className="py-3 text-right tabular-nums">R$ {r.pricePerKwh.toFixed(2)}</td>
                <td className="py-3 text-right tabular-nums">{kwh(r.compensatedKwh)}</td>
                <td className="py-3 text-right tabular-nums font-medium">{brl(r.value)}</td>
                <td className="py-3"><StatusBadge status={r.status} /></td>
                <td className="py-3 text-slate-500">{r.paidAt ?? '—'}</td>
                <td className="py-3 px-5">
                  <div className="flex items-center gap-1.5 justify-end flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => onViewPix(r)}><Copy className="h-3.5 w-3.5" /> Ver dados PIX</Button>
                    <Button variant="ghost" size="sm" onClick={() => onViewUg(r)}><Eye className="h-3.5 w-3.5" /> Ver UG</Button>
                    {r.status === 'pago' ? (
                      <Button variant="ghost" size="sm" onClick={() => onReopen(r)}><RotateCcw className="h-3.5 w-3.5" /> Reabrir</Button>
                    ) : (
                      <Button size="sm" onClick={() => onConfirm(r)}><CheckCircle2 className="h-3.5 w-3.5" /> Marcar pago</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">{r.ugName}</div>
                <div className="text-[11px] text-slate-500 truncate">{r.owner}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-2 text-xs text-slate-500">Mês {r.month} · R$ {r.pricePerKwh.toFixed(2)}/kWh</div>
            <div className="mt-1 font-semibold text-slate-800">{brl(r.value)}</div>
            <div className="mt-2 flex justify-end gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => onViewPix(r)}><Copy className="h-3.5 w-3.5" /> PIX</Button>
              {r.status !== 'pago' && (
                <Button size="sm" onClick={() => onConfirm(r)}><CheckCircle2 className="h-3.5 w-3.5" /> Marcar pago</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function today() { return new Date().toISOString().slice(0, 10); }

function ConfirmInvoicePayment({ invoice, onClose, onConfirm }: { invoice: InvoiceRow; onClose: () => void; onConfirm: (paidAt: string) => void }) {
  const [paidAt, setPaidAt] = useState(today());
  const [amount, setAmount] = useState(invoice.value.toFixed(2));
  const [note, setNote] = useState('');
  return (
    <Modal open onClose={onClose} title="Confirmar recebimento" desc="Registrar pagamento da fatura ESA"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => onConfirm(paidAt)}><CheckCircle2 className="h-4 w-4" /> Confirmar pagamento</Button></>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Beneficiária" colSpan={2}>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">{invoice.ub.name} · {invoice.ub.id}</div>
        </Field>
        <Field label="Mês"><input className={inputClass} value={invoice.month} readOnly /></Field>
        <Field label="Valor da fatura"><input className={inputClass} value={brl(invoice.value)} readOnly /></Field>
        <Field label="Data do pagamento"><input type="date" className={inputClass} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
        <Field label="Valor recebido"><input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Observação" colSpan={2}><textarea rows={2} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label="Comprovante (opcional)" colSpan={2}>
          <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" /> Anexar comprovante (protótipo — não envia arquivo)
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function ConfirmSettlementPayment({ settlement, onClose, onConfirm }: { settlement: SettlementFinRow; onClose: () => void; onConfirm: (paidAt: string) => void }) {
  const provider = useEsaProvider();
  const [paidAt, setPaidAt] = useState(today());
  const [amount, setAmount] = useState(settlement.value.toFixed(2));
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const recipient = useMemo(() => provider.getSettlementRecipient(settlement.ugId), [settlement.ugId]);
  const copy = () => {
    if (!recipient?.pixKey) return;
    navigator.clipboard?.writeText(recipient.pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Modal open onClose={onClose} title="Confirmar repasse" desc="Repasse ao proprietário / recebedor da Unidade Geradora"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => onConfirm(paidAt)}><CheckCircle2 className="h-4 w-4" /> Confirmar repasse</Button></>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Unidade Geradora" colSpan={2}>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">{settlement.ugName} · {settlement.ugId}</div>
        </Field>
        <Field label="Mês"><input className={inputClass} value={settlement.month} readOnly /></Field>
        <Field label="Valor do repasse"><input className={inputClass} value={brl(settlement.value)} readOnly /></Field>
        {recipient && (
          <Field label="Recebedor" colSpan={2}>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{recipient.recipientName}</div>
                <div className="text-[11px] text-slate-500 truncate">{recipient.recipientDocument} · PIX ({recipient.pixKeyType}) {recipient.pixKey}</div>
              </div>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} PIX
              </Button>
            </div>
          </Field>
        )}
        <Field label="Data do pagamento"><input type="date" className={inputClass} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
        <Field label="Valor pago"><input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Observação" colSpan={2}><textarea rows={2} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label="Comprovante (opcional)" colSpan={2}>
          <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" /> Anexar comprovante (protótipo)
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function PixModal({ settlement, onClose }: { settlement: SettlementFinRow; onClose: () => void }) {
  const provider = useEsaProvider();
  const [copied, setCopied] = useState(false);
  const recipient = useMemo(() => provider.getSettlementRecipient(settlement.ugId), [settlement.ugId]);
  const copy = () => {
    if (!recipient?.pixKey) return;
    navigator.clipboard?.writeText(recipient.pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Modal open onClose={onClose} title="Dados PIX — Recebedor do repasse" desc={`Unidade Geradora: ${settlement.ugName}`}
      footer={<Button variant="outline" onClick={onClose}>Fechar</Button>}
    >
      {recipient ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
            <Row label="Nome">{recipient.recipientName}</Row>
            <Row label="CPF/CNPJ">{recipient.recipientDocument}</Row>
            <Row label="Tipo da chave PIX">{recipient.pixKeyType?.toUpperCase()}</Row>
            <Row label="Chave PIX">{recipient.pixKey}</Row>
          </div>
          <button onClick={copy} className="inline-flex items-center gap-2 rounded-lg border border-[#a9e4cb] bg-[#eaf8f1] px-3.5 py-2 text-[13px] font-semibold text-[#00875a] hover:bg-[#d3f1e3] transition-colors">
            {copied ? <><CheckCircle2 className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar chave PIX</>}
          </button>
          {recipient.recipientName !== settlement.owner && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 font-medium">
              O recebedor é diferente do proprietário cadastrado na UG.
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-slate-400">Sem recebedor cadastrado para esta UG.</div>
      )}
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium text-right break-all">{children}</span>
    </div>
  );
}
