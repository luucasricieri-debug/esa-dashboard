import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Line, LineChart,
} from 'recharts';
import { CheckCircle2, RotateCcw, Upload, Copy } from 'lucide-react';
import { Card, KpiCard, SectionTitle, Button, Badge, Modal, Field, inputClass } from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import type { BeneficiaryUnit } from '@/lib/esa/types';
import { brl } from '@/lib/esa/format';

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

export function Financial() {
  const provider = useEsaProvider();
  const ubs = provider.listBeneficiaryUnits();
  const results = provider.computeAll();

  const revenue = results.reduce((s, r) => s + r.esaRevenue, 0);
  const owner = results.reduce((s, r) => s + r.ownerPayment, 0);

  const [invoices, setInvoices] = useState<InvoiceRow[]>(() =>
    ubs.map((u) => ({
      id: `INV-${u.id}-2026-07`,
      ub: u,
      month: '2026-07',
      value: u.monthlyConsumption * u.esaPrice,
      dueDate: '15/08/2026',
      status:
        u.paymentStatus === 'pago' ? 'pago'
          : u.paymentStatus === 'vencido' ? 'vencido'
          : 'aberto',
      paidAt: u.paymentStatus === 'pago' ? '12/08/2026' : undefined,
    })),
  );

  const [settlements, setSettlements] = useState<SettlementFinRow[]>(() =>
    results.map((r) => ({
      id: `SET-${r.ug.id}-2026-07`,
      ugId: r.ug.id,
      ugName: r.ug.name,
      owner: r.ug.owner,
      month: '2026-07',
      pricePerKwh: r.ug.purchasePrice,
      compensatedKwh: r.totalCompensated,
      value: r.ownerPayment,
      status: r.ug.id === 'UG-001' ? 'pago' : 'aberto',
      paidAt: r.ug.id === 'UG-001' ? '10/08/2026' : undefined,
    })),
  );

  const paidCount = invoices.filter((i) => i.status === 'pago').length;
  const openCount = invoices.filter((i) => i.status === 'aberto').length;
  const lateCount = invoices.filter((i) => i.status === 'vencido').length;
  const openValue = invoices.filter((i) => i.status === 'aberto' || i.status === 'vencido').reduce((s, i) => s + i.value, 0);

  const trend = provider.getMonthlyTrend({}).map((r) => ({
    m: r.label,
    Receita: r.Receita,
    Repasse: r.Repasse,
  }));
  const spreadTrend = trend.map((t) => ({ m: t.m, Spread: t.Receita - t.Repasse }));

  const [tab, setTab] = useState<'faturas' | 'repasses'>('faturas');
  const [invModal, setInvModal] = useState<InvoiceRow | null>(null);
  const [setModal, setSetModal] = useState<SettlementFinRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Receita ESA" value={brl(revenue)} tone="positive" />
        <KpiCard label="Repasses proprietários" value={brl(owner)} tone="negative" />
        <KpiCard label="Spread bruto" value={brl(revenue - owner)} tone="accent" />
        <KpiCard label="Faturas emitidas" value={String(invoices.length)} />
        <KpiCard label="Faturas pagas" value={String(paidCount)} tone="positive" />
        <KpiCard label="Em aberto" value={String(openCount)} />
        <KpiCard label="Vencidas" value={String(lateCount)} tone="negative" />
        <KpiCard label="Valor em aberto" value={brl(openValue)} tone="negative" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Receita × Repasse" desc="Últimos 6 meses" />
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={trend}>
                <CartesianGrid stroke="#eef2ef" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Receita" fill="#059669" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Repasse" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Spread mensal" />
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={spreadTrend}>
                <CartesianGrid stroke="#eef2ef" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="Spread" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
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
              setInvoices((all) => all.map((i) => i.id === row.id ? { ...i, status: 'aberto', paidAt: undefined } : i));
              toast('Pagamento reaberto');
            }}
          />
        ) : (
          <SettlementsTable rows={settlements} onConfirm={(row) => setSetModal(row)} />
        )}
      </Card>

      {invModal && (
        <ConfirmInvoicePayment
          invoice={invModal}
          onClose={() => setInvModal(null)}
          onConfirm={(paidAt) => {
            provider.confirmInvoicePayment(invModal.id, { paidAt, amount: invModal.value });
            setInvoices((all) => all.map((i) => i.id === invModal.id ? { ...i, status: 'pago', paidAt } : i));
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
            setSettlements((all) => all.map((s) => s.id === setModal.id ? { ...s, status: 'pago', paidAt } : s));
            toast.success('Repasse confirmado.');
            setSetModal(null);
          }}
        />
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

function RecipientCell({ ugId }: { ugId: string }) {
  const provider = useEsaProvider();
  const rec = useMemo(() => provider.getSettlementRecipient(ugId), [ugId]);
  return <span className="text-slate-600">{rec?.recipientName ?? '—'}</span>;
}

function InvoicesTable({ rows, onConfirm, onReopen }: { rows: InvoiceRow[]; onConfirm: (r: InvoiceRow) => void; onReopen: (r: InvoiceRow) => void }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto -mx-5">
        <table className="w-full text-sm">
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
                <td className="py-3">{i.ub.uc}</td>
                <td className="py-3">{i.month}</td>
                <td className="py-3 text-right tabular-nums font-medium">{brl(i.value)}</td>
                <td className="py-3">{i.dueDate}</td>
                <td className="py-3"><StatusBadge status={i.status} /></td>
                <td className="py-3 text-slate-500">{i.paidAt ?? '—'}</td>
                <td className="py-3 px-5 text-right">
                  {i.status === 'pago' ? (
                    <Button variant="ghost" size="sm" onClick={() => onReopen(i)}><RotateCcw className="h-3.5 w-3.5" /> Reabrir</Button>
                  ) : (
                    <Button size="sm" onClick={() => onConfirm(i)}><CheckCircle2 className="h-3.5 w-3.5" /> Marcar paga</Button>
                  )}
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
            <div className="mt-2 flex justify-end">
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

function SettlementsTable({ rows, onConfirm }: { rows: SettlementFinRow[]; onConfirm: (r: SettlementFinRow) => void }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto -mx-5">
        <table className="w-full text-sm">
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
                <td className="py-3">{r.owner}</td>
                <td className="py-3"><RecipientCell ugId={r.ugId} /></td>
                <td className="py-3">{r.month}</td>
                <td className="py-3 text-right tabular-nums">R$ {r.pricePerKwh.toFixed(2)}</td>
                <td className="py-3 text-right tabular-nums">{r.compensatedKwh.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kWh</td>
                <td className="py-3 text-right tabular-nums font-medium">{brl(r.value)}</td>
                <td className="py-3"><StatusBadge status={r.status} /></td>
                <td className="py-3 text-slate-500">{r.paidAt ?? '—'}</td>
                <td className="py-3 px-5 text-right">
                  {r.status !== 'pago' && (
                    <Button size="sm" onClick={() => onConfirm(r)}><CheckCircle2 className="h-3.5 w-3.5" /> Marcar pago</Button>
                  )}
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
            <div className="mt-2 flex justify-end">
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
  const recipient = useMemo(() => provider.getSettlementRecipient(settlement.ugId), [settlement.ugId]);
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
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(recipient.pixKey); toast('Chave PIX copiada'); }}>
                <Copy className="h-3.5 w-3.5" /> PIX
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
