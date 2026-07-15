import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Eye, Pencil, FileText, Zap } from 'lucide-react';
import {
  Card, SectionTitle, Button, StatusPill, Modal, Stepper, Field, inputClass, Badge,
} from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import { kwh, brl } from '@/lib/esa/format';

export function BeneficiaryUnitsView() {
  const provider = useEsaProvider();
  const generatingUnits = provider.listGeneratingUnits();
  const beneficiaryUnits = provider.listBeneficiaryUnits();
  const results = provider.computeAll();

  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const rowMap = new Map<string, { comp: number; esa: number; save: number }>();
  results.forEach((r) => r.rows.forEach((row) => {
    rowMap.set(row.ub.id, { comp: row.compensated, esa: row.faturaEsa, save: row.economia });
  }));

  const rows = beneficiaryUnits.filter((u) =>
    (u.name + u.id + u.document).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <>
      <Card className="p-5">
        <SectionTitle
          title="Unidades Beneficiárias"
          desc={`${beneficiaryUnits.length} clientes vinculados`}
          right={
            <div className="flex gap-2">
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar UB..." className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 outline-none focus:border-emerald-500 w-52" />
              <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Nova Unidade Beneficiária</Button>
            </div>
          }
        />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                <th className="py-2.5 px-5 font-medium">Beneficiária</th>
                <th className="py-2.5 font-medium">UG vinculada</th>
                <th className="py-2.5 font-medium">UC / Distr.</th>
                <th className="py-2.5 font-medium text-right">Consumo</th>
                <th className="py-2.5 font-medium text-right">Compensado</th>
                <th className="py-2.5 font-medium text-right">Valor ESA</th>
                <th className="py-2.5 font-medium text-right">Economia</th>
                <th className="py-2.5 font-medium">Pagamento</th>
                <th className="py-2.5 px-5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((u) => {
                const ug = generatingUnits.find((g) => g.id === u.ugId);
                const stats = rowMap.get(u.id);
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5">
                      <div className="font-medium text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-500">{u.id} · {u.document}</div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-emerald-600" />
                        <span className="text-slate-700">{ug?.name}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div>{u.uc}</div>
                      <div className="text-[11px] text-slate-500">{u.distributor}</div>
                    </td>
                    <td className="py-3 text-right tabular-nums">{kwh(u.monthlyConsumption)}</td>
                    <td className="py-3 text-right tabular-nums text-emerald-700 font-medium">{stats ? kwh(stats.comp) : '—'}</td>
                    <td className="py-3 text-right tabular-nums">{stats ? brl(stats.esa) : '—'}</td>
                    <td className="py-3 text-right tabular-nums text-emerald-700">{stats ? brl(stats.save) : '—'}</td>
                    <td className="py-3"><StatusPill status={u.paymentStatus} /></td>
                    <td className="py-3 px-5">
                      <div className="flex justify-end gap-1">
                        <IconBtn icon={Eye} onClick={() => setDetailId(u.id)} />
                        <IconBtn icon={Pencil} onClick={() => setDetailId(u.id)} />
                        <IconBtn icon={FileText} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {showForm && <UBForm onClose={() => setShowForm(false)} />}
      {detailId && <UBDetail ubId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function IconBtn({ icon: Icon, onClick }: { icon: any; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="h-7 w-7 grid place-items-center rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

const UB_STEPS = ['Identificação', 'Vinculação energética', 'Condições comerciais', 'Saldo inicial', 'Revisar'];

interface UBFormState {
  id: string; name: string; document: string; uc: string; distributor: string;
  status: string; esaEntryDate: string; ugId: string; preventiveMarginPct: string;
  averageMethod: 'history' | 'manual'; manualAverageKwh: string;
  esaPricePerKwh: string; priceEffectiveDate: string; dueDay: string;
  contractStatus: 'ativo' | 'pausado' | 'encerrado'; initialControlMonth: string;
  previousBalanceKwh: string; observations: string;
}

export function UBForm({
  onClose, prefill, sourceHint,
}: {
  onClose: () => void;
  prefill?: Partial<UBFormState>;
  sourceHint?: string;
}) {
  const provider = useEsaProvider();
  const generatingUnits = provider.listGeneratingUnits();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<UBFormState>({
    id: '', name: '', document: '', uc: '', distributor: 'Copel', status: 'ativa',
    esaEntryDate: '', ugId: generatingUnits[0]?.id ?? '',
    preventiveMarginPct: '5,00', averageMethod: 'history', manualAverageKwh: '',
    esaPricePerKwh: '0,55', priceEffectiveDate: new Date().toISOString().slice(0, 10),
    dueDay: '10', contractStatus: 'ativo', initialControlMonth: '2026-07',
    previousBalanceKwh: '0', observations: '', ...prefill,
  });

  const set = <K extends keyof UBFormState>(k: K, v: UBFormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const next = () => setStep((s) => Math.min(UB_STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const save = () => {
    provider.createBeneficiaryUnit({ ...f });
    toast.success('Unidade Beneficiária cadastrada', { description: 'Simulação — dados não persistidos.' });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Nova Unidade Beneficiária" desc={sourceHint ?? 'Cadastro em etapas — gestão de créditos'} size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {step > 0 && <Button variant="outline" onClick={back}>Voltar</Button>}
          {step < UB_STEPS.length - 1 ? <Button onClick={next}>Avançar</Button> : <Button onClick={save}>Salvar Unidade Beneficiária</Button>}
        </>
      }
    >
      <Stepper steps={UB_STEPS} current={step} />
      {step === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="ID / Código"><input className={inputClass} value={f.id} onChange={(e) => set('id', e.target.value)} placeholder="UB-010" /></Field>
          <Field label="Status">
            <select className={inputClass} value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ativa">Ativa</option><option value="inativa">Inativa</option>
            </select>
          </Field>
          <Field label="Nome / Razão Social" colSpan={2}><input className={inputClass} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="CPF / CNPJ"><input className={inputClass} value={f.document} onChange={(e) => set('document', e.target.value)} /></Field>
          <Field label="Unidade Consumidora — UC"><input className={inputClass} value={f.uc} onChange={(e) => set('uc', e.target.value)} /></Field>
          <Field label="Distribuidora"><input className={inputClass} value={f.distributor} onChange={(e) => set('distributor', e.target.value)} /></Field>
          <Field label="Data de entrada na ESA"><input type="date" className={inputClass} value={f.esaEntryDate} onChange={(e) => set('esaEntryDate', e.target.value)} /></Field>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Unidade Geradora vinculada" colSpan={2}>
              <select className={inputClass} value={f.ugId} onChange={(e) => set('ugId', e.target.value)}>
                {generatingUnits.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.id}</option>)}
              </select>
            </Field>
            <Field label="Margem preventiva padrão (%)" hint="Ex.: 5,00"><input className={inputClass} value={f.preventiveMarginPct} onChange={(e) => set('preventiveMarginPct', e.target.value)} /></Field>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-2">Forma de definir média de consumo</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <MethodOption active={f.averageMethod === 'history'} onClick={() => set('averageMethod', 'history')} title="Calcular pelo histórico" desc="A média será calculada a partir do histórico mensal disponível." />
              <MethodOption active={f.averageMethod === 'manual'} onClick={() => set('averageMethod', 'manual')} title="Informar média inicial" desc="Utilizar valor manual até haver histórico suficiente." />
            </div>
            {f.averageMethod === 'history'
              ? <div className="mt-3 text-xs text-slate-600">Histórico insuficiente será sinalizado: importe faturas ou informe uma média inicial.</div>
              : <div className="mt-3"><Field label="Média mensal inicial (kWh/mês)"><input className={inputClass} value={f.manualAverageKwh} onChange={(e) => set('manualAverageKwh', e.target.value)} /></Field></div>}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Preço ESA por kWh" hint="Ex.: 0,55"><input className={inputClass} value={f.esaPricePerKwh} onChange={(e) => set('esaPricePerKwh', e.target.value)} /></Field>
            <Field label="Data de vigência"><input type="date" className={inputClass} value={f.priceEffectiveDate} onChange={(e) => set('priceEffectiveDate', e.target.value)} /></Field>
            <Field label="Dia padrão de vencimento"><input className={inputClass} value={f.dueDay} onChange={(e) => set('dueDay', e.target.value)} /></Field>
            <Field label="Status do contrato">
              <select className={inputClass} value={f.contractStatus} onChange={(e) => set('contractStatus', e.target.value as any)}>
                <option value="ativo">Ativo</option><option value="pausado">Pausado</option><option value="encerrado">Encerrado</option>
              </select>
            </Field>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-800">O faturamento oficial continuará sendo calculado pelo Billing Engine do ESA OS.</div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Mês inicial do controle"><input className={inputClass} value={f.initialControlMonth} onChange={(e) => set('initialControlMonth', e.target.value)} placeholder="2026-07" /></Field>
            <Field label="Saldo inicial de créditos da UC (kWh)"><input className={inputClass} value={f.previousBalanceKwh} onChange={(e) => set('previousBalanceKwh', e.target.value)} /></Field>
            <Field label="Observações" colSpan={2}><textarea rows={3} className={inputClass} value={f.observations} onChange={(e) => set('observations', e.target.value)} /></Field>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">Informe o saldo existente na UC no início do controle para evitar divergência no histórico de créditos.</div>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-3 text-sm">
          <RGroup title="Identificação">
            <RItem label="ID" value={f.id || '—'} /><RItem label="Nome" value={f.name || '—'} />
            <RItem label="Documento" value={f.document || '—'} /><RItem label="UC" value={f.uc || '—'} />
            <RItem label="Distribuidora" value={f.distributor} /><RItem label="Entrada ESA" value={f.esaEntryDate || '—'} />
          </RGroup>
          <RGroup title="Vinculação">
            <RItem label="UG" value={generatingUnits.find((u) => u.id === f.ugId)?.name ?? f.ugId} />
            <RItem label="Margem preventiva" value={`${f.preventiveMarginPct}%`} />
            <RItem label="Método de média" value={f.averageMethod === 'history' ? 'Histórico' : 'Manual'} />
          </RGroup>
          <RGroup title="Comercial">
            <RItem label="Preço ESA" value={`R$ ${f.esaPricePerKwh}/kWh`} /><RItem label="Vigência" value={f.priceEffectiveDate} />
            <RItem label="Vencimento" value={`Dia ${f.dueDay}`} /><RItem label="Contrato" value={f.contractStatus} />
          </RGroup>
          <RGroup title="Saldo inicial">
            <RItem label="Mês inicial" value={f.initialControlMonth} /><RItem label="Saldo" value={`${f.previousBalanceKwh} kWh`} />
          </RGroup>
        </div>
      )}
    </Modal>
  );
}

function MethodOption({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={`text-left rounded-lg border p-3 transition-all ${active ? 'border-emerald-500 bg-emerald-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <div className={`text-sm font-medium ${active ? 'text-emerald-800' : 'text-slate-800'}`}>{title}</div>
      <div className="text-[11px] text-slate-500 mt-1">{desc}</div>
    </button>
  );
}

function RGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>
    </div>
  );
}

function RItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-slate-800 font-medium truncate">{value}</div>
    </div>
  );
}

function UBDetail({ ubId, onClose }: { ubId: string; onClose: () => void }) {
  const provider = useEsaProvider();
  const ubs = provider.listBeneficiaryUnits();
  const ugs = provider.listGeneratingUnits();
  const ub = ubs.find((u) => u.id === ubId)!;
  const ug = ugs.find((g) => g.id === ub?.ugId);
  const history: any[] = provider.getBeneficiaryMonthlyHistory(ubId) ?? [];
  const avgComp = provider.getBeneficiaryAverageComposition(ubId) ?? { monthsConsidered: 0, monthlyAverageKwh: 0, bySource: { utility_bill_import: 0, csv_import: 0, manual_entry: 0 } };
  const [tab, setTab] = useState<'overview' | 'history'>('overview');
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const badgeFor = (s: string) =>
    s === 'utility_bill_import' ? <Badge tone="green">FATURA IMPORTADA</Badge>
    : s === 'csv_import' ? <Badge tone="blue">CSV</Badge>
    : <Badge tone="slate">MANUAL</Badge>;

  const record = openMonth ? provider.getBeneficiaryMonthlyRecord(ubId, openMonth) : null;

  if (!ub) return null;

  return (
    <Modal open onClose={onClose} title={ub.name} desc={`${ub.id} · UG ${ug?.name ?? '—'}`} size="lg">
      <div className="flex gap-1 border-b border-slate-100 mb-4 -mt-1">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Visão geral</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>Histórico mensal</TabBtn>
      </div>
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <InfoBlock label="UC" value={ub.uc} /><InfoBlock label="Distribuidora" value={ub.distributor} />
          <InfoBlock label="Consumo mês" value={kwh(ub.monthlyConsumption)} />
          <InfoBlock label="Média anual" value={kwh(ub.annualAverage)} />
          <InfoBlock label="Margem prev." value={`${(ub.preventiveMargin * 100).toFixed(2)}%`} />
          <InfoBlock label="Preço ESA" value={`R$ ${ub.esaPrice.toFixed(2)}/kWh`} />
        </div>
      )}
      {tab === 'history' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600">
            Registros mensais confirmados são considerados no cálculo da média histórica de consumo da beneficiária.
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-700">
              <MiniStat label="Meses considerados" value={String(avgComp.monthsConsidered)} />
              <MiniStat label="Média calculada" value={`${avgComp.monthlyAverageKwh} kWh/mês`} />
              <MiniStat label="Faturas importadas" value={String(avgComp.bySource?.utility_bill_import ?? 0)} />
              <MiniStat label="CSV / Manual" value={`${avgComp.bySource?.csv_import ?? 0} / ${avgComp.bySource?.manual_entry ?? 0}`} />
            </div>
          </div>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                  <th className="py-2 px-2 font-medium">Mês</th><th className="py-2 font-medium text-right">Consumo</th>
                  <th className="py-2 font-medium">Origem</th><th className="py-2 font-medium">Status</th>
                  <th className="py-2 px-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((r: any) => (
                  <tr key={r.month} className="hover:bg-slate-50/60">
                    <td className="py-2 px-2 font-medium text-slate-800">{r.label}</td>
                    <td className="py-2 text-right tabular-nums">{kwh(r.consumptionKwh)}</td>
                    <td className="py-2">{badgeFor(r.source)}</td>
                    <td className="py-2"><Badge tone="green">CONFIRMADO</Badge></td>
                    <td className="py-2 px-2 text-right"><button className="text-xs text-emerald-700 hover:underline" onClick={() => setOpenMonth(r.month)}>Detalhar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {openMonth && record && (
        <Modal open onClose={() => setOpenMonth(null)} title={`Dados da fatura da distribuidora · ${openMonth}`} desc={record.fileName ?? undefined} size="lg">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <InfoBlock label="UC" value={record.utilityConsumerUnit} />
            <InfoBlock label="Mês de referência" value={record.referenceMonth} />
            <InfoBlock label="Consumo (kWh)" value={String(record.consumptionKwh)} />
            <InfoBlock label="TE" value={brl(record.teValue)} /><InfoBlock label="TUSD" value={brl(record.tusdValue)} />
            <InfoBlock label="Fio B" value={brl(record.fioB)} /><InfoBlock label="Bandeira" value={brl(record.flagValue)} />
            <InfoBlock label="CIP" value={brl(record.cipValue)} /><InfoBlock label="Impostos" value={brl(record.taxesValue)} />
            <InfoBlock label="Mín. faturável (kWh)" value={String(record.minimumBillableKwh)} />
            <InfoBlock label="Valor total" value={brl(record.totalBillValue)} />
            <InfoBlock label="Data da importação" value={record.importedAt} />
          </div>
        </Modal>
      )}
    </Modal>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-2 text-sm border-b-2 -mb-px ${active ? 'border-emerald-600 text-emerald-800 font-medium' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white border border-slate-100 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-800 font-semibold text-sm tabular-nums">{value}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className="text-slate-800 font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
