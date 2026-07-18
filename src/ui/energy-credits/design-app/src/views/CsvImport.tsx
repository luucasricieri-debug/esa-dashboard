import { useState } from 'react';
import { toast } from 'sonner';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  Play,
  Save,
  Download,
  FileText,
  Eye,
  Sparkles,
  Link2,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { Card, SectionTitle, Button, Badge, Modal, Field, inputClass, Stepper } from '@/components/ui/index';
import { demoProvider } from '@/lib/demo';
import { brl, kwh } from '@/lib/format';

const TYPES = [
  { key: 'ug' as const, label: 'Unidades Geradoras', note: 'Preço de compra e PIX não fazem parte deste modelo básico.' },
  { key: 'ub' as const, label: 'Unidades Beneficiárias', note: 'Cadastro básico. Parâmetros comerciais são complementares.' },
  { key: 'rug' as const, label: 'Registros Mensais de UGs', note: 'Uma linha por UG por mês. Valores com vírgula decimal.' },
  { key: 'rub' as const, label: 'Registros Mensais de UBs', note: 'Uma linha por UB por mês. Alinhado ao Billing Engine.' },
];

type ImportType = (typeof TYPES)[number]['key'];
type Stage = 'idle' | 'analyzing' | 'review' | 'duplicate' | 'success';
type Scenario = 'matched' | 'unmatched' | 'duplicate';

const INVOICE_STEPS = ['Upload', 'Extração', 'Verificação', 'Confirmação'];

export function CsvImport() {
  const [tab, setTab] = useState<'csv' | 'invoice'>('csv');
  const [type, setType] = useState<ImportType>('ug');
  const [csv, setCsv] = useState('');
  const [validated, setValidated] = useState(false);

  const template = demoProvider.getCsvTemplate(type);
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
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
        <button
          onClick={() => setTab('csv')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'csv' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Importação CSV
        </button>
        <button
          onClick={() => setTab('invoice')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'invoice' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Importação de Fatura
        </button>
      </div>

      {tab === 'csv' && (
        <>
          <Card className="p-5">
            <SectionTitle title="Importação de dados" desc="Cargas em massa via CSV — separador ';'" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setType(t.key); setValidated(false); }}
                  className={`text-left rounded-lg border px-3 py-3 transition-all ${type === t.key ? 'border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Tipo</div>
                  <div className={`text-sm font-medium mt-0.5 ${type === t.key ? 'text-emerald-800' : 'text-slate-800'}`}>{t.label}</div>
                </button>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Cole seu CSV</label>
                <textarea
                  value={csv}
                  onChange={(e) => { setCsv(e.target.value); setValidated(false); }}
                  placeholder={`Formato esperado — separador ";"`}
                  className="mt-1 w-full h-52 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono bg-slate-50 outline-none focus:border-emerald-500"
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4" /> Baixar modelo</Button>
                  <Button variant="outline"><UploadCloud className="h-4 w-4" /> Importar arquivo</Button>
                  <Button variant="soft" onClick={() => setValidated(true)}><Play className="h-4 w-4" /> Validar</Button>
                  <Button><Save className="h-4 w-4" /> Importar</Button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">{current.note}</p>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Exemplo — {current.label}</label>
                <div className="mt-1 relative rounded-lg border border-slate-200 bg-slate-900 text-slate-100 text-[11px] font-mono p-3 h-52 overflow-auto whitespace-pre">
                  {template.example}
                  <button
                    onClick={() => { navigator.clipboard?.writeText(template.example); setCsv(template.example); toast('Exemplo copiado para o campo'); }}
                    className="absolute top-2 right-2 text-slate-300 hover:text-emerald-300 text-[11px] flex items-center gap-1"
                  >
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
                <SectionTitle
                  title="Preview normalizado"
                  desc="Dados como serão importados"
                  right={errors.length === 0 ? <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Sem erros</Badge> : <Badge tone="red"><AlertCircle className="h-3 w-3" /> {errors.length} erros</Badge>}
                />
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
                        <th className="py-2 font-medium">Código</th>
                        <th className="py-2 font-medium">Mensagem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(errors as Array<{ line: number; field: string; code: string; msg: string }>).map((e, i) => (
                        <tr key={i}>
                          <td className="py-2 text-rose-700 font-medium">{e.line}</td>
                          <td className="py-2">{e.field}</td>
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
        </>
      )}

      {tab === 'invoice' && <InvoiceImporter />}
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

function InvoiceImporter() {
  const [stage, setStage] = useState<Stage>('idle');
  const [invoiceStep, setInvoiceStep] = useState(0);
  const [scenario, setScenario] = useState<Scenario>('matched');
  const [fileName, setFileName] = useState<string | null>(null);
  const [data, setData] = useState<ReturnType<typeof demoProvider.simulateUtilityBillExtraction> | null>(null);
  const [match, setMatch] = useState<ReturnType<typeof demoProvider.matchUtilityBillToBeneficiary> | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ name: string; month: string; kwh: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceReason, setReplaceReason] = useState('');

  const reset = () => { setStage('idle'); setInvoiceStep(0); setFileName(null); setData(null); setMatch(null); setSuccessInfo(null); };

  function onFile(name: string) {
    setFileName(name);
    setStage('analyzing');
    setInvoiceStep(1);
    setTimeout(() => {
      const d = demoProvider.simulateUtilityBillExtraction({ name }, scenario);
      setData(d);
      setInvoiceStep(2);
      const m = demoProvider.matchUtilityBillToBeneficiary({ utilityConsumerUnit: d.utilityConsumerUnit, distributor: d.distributor });
      setMatch(m);
      if (scenario === 'duplicate') { setStage('duplicate'); } else { setStage('review'); setInvoiceStep(3); }
    }, 900);
  }

  function confirmRecord() {
    if (!data || !match?.matched) return;
    demoProvider.confirmBeneficiaryMonthlyRecordFromUtilityBill(data.extractionId, {
      beneficiaryUnitId: match.beneficiaryUnitId,
      referenceMonth: data.referenceMonth,
      consumptionKwh: data.consumptionKwh,
    });
    setSuccessInfo({ name: match.beneficiaryName, month: data.referenceMonth, kwh: data.consumptionKwh });
    setStage('success');
    setInvoiceStep(4);
    toast.success('Registro mensal preparado.');
  }

  const allUbs = demoProvider.listBeneficiaryUnits();

  return (
    <Card className="p-5">
      <SectionTitle title="Importar fatura da distribuidora" desc="Envie uma fatura da concessionária para extrair consumo e componentes tarifários" right={<Badge tone="amber">BETA</Badge>} />
      <Stepper steps={INVOICE_STEPS} current={invoiceStep} />

      {stage === 'idle' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="sm:col-span-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition">
            <UploadCloud className="h-8 w-8 mx-auto text-slate-400" />
            <div className="mt-2 text-sm font-medium text-slate-800">Arraste ou clique para enviar a fatura</div>
            <div className="text-[11px] text-slate-500 mt-0.5">PDF, JPG ou PNG</div>
            <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f.name); }} />
          </label>
          <div className="rounded-xl border border-slate-200 p-4 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]"><Sparkles className="h-3.5 w-3.5" /> CENÁRIO DE SIMULAÇÃO</div>
            <div className="space-y-1.5">
              {([['matched', 'UC vinculada a UB existente'], ['unmatched', 'UC não identificada'], ['duplicate', 'Fatura já cadastrada']] as [Scenario, string][]).map(([k, label]) => (
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

          {match?.matched ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="text-[11px] uppercase tracking-wider text-emerald-800 font-semibold mb-2">Beneficiária identificada</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <ReadonlyField label="Nome" value={match.beneficiaryName} />
                <ReadonlyField label="Código UB" value={match.beneficiaryUnitId} />
                <ReadonlyField label="UC" value={match.uc} />
                <ReadonlyField label="UG vinculada" value={match.generatingUnitName} />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3">
              <div className="text-[11px] uppercase tracking-wider text-amber-900 font-semibold mb-1">Beneficiária não identificada</div>
              <p className="text-xs text-amber-900">A fatura da UC <b>{data.utilityConsumerUnit}</b> não está vinculada a nenhuma UB cadastrada.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setLinkOpen(true)}><Link2 className="h-4 w-4" /> Vincular existente</Button>
                <Button><UserPlus className="h-4 w-4" /> Criar nova UB</Button>
              </div>
            </div>
          )}

          {stage === 'duplicate' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3">
              <div className="font-semibold flex items-center gap-1.5 text-sm text-amber-900"><AlertCircle className="h-4 w-4" /> FATURA JÁ CADASTRADA</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={reset}>Cancelar</Button>
                <Button variant="outline" onClick={() => setCompareOpen(true)}><Eye className="h-4 w-4" /> Comparar dados</Button>
                <Button onClick={() => setReplaceOpen(true)}>Substituir</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <ReadonlyField label="UC" value={data.utilityConsumerUnit} />
            <ReadonlyField label="Distribuidora" value={data.distributor} />
            <ReadonlyField label="Mês" value={data.referenceMonth} />
            <ReadonlyField label="Consumo (kWh)" value={String(data.consumptionKwh)} />
            <ReadonlyField label="TE" value={brl(data.teValue)} />
            <ReadonlyField label="TUSD" value={brl(data.tusdValue)} />
            <ReadonlyField label="CIP" value={brl(data.cipValue)} />
            <ReadonlyField label="Impostos" value={brl(data.taxesValue)} />
            <ReadonlyField label="Fio B" value={brl(data.fioB)} />
            <ReadonlyField label="Bandeira" value={brl(data.flagValue)} />
            <ReadonlyField label="Mín. faturável" value={`${data.minimumBillableKwh} kWh`} />
            <ReadonlyField label="Total" value={brl(data.totalBillValue)} />
          </div>

          {stage === 'review' && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={reset}>Descartar</Button>
              {match?.matched ? (
                <Button onClick={confirmRecord}><CheckCircle2 className="h-4 w-4" /> Confirmar registro mensal</Button>
              ) : (
                <Button disabled>Vincule uma beneficiária para confirmar</Button>
              )}
            </div>
          )}
        </div>
      )}

      {stage === 'success' && successInfo && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold"><CheckCircle2 className="h-5 w-5" /> DADOS MENSAIS PREPARADOS</div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <ReadonlyField label="Beneficiária" value={successInfo.name} />
            <ReadonlyField label="Mês" value={successInfo.month} />
            <ReadonlyField label="Consumo" value={kwh(successInfo.kwh)} />
            <ReadonlyField label="Origem" value="Fatura importada" />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={reset}>Importar outra fatura</Button>
            <Button onClick={() => toast('Abrindo Apuração Mensal…')}>
              Ir para Apuração <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Link Beneficiary Modal */}
      {linkOpen && (
        <Modal open onClose={() => setLinkOpen(false)} title="Vincular a beneficiária existente" size="lg">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allUbs.map((u) => (
              <div key={u.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-slate-800">{u.name}</div>
                  <div className="text-[11px] text-slate-500">{u.id} · UC {u.uc}</div>
                </div>
                <Button size="sm" onClick={() => { demoProvider.linkUtilityBillToBeneficiary(data?.extractionId ?? '', u.id); setLinkOpen(false); toast.success(`Vinculado a ${u.name}`); }}>Vincular</Button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Compare Modal */}
      {compareOpen && data && (
        <Modal
          open
          onClose={() => setCompareOpen(false)}
          title="Comparar dados"
          desc={`UC ${data.utilityConsumerUnit} · ${data.referenceMonth}`}
          size="lg"
          footer={<><Button variant="outline" onClick={() => setCompareOpen(false)}>Fechar</Button><Button onClick={() => { setCompareOpen(false); setReplaceOpen(true); }}>Substituir dados</Button></>}
        >
          <p className="text-sm text-slate-600 mb-3">Comparação entre dados existentes e a nova fatura importada.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
                <th className="py-2 font-medium">Campo</th>
                <th className="py-2 font-medium text-right">Atual</th>
                <th className="py-2 font-medium text-right">Nova fatura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2">Consumo (kWh)</td><td className="py-2 text-right">{data.consumptionKwh}</td><td className="py-2 text-right font-medium">{data.consumptionKwh + 180}</td></tr>
              <tr><td className="py-2">Total</td><td className="py-2 text-right">{brl(data.totalBillValue)}</td><td className="py-2 text-right font-medium">{brl(data.totalBillValue * 1.05)}</td></tr>
            </tbody>
          </table>
        </Modal>
      )}

      {/* Replace Modal */}
      {replaceOpen && (
        <Modal
          open
          onClose={() => setReplaceOpen(false)}
          title="Substituir dados existentes"
          desc="Informe o motivo — auditoria interna"
          footer={
            <>
              <Button variant="outline" onClick={() => setReplaceOpen(false)}>Cancelar</Button>
              <Button
                disabled={!replaceReason.trim()}
                onClick={() => {
                  if (data) demoProvider.replaceBeneficiaryMonthlyRecordFromUtilityBill(data.extractionId, replaceReason);
                  setReplaceOpen(false);
                  if (match?.matched && data) {
                    setSuccessInfo({ name: match.beneficiaryName, month: data.referenceMonth, kwh: data.consumptionKwh });
                    setStage('success');
                  }
                  toast.success('Registro substituído.');
                }}
              >
                Confirmar substituição
              </Button>
            </>
          }
        >
          <Field label="Motivo da alteração">
            <textarea rows={4} className={inputClass} value={replaceReason} onChange={e => setReplaceReason(e.target.value)} placeholder="Ex.: refaturamento da distribuidora" />
          </Field>
        </Modal>
      )}
    </Card>
  );
}

function ConfidenceBadge({ c }: { c: 'high' | 'review' | 'unknown' }) {
  if (c === 'high') return <Badge tone="green">Alta confiança</Badge>;
  if (c === 'review') return <Badge tone="amber">Revisar</Badge>;
  return <Badge tone="red">Não identificado</Badge>;
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className="text-slate-800 font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
