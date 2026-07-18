import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Eye, Pencil, FileText, Zap, History } from 'lucide-react';
import {
  Card, SectionTitle, Button, StatusPill, Modal, Stepper, Field, inputClass, Badge,
} from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import type { GeneratingUnit } from '@/lib/esa/types';
import { kwh, brl } from '@/lib/esa/format';

// ──────────────────────────────────────────────────────────────────────────────
// List view
// ──────────────────────────────────────────────────────────────────────────────

export function BeneficiaryUnitsView() {
  const provider = useEsaProvider();
  const generatingUnits = provider.listGeneratingUnits();
  const beneficiaryUnits = provider.listBeneficiaryUnits();
  const results = provider.computeAll();
  const currentMonth = provider.listMonths()[0]?.value ?? '2026-07';

  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'history'>('overview');

  const rowMap = new Map<string, { comp: number; esa: number; save: number }>();
  results.forEach((r) => r.rows.forEach((row) => {
    rowMap.set(row.ub.id, { comp: row.compensated, esa: row.faturaEsa, save: row.economia });
  }));

  const cbMap = new Map<string, any>();
  beneficiaryUnits.forEach((u) => {
    cbMap.set(u.id, provider.getBeneficiaryCreditBalance(u.id, currentMonth));
  });

  const rows = beneficiaryUnits.filter((u) =>
    (u.name + u.document + u.uc).toLowerCase().includes(filter.toLowerCase()),
  );

  const openDetail = (id: string, tab: 'overview' | 'history' = 'overview') => {
    setDetailId(id);
    setDetailTab(tab);
  };

  return (
    <>
      <Card className="p-5">
        <SectionTitle
          title="Unidades Beneficiárias"
          desc={`${beneficiaryUnits.length} clientes vinculados`}
          right={
            <div className="flex gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar por nome, documento ou UC..."
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 outline-none focus:border-emerald-500 w-64"
              />
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Nova Unidade Beneficiária
              </Button>
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
                <th className="py-2.5 font-medium text-right">Saldo atual</th>
                <th className="py-2.5 font-medium text-right">Cobertura</th>
                <th className="py-2.5 font-medium text-right">Valor Fatura ESA</th>
                <th className="py-2.5 font-medium text-right">Economia</th>
                <th className="py-2.5 font-medium">Pagamento</th>
                <th className="py-2.5 px-5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-sm text-slate-400">
                    {beneficiaryUnits.length === 0
                      ? 'Nenhuma Unidade Beneficiária cadastrada.'
                      : 'Nenhum resultado para a busca realizada.'}
                  </td>
                </tr>
              )}
              {rows.map((u) => {
                const ug = generatingUnits.find((g) => g.id === u.ugId);
                const stats = rowMap.get(u.id);
                const cb = cbMap.get(u.id);
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5">
                      <div className="font-medium text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-500">{u.id} · {u.document}</div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-emerald-600" />
                        <span className="text-slate-700">{ug?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div>{u.uc}</div>
                      <div className="text-[11px] text-slate-500">{u.distributor}</div>
                    </td>
                    <td className="py-3 text-right tabular-nums">{kwh(u.monthlyConsumption)}</td>
                    <td className="py-3 text-right tabular-nums text-emerald-700 font-medium">
                      {stats ? kwh(stats.comp) : '—'}
                    </td>
                    <td className="py-3 text-right tabular-nums font-medium">
                      {cb ? kwh(cb.final) : '—'}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {cb ? `${cb.coverageMonths.toFixed(1)} mes.` : '—'}
                    </td>
                    <td className="py-3 text-right tabular-nums">{stats ? brl(stats.esa) : '—'}</td>
                    <td className="py-3 text-right tabular-nums text-emerald-700">
                      {stats ? brl(stats.save) : '—'}
                    </td>
                    <td className="py-3"><StatusPill status={u.paymentStatus} /></td>
                    <td className="py-3 px-5">
                      <div className="flex justify-end gap-1">
                        <IconBtn icon={Eye} label="Ver detalhes" onClick={() => openDetail(u.id)} />
                        <IconBtn icon={Pencil} label="Editar" onClick={() => openDetail(u.id)} />
                        <IconBtn icon={History} label="Histórico mensal" onClick={() => openDetail(u.id, 'history')} />
                        <IconBtn icon={FileText} label="Ver Fatura ESA" />
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
      {detailId && (
        <UBDetail ubId={detailId} initialTab={detailTab} onClose={() => setDetailId(null)} />
      )}
    </>
  );
}

function IconBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
  return (
    <button
      title={label}
      onClick={onClick}
      className="h-7 w-7 grid place-items-center rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Wizard — Nova UB
// ──────────────────────────────────────────────────────────────────────────────

const UB_STEPS = ['Identificação', 'Vinculação energética', 'Condições comerciais', 'Saldo inicial', 'Revisar'];

interface UBFormState {
  id: string; name: string; document: string; uc: string; distributor: string;
  status: string; esaEntryDate: string; ugId: string;
  preventiveMarginPct: string; averageMethod: 'history' | 'manual'; manualAverageKwh: string;
  esaPricePerKwh: string; priceEffectiveDate: string; dueDay: string;
  contractStatus: 'ativo' | 'pausado' | 'encerrado';
  commercialObservation: string;
  initialControlMonth: string; previousBalanceKwh: string; observations: string;
}

type UBSet = <K extends keyof UBFormState>(k: K, v: UBFormState[K]) => void;

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
    preventiveMarginPct: '5,00', averageMethod: 'manual', manualAverageKwh: '',
    esaPricePerKwh: '0,55', priceEffectiveDate: new Date().toISOString().slice(0, 10),
    dueDay: '10', contractStatus: 'ativo', commercialObservation: '',
    initialControlMonth: '2026-07', previousBalanceKwh: '0', observations: '',
    ...prefill,
  });

  const set: UBSet = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    provider.createBeneficiaryUnit({ ...f });
    toast.success('Unidade Beneficiária cadastrada', { description: 'Simulação — dados não persistidos.' });
    onClose();
  };

  return (
    <Modal
      open onClose={onClose}
      title="Nova Unidade Beneficiária"
      desc={sourceHint ?? 'Cadastro em etapas — gestão de créditos'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Voltar</Button>}
          {step < UB_STEPS.length - 1
            ? <Button onClick={() => setStep((s) => s + 1)}>Avançar</Button>
            : <Button onClick={save}>Cadastrar Unidade Beneficiária</Button>}
        </>
      }
    >
      <Stepper steps={UB_STEPS} current={step} />
      {step === 0 && <UBStep0 f={f} set={set} />}
      {step === 1 && <UBStep1 f={f} set={set} generatingUnits={generatingUnits} />}
      {step === 2 && <UBStep2 f={f} set={set} />}
      {step === 3 && <UBStep3 f={f} set={set} />}
      {step === 4 && <UBStep4 f={f} generatingUnits={generatingUnits} />}
    </Modal>
  );
}

function UBStep0({ f, set }: { f: UBFormState; set: UBSet }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="ID / Código">
        <input className={inputClass} value={f.id} onChange={(e) => set('id', e.target.value)} placeholder="UB-010" />
      </Field>
      <Field label="Status">
        <select className={inputClass} value={f.status} onChange={(e) => set('status', e.target.value)}>
          <option value="ativa">Ativa</option>
          <option value="inativa">Inativa</option>
        </select>
      </Field>
      <Field label="Nome / Razão Social" colSpan={2}>
        <input className={inputClass} value={f.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="CPF / CNPJ">
        <input className={inputClass} value={f.document} onChange={(e) => set('document', e.target.value)} />
      </Field>
      <Field label="Unidade Consumidora — UC">
        <input className={inputClass} value={f.uc} onChange={(e) => set('uc', e.target.value)} />
      </Field>
      <Field label="Distribuidora">
        <input className={inputClass} value={f.distributor} onChange={(e) => set('distributor', e.target.value)} />
      </Field>
      <Field label="Data de entrada na ESA">
        <input type="date" className={inputClass} value={f.esaEntryDate} onChange={(e) => set('esaEntryDate', e.target.value)} />
      </Field>
    </div>
  );
}

function UBStep1({
  f, set, generatingUnits,
}: {
  f: UBFormState; set: UBSet; generatingUnits: GeneratingUnit[];
}) {
  const selectedUg = generatingUnits.find((u) => u.id === f.ugId);
  return (
    <div className="space-y-3">
      <Field label="Unidade Geradora vinculada" colSpan={2}>
        <select className={inputClass} value={f.ugId} onChange={(e) => set('ugId', e.target.value)}>
          {generatingUnits.map((u) => (
            <option key={u.id} value={u.id}>{u.name} — {u.id}</option>
          ))}
          {generatingUnits.length === 0 && <option value="">Nenhuma UG cadastrada</option>}
        </select>
      </Field>
      {selectedUg && <UGSummaryCard ug={selectedUg} />}
      <Field label="Margem preventiva padrão (%)" hint="Ex.: 5,00">
        <input className={inputClass} value={f.preventiveMarginPct} onChange={(e) => set('preventiveMarginPct', e.target.value)} />
      </Field>
    </div>
  );
}

function UGSummaryCard({ ug }: { ug: GeneratingUnit }) {
  const provider = useEsaProvider();
  const ubsLinked = provider.listBeneficiaryUnits().filter((u) => u.ugId === ug.id);
  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-xs">
      <div className="font-semibold text-emerald-900 mb-2">{ug.name}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
        <span className="text-slate-500">Proprietário</span><span>{ug.owner}</span>
        <span className="text-slate-500">Geração de referência</span><span>{kwh(ug.monthlyGeneration)}</span>
        <span className="text-slate-500">Beneficiárias vinculadas</span><span>{ubsLinked.length}</span>
        <span className="text-slate-500">Preço padrão de compra</span><span>R$ {ug.purchasePrice.toFixed(2)}/kWh</span>
      </div>
    </div>
  );
}

function UBStep2({ f, set }: { f: UBFormState; set: UBSet }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-800">
        O faturamento oficial continuará sendo calculado pelo Billing Engine do ESA OS.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Preço ESA por kWh" hint="Ex.: 0,55">
          <input className={inputClass} value={f.esaPricePerKwh} onChange={(e) => set('esaPricePerKwh', e.target.value)} />
        </Field>
        <Field label="Data de vigência">
          <input type="date" className={inputClass} value={f.priceEffectiveDate} onChange={(e) => set('priceEffectiveDate', e.target.value)} />
        </Field>
        <Field label="Dia padrão de vencimento">
          <input className={inputClass} value={f.dueDay} onChange={(e) => set('dueDay', e.target.value)} />
        </Field>
        <Field label="Status do contrato">
          <select className={inputClass} value={f.contractStatus} onChange={(e) => set('contractStatus', e.target.value as UBFormState['contractStatus'])}>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </Field>
        <Field label="Observações" colSpan={2}>
          <textarea rows={2} className={inputClass} value={f.commercialObservation} onChange={(e) => set('commercialObservation', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

// For new UBs, hasSufficientHistory is always false — no history exists before first enrollment.
// When Core later returns this capability, it can be read from getBeneficiaryAverageComposition.
const HAS_SUFFICIENT_HISTORY = false;

function UBStep3({ f, set }: { f: UBFormState; set: UBSet }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium text-slate-700 uppercase tracking-wider">
            Método de cálculo da média de consumo
          </div>
          {!HAS_SUFFICIENT_HISTORY && (
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              Histórico insuficiente
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <MethodOption
            active={false}
            disabled
            onClick={() => {}}
            title="Calcular pelo histórico"
            desc="Sem faturas importadas suficientes para calcular a média histórica."
          />
          <MethodOption
            active={f.averageMethod === 'manual'}
            onClick={() => set('averageMethod', 'manual')}
            title="Informar média manual"
            desc="Utilizar valor informado até haver histórico disponível."
          />
        </div>
        <div className="mt-3">
          <Field label="Média mensal inicial de consumo (kWh/mês)">
            <input
              className={inputClass}
              value={f.manualAverageKwh}
              onChange={(e) => set('manualAverageKwh', e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Mês de referência inicial">
          <input className={inputClass} value={f.initialControlMonth} onChange={(e) => set('initialControlMonth', e.target.value)} placeholder="2026-07" />
        </Field>
        <Field label="Saldo anterior de créditos da UC (kWh)">
          <input className={inputClass} value={f.previousBalanceKwh} onChange={(e) => set('previousBalanceKwh', e.target.value)} />
        </Field>
        <Field label="Observações" colSpan={2}>
          <textarea rows={2} className={inputClass} value={f.observations} onChange={(e) => set('observations', e.target.value)} />
        </Field>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
        Informe o saldo existente na UC no início do controle para evitar divergência no histórico de créditos.
      </div>
    </div>
  );
}

function UBStep4({ f, generatingUnits }: { f: UBFormState; generatingUnits: GeneratingUnit[] }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
        Modo prévia — os dados abaixo serão enviados ao Core após confirmação. Nenhum ciclo anterior é afetado.
      </div>
      <RGroup title="Identificação">
        <RItem label="ID" value={f.id || '—'} />
        <RItem label="Nome" value={f.name || '—'} />
        <RItem label="Documento" value={f.document || '—'} />
        <RItem label="UC" value={f.uc || '—'} />
        <RItem label="Distribuidora" value={f.distributor} />
        <RItem label="Entrada ESA" value={f.esaEntryDate || '—'} />
      </RGroup>
      <RGroup title="Vinculação energética">
        <RItem label="UG" value={generatingUnits.find((u) => u.id === f.ugId)?.name ?? f.ugId} />
        <RItem label="Margem preventiva" value={`${f.preventiveMarginPct}%`} />
        <RItem label="Média inicial" value={f.manualAverageKwh ? `${f.manualAverageKwh} kWh/mês` : '—'} />
      </RGroup>
      <RGroup title="Condições comerciais">
        <RItem label="Preço ESA" value={`R$ ${f.esaPricePerKwh}/kWh`} />
        <RItem label="Vigência" value={f.priceEffectiveDate} />
        <RItem label="Vencimento" value={`Dia ${f.dueDay}`} />
        <RItem label="Contrato" value={f.contractStatus} />
      </RGroup>
      <RGroup title="Saldo inicial">
        <RItem label="Mês inicial" value={f.initialControlMonth} />
        <RItem label="Saldo anterior" value={`${f.previousBalanceKwh} kWh`} />
      </RGroup>
    </div>
  );
}

function MethodOption({
  active, disabled, onClick, title, desc,
}: {
  active: boolean; disabled?: boolean; onClick: () => void; title: string; desc: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`text-left rounded-lg border p-3 transition-all ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-slate-200 bg-white'
          : active
            ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className={`text-sm font-medium ${active && !disabled ? 'text-emerald-800' : 'text-slate-800'}`}>{title}</div>
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

// ──────────────────────────────────────────────────────────────────────────────
// Detalhe da UB — 2 abas
// ──────────────────────────────────────────────────────────────────────────────

function UBDetail({
  ubId, initialTab, onClose,
}: {
  ubId: string; initialTab?: 'overview' | 'history'; onClose: () => void;
}) {
  const provider = useEsaProvider();
  const ubs = provider.listBeneficiaryUnits();
  const ugs = provider.listGeneratingUnits();
  const ub = ubs.find((u) => u.id === ubId);
  const ug = ugs.find((g) => g.id === ub?.ugId);
  const [tab, setTab] = useState<'overview' | 'history'>(initialTab ?? 'overview');

  if (!ub) return null;
  return (
    <Modal open onClose={onClose} title={ub.name} desc={`${ub.id} · UG ${ug?.name ?? '—'}`} size="lg">
      <div className="flex gap-1 border-b border-slate-100 mb-4 -mt-1">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Visão geral</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>Histórico mensal</TabBtn>
      </div>
      {tab === 'overview' && <UBOverviewTab ub={ub} />}
      {tab === 'history' && <UBHistoryTab ubId={ubId} />}
    </Modal>
  );
}

function UBOverviewTab({ ub }: { ub: any }) {
  const provider = useEsaProvider();
  const currentMonth = provider.listMonths()[0]?.value ?? '2026-07';
  const creditBalance = provider.getBeneficiaryCreditBalance(ub.id, currentMonth);
  const avgComp = provider.getBeneficiaryAverageComposition(ub.id);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoBlock label="Consumo atual" value={kwh(ub.monthlyConsumption)} />
        <InfoBlock label="Compensado" value={creditBalance ? kwh(creditBalance.compensated) : '—'} />
        <InfoBlock label="Saldo de créditos" value={creditBalance ? kwh(creditBalance.final) : '—'} />
        <InfoBlock label="Cobertura" value={creditBalance ? `${creditBalance.coverageMonths.toFixed(1)} meses` : '—'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoBlock label="Média mensal" value={avgComp ? kwh(avgComp.monthlyAverageKwh) : '—'} />
        <InfoBlock label="Margem preventiva" value={`${(ub.preventiveMargin * 100).toFixed(2)}%`} />
        <InfoBlock label="Economia acumulada" value={brl(ub.accumulatedSavings)} />
        <InfoBlock label="Preço ESA" value={`R$ ${ub.esaPrice.toFixed(2)}/kWh`} />
      </div>
      {creditBalance && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-2">Movimentação de créditos</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <MiniStat label="Saldo anterior" value={kwh(creditBalance.previous)} />
            <MiniStat label="Recebidos" value={kwh(creditBalance.received)} />
            <MiniStat label="Compensados" value={kwh(creditBalance.compensated)} />
            <MiniStat label="Saldo final" value={kwh(creditBalance.final)} />
          </div>
        </div>
      )}
      <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-2">Condição comercial</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-700">
          <span className="text-slate-500">Preço ESA</span><span>R$ {ub.esaPrice.toFixed(2)}/kWh</span>
          <span className="text-slate-500">Tarifa distribuidora</span><span>R$ {ub.distributorTariff.toFixed(2)}/kWh</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline"><Pencil className="h-4 w-4" /> Editar beneficiária</Button>
        <Button variant="outline"><FileText className="h-4 w-4" /> Ver Fatura ESA</Button>
      </div>
    </div>
  );
}

function UBHistoryTab({ ubId }: { ubId: string }) {
  const provider = useEsaProvider();
  const history: any[] = provider.getBeneficiaryMonthlyHistory(ubId) ?? [];
  const avgComp = provider.getBeneficiaryAverageComposition(ubId) ?? {
    monthsConsidered: 0, monthlyAverageKwh: 0,
    bySource: { utility_bill_import: 0, csv_import: 0, manual_entry: 0 },
  };
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const record = openMonth ? provider.getBeneficiaryMonthlyRecord(ubId, openMonth) : null;

  const badgeFor = (s: string) =>
    s === 'utility_bill_import' ? <Badge tone="green">FATURA IMPORTADA</Badge>
    : s === 'csv_import' ? <Badge tone="blue">CSV</Badge>
    : <Badge tone="slate">MANUAL</Badge>;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600">
        Registros mensais confirmados são considerados no cálculo da média histórica de consumo.
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-700">
          <MiniStat label="Meses considerados" value={String(avgComp.monthsConsidered)} />
          <MiniStat label="Média calculada" value={`${avgComp.monthlyAverageKwh} kWh/mês`} />
          <MiniStat label="Faturas importadas" value={String(avgComp.bySource?.utility_bill_import ?? 0)} />
          <MiniStat label="CSV / Manual" value={`${avgComp.bySource?.csv_import ?? 0} / ${avgComp.bySource?.manual_entry ?? 0}`} />
        </div>
      </div>
      {history.length === 0
        ? <div className="py-6 text-center text-sm text-slate-400">Nenhum registro mensal confirmado.</div>
        : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                  <th className="py-2 px-2 font-medium">Mês</th>
                  <th className="py-2 font-medium text-right">Consumo</th>
                  <th className="py-2 font-medium">Origem</th>
                  <th className="py-2 font-medium">Status</th>
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
                    <td className="py-2 px-2 text-right">
                      <button className="text-xs text-emerald-700 hover:underline" onClick={() => setOpenMonth(r.month)}>Detalhar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {openMonth && record && (
        <Modal open onClose={() => setOpenMonth(null)} title={`Fatura da distribuidora · ${openMonth}`} desc={record.fileName ?? undefined} size="lg">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <InfoBlock label="UC" value={record.utilityConsumerUnit} />
            <InfoBlock label="Mês de referência" value={record.referenceMonth} />
            <InfoBlock label="Consumo (kWh)" value={String(record.consumptionKwh)} />
            <InfoBlock label="TE" value={brl(record.teValue)} />
            <InfoBlock label="TUSD" value={brl(record.tusdValue)} />
            <InfoBlock label="Fio B" value={brl(record.fioB)} />
            <InfoBlock label="Bandeira" value={brl(record.flagValue)} />
            <InfoBlock label="CIP" value={brl(record.cipValue)} />
            <InfoBlock label="Impostos" value={brl(record.taxesValue)} />
            <InfoBlock label="Mín. faturável (kWh)" value={String(record.minimumBillableKwh)} />
            <InfoBlock label="Valor total" value={brl(record.totalBillValue)} />
            <InfoBlock label="Data da importação" value={record.importedAt} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 -mb-px ${active ? 'border-emerald-600 text-emerald-800 font-medium' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
    >
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
