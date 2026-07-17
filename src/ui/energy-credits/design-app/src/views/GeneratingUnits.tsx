import { useState } from 'react';
import { Plus, Sun, Pencil } from 'lucide-react';
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
import { demoProvider, type GeneratingUnit } from '@/lib/demo';
import { brl, kwh } from '@/lib/format';

type DrawerMode = 'view' | 'edit';

const STEPS = ['Dados da UG', 'Beneficiárias', 'Condições Comerciais', 'Revisão'];

const DISTRIBUTORS = ['Copel', 'CEMIG', 'CPFL', 'Enel', 'Light', 'Coelba', 'CELPE'];

export function GeneratingUnits() {
  const ugs = demoProvider.listGeneratingUnits();
  const ubs = demoProvider.listBeneficiaryUnits();

  const [loading] = useState(false);
  const [showEmpty] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerUg, setDrawerUg] = useState<GeneratingUnit | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(0);

  // Form state
  const [form, setForm] = useState({
    nome: '',
    proprietario: '',
    documento: '',
    uc: '',
    distribuidora: 'Copel',
    status: 'ativa',
    selectedUbs: [] as string[],
    precoCompra: '0.35',
    dataVigencia: '2026-01-01',
    pixKey: '',
    pixType: 'email',
  });

  function resetForm() {
    setForm({ nome: '', proprietario: '', documento: '', uc: '', distribuidora: 'Copel', status: 'ativa', selectedUbs: [], precoCompra: '0.35', dataVigencia: '2026-01-01', pixKey: '', pixType: 'email' });
    setStep(0);
  }

  function handleCreate() {
    demoProvider.createGeneratingUnit({ nome: form.nome });
    setCreateOpen(false);
    resetForm();
    setSuccess(`Unidade Geradora "${form.nome || 'Nova UG'}" cadastrada com sucesso.`);
    setTimeout(() => setSuccess(''), 5000);
  }

  const displayUgs = showEmpty ? [] : ugs;

  if (loading) {
    return (
      <Card className="p-8">
        <LoadingSpinner label="Carregando unidades geradoras..." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {success && (
        <SuccessBanner
          title="UG cadastrada"
          desc={success}
          onDismiss={() => setSuccess('')}
        />
      )}

      <Card className="p-5">
        <SectionTitle
          title="Unidades Geradoras"
          desc="Gestão de usinas e proprietários cadastrados"
          right={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Nova UG
            </Button>
          }
        />

        {displayUgs.length === 0 ? (
          <EmptyState
            icon={<Sun className="h-6 w-6" />}
            title="Nenhuma UG cadastrada"
            desc="Cadastre a primeira unidade geradora para iniciar a operação."
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Cadastrar UG</Button>}
          />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50/50">
                  <th className="py-2.5 px-5 font-medium">ID</th>
                  <th className="py-2.5 font-medium">Nome</th>
                  <th className="py-2.5 font-medium">Proprietário</th>
                  <th className="py-2.5 font-medium">UC</th>
                  <th className="py-2.5 font-medium">Distribuidora</th>
                  <th className="py-2.5 font-medium">Status</th>
                  <th className="py-2.5 font-medium text-right">Geração mensal</th>
                  <th className="py-2.5 px-5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayUgs.map((ug) => (
                  <tr key={ug.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5">
                      <Badge tone="neutral">{ug.id}</Badge>
                    </td>
                    <td className="py-3">
                      <div className="font-medium text-slate-900">{ug.name}</div>
                    </td>
                    <td className="py-3 text-slate-600">{ug.owner}</td>
                    <td className="py-3 text-slate-600 font-mono text-xs">{ug.uc}</td>
                    <td className="py-3 text-slate-600">{ug.distributor}</td>
                    <td className="py-3">
                      <StatusPill status={ug.status} />
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-700">
                      {kwh(ug.monthlyGeneration)}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDrawerUg(ug); setDrawerMode('view'); }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); resetForm(); }}
        title="Nova Unidade Geradora"
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
              <Button onClick={handleCreate}>Cadastrar UG</Button>
            )}
          </>
        }
      >
        <Stepper steps={STEPS} current={step} />

        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome da UG" colSpan={2}>
              <input className={inputClass} value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="UG Solar Assaí" />
            </Field>
            <Field label="Proprietário">
              <input className={inputClass} value={form.proprietario} onChange={(e) => setForm(f => ({ ...f, proprietario: e.target.value }))} placeholder="João Pereira" />
            </Field>
            <Field label="Documento (CPF/CNPJ)">
              <input className={inputClass} value={form.documento} onChange={(e) => setForm(f => ({ ...f, documento: e.target.value }))} placeholder="123.456.789-00" />
            </Field>
            <Field label="Unidade Consumidora (UC)">
              <input className={inputClass} value={form.uc} onChange={(e) => setForm(f => ({ ...f, uc: e.target.value }))} placeholder="123456789" />
            </Field>
            <Field label="Distribuidora">
              <select className={inputClass} value={form.distribuidora} onChange={(e) => setForm(f => ({ ...f, distribuidora: e.target.value }))}>
                {DISTRIBUTORS.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
                <option value="manutencao">Manutenção</option>
              </select>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Selecione as UBs que receberão créditos desta UG:</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {ubs.map(ub => (
                <label key={ub.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-emerald-600"
                    checked={form.selectedUbs.includes(ub.id)}
                    onChange={(e) => setForm(f => ({
                      ...f,
                      selectedUbs: e.target.checked
                        ? [...f.selectedUbs, ub.id]
                        : f.selectedUbs.filter(id => id !== ub.id),
                    }))}
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-800">{ub.name}</div>
                    <div className="text-[11px] text-slate-500">{ub.id} · UC {ub.uc}</div>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">{form.selectedUbs.length} UB(s) selecionada(s)</p>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Preço de compra (R$/kWh)">
              <input className={inputClass} type="number" step="0.01" value={form.precoCompra} onChange={(e) => setForm(f => ({ ...f, precoCompra: e.target.value }))} />
            </Field>
            <Field label="Data de vigência">
              <input className={inputClass} type="date" value={form.dataVigencia} onChange={(e) => setForm(f => ({ ...f, dataVigencia: e.target.value }))} />
            </Field>
            <Field label="Chave PIX do destinatário" colSpan={2}>
              <input className={inputClass} value={form.pixKey} onChange={(e) => setForm(f => ({ ...f, pixKey: e.target.value }))} placeholder="email, CPF, CNPJ ou chave aleatória" />
            </Field>
            <Field label="Tipo de chave PIX">
              <select className={inputClass} value={form.pixType} onChange={(e) => setForm(f => ({ ...f, pixType: e.target.value }))}>
                <option value="email">E-mail</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave aleatória</option>
              </select>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-3">Resumo do cadastro</div>
              <div className="grid grid-cols-2 gap-2">
                <FieldRow label="Nome" value={form.nome || '—'} />
                <FieldRow label="Proprietário" value={form.proprietario || '—'} />
                <FieldRow label="Documento" value={form.documento || '—'} />
                <FieldRow label="UC" value={form.uc || '—'} />
                <FieldRow label="Distribuidora" value={form.distribuidora} />
                <FieldRow label="Status" value={form.status} />
                <FieldRow label="Preço de compra" value={`R$ ${form.precoCompra}/kWh`} />
                <FieldRow label="Chave PIX" value={form.pixKey || '—'} />
              </div>
              <div className="mt-3 text-xs text-slate-600">
                UBs vinculadas: {form.selectedUbs.length > 0 ? form.selectedUbs.join(', ') : 'Nenhuma selecionada'}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        open={!!drawerUg}
        onClose={() => setDrawerUg(null)}
        title={drawerUg?.name ?? ''}
        desc={`${drawerUg?.id} · ${drawerUg?.owner}`}
      >
        {drawerUg && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={drawerMode === 'view' ? 'soft' : 'outline'}
                size="sm"
                onClick={() => setDrawerMode('view')}
              >
                Detalhes
              </Button>
              <Button
                variant={drawerMode === 'edit' ? 'soft' : 'outline'}
                size="sm"
                onClick={() => setDrawerMode('edit')}
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>

            {drawerMode === 'view' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="ID" value={drawerUg.id} />
                  <FieldRow label="Status" value={drawerUg.status} />
                  <FieldRow label="UC" value={drawerUg.uc} />
                  <FieldRow label="Distribuidora" value={drawerUg.distributor} />
                  <FieldRow label="Documento" value={drawerUg.document} />
                  <FieldRow label="Preço de compra" value={`R$ ${drawerUg.purchasePrice.toFixed(2)}/kWh`} />
                  <FieldRow label="Saldo anterior" value={kwh(drawerUg.previousBalance)} />
                  <FieldRow label="Geração mensal" value={kwh(drawerUg.monthlyGeneration)} />
                  <FieldRow label="PIX" value={drawerUg.payee.pixKey} />
                  <FieldRow label="Tipo PIX" value={drawerUg.payee.pixType} />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                    Beneficiárias vinculadas ({drawerUg.beneficiaries.length})
                  </div>
                  <div className="space-y-1.5">
                    {drawerUg.beneficiaries.map(ubId => {
                      const ub = ubs.find(u => u.id === ubId);
                      return (
                        <div key={ubId} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                          <div className="text-sm font-medium text-slate-800">{ub?.name ?? ubId}</div>
                          <div className="text-xs text-slate-500">{ubId}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="border border-emerald-100 bg-emerald-50/50 rounded-xl p-3">
                  <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-2">Resumo financeiro</div>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Receita estimada" value={brl(drawerUg.monthlyGeneration * 0.55 * 0.85)} tone="emerald" />
                    <FieldRow label="Repasse estimado" value={brl(drawerUg.monthlyGeneration * drawerUg.purchasePrice * 0.85)} tone="rose" />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <Field label="Nome da UG">
                  <input className={inputClass} defaultValue={drawerUg.name} />
                </Field>
                <Field label="Proprietário">
                  <input className={inputClass} defaultValue={drawerUg.owner} />
                </Field>
                <Field label="Documento">
                  <input className={inputClass} defaultValue={drawerUg.document} />
                </Field>
                <Field label="UC">
                  <input className={inputClass} defaultValue={drawerUg.uc} />
                </Field>
                <Field label="Preço de compra (R$/kWh)">
                  <input className={inputClass} type="number" step="0.01" defaultValue={drawerUg.purchasePrice} />
                </Field>
                <Field label="Status">
                  <select className={inputClass} defaultValue={drawerUg.status}>
                    <option value="ativa">Ativa</option>
                    <option value="inativa">Inativa</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </Field>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" onClick={() => setDrawerMode('view')}>Cancelar</Button>
                  <Button onClick={() => { demoProvider.updateGeneratingUnit(drawerUg.id, {}); setDrawerMode('view'); }}>Salvar alterações</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
