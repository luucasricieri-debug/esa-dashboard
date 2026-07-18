import { useState } from 'react';
import { toast } from 'sonner';
import {
  UploadCloud, CheckCircle2, AlertCircle, Copy, Play, Save, Download,
  FileText, Eye, Sparkles, Link2, UserPlus, ArrowRight, Zap,
} from 'lucide-react';
import { Card, SectionTitle, Button, Badge, Modal, Field, inputClass } from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import { brl, kwh } from '@/lib/esa/format';
import { navigateTo } from '@/lib/esa/nav';
import { UBForm } from './BeneficiaryUnits';

interface UtilityBillData {
  extractionId: string;
  fileName: string;
  confidence: 'high' | 'review' | 'unknown';
  utilityConsumerUnit: string;
  distributor: string;
  referenceMonth: string;
  consumptionKwh: number;
  teValue: number;
  tusdValue: number;
  fioB: number;
  flagValue: number;
  cipValue: number;
  taxesValue: number;
  minimumBillableKwh: number;
  totalBillValue: number;
  beneficiaryName?: string;
}

interface BeneficiaryMatch {
  matched: boolean;
  beneficiaryUnitId: string;
  beneficiaryName: string;
  beneficiaryDocument: string;
  uc: string;
  distributor: string;
  generatingUnitId: string;
  generatingUnitName: string;
}

const TYPES = [
  { key: 'ug' as const, label: 'Unidades Geradoras', note: 'Preço de compra e PIX não fazem parte deste modelo básico. Um modelo avançado poderá ser criado futuramente.' },
  { key: 'ub' as const, label: 'Unidades Beneficiárias', note: 'Cadastro básico. Preço ESA, saldo inicial e condições comerciais serão cadastros complementares.' },
  { key: 'rug' as const, label: 'Registros Mensais de UGs', note: 'Uma linha por UG por mês. Valores com vírgula como separador decimal.' },
  { key: 'rub' as const, label: 'Registros Mensais de UBs', note: 'Uma linha por UB por mês. Créditos alocados/compensados alinhados ao Billing Engine.' },
];

type ImportType = (typeof TYPES)[number]['key'];

export function CsvImport() {
  const provider = useEsaProvider();
  const [type, setType] = useState<ImportType>('ug');
  const [csv, setCsv] = useState('');
  const [validated, setValidated] = useState(false);
  const template = provider.getCsvTemplate(type);
  const current = TYPES.find((t) => t.key === type)!;

  const lines = csv.trim() ? csv.trim().split('\n') : [];
  const header = lines[0]?.split(';') ?? [];
  const rows = lines.slice(1).map((l) => l.split(';'));

  const errors = validated && rows.length
    ? rows.map((r, i) => {
        if (r.length !== header.length) return { line: i + 2, field: '—', value: r.join(';'), code: 'COL_COUNT', msg: 'Número de colunas incompatível com o header' };
        if (r.some((c) => !c.trim())) return { line: i + 2, field: '—', value: r.join(';'), code: 'EMPTY_CELL', msg: 'Célula vazia detectada' };
        return null;
      }).filter(Boolean)
    : [];

  const downloadTemplate = () => {
    const blob = new Blob([template.example], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = template.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Modelo CSV baixado');
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle title="Importação de dados" desc="Cargas em massa via CSV — separador ';'" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => { setType(t.key); setValidated(false); }} className={`text-left rounded-lg border px-3 py-3 transition-all ${type === t.key ? 'border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Tipo</div>
              <div className={`text-sm font-medium mt-0.5 ${type === t.key ? 'text-emerald-800' : 'text-slate-800'}`}>{t.label}</div>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Cole seu CSV</label>
            <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setValidated(false); }} placeholder={`Formato esperado — separador ";"`} className="mt-1 w-full h-52 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono bg-slate-50 outline-none focus:border-emerald-500" />
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4" /> Baixar modelo CSV</Button>
              <Button variant="outline"><UploadCloud className="h-4 w-4" /> Importar arquivo</Button>
              <Button variant="soft" onClick={() => setValidated(true)}><Play className="h-4 w-4" /> Validar dados</Button>
              <Button><Save className="h-4 w-4" /> Importar e salvar</Button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{current.note}</p>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Exemplo — {current.label}</label>
            <div className="mt-1 relative rounded-lg border border-slate-200 bg-slate-900 text-slate-100 text-[11px] font-mono p-3 h-52 overflow-auto whitespace-pre">
              {template.example}
              <button onClick={() => { navigator.clipboard.writeText(template.example); setCsv(template.example); toast('Exemplo copiado para o campo'); }} className="absolute top-2 right-2 text-slate-300 hover:text-emerald-300 text-[11px] flex items-center gap-1">
                <Copy className="h-3 w-3" /> Copiar
              </button>
            </div>
          </div>
        </div>
      </Card>

      {validated && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SmallStat label="Total de linhas" value={String(rows.length)} />
            <SmallStat label="Aceitas" value={String(rows.length - errors.length)} tone="green" />
            <SmallStat label="Rejeitadas" value={String(errors.length)} tone="red" />
            <SmallStat label="Alertas" value="0" tone="amber" />
          </div>
          <Card className="p-5">
            <SectionTitle title="Preview normalizado" desc="Dados como serão importados" right={errors.length === 0 ? <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Sem erros</Badge> : <Badge tone="red"><AlertCircle className="h-3 w-3" /> {errors.length} erros</Badge>} />
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                    <th className="py-2 px-5 font-medium">#</th>
                    {header.map((h) => <th key={h} className="py-2 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 px-5 text-slate-400">{i + 2}</td>
                      {r.map((c, j) => <td key={j} className="py-2 text-slate-700 font-mono">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {errors.length > 0 && (
            <Card className="p-5">
              <SectionTitle title="Erros detectados" />
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
                    <th className="py-2 font-medium">Linha</th>
                    <th className="py-2 font-medium">Campo</th>
                    <th className="py-2 font-medium">Valor</th>
                    <th className="py-2 font-medium">Código</th>
                    <th className="py-2 font-medium">Mensagem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {errors.map((e: any, i) => (
                    <tr key={i}>
                      <td className="py-2 text-rose-700 font-medium">{e.line}</td>
                      <td className="py-2">{e.field}</td>
                      <td className="py-2 font-mono truncate max-w-xs">{e.value}</td>
                      <td className="py-2"><Badge tone="red">{e.code}</Badge></td>
                      <td className="py-2 text-slate-600">{e.msg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <UtilityBillImporter />
    </div>
  );
}

function SmallStat({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'green' | 'red' | 'amber' }) {
  const map = { slate: 'text-slate-800', green: 'text-emerald-700', red: 'text-rose-600', amber: 'text-amber-700' };
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-semibold mt-2 ${map[tone]}`}>{value}</div>
    </Card>
  );
}

type Stage = 'idle' | 'analyzing' | 'review' | 'duplicate' | 'success';
type Scenario = 'matched' | 'unmatched' | 'duplicate';

const FLOW_STEPS = ['Enviar fatura', 'Extrair dados', 'Identificar UC / Beneficiária', 'Revisar dados', 'Confirmar registro mensal', 'Ir para Apuração'];

function UtilityBillImporter() {
  const provider = useEsaProvider();
  const [stage, setStage] = useState<Stage>('idle');
  const [flowStep, setFlowStep] = useState(0);
  const [scenario, setScenario] = useState<Scenario>('matched');
  const [fileName, setFileName] = useState<string | null>(null);
  const [data, setData] = useState<UtilityBillData | null>(null);
  const [match, setMatch] = useState<BeneficiaryMatch | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ beneficiaryName: string; beneficiaryUnitId: string; referenceMonth: string; consumptionKwh: number } | null>(null);

  const reset = () => { setStage('idle'); setFlowStep(0); setFileName(null); setData(null); setMatch(null); setSuccessInfo(null); };

  const onFile = (name: string) => {
    setFileName(name);
    setStage('analyzing');
    setFlowStep(1);
    setTimeout(() => {
      const d = provider.simulateUtilityBillExtraction({ name }, scenario) as UtilityBillData;
      setData(d);
      setFlowStep(2);
      const m = provider.matchUtilityBillToBeneficiary({ utilityConsumerUnit: d.utilityConsumerUnit, distributor: d.distributor }) as BeneficiaryMatch;
      setMatch(m);
      if (scenario === 'duplicate') { setStage('duplicate'); } else { setStage('review'); setFlowStep(3); }
    }, 900);
  };

  const confirmMonthlyRecord = () => {
    if (!data || !match?.matched) return;
    provider.confirmBeneficiaryMonthlyRecordFromUtilityBill(data.extractionId, {
      beneficiaryUnitId: match.beneficiaryUnitId,
      referenceMonth: data.referenceMonth,
      consumptionKwh: data.consumptionKwh,
    });
    setSuccessInfo({ beneficiaryName: match.beneficiaryName, beneficiaryUnitId: match.beneficiaryUnitId, referenceMonth: data.referenceMonth, consumptionKwh: data.consumptionKwh });
    setStage('success');
    setFlowStep(4);
    toast.success('Registro mensal preparado.');
  };

  return (
    <Card className="p-5">
      <SectionTitle title="Importar fatura da distribuidora" desc="Envie uma fatura da concessionária para extrair consumo e componentes tarifários" right={<Badge tone="amber">BETA</Badge>} />
      <FlowSteps steps={FLOW_STEPS} current={flowStep} />

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-800 mb-1">Fatura da distribuidora</div>
          <p>Documento de <b>entrada</b>. Usado para obter consumo mensal e componentes tarifários (TE, TUSD, Fio B, bandeira, CIP, impostos).</p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-900">
          <div className="font-semibold mb-1">Fatura ESA</div>
          <p>Documento de <b>cobrança</b> ao beneficiário. Gerada somente após a Apuração e o cálculo oficial do Billing Engine.</p>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">Fluxo: Fatura da distribuidora → Dados mensais → Apuração → Billing Engine → Fatura ESA.</div>
      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-600">A fatura da distribuidora é uma fonte de dados mensais. Ela não gera automaticamente uma cobrança ESA e não cria clientes sem confirmação.</div>

      {stage === 'idle' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="sm:col-span-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition">
            <UploadCloud className="h-8 w-8 mx-auto text-slate-400" />
            <div className="mt-2 text-sm font-medium text-slate-800">Arraste ou clique para enviar a fatura</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Aceita PDF, JPG, PNG · não processa o arquivo neste protótipo</div>
            <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f.name); }} />
          </label>
          <div className="rounded-xl border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]"><Sparkles className="h-3.5 w-3.5" /> CENÁRIO DE SIMULAÇÃO</div>
            <p className="text-[11px] text-slate-500">Selecione um cenário para explorar o fluxo neste protótipo.</p>
            <div className="space-y-1.5">
              {([['matched', 'UC vinculada a UB existente'], ['unmatched', 'UC não identificada'], ['duplicate', 'Fatura já cadastrada para UC + mês']] as [Scenario, string][]).map(([k, label]) => (
                <label key={k} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] cursor-pointer ${scenario === k ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <input type="radio" className="accent-emerald-600" checked={scenario === k} onChange={() => setScenario(k)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === 'analyzing' && (
        <div className="py-10 text-center text-sm text-slate-600">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
          Analisando fatura {fileName}…
        </div>
      )}

      {(stage === 'review' || stage === 'duplicate') && data && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-700 flex items-center gap-2"><FileText className="h-4 w-4 text-slate-500" />{data.fileName}</div>
            <ConfidenceBadge c={data.confidence} />
          </div>

          <IdentificationCard match={match} data={data} onLink={() => setLinkOpen(true)} onCreate={() => setCreateOpen(true)} />

          {stage === 'duplicate' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900">
              <div className="font-semibold flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />FATURA JÁ CADASTRADA PARA ESTA UC E MÊS</div>
              <p className="text-xs mt-1">Não sobrescrever automaticamente. Escolha uma ação abaixo.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={reset}>Cancelar importação</Button>
                <Button variant="outline" onClick={() => setCompareOpen(true)}><Eye className="h-4 w-4" /> Comparar dados</Button>
                <Button onClick={() => setReplaceOpen(true)}>Substituir dados existentes</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <FieldReadonly label="UC" value={data.utilityConsumerUnit} />
            <FieldReadonly label="Distribuidora" value={data.distributor} />
            <FieldReadonly label="Mês de referência" value={data.referenceMonth} />
            <FieldReadonly label="Consumo (kWh)" value={String(data.consumptionKwh)} />
            <FieldReadonly label="TE" value={brl(data.teValue)} />
            <FieldReadonly label="TUSD" value={brl(data.tusdValue)} />
            <FieldReadonly label="Fio B" value={brl(data.fioB)} />
            <FieldReadonly label="Bandeira" value={brl(data.flagValue)} />
            <FieldReadonly label="CIP" value={brl(data.cipValue)} />
            <FieldReadonly label="Impostos" value={brl(data.taxesValue)} />
            <FieldReadonly label="Mín. faturável (kWh)" value={String(data.minimumBillableKwh)} />
            <FieldReadonly label="Valor total" value={brl(data.totalBillValue)} />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">Os dados extraídos nunca serão salvos automaticamente. Revise antes de confirmar.</div>

          {stage === 'review' && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={reset}>Descartar</Button>
              {match?.matched ? (
                <Button onClick={confirmMonthlyRecord}><CheckCircle2 className="h-4 w-4" /> Confirmar registro mensal</Button>
              ) : (
                <Button disabled>Vincule ou crie uma beneficiária para confirmar</Button>
              )}
            </div>
          )}
        </div>
      )}

      {stage === 'success' && successInfo && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold"><CheckCircle2 className="h-5 w-5" /> DADOS MENSAIS PREPARADOS</div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <FieldReadonly label="Beneficiária" value={successInfo.beneficiaryName} />
            <FieldReadonly label="Mês de referência" value={successInfo.referenceMonth} />
            <FieldReadonly label="Consumo identificado" value={kwh(successInfo.consumptionKwh)} />
            <FieldReadonly label="Origem" value="Fatura da distribuidora" />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={reset}>Importar outra fatura</Button>
            <Button onClick={() => { navigateTo('apuracao', { month: successInfo.referenceMonth }); toast('Abrindo Apuração Mensal…'); }}>
              Ir para Apuração de {successInfo.referenceMonth}<ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {linkOpen && data && (
        <LinkBeneficiaryModal onClose={() => setLinkOpen(false)} onLink={(ubId) => {
          provider.linkUtilityBillToBeneficiary(data.extractionId, ubId);
          const ub = provider.listBeneficiaryUnits().find((u) => u.id === ubId);
          const ug = provider.listGeneratingUnits().find((g) => g.id === ub?.ugId);
          if (ub) {
            setMatch({ matched: true, beneficiaryUnitId: ub.id, beneficiaryName: ub.name, beneficiaryDocument: ub.document, uc: ub.uc, distributor: ub.distributor, generatingUnitId: ub.ugId, generatingUnitName: ug?.name ?? '—' });
          }
          setLinkOpen(false);
          toast.success(`Fatura vinculada a ${ub?.name ?? ubId}.`);
        }} />
      )}

      {createOpen && data && (
        <UBForm sourceHint={`Pré-preenchido a partir da fatura ${data.fileName}`} prefill={{ name: data.beneficiaryName ?? '', document: '', uc: data.utilityConsumerUnit, distributor: data.distributor }} onClose={() => setCreateOpen(false)} />
      )}

      {compareOpen && data && (
        <CompareModal data={data} onClose={() => setCompareOpen(false)} onReplace={() => { setCompareOpen(false); setReplaceOpen(true); }} />
      )}

      {replaceOpen && data && (
        <ReplaceModal onClose={() => setReplaceOpen(false)} onConfirm={(reason) => {
          provider.replaceBeneficiaryMonthlyRecordFromUtilityBill(data.extractionId, reason);
          setReplaceOpen(false);
          if (match?.matched) {
            setSuccessInfo({ beneficiaryName: match.beneficiaryName, beneficiaryUnitId: match.beneficiaryUnitId, referenceMonth: data.referenceMonth, consumptionKwh: data.consumptionKwh });
            setStage('success');
            setFlowStep(4);
          }
          toast.success('Registro mensal substituído.');
        }} />
      )}
    </Card>
  );
}

function FlowSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-1.5">
            <div className={`h-5 w-5 rounded-full grid place-items-center text-[10px] font-semibold border ${done ? 'bg-emerald-600 text-white border-emerald-600' : active ? 'bg-emerald-50 text-emerald-700 border-emerald-500' : 'bg-white text-slate-400 border-slate-200'}`}>
              {done ? '✓' : i + 1}
            </div>
            <span className={`text-[11px] ${active ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>{s}</span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}

function IdentificationCard({ match, data, onLink, onCreate }: { match: BeneficiaryMatch | null; data: UtilityBillData; onLink: () => void; onCreate: () => void }) {
  if (match?.matched) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="text-[11px] uppercase tracking-wider text-emerald-800 font-semibold mb-1">Beneficiária identificada</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <FieldReadonly label="Nome" value={match.beneficiaryName} />
          <FieldReadonly label="Código da UB" value={match.beneficiaryUnitId} />
          <FieldReadonly label="UC" value={match.uc} />
          <FieldReadonly label="UG vinculada" value={match.generatingUnitName} />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3">
      <div className="text-[11px] uppercase tracking-wider text-amber-900 font-semibold mb-1">Beneficiária não identificada</div>
      <p className="text-xs text-amber-900">A fatura da UC <b>{data.utilityConsumerUnit}</b> não está vinculada a nenhuma Unidade Beneficiária cadastrada.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onLink}><Link2 className="h-4 w-4" /> Vincular beneficiária existente</Button>
        <Button onClick={onCreate}><UserPlus className="h-4 w-4" /> Criar nova beneficiária</Button>
      </div>
    </div>
  );
}

function LinkBeneficiaryModal({ onClose, onLink }: { onClose: () => void; onLink: (ubId: string) => void }) {
  const provider = useEsaProvider();
  const allUbs = provider.listBeneficiaryUnits();
  const allUgs = provider.listGeneratingUnits();
  const [filter, setFilter] = useState('');
  const list = allUbs.filter((u) => (u.name + u.id + u.uc + u.document).toLowerCase().includes(filter.toLowerCase()));
  return (
    <Modal open onClose={onClose} title="Vincular fatura a uma beneficiária existente" desc="Selecione a UB correta para associar esta fatura" size="lg">
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar por nome, UC, documento..." className={inputClass} />
      <ul className="mt-3 divide-y divide-slate-100 border border-slate-100 rounded-lg max-h-80 overflow-y-auto">
        {list.map((u) => {
          const ug = allUgs.find((g) => g.id === u.ugId);
          return (
            <li key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="font-medium text-slate-800">{u.name}</div>
                <div className="text-[11px] text-slate-500">{u.id} · UC {u.uc} · <Zap className="inline h-3 w-3 text-emerald-600" /> {ug?.name}</div>
              </div>
              <Button size="sm" onClick={() => onLink(u.id)}>Vincular</Button>
            </li>
          );
        })}
        {list.length === 0 && <li className="px-3 py-4 text-sm text-slate-500 text-center">Nenhuma beneficiária encontrada.</li>}
      </ul>
    </Modal>
  );
}

function CompareModal({ data, onClose, onReplace }: { data: UtilityBillData; onClose: () => void; onReplace: () => void }) {
  const provider = useEsaProvider();
  const ub = provider.listBeneficiaryUnits().find((u) => u.uc === data.utilityConsumerUnit);
  const existingRecord = ub ? provider.getBeneficiaryMonthlyRecord(ub.id, data.referenceMonth) : null;
  if (!existingRecord) {
    return <Modal open onClose={onClose} title="Comparar dados"><p className="text-sm text-slate-600">Nenhum registro existente para comparar.</p></Modal>;
  }
  const cmp = provider.compareUtilityBillWithExistingRecord(
    data.extractionId,
    { consumptionKwh: existingRecord.consumptionKwh, teValue: existingRecord.teValue, tusdValue: existingRecord.tusdValue, fioB: existingRecord.fioB, flagValue: existingRecord.flagValue, cipValue: existingRecord.cipValue, taxesValue: existingRecord.taxesValue, totalBillValue: existingRecord.totalBillValue },
    { consumptionKwh: data.consumptionKwh, teValue: data.teValue, tusdValue: data.tusdValue, fioB: data.fioB, flagValue: data.flagValue, cipValue: data.cipValue, taxesValue: data.taxesValue, totalBillValue: data.totalBillValue },
  );
  return (
    <Modal open onClose={onClose} title="Comparar fatura importada com registro existente" desc={`UC ${data.utilityConsumerUnit} · ${data.referenceMonth}`} size="lg" footer={<><Button variant="outline" onClick={onClose}>Fechar</Button><Button onClick={onReplace}>Substituir dados existentes</Button></>}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
            <th className="py-2 font-medium">Campo</th>
            <th className="py-2 font-medium text-right">Dado atual</th>
            <th className="py-2 font-medium text-right">Nova fatura</th>
            <th className="py-2 font-medium text-right">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(cmp?.fields ?? []).map((f: any) => {
            const changed = Math.abs(f.delta) > 0.001;
            return (
              <tr key={f.label} className={changed ? 'bg-amber-50/40' : ''}>
                <td className="py-2 font-medium text-slate-700">{f.label}</td>
                <td className="py-2 text-right tabular-nums">{f.current.toFixed(2)}</td>
                <td className="py-2 text-right tabular-nums font-medium">{f.incoming.toFixed(2)}</td>
                <td className={`py-2 text-right tabular-nums ${changed ? (f.delta > 0 ? 'text-emerald-700' : 'text-rose-600') : 'text-slate-400'}`}>{changed ? `${f.delta > 0 ? '+' : ''}${f.delta.toFixed(2)}` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}

function ReplaceModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open onClose={onClose} title="Substituir dados existentes" desc="Informe o motivo da alteração — auditoria interna" footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Confirmar substituição</Button></>}>
      <Field label="Motivo da alteração"><textarea rows={4} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: refaturamento da distribuidora" /></Field>
    </Modal>
  );
}

function ConfidenceBadge({ c }: { c: 'high' | 'review' | 'unknown' }) {
  if (c === 'high') return <Badge tone="green">Alta confiança</Badge>;
  if (c === 'review') return <Badge tone="amber">Revisar</Badge>;
  return <Badge tone="red">Não identificado</Badge>;
}

function FieldReadonly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className="text-slate-800 font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
