import { useState } from 'react';
import { FileDown, Printer, ChevronDown } from 'lucide-react';
import { Card, SectionTitle, Button, Badge, Drawer, FieldRow } from '@/components/ui/index';
import { demoProvider, generatingUnits, availableMonths } from '@/lib/demo';
import { brl, kwh, num } from '@/lib/format';

type ReportTab = 'proprietario' | 'interno' | 'financeiro';

export function Reports() {
  const [tab, setTab] = useState<ReportTab>('proprietario');
  const [selectedUg, setSelectedUg] = useState(generatingUnits[0].id);
  const [selectedMonth, setSelectedMonth] = useState('2026-07');
  const [invoiceDrawer, setInvoiceDrawer] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  const ugs = demoProvider.listGeneratingUnits();
  const ubs = demoProvider.listBeneficiaryUnits();

  const ug = ugs.find(u => u.id === selectedUg)!;
  const plan = demoProvider.getCreditAllocationPlan(selectedUg, selectedMonth);

  function toggleAccordion(id: string) {
    setOpenAccordions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit overflow-x-auto">
        {(['proprietario', 'interno', 'financeiro'] as ReportTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${tab === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'proprietario' ? 'Proprietário' : t === 'interno' ? 'Interno ESA' : 'Financeiro ESA'}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Mês</label>
            <select className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          {tab === 'proprietario' && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">UG</label>
              <select className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500" value={selectedUg} onChange={e => setSelectedUg(e.target.value)}>
                {ugs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex-1" />
          <Button variant="outline"><Printer className="h-4 w-4" /> Imprimir</Button>
          <Button><FileDown className="h-4 w-4" /> Download PDF</Button>
        </div>
      </Card>

      {/* Report Documents */}
      {tab === 'proprietario' && plan && (
        <Card className="p-6 md:p-8">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white p-6 text-center">
              <div className="text-[10px] uppercase tracking-widest text-emerald-200 mb-1">ESA Energia</div>
              <div className="text-xl font-bold">RELATÓRIO DO PROPRIETÁRIO</div>
              <div className="text-sm text-emerald-100 mt-1">{ug.name}</div>
            </div>

            <div className="p-6 space-y-6">
              {/* Cycle info */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FieldRow label="Mês de referência" value={selectedMonth} />
                  <FieldRow label="Status do ciclo" value="EM APURAÇÃO" />
                  <FieldRow label="Unidade Geradora" value={ug.id} />
                  <FieldRow label="Distribuidora" value={ug.distributor} />
                </div>
              </div>

              {/* Destination table */}
              <div>
                <SectionTitle title="Destinação dos créditos" desc="Distribuição por beneficiária" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50">
                        <th className="py-2.5 font-medium">Beneficiária</th>
                        <th className="py-2.5 font-medium text-right">kWh compensados</th>
                        <th className="py-2.5 font-medium text-right">% Rateio</th>
                        <th className="py-2.5 font-medium text-right">Saldo final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {plan.rows.map(r => (
                        <tr key={r.ub.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5">
                            <div className="font-medium text-slate-900">{r.ub.name}</div>
                            <div className="text-[11px] text-slate-500">{r.ub.id}</div>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{kwh(r.creditsCompensatedKwh)}</td>
                          <td className="py-2.5 text-right tabular-nums">{(r.allocationPercentage * 100).toFixed(2)}%</td>
                          <td className="py-2.5 text-right tabular-nums">{kwh(r.finalBalanceKwh)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-emerald-50/40 font-semibold">
                        <td className="py-2.5 text-slate-800">Totais</td>
                        <td className="py-2.5 text-right tabular-nums text-emerald-700">{kwh(plan.totalCompensated)}</td>
                        <td className="py-2.5 text-right tabular-nums">{(plan.totalPct * 100).toFixed(2)}%</td>
                        <td className="py-2.5 text-right tabular-nums">{kwh(plan.totalFinalBalance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Financial summary */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <SectionTitle title="Resumo financeiro" desc="Repasse ao proprietário neste ciclo" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FieldRow label="Geração total" value={kwh(plan.generation)} />
                  <FieldRow label="Compensado" value={kwh(plan.totalCompensated)} />
                  <FieldRow label="Repasse ao proprietário" value={brl(plan.ownerPayment)} tone="emerald" />
                  <FieldRow label="Preço de compra" value={`R$ ${num(ug.purchasePrice, 2)}/kWh`} />
                </div>
              </div>

              {/* Payee details */}
              <div>
                <SectionTitle title="Dados de pagamento" desc="Destinatário do repasse" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FieldRow label="Nome" value={ug.payee.name} />
                  <FieldRow label="Documento" value={ug.payee.document} />
                  <FieldRow label="Chave PIX" value={ug.payee.pixKey} />
                  <FieldRow label="Tipo de chave" value={ug.payee.pixType.toUpperCase()} />
                </div>
              </div>

              {/* Per-beneficiary accordion */}
              <div>
                <SectionTitle title="Detalhamento por beneficiária" />
                <div className="space-y-2">
                  {plan.rows.map(r => (
                    <div key={r.ub.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleAccordion(r.ub.id)}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 text-left"
                      >
                        <div>
                          <span className="font-medium text-slate-900 text-sm">{r.ub.name}</span>
                          <span className="ml-2 text-xs text-slate-500">{r.ub.id}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm tabular-nums text-emerald-700 font-semibold">{kwh(r.creditsCompensatedKwh)}</span>
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openAccordions.has(r.ub.id) ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {openAccordions.has(r.ub.id) && (
                        <div className="px-3 pb-3 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                          <FieldRow label="Consumo" value={kwh(r.monthlyConsumptionKwh)} />
                          <FieldRow label="Saldo anterior" value={kwh(r.previousBalanceKwh)} />
                          <FieldRow label="Recebido" value={kwh(r.creditsReceivedKwh)} />
                          <FieldRow label="Saldo final" value={kwh(r.finalBalanceKwh)} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === 'interno' && (
        <Card className="p-6">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-br from-slate-700 to-slate-900 text-white p-6 text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-300 mb-1">USO INTERNO</div>
              <div className="text-xl font-bold">RELATÓRIO OPERACIONAL INTERNO</div>
              <div className="text-sm text-slate-200 mt-1">ESA Energia — {selectedMonth}</div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FieldRow label="Total de UGs" value={String(ugs.length)} />
                <FieldRow label="Total de UBs" value={String(ubs.length)} />
                <FieldRow label="UGs ativas" value={String(ugs.filter(u => u.status === 'ativa').length)} />
                <FieldRow label="UBs ativas" value={String(ubs.filter(u => u.status === 'ativa').length)} />
              </div>

              <div>
                <SectionTitle title="Breakdown por UG" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50">
                        <th className="py-2 font-medium">UG</th>
                        <th className="py-2 font-medium text-right">Geração</th>
                        <th className="py-2 font-medium text-right">Compensado</th>
                        <th className="py-2 font-medium text-right">Receita ESA</th>
                        <th className="py-2 font-medium text-right">Repasse</th>
                        <th className="py-2 font-medium text-right">Spread</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ugs.map(u => {
                        const ugPlan = demoProvider.getCreditAllocationPlan(u.id, selectedMonth);
                        if (!ugPlan) return null;
                        return (
                          <tr key={u.id} className="hover:bg-slate-50">
                            <td className="py-2.5">
                              <div className="font-medium text-slate-900">{u.name}</div>
                              <div className="text-[11px] text-slate-500">{u.id}</div>
                            </td>
                            <td className="py-2.5 text-right tabular-nums">{kwh(ugPlan.generation)}</td>
                            <td className="py-2.5 text-right tabular-nums">{kwh(ugPlan.totalCompensated)}</td>
                            <td className="py-2.5 text-right tabular-nums text-emerald-700">{brl(ugPlan.esaRevenue)}</td>
                            <td className="py-2.5 text-right tabular-nums text-rose-600">{brl(ugPlan.ownerPayment)}</td>
                            <td className="py-2.5 text-right tabular-nums text-emerald-600 font-semibold">{brl(ugPlan.esaRevenue - ugPlan.ownerPayment)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <SectionTitle title="Resumo de alertas" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FieldRow label="Críticos" value="2" tone="rose" />
                  <FieldRow label="Riscos" value="2" />
                  <FieldRow label="Atenção" value="2" />
                  <FieldRow label="Informativos" value="1" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === 'financeiro' && (
        <Card className="p-6">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-6 text-center">
              <div className="text-[10px] uppercase tracking-widest text-emerald-200 mb-1">CONFIDENCIAL</div>
              <div className="text-xl font-bold">RELATÓRIO FINANCEIRO</div>
              <div className="text-sm text-emerald-100 mt-1">ESA Energia — Últimos 5 ciclos</div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <SectionTitle title="Receita vs. Repasse vs. Spread" desc="Últimos ciclos" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50">
                        <th className="py-2 font-medium">Mês</th>
                        <th className="py-2 font-medium text-right">Receita ESA</th>
                        <th className="py-2 font-medium text-right">Repasse</th>
                        <th className="py-2 font-medium text-right">Spread</th>
                        <th className="py-2 font-medium text-right">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {availableMonths.map(m => {
                        const trend = demoProvider.getMonthlyTrend({});
                        const row = trend.find(t => t.month === m.value);
                        if (!row) return null;
                        return (
                          <tr key={m.value} className="hover:bg-slate-50">
                            <td className="py-2.5 font-medium text-slate-800">{m.label}</td>
                            <td className="py-2.5 text-right tabular-nums text-emerald-700">{brl(row.Receita)}</td>
                            <td className="py-2.5 text-right tabular-nums text-rose-600">{brl(row.Repasse)}</td>
                            <td className="py-2.5 text-right tabular-nums text-emerald-600 font-semibold">{brl(row.Spread)}</td>
                            <td className="py-2.5 text-right tabular-nums">{row.Receita > 0 ? `${((row.Spread / row.Receita) * 100).toFixed(1)}%` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <SectionTitle title="Status de faturas — UBs" desc="Mês selecionado" right={<Button variant="outline" size="sm">Ver todas</Button>} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100 bg-slate-50">
                        <th className="py-2 font-medium">Beneficiária</th>
                        <th className="py-2 font-medium text-right">Consumo</th>
                        <th className="py-2 font-medium text-right">Fatura ESA</th>
                        <th className="py-2 font-medium">Status</th>
                        <th className="py-2 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ubs.slice(0, 5).map(ub => (
                        <tr key={ub.id} className="hover:bg-slate-50">
                          <td className="py-2.5">
                            <div className="font-medium text-slate-900">{ub.name}</div>
                            <div className="text-[11px] text-slate-500">{ub.id}</div>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{kwh(ub.monthlyConsumption)}</td>
                          <td className="py-2.5 text-right tabular-nums text-emerald-700 font-semibold">{brl(ub.monthlyConsumption * ub.esaPrice * 0.85)}</td>
                          <td className="py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${ub.paymentStatus === 'pago' ? 'bg-emerald-100 text-emerald-800' : ub.paymentStatus === 'vencido' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                              {ub.paymentStatus === 'pago' ? 'Pago' : ub.paymentStatus === 'vencido' ? 'Vencido' : 'Em aberto'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <Button variant="ghost" size="sm" onClick={() => setInvoiceDrawer(ub.id)}>Ver fatura</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Invoice Drawer */}
      <Drawer
        open={!!invoiceDrawer}
        onClose={() => setInvoiceDrawer(null)}
        title="Fatura de Energia ESA"
        desc={invoiceDrawer ? `${invoiceDrawer} · ${selectedMonth}` : ''}
      >
        {invoiceDrawer && <InvoiceDocument ubId={invoiceDrawer} month={selectedMonth} />}
      </Drawer>
    </div>
  );
}

function InvoiceDocument({ ubId, month }: { ubId: string; month: string }) {
  const inv = demoProvider.getBeneficiaryInvoice(ubId, month);
  if (!inv) return <p className="text-sm text-slate-500">Fatura não encontrada.</p>;

  const { raw, billingSnapshot } = inv;
  const savingsHistory = inv.beneficiarySavingsHistory.slice(-5);

  return (
    <div className="space-y-4">
      {/* Doc header */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-widest text-emerald-200">FATURA DE ENERGIA ESA</div>
        <div className="text-lg font-bold mt-1">{raw.ub.name}</div>
        <div className="text-xs text-emerald-200 mt-0.5">Nº {raw.docNumber}</div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div><div className="text-emerald-200">Vencimento</div><div className="font-semibold">{raw.dueDate}</div></div>
          <div><div className="text-emerald-200">Mês de referência</div><div className="font-semibold">{raw.month}</div></div>
        </div>
      </div>

      {/* Credit balance */}
      <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-4">
        <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-3">Saldo de créditos</div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-600">Saldo anterior</span><span className="tabular-nums">{kwh(raw.previousBalance)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Créditos recebidos</span><span className="tabular-nums text-emerald-600">+ {kwh(raw.receivedCredits)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Créditos compensados</span><span className="tabular-nums text-rose-500">− {kwh(raw.compensated)}</span></div>
          <div className="flex justify-between border-t border-emerald-200 pt-1.5 font-semibold"><span>Saldo final</span><span className="tabular-nums">{kwh(raw.finalBalance)}</span></div>
        </div>
      </div>

      {/* Financial breakdown */}
      <div className="border border-slate-200 rounded-xl p-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3">Composição financeira</div>
        <div className="space-y-1.5 text-sm">
          {billingSnapshot.componentesTarifarios.map(c => (
            <div key={c.label} className="flex justify-between">
              <span className="text-slate-600">{c.label}</span>
              <span className="tabular-nums">{brl(c.value)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-base">
            <span>Total a pagar</span>
            <span className="tabular-nums text-emerald-700">{brl(raw.totalWithEsa)}</span>
          </div>
        </div>
      </div>

      {/* Savings comparison */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3">Comparativo de economia</div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-600">Sem ESA (distribuidora)</span><span className="tabular-nums text-slate-500 line-through">{brl(raw.totalWithoutEsa)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Com ESA</span><span className="tabular-nums text-emerald-700 font-semibold">{brl(raw.totalWithEsa)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-emerald-700">
            <span>Economia mensal ({raw.discountPct.toFixed(1)}%)</span>
            <span className="tabular-nums">{brl(raw.monthlySavings)}</span>
          </div>
        </div>
      </div>

      {/* Savings history sparkline */}
      {savingsHistory.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3">Histórico de economia</div>
          <div className="flex items-end gap-1.5 h-16">
            {savingsHistory.map((h, i) => {
              const max = Math.max(...savingsHistory.map(x => x.monthlySavings));
              const height = max > 0 ? (h.monthlySavings / max) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: '#059669', minHeight: 4 }} />
                  <div className="text-[9px] text-slate-500">{h.label}</div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-slate-600 mt-2">
            Acumulado total: <span className="font-semibold text-emerald-700">{brl(raw.accumulatedSavings)}</span>
          </div>
        </div>
      )}

      <Button className="w-full justify-center"><FileDown className="h-4 w-4" /> Download PDF</Button>
    </div>
  );
}
