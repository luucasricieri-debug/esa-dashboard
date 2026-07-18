import { useState } from 'react';
import { Plus, Building2, Pencil } from 'lucide-react';
import {
  Card,
  SectionTitle,
  Button,
  StatusPill,
  Badge,
  Modal,
  Stepper,
  Field,
  inputClass,
  Drawer,
  EmptyState,
  LoadingSpinner,
  SuccessBanner,
  FieldRow,
} from '@/components/ui/index';
import { demoProvider, type BeneficiaryUnit } from '@/lib/demo';
import { brl, kwh } from '@/lib/format';

type DrawerMode = 'view' | 'edit';

const STEPS = ['Dados da UB', 'Vinculação à UG', 'Parâmetros', 'Revisão'];

const DISTRIBUTORS = ['Copel', 'CEMIG', 'CPFL', 'Enel', 'Light', 'Coelba', 'CELPE'];

export function BeneficiaryUnits() {
  const ugs = demoProvider.listGeneratingUnits();
  const ubs = demoProvider.listBeneficiaryUnits();

  const [ugFilter, setUgFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const [loading] = useState(false);
  const [showEmpty] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerUb, setDrawerUb] = useState<BeneficiaryUnit | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    nome: '',
    documento: '',
    uc: '',
    distribuidora: 'Copel',
    status: 'ativa',
    customerSince: '2026-01',
    ugId: ugs[0]?.id ?? '',
    allocationPct: '0.30',
    preventiveMargin: '5',
    esaPrice: '0.55',
    distributorTariff: '0.85',
    taxes: '300',
    cip: '45',
  });

  function resetForm() {
    setForm({ nome: '', documento: '', uc: '', distribuidora: 'Copel', status: 'ativa', customerSince: '2026-01', ugId: ugs[0]?.id ?? '', allocationPct: '0.30', preventiveMargin: '5', esaPrice: '0.55', distributorTariff: '0.85', taxes: '300', cip: '45' });
    setStep(0);
  }

  function handleCreate() {
    demoProvider.createBeneficiaryUnit({ nome: form.nome });
    setCreateOpen(false);
    resetForm();
    setSuccess(`Unidade Beneficiária "${form.nome || 'Nova UB'}" cadastrada com sucesso.`);
    setTimeout(() => setSuccess(''), 5000);
  }

  const filtered = showEmpty ? [] : ubs.filter(ub => {
    if (ugFilter !== 'all' && ub.ugId !== ugFilter) return false;
    if (statusFilter !== 'all' && ub.status !== statusFilter) return false;
    if (paymentFilter !== 'all' && ub.paymentStatus !== paymentFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <Card className="p-8">
        <LoadingSpinner label="Carregando unidades beneficiárias..." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {success && (
        <SuccessBanner title="UB cadastrada" desc={success} onDismiss={() => setSuccess('')} />
      )}

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">UG</label>
            <select className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500" value={ugFilter} onChange={e => setUgFilter(e.target.value)}>
              <option value="all">Todas</option>
              {ugs.map(ug => <option key={ug.id} value={ug.id}>{ug.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Status</label>
            <select className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Pagamento</label>
            <select className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="pago">Pago</option>
              <option value="aberto">Em aberto</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
          <div className="flex-1" />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nova UB
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Unidades Beneficiárias"
          desc={`${filtered.length} unidade(s) encontrada(s)`}
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="Nenhuma UB encontrada"
            desc="Ajuste os filtros ou cadastre uma nova unidade beneficiária."
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Cadastrar UB</Button>}
          />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                  <th className="py-2.5 px-5 font-medium">ID</th>
                  <th className="py-2.5 font-medium">Nome</th>
                  <th className="py-2.5 font-medium">Documento</th>
                  <th className="py-2.5 font-medium">UC</th>
                  <th className="py-2.5 font-medium">UG vinculada</th>
                  <th className="py-2.5 font-medium">Status</th>
                  <th className="py-2.5 font-medium">Pagamento</th>
                  <th className="py-2.5 px-5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((ub) => {
                  const ug = ugs.find(u => u.id === ub.ugId);
                  return (
                    <tr key={ub.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5"><Badge tone="neutral">{ub.id}</Badge></td>
                      <td className="py-3 font-medium text-slate-900">{ub.name}</td>
                      <td className="py-3 text-slate-500 text-xs font-mono">{ub.document}</td>
                      <td className="py-3 text-slate-500 font-mono text-xs">{ub.uc}</td>
                      <td className="py-3 text-slate-600 text-xs">{ug?.name ?? ub.ugId}</td>
                      <td className="py-3"><StatusPill status={ub.status} /></td>
                      <td className="py-3"><StatusPill status={ub.paymentStatus} /></td>
                      <td className="py-3 px-5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setDrawerUb(ub); setDrawerMode('view'); }}>
                          <Pencil className="h-3.5 w-3.5" /> Detalhes
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); resetForm(); }}
        title="Nova Unidade Beneficiária"
        desc="Cadastro em 4 etapas"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { if (step === 0) { setCreateOpen(false); resetForm(); } else setStep(s => s - 1); }}>
              {step === 0 ? 'Cancelar' : '← Voltar'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)}>Próximo →</Button>
            ) : (
              <Button onClick={handleCreate}>Cadastrar UB</Button>
            )}
          </>
        }
      >
        <Stepper steps={STEPS} current={step} />

        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome da UB" colSpan={2}>
              <input className={inputClass} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Mercado Central" />
            </Field>
            <Field label="Documento (CPF/CNPJ)">
              <input className={inputClass} value={form.documento} onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} placeholder="11.222.333/0001-44" />
            </Field>
            <Field label="Unidade Consumidora (UC)">
              <input className={inputClass} value={form.uc} onChange={e => setForm(f => ({ ...f, uc: e.target.value }))} placeholder="111222333" />
            </Field>
            <Field label="Distribuidora">
              <select className={inputClass} value={form.distribuidora} onChange={e => setForm(f => ({ ...f, distribuidora: e.target.value }))}>
                {DISTRIBUTORS.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
              </select>
            </Field>
            <Field label="Cliente desde">
              <input className={inputClass} type="month" value={form.customerSince} onChange={e => setForm(f => ({ ...f, customerSince: e.target.value }))} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Unidade Geradora" colSpan={2}>
              <select className={inputClass} value={form.ugId} onChange={e => setForm(f => ({ ...f, ugId: e.target.value }))}>
                {ugs.map(ug => <option key={ug.id} value={ug.id}>{ug.name} ({ug.id})</option>)}
              </select>
            </Field>
            <Field label="% de rateio">
              <input className={inputClass} type="number" step="0.01" min="0" max="1" value={form.allocationPct} onChange={e => setForm(f => ({ ...f, allocationPct: e.target.value }))} />
            </Field>
            <Field label="Margem preventiva (%)">
              <input className={inputClass} type="number" step="1" min="0" max="30" value={form.preventiveMargin} onChange={e => setForm(f => ({ ...f, preventiveMargin: e.target.value }))} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Preço ESA (R$/kWh)">
              <input className={inputClass} type="number" step="0.01" value={form.esaPrice} onChange={e => setForm(f => ({ ...f, esaPrice: e.target.value }))} />
            </Field>
            <Field label="Tarifa distribuidora (R$/kWh)">
              <input className={inputClass} type="number" step="0.01" value={form.distributorTariff} onChange={e => setForm(f => ({ ...f, distributorTariff: e.target.value }))} />
            </Field>
            <Field label="Impostos (R$)">
              <input className={inputClass} type="number" step="1" value={form.taxes} onChange={e => setForm(f => ({ ...f, taxes: e.target.value }))} />
            </Field>
            <Field label="CIP / Iluminação pública (R$)">
              <input className={inputClass} type="number" step="0.01" value={form.cip} onChange={e => setForm(f => ({ ...f, cip: e.target.value }))} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">Resumo do cadastro</div>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Nome" value={form.nome || '—'} />
              <FieldRow label="Documento" value={form.documento || '—'} />
              <FieldRow label="UC" value={form.uc || '—'} />
              <FieldRow label="UG vinculada" value={ugs.find(u => u.id === form.ugId)?.name ?? '—'} />
              <FieldRow label="% Rateio" value={`${(Number(form.allocationPct) * 100).toFixed(1)}%`} />
              <FieldRow label="Margem preventiva" value={`${form.preventiveMargin}%`} />
              <FieldRow label="Preço ESA" value={`R$ ${form.esaPrice}/kWh`} />
              <FieldRow label="Tarifa dist." value={`R$ ${form.distributorTariff}/kWh`} />
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        open={!!drawerUb}
        onClose={() => setDrawerUb(null)}
        title={drawerUb?.name ?? ''}
        desc={`${drawerUb?.id} · UC ${drawerUb?.uc}`}
      >
        {drawerUb && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={drawerMode === 'view' ? 'soft' : 'outline'} size="sm" onClick={() => setDrawerMode('view')}>Detalhes</Button>
              <Button variant={drawerMode === 'edit' ? 'soft' : 'outline'} size="sm" onClick={() => setDrawerMode('edit')}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
            </div>

            {drawerMode === 'view' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Status" value={drawerUb.status} />
                  <FieldRow label="Pagamento" value={drawerUb.paymentStatus} />
                  <FieldRow label="Documento" value={drawerUb.document} />
                  <FieldRow label="Distribuidora" value={drawerUb.distributor} />
                  <FieldRow label="Consumo mensal" value={kwh(drawerUb.monthlyConsumption)} />
                  <FieldRow label="Saldo anterior" value={kwh(drawerUb.previousCreditBalance)} />
                  <FieldRow label="% Rateio" value={`${(drawerUb.allocationPct * 100).toFixed(1)}%`} />
                  <FieldRow label="Margem preventiva" value={`${(drawerUb.preventiveMargin * 100).toFixed(0)}%`} />
                  <FieldRow label="Preço ESA" value={`R$ ${drawerUb.esaPrice.toFixed(2)}/kWh`} />
                  <FieldRow label="Tarifa dist." value={`R$ ${drawerUb.distributorTariff.toFixed(2)}/kWh`} />
                  <FieldRow label="Impostos" value={brl(drawerUb.taxes)} />
                  <FieldRow label="CIP" value={brl(drawerUb.cip)} />
                  <FieldRow label="Cliente desde" value={drawerUb.customerSince} />
                  <FieldRow label="Economia acumulada" value={brl(drawerUb.accumulatedSavings)} tone="emerald" />
                </div>

                {/* Invoice preview section */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3">Preview da Fatura (Mês atual)</div>
                  {(() => {
                    const inv = demoProvider.getBeneficiaryInvoice(drawerUb.id, '2026-07');
                    if (!inv) return <p className="text-xs text-slate-500">Fatura não disponível.</p>;
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Créditos compensados</span>
                          <span className="font-medium">{kwh(inv.billingSnapshot.creditos.creditsCompensatedKwh)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Fatura ESA</span>
                          <span className="font-medium text-emerald-700">{brl(inv.raw.faturaEsa)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Total com ESA</span>
                          <span className="font-semibold text-slate-900">{brl(inv.raw.totalWithEsa)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Sem ESA seria</span>
                          <span className="text-slate-500 line-through">{brl(inv.raw.totalWithoutEsa)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-2">
                          <span className="text-emerald-700 font-semibold">Economia mensal</span>
                          <span className="text-emerald-700 font-semibold">{brl(inv.raw.monthlySavings)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Monthly history */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Histórico mensal</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
                          <th className="py-1.5 font-medium">Mês</th>
                          <th className="py-1.5 font-medium text-right">Consumo</th>
                          <th className="py-1.5 font-medium text-right">Economia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[{ month: '2026-07', label: 'Jul/26' }, { month: '2026-06', label: 'Jun/26' }, { month: '2026-05', label: 'Mai/26' }].map(({ month, label }) => (
                          <tr key={month}>
                            <td className="py-1.5">{label}</td>
                            <td className="py-1.5 text-right tabular-nums">{kwh(drawerUb.monthlyConsumption)}</td>
                            <td className="py-1.5 text-right tabular-nums text-emerald-700">
                              {brl(drawerUb.monthlyConsumption * (drawerUb.distributorTariff - drawerUb.esaPrice) * 0.85)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <Field label="Nome">
                  <input className={inputClass} defaultValue={drawerUb.name} />
                </Field>
                <Field label="Status">
                  <select className={inputClass} defaultValue={drawerUb.status}>
                    <option value="ativa">Ativa</option>
                    <option value="inativa">Inativa</option>
                  </select>
                </Field>
                <Field label="% Rateio">
                  <input className={inputClass} type="number" step="0.01" defaultValue={drawerUb.allocationPct} />
                </Field>
                <Field label="Margem preventiva (%)">
                  <input className={inputClass} type="number" step="1" defaultValue={drawerUb.preventiveMargin * 100} />
                </Field>
                <Field label="Preço ESA (R$/kWh)">
                  <input className={inputClass} type="number" step="0.01" defaultValue={drawerUb.esaPrice} />
                </Field>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" onClick={() => setDrawerMode('view')}>Cancelar</Button>
                  <Button onClick={() => { demoProvider.updateBeneficiaryUnit(drawerUb.id, {}); setDrawerMode('view'); }}>Salvar</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
