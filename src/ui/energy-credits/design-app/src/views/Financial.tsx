import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { Card, SectionTitle, KpiCard, Button, Modal, Badge, FieldRow } from '@/components/ui/index';
import { demoProvider, generatingUnits, availableMonths } from '@/lib/demo';
import { brl, kwh } from '@/lib/format';

interface PaymentModalProps {
  ubId: string;
  month: string;
  action: 'confirm' | 'reopen';
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentModal({ ubId, month, action, onClose, onSuccess }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);

  function handleConfirm() {
    setLoading(true);
    setTimeout(() => {
      if (action === 'confirm') {
        demoProvider.confirmInvoicePayment(ubId, { paidAt: new Date().toISOString(), amount: 0 });
      } else {
        demoProvider.reopenInvoicePayment(ubId);
      }
      setLoading(false);
      onSuccess();
    }, 900);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={action === 'confirm' ? 'Confirmar pagamento' : 'Reabrir fatura'}
      desc={action === 'confirm' ? 'Marcar fatura como paga?' : 'Marcar fatura como em aberto?'}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant={action === 'confirm' ? 'primary' : 'danger'}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Processando...' : action === 'confirm' ? 'Confirmar pagamento' : 'Reabrir'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          {action === 'confirm'
            ? <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
            : <RotateCcw className="h-6 w-6 text-amber-500 shrink-0" />}
          <div>
            <div className="font-medium text-slate-900 text-sm">UB: {ubId}</div>
            <div className="text-[12px] text-slate-500">Mês: {month}</div>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          {action === 'confirm'
            ? 'Esta ação registrará o recebimento do pagamento desta fatura.'
            : 'Esta ação reverterá o status de pagamento da fatura para "em aberto".'}
        </p>
      </div>
    </Modal>
  );
}

export function Financial() {
  const [selectedMonth, setSelectedMonth] = useState('2026-07');
  const [selectedUg, setSelectedUg] = useState('all');
  const [paymentModal, setPaymentModal] = useState<{ ubId: string; action: 'confirm' | 'reopen' } | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const ugs = demoProvider.listGeneratingUnits();
  const ubs = demoProvider.listBeneficiaryUnits();
  const trend = demoProvider.getMonthlyTrend({});

  const filteredUbs = useMemo(() => {
    if (selectedUg === 'all') return ubs;
    return ubs.filter(u => u.ugId === selectedUg);
  }, [ubs, selectedUg]);

  const kpis = useMemo(() => {
    const row = trend.find(t => t.month === selectedMonth);
    return {
      receita: row?.Receita ?? 0,
      repasse: row?.Repasse ?? 0,
      spread: row?.Spread ?? 0,
    };
  }, [trend, selectedMonth]);

  const ubsForSelectedUg = useMemo(() => {
    if (selectedUg === 'all') return filteredUbs;
    return filteredUbs;
  }, [filteredUbs]);

  function handlePaymentSuccess(ubId: string, action: 'confirm' | 'reopen') {
    setPaymentModal(null);
    setSuccessMessage(action === 'confirm' ? `Pagamento de ${ubId} confirmado.` : `Fatura de ${ubId} reaberta.`);
    setTimeout(() => setSuccessMessage(''), 3000);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Mês</label>
            <select
              className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">UG</label>
            <select
              className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500"
              value={selectedUg}
              onChange={e => setSelectedUg(e.target.value)}
            >
              <option value="all">Todas as UGs</option>
              {ugs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Success banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-800 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard
          label="Receita ESA"
          value={brl(kpis.receita)}
          tone="positive"
          delta={{ value: 8.4, pct: 8.4, direction: 'up' }}
          deltaLabel="vs mês anterior"
        />
        <KpiCard
          label="Repasse ao Proprietário"
          value={brl(kpis.repasse)}
          delta={{ value: 6.1, pct: 6.1, direction: 'up' }}
          deltaLabel="vs mês anterior"
        />
        <KpiCard
          label="Spread ESA"
          value={brl(kpis.spread)}
          tone="positive"
          delta={{ value: 14.2, pct: 14.2, direction: 'up' }}
          deltaLabel="vs mês anterior"
        />
      </div>

      {/* Revenue trend chart */}
      <Card className="p-4">
        <SectionTitle title="Tendência de receita" desc="Evolução mensal de receita, repasse e spread" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={v => v.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`}
                width={60}
              />
              <Tooltip
                formatter={(v: number) => brl(v)}
                labelFormatter={l => `Mês: ${l}`}
              />
              <Legend />
              <Line type="monotone" dataKey="Receita" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Repasse" stroke="#e11d48" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="Spread" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-UG revenue breakdown */}
      <Card className="p-4">
        <SectionTitle title="Receita por UG" desc={`Composição do mês ${selectedMonth}`} />
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={ugs.map(u => {
                const p = demoProvider.getCreditAllocationPlan(u.id, selectedMonth);
                return {
                  name: u.id,
                  Receita: p?.esaRevenue ?? 0,
                  Repasse: p?.ownerPayment ?? 0,
                };
              })}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} width={60} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Legend />
              <Bar dataKey="Receita" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Repasse" fill="#fca5a5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-UG repasse panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(selectedUg === 'all' ? ugs : ugs.filter(u => u.id === selectedUg)).map(u => {
          const plan = demoProvider.getCreditAllocationPlan(u.id, selectedMonth);
          return (
            <Card key={u.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{u.name}</div>
                  <div className="text-[11px] text-slate-500">{u.id}</div>
                </div>
                <Badge tone="emerald">{u.status}</Badge>
              </div>
              <div className="space-y-1.5 text-sm">
                <FieldRow label="Geração" value={kwh(plan?.generation ?? 0)} />
                <FieldRow label="Compensado" value={kwh(plan?.totalCompensated ?? 0)} />
                <FieldRow label="Receita ESA" value={brl(plan?.esaRevenue ?? 0)} tone="emerald" />
                <FieldRow label="Repasse proprietário" value={brl(plan?.ownerPayment ?? 0)} />
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Spread</div>
                <div className="text-lg font-bold text-emerald-700">{brl((plan?.esaRevenue ?? 0) - (plan?.ownerPayment ?? 0))}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Per-UB invoice table */}
      <Card className="p-4">
        <SectionTitle
          title="Faturas de beneficiárias"
          desc={`${selectedMonth} · ${ubsForSelectedUg.length} unidades`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50">
                <th className="py-2.5 font-medium">Beneficiária</th>
                <th className="py-2.5 font-medium">UG Vinculada</th>
                <th className="py-2.5 font-medium text-right">Consumo</th>
                <th className="py-2.5 font-medium text-right">Fatura ESA</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ubsForSelectedUg.map(ub => {
                const esaPrice = ub.esaPrice;
                const invoiceValue = ub.monthlyConsumption * esaPrice * 0.85;
                const isPaid = ub.paymentStatus === 'pago';
                const isOverdue = ub.paymentStatus === 'vencido';

                return (
                  <tr key={ub.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5">
                      <div className="font-medium text-slate-900">{ub.name}</div>
                      <div className="text-[11px] text-slate-500">{ub.id}</div>
                    </td>
                    <td className="py-2.5 text-slate-600 text-xs">{ub.ugId}</td>
                    <td className="py-2.5 text-right tabular-nums">{kwh(ub.monthlyConsumption)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-emerald-700">{brl(invoiceValue)}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800'
                          : isOverdue
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isPaid ? <CheckCircle className="h-3 w-3" /> : isOverdue ? <XCircle className="h-3 w-3" /> : null}
                        {isPaid ? 'Pago' : isOverdue ? 'Vencido' : 'Em aberto'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {isPaid ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPaymentModal({ ubId: ub.id, action: 'reopen' })}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPaymentModal({ ubId: ub.id, action: 'confirm' })}
                        >
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Confirmar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment modal */}
      {paymentModal && (
        <PaymentModal
          ubId={paymentModal.ubId}
          month={selectedMonth}
          action={paymentModal.action}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => handlePaymentSuccess(paymentModal.ubId, paymentModal.action)}
        />
      )}
    </div>
  );
}
