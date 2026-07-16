import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Eye, Pencil, Calculator, FileText, Copy } from 'lucide-react';
import {
  Card, SectionTitle, Button, StatusPill, Badge, Modal, Stepper, Field, inputClass, CycleBadge,
} from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import type { GeneratingUnit } from '@/lib/esa/types';
import { kwh, brl } from '@/lib/esa/format';

// ──────────────────────────────────────────────────────────────────────────────
// List view
// ──────────────────────────────────────────────────────────────────────────────

export function GeneratingUnitsView() {
  const provider = useEsaProvider();
  const generatingUnits = provider.listGeneratingUnits();
  const beneficiaryUnits = provider.listBeneficiaryUnits();
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const rows = generatingUnits.filter((u) =>
    (u.name + u.owner + u.uc).toLowerCase().includes(filter.toLowerCase()),
  );
  const ubCountFor = (ugId: string) => beneficiaryUnits.filter((b) => b.ugId === ugId).length;
  const avgPrice =
    generatingUnits.reduce((s, u) => s + u.purchasePrice, 0) / (generatingUnits.length || 1);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle
          title="Unidades Geradoras"
          desc={`${generatingUnits.length} usinas cadastradas`}
          right={
            <div className="flex gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar por nome, proprietário ou UC..."
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 outline-none focus:border-emerald-500 w-64"
              />
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Nova Unidade Geradora
              </Button>
            </div>
          }
        />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                <th className="py-2.5 px-5 font-medium">Unidade</th>
                <th className="py-2.5 font-medium">Proprietário</th>
                <th className="py-2.5 font-medium">UC / Distribuidora</th>
                <th className="py-2.5 font-medium text-right">Saldo atual</th>
                <th className="py-2.5 font-medium text-right">Geração do mês</th>
                <th className="py-2.5 font-medium text-right">Preço de compra</th>
                <th className="py-2.5 font-medium text-center">Beneficiárias</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 px-5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-slate-400">
                    {generatingUnits.length === 0
                      ? 'Nenhuma Unidade Geradora cadastrada.'
                      : 'Nenhum resultado para a busca realizada.'}
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <UGTableRow
                  key={u.id}
                  u={u}
                  ubCount={ubCountFor(u.id)}
                  onDetail={() => setDetailId(u.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-slate-500">
          Preço médio de compra:{' '}
          <span className="text-slate-800 font-medium">R$ {avgPrice.toFixed(2)}/kWh</span>
        </div>
      </Card>
      {showForm && <UGForm onClose={() => setShowForm(false)} />}
      {detailId && (
        <UGDetail
          ug={generatingUnits.find((u) => u.id === detailId)!}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

function UGTableRow({
  u, ubCount, onDetail,
}: {
  u: GeneratingUnit; ubCount: number; onDetail: () => void;
}) {
  return (
    <tr className="hover:bg-slate-50/60 transition-colors">
      <td className="py-3 px-5">
        <div className="font-medium text-slate-900">{u.name}</div>
        <div className="text-[11px] text-slate-500">{u.id} · {u.document}</div>
      </td>
      <td className="py-3">{u.owner}</td>
      <td className="py-3">
        <div className="text-slate-700">{u.uc}</div>
        <div className="text-[11px] text-slate-500">{u.distributor}</div>
      </td>
      <td className="py-3 text-right tabular-nums font-medium">{kwh(u.previousBalance)}</td>
      <td className="py-3 text-right tabular-nums text-emerald-700 font-medium">{kwh(u.monthlyGeneration)}</td>
      <td className="py-3 text-right tabular-nums">R$ {u.purchasePrice.toFixed(2)}/kWh</td>
      <td className="py-3 text-center"><Badge tone="slate">{ubCount}</Badge></td>
      <td className="py-3"><StatusPill status={u.status} /></td>
      <td className="py-3 px-5">
        <div className="flex justify-end gap-1">
          <IconBtn icon={Eye} label="Ver detalhes" onClick={onDetail} />
          <IconBtn icon={Pencil} label="Editar" onClick={onDetail} />
          <IconBtn icon={Calculator} label="Apurar mês" />
          <IconBtn icon={FileText} label="Relatório" />
        </div>
      </td>
    </tr>
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
// Wizard — Nova UG
// ──────────────────────────────────────────────────────────────────────────────

const UG_STEPS = ['Identificação', 'Condição de compra', 'Recebedor / PIX', 'Revisar'];

interface UGFormState {
  id: string; name: string; owner: string; document: string; uc: string;
  distributor: string; status: string; startDate: string;
  purchasePricePerKwh: string; priceEffectiveDate: string; commercialObservation: string;
  recipientIsOwner: boolean; recipientName: string; recipientDocument: string;
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'; pixKey: string;
}

type UGSet = <K extends keyof UGFormState>(k: K, v: UGFormState[K]) => void;

function UGForm({ onClose }: { onClose: () => void }) {
  const provider = useEsaProvider();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<UGFormState>({
    id: '', name: '', owner: '', document: '', uc: '', distributor: 'Copel',
    status: 'ativa', startDate: '',
    purchasePricePerKwh: '0,35', priceEffectiveDate: new Date().toISOString().slice(0, 10),
    commercialObservation: '', recipientIsOwner: true,
    recipientName: '', recipientDocument: '', pixKeyType: 'cpf', pixKey: '',
  });

  const set: UGSet = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const recipientName = f.recipientIsOwner ? f.owner : f.recipientName;
  const recipientDocument = f.recipientIsOwner ? f.document : f.recipientDocument;

  const save = () => {
    provider.createGeneratingUnit({
      id: f.id, name: f.name, owner: f.owner, document: f.document, uc: f.uc,
      distributor: f.distributor, status: f.status, startDate: f.startDate,
      purchasePricePerKwh: Number(f.purchasePricePerKwh.replace(',', '.')),
      priceEffectiveDate: f.priceEffectiveDate, commercialObservation: f.commercialObservation,
      settlementRecipient: { recipientName, recipientDocument, pixKeyType: f.pixKeyType, pixKey: f.pixKey },
    });
    toast.success('Unidade Geradora cadastrada', { description: 'Simulação — dados não persistidos.' });
    onClose();
  };

  return (
    <Modal
      open onClose={onClose}
      title="Nova Unidade Geradora"
      desc="Cadastro em etapas — módulo Gestão de Créditos"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Voltar</Button>}
          {step < UG_STEPS.length - 1
            ? <Button onClick={() => setStep((s) => s + 1)}>Avançar</Button>
            : <Button onClick={save}>Cadastrar Unidade Geradora</Button>}
        </>
      }
    >
      <Stepper steps={UG_STEPS} current={step} />
      {step === 0 && <UGStep0 f={f} set={set} />}
      {step === 1 && <UGStep1 f={f} set={set} />}
      {step === 2 && <UGStep2 f={f} set={set} recipientName={recipientName} recipientDoc={recipientDocument} />}
      {step === 3 && <UGStep3 f={f} recipientName={recipientName} recipientDoc={recipientDocument} />}
    </Modal>
  );
}

function UGStep0({ f, set }: { f: UGFormState; set: UGSet }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="ID / Código">
        <input className={inputClass} placeholder="UG-004" value={f.id} onChange={(e) => set('id', e.target.value)} />
      </Field>
      <Field label="Status">
        <select className={inputClass} value={f.status} onChange={(e) => set('status', e.target.value)}>
          <option value="ativa">Ativa</option>
          <option value="manutencao">Manutenção</option>
          <option value="inativa">Inativa</option>
        </select>
      </Field>
      <Field label="Nome da UG" colSpan={2}>
        <input className={inputClass} placeholder="UG Solar ..." value={f.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Proprietário">
        <input className={inputClass} placeholder="Nome do titular" value={f.owner} onChange={(e) => set('owner', e.target.value)} />
      </Field>
      <Field label="CPF / CNPJ do proprietário">
        <input className={inputClass} placeholder="000.000.000-00" value={f.document} onChange={(e) => set('document', e.target.value)} />
      </Field>
      <Field label="Unidade Consumidora — UC">
        <input className={inputClass} placeholder="123456789" value={f.uc} onChange={(e) => set('uc', e.target.value)} />
      </Field>
      <Field label="Distribuidora">
        <input className={inputClass} value={f.distributor} onChange={(e) => set('distributor', e.target.value)} />
      </Field>
      <Field label="Início da operação">
        <input type="date" className={inputClass} value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
      </Field>
    </div>
  );
}

function UGStep1({ f, set }: { f: UGFormState; set: UGSet }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800">
        Valor padrão utilizado para cálculo do repasse ao proprietário da Unidade Geradora. O preço
        aplicado em cada ciclo pode diferir do padrão caso haja revisão comercial.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Preço padrão de compra (R$/kWh)" hint="Ex.: 0,35">
          <input className={inputClass} value={f.purchasePricePerKwh} onChange={(e) => set('purchasePricePerKwh', e.target.value)} />
        </Field>
        <Field label="Data de vigência do preço">
          <input type="date" className={inputClass} value={f.priceEffectiveDate} onChange={(e) => set('priceEffectiveDate', e.target.value)} />
        </Field>
        <Field label="Observação da condição comercial" colSpan={2}>
          <textarea rows={3} className={inputClass} placeholder="Ex.: reajuste anual pelo IPCA" value={f.commercialObservation} onChange={(e) => set('commercialObservation', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function UGStep2({
  f, set, recipientName, recipientDoc,
}: {
  f: UGFormState; set: UGSet; recipientName: string; recipientDoc: string;
}) {
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" className="mt-1" checked={f.recipientIsOwner} onChange={(e) => set('recipientIsOwner', e.target.checked)} />
        <span>
          <span className="font-medium text-slate-800">O recebedor é o mesmo proprietário da Unidade Geradora</span>
          <div className="text-xs text-slate-500">Se desmarcado, é possível cadastrar outro destinatário do repasse.</div>
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nome do recebedor" colSpan={2}>
          <input className={inputClass} value={recipientName} disabled={f.recipientIsOwner} onChange={(e) => set('recipientName', e.target.value)} />
        </Field>
        <Field label="CPF / CNPJ do recebedor">
          <input className={inputClass} value={recipientDoc} disabled={f.recipientIsOwner} onChange={(e) => set('recipientDocument', e.target.value)} />
        </Field>
        <Field label="Tipo da chave PIX">
          <select className={inputClass} value={f.pixKeyType} onChange={(e) => set('pixKeyType', e.target.value as UGFormState['pixKeyType'])}>
            <option value="cpf">CPF</option>
            <option value="cnpj">CNPJ</option>
            <option value="email">E-mail</option>
            <option value="telefone">Telefone</option>
            <option value="aleatoria">Aleatória</option>
          </select>
        </Field>
        <Field label="Chave PIX" colSpan={2}>
          <div className="flex gap-2">
            <input className={inputClass} value={f.pixKey} onChange={(e) => set('pixKey', e.target.value)} placeholder="chave@pix.com" />
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(f.pixKey); toast('Chave PIX copiada'); }}>
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </div>
        </Field>
      </div>
    </div>
  );
}

function UGStep3({
  f, recipientName, recipientDoc,
}: {
  f: UGFormState; recipientName: string; recipientDoc: string;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
        Modo prévia — os dados abaixo serão enviados ao Core após confirmação. Nenhum ciclo anterior é afetado.
      </div>
      <ReviewGroup title="Identificação">
        <ReviewItem label="ID" value={f.id || '—'} />
        <ReviewItem label="Nome" value={f.name || '—'} />
        <ReviewItem label="Proprietário" value={f.owner || '—'} />
        <ReviewItem label="Documento" value={f.document || '—'} />
        <ReviewItem label="UC" value={f.uc || '—'} />
        <ReviewItem label="Distribuidora" value={f.distributor} />
        <ReviewItem label="Início da operação" value={f.startDate || '—'} />
        <ReviewItem label="Status" value={f.status} />
      </ReviewGroup>
      <ReviewGroup title="Condição de compra">
        <ReviewItem label="Preço padrão" value={`R$ ${f.purchasePricePerKwh}/kWh`} />
        <ReviewItem label="Vigência" value={f.priceEffectiveDate} />
        <ReviewItem label="Observação" value={f.commercialObservation || '—'} colSpan />
      </ReviewGroup>
      <ReviewGroup title="Recebedor / PIX">
        <ReviewItem label="Recebedor" value={recipientName || '—'} />
        <ReviewItem label="Documento" value={recipientDoc || '—'} />
        <ReviewItem label="Tipo PIX" value={f.pixKeyType} />
        <ReviewItem label="Chave PIX" value={f.pixKey || '—'} />
      </ReviewGroup>
    </div>
  );
}

function ReviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>
    </div>
  );
}

function ReviewItem({ label, value, colSpan }: { label: string; value: string; colSpan?: boolean }) {
  return (
    <div className={colSpan ? 'sm:col-span-2' : ''}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-slate-800 font-medium truncate">{value}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Detalhe da UG — 5 abas
// ──────────────────────────────────────────────────────────────────────────────

type UGTab = 'resumo' | 'benef' | 'comercial' | 'pix' | 'hist';

const UG_TABS: { key: UGTab; label: string }[] = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'benef', label: 'Beneficiárias' },
  { key: 'comercial', label: 'Condição comercial' },
  { key: 'pix', label: 'Recebedor / PIX' },
  { key: 'hist', label: 'Histórico' },
];

function UGDetail({ ug, onClose }: { ug: GeneratingUnit; onClose: () => void }) {
  const provider = useEsaProvider();
  const [tab, setTab] = useState<UGTab>('resumo');
  const currentMonth = provider.listMonths()[0]?.value ?? '2026-07';
  const beneficiaryUnits = provider.listBeneficiaryUnits();
  const ubs = useMemo(() => beneficiaryUnits.filter((b) => b.ugId === ug.id), [beneficiaryUnits, ug.id]);
  const terms = provider.getGeneratingUnitCommercialTerms(ug.id);
  const recipient = provider.getSettlementRecipient(ug.id);

  return (
    <Modal open onClose={onClose} title={ug.name} desc={`${ug.id} · ${ug.owner}`} size="lg">
      <div className="flex gap-1 border-b border-slate-100 mb-4 overflow-x-auto">
        {UG_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-2 border-b-2 whitespace-nowrap ${tab === t.key ? 'border-emerald-500 text-emerald-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'resumo' && <UGResumoTab ug={ug} ubs={ubs} currentMonth={currentMonth} />}
      {tab === 'benef' && <UGBenefTab ug={ug} ubs={ubs} currentMonth={currentMonth} />}
      {tab === 'comercial' && <UGComercialTab terms={terms} />}
      {tab === 'pix' && <UGPixTab recipient={recipient} />}
      {tab === 'hist' && <UGHistoricoTab ugId={ug.id} />}
    </Modal>
  );
}

function UGResumoTab({ ug, ubs, currentMonth }: { ug: GeneratingUnit; ubs: any[]; currentMonth: string }) {
  const provider = useEsaProvider();
  const cycleSummary = provider.getGeneratingUnitCycleSummary(ug.id, { month: currentMonth });
  const report = provider.getGeneratingUnitCreditDestinationReport(ug.id, currentMonth);
  const alerts = provider.getAlertsSummary({ month: currentMonth }).slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <InfoCard label="Geração do mês" value={kwh(cycleSummary?.generationKwh ?? ug.monthlyGeneration)} />
        <InfoCard label="Saldo atual" value={kwh(cycleSummary?.totalFinalBalanceKwh ?? ug.previousBalance)} />
        <InfoCard label="Créditos compensados" value={kwh(cycleSummary?.totalCompensatedKwh ?? 0)} />
        <InfoCard label="Beneficiárias vinculadas" value={String(ubs.length)} />
        <InfoCard label="Preço padrão" value={`R$ ${ug.purchasePrice.toFixed(2)}/kWh`} />
        <InfoCard label="Repasse do mês" value={report ? brl(report.ownerPayment) : '—'} />
      </div>
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Alertas recentes</div>
          {alerts.map((a: any) => (
            <div key={a.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">{a.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function UGBenefTab({ ug, ubs, currentMonth }: { ug: GeneratingUnit; ubs: any[]; currentMonth: string }) {
  const provider = useEsaProvider();
  const plan = provider.getCreditAllocationPlan(ug.id, currentMonth);
  const planRowMap = new Map((plan?.rows ?? []).map((r: any) => [r.ub.id, r]));

  if (ubs.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-400">Nenhuma beneficiária vinculada a esta UG.</div>;
  }
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
            <th className="py-2 px-5 font-medium">Beneficiária</th>
            <th className="py-2 font-medium">UC</th>
            <th className="py-2 font-medium text-right">Consumo</th>
            <th className="py-2 font-medium text-right">Compensado</th>
            <th className="py-2 font-medium text-right">Saldo</th>
            <th className="py-2 font-medium text-right">Cobertura</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ubs.map((u: any) => {
            const pr: any = planRowMap.get(u.id);
            return (
              <tr key={u.id} className="hover:bg-slate-50/60">
                <td className="py-2.5 px-5 font-medium">{u.name}</td>
                <td className="py-2.5">{u.uc}</td>
                <td className="py-2.5 text-right tabular-nums">{kwh(u.monthlyConsumption)}</td>
                <td className="py-2.5 text-right tabular-nums">{pr ? kwh(pr.creditsCompensatedKwh) : '—'}</td>
                <td className="py-2.5 text-right tabular-nums">{pr ? kwh(pr.finalBalanceKwh) : '—'}</td>
                <td className="py-2.5 text-right tabular-nums">{pr ? `${pr.coverageMonths.toFixed(1)} mes.` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UGComercialTab({ terms }: { terms: any }) {
  if (!terms) return <div className="py-8 text-center text-sm text-slate-400">Sem condição comercial registrada.</div>;
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <InfoCard label="Preço padrão" value={`R$ ${terms.purchasePricePerKwh.toFixed(2)}/kWh`} />
      <InfoCard label="Vigência" value={terms.effectiveDate} />
      <InfoCard label="Último preço aplicado" value={`R$ ${terms.lastAppliedPricePerKwh.toFixed(2)}/kWh`} />
      <InfoCard label="Mês do último preço" value={terms.lastAppliedMonth} />
      <div className="col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
        {terms.observation}
      </div>
    </div>
  );
}

function UGPixTab({ recipient }: { recipient: any }) {
  if (!recipient) return <div className="py-8 text-center text-sm text-slate-400">Sem recebedor cadastrado.</div>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoCard label="Nome" value={recipient.recipientName} />
        <InfoCard label="Documento" value={recipient.recipientDocument} />
        <InfoCard label="Tipo da chave" value={recipient.pixKeyType} />
        <InfoCard label="Chave PIX" value={recipient.pixKey} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { navigator.clipboard.writeText(recipient.pixKey); toast('Chave PIX copiada'); }}>
          <Copy className="h-4 w-4" /> Copiar PIX
        </Button>
        <Button variant="outline"><Pencil className="h-4 w-4" /> Alterar recebedor</Button>
      </div>
    </div>
  );
}

function UGHistoricoTab({ ugId }: { ugId: string }) {
  const provider = useEsaProvider();
  const months = provider.listMonths();
  const rows: Array<{ month: (typeof months)[0]; report: any }> = [];
  for (const m of months) {
    try {
      const report = provider.getGeneratingUnitCreditDestinationReport(ugId, m.value);
      if (report) rows.push({ month: m, report });
    } catch {
      // unknown Core error — skip month
    }
  }

  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-400">Nenhum ciclo apurado para esta unidade.</div>;
  }
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
            <th className="py-2 px-5 font-medium">Mês</th>
            <th className="py-2 font-medium text-right">Geração</th>
            <th className="py-2 font-medium text-right">Distribuído</th>
            <th className="py-2 font-medium text-right">Compensado</th>
            <th className="py-2 font-medium text-right">Saldo</th>
            <th className="py-2 font-medium text-right">Repasse</th>
            <th className="py-2 px-5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ month, report }) => (
            <tr key={month.value} className="hover:bg-slate-50/60">
              <td className="py-2.5 px-5 font-medium">{month.label}</td>
              <td className="py-2.5 text-right tabular-nums">{kwh(report.generation)}</td>
              <td className="py-2.5 text-right tabular-nums">{kwh(report.totalDistributed)}</td>
              <td className="py-2.5 text-right tabular-nums">{kwh(report.totalCompensated)}</td>
              <td className="py-2.5 text-right tabular-nums">{kwh(report.totalAccumulatedBalance)}</td>
              <td className="py-2.5 text-right tabular-nums text-emerald-700">{brl(report.ownerPayment)}</td>
              <td className="py-2.5 px-5"><CycleBadge status={month.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className="text-slate-800 font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
