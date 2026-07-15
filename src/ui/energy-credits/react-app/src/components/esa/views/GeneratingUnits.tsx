import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Eye, Pencil, Calculator, FileText, Copy } from 'lucide-react';
import {
  Card, SectionTitle, Button, StatusPill, Badge, Modal, Stepper, Field, inputClass,
} from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import type { GeneratingUnit } from '@/lib/esa/types';
import { kwh, brl } from '@/lib/esa/format';

export function GeneratingUnitsView() {
  const provider = useEsaProvider();
  const generatingUnits = provider.listGeneratingUnits();
  const beneficiaryUnits = provider.listBeneficiaryUnits();

  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const rows = generatingUnits.filter((u) =>
    (u.name + u.owner + u.id).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle
          title="Unidades Geradoras"
          desc={`${generatingUnits.length} usinas cadastradas`}
          right={
            <div className="flex gap-2">
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar UG..." className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 outline-none focus:border-emerald-500 w-52" />
              <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Nova Unidade Geradora</Button>
            </div>
          }
        />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                <th className="py-2.5 px-5 font-medium">Unidade</th>
                <th className="py-2.5 font-medium">Proprietário</th>
                <th className="py-2.5 font-medium">UC / Distr.</th>
                <th className="py-2.5 font-medium text-right">Saldo atual</th>
                <th className="py-2.5 font-medium text-right">Geração mês</th>
                <th className="py-2.5 font-medium text-right">Preço compra</th>
                <th className="py-2.5 font-medium text-center">Benef.</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 px-5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((u) => {
                const linkedUbs = beneficiaryUnits.filter((b) => b.ugId === u.id);
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
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
                    <td className="py-3 text-center"><Badge tone="slate">{linkedUbs.length}</Badge></td>
                    <td className="py-3"><StatusPill status={u.status} /></td>
                    <td className="py-3 px-5">
                      <div className="flex justify-end gap-1">
                        <IconBtn icon={Eye} label="Detalhes" onClick={() => setDetailId(u.id)} />
                        <IconBtn icon={Pencil} label="Editar" onClick={() => setDetailId(u.id)} />
                        <IconBtn icon={Calculator} label="Apurar mês" />
                        <IconBtn icon={FileText} label="Relatório" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-slate-500">
          Preço médio de compra:{' '}
          <span className="text-slate-800 font-medium">
            {brl(generatingUnits.reduce((s, u) => s + u.purchasePrice, 0) / (generatingUnits.length || 1))}/kWh
          </span>
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

function IconBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
  return (
    <button title={label} onClick={onClick} className="h-7 w-7 grid place-items-center rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

const UG_STEPS = ['Identificação', 'Condição de compra', 'Recebedor / PIX', 'Revisar'];

interface UGFormState {
  id: string; name: string; owner: string; document: string; uc: string;
  distributor: string; status: string; startDate: string;
  purchasePricePerKwh: string; priceEffectiveDate: string;
  commercialObservation: string; recipientIsOwner: boolean;
  recipientName: string; recipientDocument: string;
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'; pixKey: string;
}

function UGForm({ onClose }: { onClose: () => void }) {
  const provider = useEsaProvider();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<UGFormState>({
    id: '', name: '', owner: '', document: '', uc: '', distributor: 'Copel',
    status: 'ativa', startDate: '', purchasePricePerKwh: '0,35',
    priceEffectiveDate: new Date().toISOString().slice(0, 10),
    commercialObservation: '', recipientIsOwner: true, recipientName: '',
    recipientDocument: '', pixKeyType: 'cpf', pixKey: '',
  });

  const set = <K extends keyof UGFormState>(k: K, v: UGFormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const recipientName = f.recipientIsOwner ? f.owner : f.recipientName;
  const recipientDocument = f.recipientIsOwner ? f.document : f.recipientDocument;
  const next = () => setStep((s) => Math.min(UG_STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

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
    <Modal open onClose={onClose} title="Nova Unidade Geradora" desc="Cadastro em etapas — módulo Gestão de Créditos" size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {step > 0 && <Button variant="outline" onClick={back}>Voltar</Button>}
          {step < UG_STEPS.length - 1 ? <Button onClick={next}>Avançar</Button> : <Button onClick={save}>Salvar Unidade Geradora</Button>}
        </>
      }
    >
      <Stepper steps={UG_STEPS} current={step} />
      {step === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="ID / Código"><input className={inputClass} placeholder="UG-004" value={f.id} onChange={(e) => set('id', e.target.value)} /></Field>
          <Field label="Status">
            <select className={inputClass} value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ativa">Ativa</option><option value="manutencao">Manutenção</option><option value="inativa">Inativa</option>
            </select>
          </Field>
          <Field label="Nome da UG" colSpan={2}><input className={inputClass} placeholder="UG Solar ..." value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Proprietário"><input className={inputClass} placeholder="Nome do titular" value={f.owner} onChange={(e) => set('owner', e.target.value)} /></Field>
          <Field label="CPF / CNPJ do proprietário"><input className={inputClass} placeholder="000.000.000-00" value={f.document} onChange={(e) => set('document', e.target.value)} /></Field>
          <Field label="Unidade Consumidora — UC"><input className={inputClass} placeholder="123456789" value={f.uc} onChange={(e) => set('uc', e.target.value)} /></Field>
          <Field label="Distribuidora"><input className={inputClass} value={f.distributor} onChange={(e) => set('distributor', e.target.value)} /></Field>
          <Field label="Data de início da operação"><input type="date" className={inputClass} value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800">
            Valor padrão utilizado para cálculo do repasse ao proprietário da Unidade Geradora.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Preço padrão de compra (R$/kWh)" hint="Ex.: 0,35"><input className={inputClass} value={f.purchasePricePerKwh} onChange={(e) => set('purchasePricePerKwh', e.target.value)} /></Field>
            <Field label="Data de vigência do preço"><input type="date" className={inputClass} value={f.priceEffectiveDate} onChange={(e) => set('priceEffectiveDate', e.target.value)} /></Field>
            <Field label="Observação da condição comercial" colSpan={2}><textarea rows={3} className={inputClass} placeholder="Ex.: reajuste anual pelo IPCA" value={f.commercialObservation} onChange={(e) => set('commercialObservation', e.target.value)} /></Field>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={f.recipientIsOwner} onChange={(e) => set('recipientIsOwner', e.target.checked)} />
            <span><span className="font-medium text-slate-800">O recebedor é o mesmo proprietário da Unidade Geradora</span><div className="text-xs text-slate-500">Se desmarcado, é possível cadastrar outro destinatário do repasse.</div></span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome do recebedor" colSpan={2}><input className={inputClass} value={recipientName} disabled={f.recipientIsOwner} onChange={(e) => set('recipientName', e.target.value)} /></Field>
            <Field label="CPF / CNPJ"><input className={inputClass} value={recipientDocument} disabled={f.recipientIsOwner} onChange={(e) => set('recipientDocument', e.target.value)} /></Field>
            <Field label="Tipo da chave PIX">
              <select className={inputClass} value={f.pixKeyType} onChange={(e) => set('pixKeyType', e.target.value as any)}>
                <option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option>
              </select>
            </Field>
            <Field label="Chave PIX" colSpan={2}>
              <div className="flex gap-2">
                <input className={inputClass} value={f.pixKey} onChange={(e) => set('pixKey', e.target.value)} placeholder="chave@pix.com" />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(f.pixKey); toast('Chave PIX copiada'); }}><Copy className="h-4 w-4" /> Copiar</Button>
              </div>
            </Field>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3 text-sm">
          <ReviewGroup title="Identificação">
            <ReviewItem label="ID" value={f.id || '—'} /><ReviewItem label="Nome" value={f.name || '—'} />
            <ReviewItem label="Proprietário" value={f.owner || '—'} /><ReviewItem label="Documento" value={f.document || '—'} />
            <ReviewItem label="UC" value={f.uc || '—'} /><ReviewItem label="Distribuidora" value={f.distributor} />
            <ReviewItem label="Início operação" value={f.startDate || '—'} /><ReviewItem label="Status" value={f.status} />
          </ReviewGroup>
          <ReviewGroup title="Condição comercial">
            <ReviewItem label="Preço padrão" value={`R$ ${f.purchasePricePerKwh}/kWh`} /><ReviewItem label="Vigência" value={f.priceEffectiveDate} />
            <ReviewItem label="Observação" value={f.commercialObservation || '—'} colSpan />
          </ReviewGroup>
          <ReviewGroup title="Recebedor / PIX">
            <ReviewItem label="Recebedor" value={recipientName || '—'} /><ReviewItem label="Documento" value={recipientDocument || '—'} />
            <ReviewItem label="Tipo PIX" value={f.pixKeyType} /><ReviewItem label="Chave PIX" value={f.pixKey || '—'} />
          </ReviewGroup>
        </div>
      )}
    </Modal>
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

type UGTab = 'resumo' | 'benef' | 'commercial' | 'pix' | 'hist';

function UGDetail({ ug, onClose }: { ug: GeneratingUnit; onClose: () => void }) {
  const provider = useEsaProvider();
  const beneficiaryUnits = provider.listBeneficiaryUnits();
  const [tab, setTab] = useState<UGTab>('resumo');
  const ubs = useMemo(() => beneficiaryUnits.filter((b) => b.ugId === ug.id), [ug.id]);
  const terms = provider.getGeneratingUnitCommercialTerms(ug.id);
  const recipient = provider.getSettlementRecipient(ug.id);

  const tabs: { key: UGTab; label: string }[] = [
    { key: 'resumo', label: 'Resumo' }, { key: 'benef', label: 'Beneficiárias' },
    { key: 'commercial', label: 'Condição comercial' }, { key: 'pix', label: 'Recebedor / PIX' },
    { key: 'hist', label: 'Histórico' },
  ];

  return (
    <Modal open onClose={onClose} title={ug.name} desc={`${ug.id} · ${ug.owner}`} size="lg">
      <div className="flex gap-1 border-b border-slate-100 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`text-xs px-3 py-2 border-b-2 whitespace-nowrap ${tab === t.key ? 'border-emerald-500 text-emerald-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'resumo' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Info label="UC" value={ug.uc} /><Info label="Distribuidora" value={ug.distributor} />
          <Info label="Status" value={ug.status} /><Info label="Saldo anterior" value={kwh(ug.previousBalance)} />
          <Info label="Geração mensal" value={kwh(ug.monthlyGeneration)} /><Info label="Beneficiárias" value={String(ubs.length)} />
        </div>
      )}
      {tab === 'benef' && (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                <th className="py-2 px-5">Beneficiária</th><th className="py-2">UC</th>
                <th className="py-2 text-right">Rateio</th><th className="py-2 text-right">Consumo</th><th className="py-2 px-5">Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ubs.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 px-5 font-medium">{u.name}</td><td className="py-2">{u.uc}</td>
                  <td className="py-2 text-right tabular-nums">{(u.allocationPct * 100).toFixed(1)}%</td>
                  <td className="py-2 text-right tabular-nums">{kwh(u.monthlyConsumption)}</td>
                  <td className="py-2 px-5"><StatusPill status={u.paymentStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'commercial' && terms && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Preço padrão" value={`R$ ${terms.purchasePricePerKwh.toFixed(2)}/kWh`} />
          <Info label="Vigência" value={terms.effectiveDate} />
          <Info label="Último preço aplicado" value={`R$ ${terms.lastAppliedPricePerKwh.toFixed(2)}/kWh`} />
          <Info label="Mês do último preço" value={terms.lastAppliedMonth} />
          <div className="col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">{terms.observation}</div>
        </div>
      )}
      {tab === 'pix' && recipient && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Nome" value={recipient.recipientName} /><Info label="Documento" value={recipient.recipientDocument} />
            <Info label="Tipo da chave" value={recipient.pixKeyType} /><Info label="Chave PIX" value={recipient.pixKey} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(recipient.pixKey); toast('Chave PIX copiada'); }}><Copy className="h-4 w-4" /> Copiar PIX</Button>
            <Button variant="outline"><Pencil className="h-4 w-4" /> Editar</Button>
          </div>
        </div>
      )}
      {tab === 'hist' && (
        <div className="text-sm text-slate-600">
          Histórico operacional da usina (mock). Última apuração em Jul/2026 · geração {kwh(ug.monthlyGeneration)} · rateio para {ubs.length} beneficiárias.
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className="text-slate-800 font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
