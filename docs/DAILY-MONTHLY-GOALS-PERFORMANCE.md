# Metas Diárias/Mensais e o Indicador "Percentual médio da meta"

## Indicadores oficiais

Três indicadores oficiais, sempre os mesmos, diários e mensais:

| Chave canônica         | Label                     |
|-------------------------|---------------------------|
| `newClients`             | Novos Clientes            |
| `qualifiedLeads`         | Leads Qualificados        |
| `completedAttendances`   | Atendimentos Realizados   |

Fonte única: [`assets/performance-goals.js`](../assets/performance-goals.js) —
um módulo UMD (funciona como `require()` no Node/backend e como
`window.ESAPerformanceGoals` no browser via
`<script src="/assets/performance-goals.js">` em `index.html`). Nenhum outro
lugar do código deve reimplementar estas fórmulas ou o mapeamento de aliases —
isso é o que a tarefa chamou de "fonte única de definição dos indicadores".

## Aliases históricos

`ESAPerformanceGoals.normalizeIndicatorKey(raw)` resolve qualquer id/label
histórico ou atual para a chave canônica, sem apagar ou migrar nenhum dado:

- `Prospecção`, `prospecção`, `Prospecções`, `prospeccao`, `novosClientes`,
  `novos_clientes`, `prosp_mensal` → `newClients`
- `leadsQualificados`, `leads_qualificados` → `qualifiedLeads`
- `Atendimento`, `atendimentos`, `atend_mensal` → `completedAttendances`

A normalização usa `normalize('NFD')` + remoção de diacríticos + remoção de
underscores/espaços, então cobre variações de acentuação/plural/caixa sem uma
lista exaustiva de strings exatas.

**Os ids internos usados em `METAS` (`novos_clientes`, `prosp_mensal`,
`atend_mensal`, `leads_qualificados`, `atendimentos`) não foram renomeados** —
só os **labels** exibidos. Isso preserva 100% de compatibilidade com qualquer
dado histórico/relatório já persistido sob esses ids; renomear os ids
quebraria essa referência sem necessidade.

## Metas diárias

`METAS.executivo.diaria` (`index.html`) agora tem os 3 indicadores oficiais
com os MESMOS labels usados na meta mensal:

```
Novos Clientes           — meta 5/dia
Interação Comercial      — meta 10/dia   (indicador adicional, fora do trio oficial)
Leads Qualificados       — meta 0,5/dia  (novo)
Atendimentos Realizados  — meta 2/dia
```

`Leads Qualificados` foi adicionado com `id: 'leads_qualificados_diario'` e
`meta: 0.5` — o valor decimal é preservado exatamente (nunca arredondado para
0 ou 1) em toda a cadeia: constante JS, cálculo de percentual, e exibição
(`metaRow()` formata com `toLocaleString('pt-BR')`, exibindo `0,5` com
vírgula, nunca `0.5` com ponto nem truncado).

`countMeta()` ganhou o case `leads_qualificados_diario`: conta deals do funil
`venda_ufv` criados pelo usuário **no dia selecionado** (`window._metaDataSel`)
— espelha exatamente o padrão já usado por `atendimentos` (diário) vs
`atend_mensal` (mês inteiro).

## Metas mensais

`METAS.executivo.mensal`:

```
Novos Clientes            (era "Prospecções")           — meta 100/mês
Leads Qualificados                                       — meta = 0,5 × dias úteis do mês corrente
Atendimentos Realizados   (era "Atendimentos")           — meta 40/mês
Contratos Fechados, Vendas (R$), Meta de Vendas (R$), Meta kWh Assinatura — inalterados
```

## Dias úteis (nunca hardcoded)

`ESAPerformanceGoals.countBusinessDays(startISO, endISO)` conta dias de
segunda a sexta (inclusive), reais — nunca uma constante fixa de 22. A meta
mensal de Leads Qualificados é recalculada a cada carregamento da página via
`_currentMonthBusinessDays()` (em `index.html`), usando o mês corrente real:

```
meta mensal = meta diária × dias úteis do período
0,5 × 22 dias úteis = 11
0,5 × 20 dias úteis = 10
```

## Teto de 100% por indicador

`ESAPerformanceGoals.computeIndicatorPercentage(realizado, meta)`:

- `meta` ausente ou `<= 0` → `status: 'missing_goal'`, `percentage`/`capped`
  ambos `null` (nunca `NaN`/`Infinity`, nunca 0 silencioso).
- `realizado` negativo → tratado como `0`.
- `percentage = realizado / meta * 100`; `capped = Math.min(percentage, 100)`,
  nunca negativo.

## Fórmula da média diária

`computeDailyGoalAveragePercentage({ newClients, qualifiedLeads, completedAttendances })`:

```
average = (cappedNewClients + cappedQualifiedLeads + cappedCompletedAttendances) / 3
```

**Sempre divide por 3** — mesmo quando 1 ou 2 indicadores estão sem meta
configurada (nesse caso eles contribuem 0 para a soma, e o resultado é
marcado `status: 'incomplete_configuration'` para a UI sinalizar). Só quando
os **3** estão sem meta é que o dia inteiro vira `status: 'not_configured'`
e `average: null` — nunca 0 silencioso.

Exemplo oficial da tarefa: Novos Clientes 150% (capado a 100), Leads
Qualificados 50%, Atendimentos Realizados 80% → `(100+50+80)/3 = 76,67%`.
Arredondado a 2 casas decimais.

## Fórmula do período (múltiplos dias)

`computePeriodGoalAveragePercentage(days)`:

```
periodAverage = soma(dailyGoalAveragePercentage dos dias válidos) / quantidade de dias válidos
```

Regras:

- **Dias duplicados** (mesma `date` repetida) contam uma única vez.
- **Dias com `average === null`** (`not_configured` — nenhum dos 3 indicadores
  tinha meta naquele dia) são **excluídos do denominador**, nunca tratados
  como 0. Isso cobre naturalmente finais de semana/feriados/dias sem
  expediente para o indicador: se não há meta configurada para aquele dia,
  ele simplesmente não entra na conta — não derruba a média artificialmente.
- Se **nenhum** dia do período for válido, `status: 'no_valid_days'` e
  `average: null` (a UI deve mostrar "Meta não configurada", nunca "0%").
- O cálculo usa o **resultado consolidado por usuário e por dia**
  (`countMetaFor(uid, ..., id, data)`, que já soma os registros de CRM do
  dia) — nunca a média simples dos registros individuais do CRM.

## Permissões

Novo indicador "Percentual médio da meta", visível **apenas** para:

- `lucas_vizentin`
- `fernando_fadel_mphd4rj6`

**Controle aplicado no backend**, não apenas escondido na interface:
[`netlify/functions/reports-performance-goal-average.js`](../netlify/functions/reports-performance-goal-average.js)
extrai o `uid` do `sessionToken` **verificado** (nunca de um campo do body) e
checa `hasPerformanceGoalAveragePermission(uid, user)` em
[`netlify/functions/_shared/reports-permissions.js`](../netlify/functions/_shared/reports-permissions.js)
antes de calcular ou devolver qualquer dado. Um uid não autorizado recebe
`403 { code: 'no_permission' }` sem nenhum dado de cálculo na resposta.

Permissão oficial: `reports.performanceGoalAverage.read`. Concedida
inicialmente via allowlist de uid (`AUTHORIZED_UIDS`); extensível sem novo
deploy via `users/{uid}/capabilities['reports.performanceGoalAverage.read'] === true`
no Firebase.

O frontend (`index.html`, dentro de `renderRelCharts()`) também esconde a
seção quando `CU.uid` não está na allowlist — essa é só a primeira camada
(experiência de usuário), nunca a única. Os dois uids foram fornecidos
explicitamente na tarefa; **não foi possível auditar contra o Firebase de
produção real a partir deste ambiente** (sem credenciais/acesso de deploy) —
ver seção "Validação em produção".

## Casos de borda tratados

| Caso                                  | Comportamento                                                    |
|----------------------------------------|-------------------------------------------------------------------|
| Meta 0                                  | `missing_goal` — nunca divide por zero                            |
| Meta ausente                            | `missing_goal`                                                     |
| Realizado 0                              | Percentual 0%, não é erro                                          |
| Realizado acima da meta                  | Capado em 100% para a média; percentual "cru" continua disponível |
| Valor decimal (0,5)                      | Preservado exatamente, formatado com vírgula                       |
| Dia sem expediente / sem meta configurada| Excluído do denominador do período — nunca vira 0                  |
| Usuário sem meta configurada             | Todos os 3 indicadores `missing_goal` → dia `not_configured`       |
| Dia parcial / filtro de 1 dia            | `periodGoalAveragePercentage` = o próprio valor do dia             |
| Período sem dados válidos                | `status: 'no_valid_days'`, `average: null`                         |
| Filtro por usuário/equipe                | Uma linha por usuário selecionado na tabela do relatório           |
| Usuário não autorizado                   | Bloqueado no backend (403), oculto no frontend                    |
| Dados históricos (Prospecção/Atendimento)| Lidos normalmente via alias — nenhum dado apagado ou migrado       |

Nunca permitido em nenhum resultado: `Infinity`, `NaN`, percentual negativo,
percentual acima de 100 no cálculo da média (indicadores individuais são
sempre capados **antes** de entrar na média).

## Correção: "Atendimentos Realizados" sempre 0/48 no relatório (2026-07-24)

**Incidente**: mesmo após a correção de "Minhas Metas" (que passou a chamar
`ensureAgEvsLoaded()` antes de contar atendimentos), o bloco "Percentual médio
da meta" do relatório continuava mostrando `0 / 48` (`0%`) em "Atendimentos
Realizados" para todos os colaboradores, mesmo havendo histórico real de
atendimentos no período (ex.: `2026-07-01` a `2026-07-24`, usuários Jéssica
Lane, Felipe dos Santos, Yasmin Crosoletti, Jaqueline Demarchi).

**Causa raiz exata**: `renderRelCharts()` (o bloco do relatório, em
`index.html`) **nunca chamava `ensureAgEvsLoaded()`** — só `renderMetas()`
(tela Minhas Metas) chamava. O bloco "Percentual médio da meta" calculava
`completedAttendances.realizado` no CLIENTE via
`countMetaFor(uid, [], 'atendimentos', dia)`, que lê a variável em memória
`agEvs` — populada apenas quando o usuário visitava Agenda/Minhas Metas na
mesma sessão. Se o usuário abrisse Relatórios sem antes visitar essas telas,
`agEvs` permanecia `{}` e o indicador ficava sempre zerado, mesmo com
histórico real no Firebase.

**Diferença entre frontend e backend agora**: Novos Clientes e Leads
Qualificados continuam sendo pré-computados pelo CLIENTE (dependem de dados de
CRM já carregados na página) e enviados ao backend só para aplicação da
fórmula — isso é **inalterado**. Atendimentos Realizados passou a ser
**autoritativo no backend**: o cliente envia apenas um placeholder
(`realizado: 0`) e o campo `targetUid` (uid do colaborador cujos atendimentos
devem ser contados); o endpoint
[`reports-performance-goal-average.js`](../netlify/functions/reports-performance-goal-average.js)
lê `events/{data}` diretamente via Firebase Admin — **apenas as datas do
período pedido**, nunca o nó inteiro — resolve o nome canônico do colaborador
(`users/{targetUid}.name`) e calcula o valor real usando
[`assets/attendance-performance.js`](../assets/attendance-performance.js), a
nova fonte única. O backend devolve o `completedAttendances` (realizado +
meta) já corrigido por dia; o cliente usa esse valor (não o placeholder que
enviou) para montar a coluna e os totais do período.

**Regra de participação** (idêntica à usada por `countMeta('atendimentos')`
em Minhas Metas — preservada exatamente, sem regressão):

- Conta quando a pessoa é `ev.author` OU aparece em `ev.guests[]` com
  `status === 'confirmed'`. Convidado `pending`/`declined`/`invited`/sem
  status **nunca** conta.
- Um mesmo evento nunca conta duas vezes para a mesma pessoa, mesmo que ela
  seja autora E convidada confirmada simultaneamente.
- Exige `ev.resultado === 'sucesso'`.
- Exclui `ev.type === 'retomada'` **e** `ev.tipo_atendimento === 'retomada'`
  (ambos os campos podem carregar esse valor historicamente).
- Exige `ev.tipo_atendimento` ausente ou exatamente `'cliente'` — qualquer
  outro valor não conta. Esta é a regra REAL já em produção via Minhas Metas;
  foi verificada por um teste de paridade que extrai `countMeta()` direto de
  `index.html` e compara, evento a evento, contra o novo módulo
  (`report-attendance-performance.manual-test.ts`, suíte AP1).

**Resolução de nome** (para o relatório, que compara colaboradores de fora
pelo uid, ao contrário de Minhas Metas que sempre compara contra o próprio
nome logado): normalização controlada — `trim`, minúsculas,
`normalize('NFD')` + remoção de diacríticos, colapso de espaços internos.
**Nunca** por substring/prefixo: "Felipe dos Santos" casa com
"felipe dos santos", mas nunca com "Felipe Santos Junior".

**Filtro de período**: datas tratadas como strings `YYYY-MM-DD` (comparação
lexicográfica, nunca via `Date`/fuso horário — elimina qualquer risco de
deslocamento de dia por conversão UTC). `startDate` e `endDate` são ambos
inclusivos. O backend lê exclusivamente `events/{data}` para as datas
presentes no período recebido (nunca o nó `events` inteiro).

**Fórmula**: inalterada. A meta (`2/dia`, `48` para 24 dias) continua vindo do
cliente; só o `realizado` passou a ser recalculado no backend. O teto de 100%
por indicador e a média diária/período (`computeDailyGoalAveragePercentage`/
`computePeriodGoalAveragePercentage`, ambos em `assets/performance-goals.js`,
**não modificado**) continuam exatamente os mesmos.

**Diagnóstico temporário**: com `REPORT_ATTENDANCE_DIAGNOSTICS=true`, a
resposta do endpoint inclui `attendanceDiagnostics: { sourceNode: "events",
datesRead, eventsRead, successfulEvents, excludedRetomada, matchedAsAuthor,
matchedAsConfirmedGuest, uniqueMatchedEvents, resolvedPersonName }` — nunca
inclui descrição do evento, tokens ou dados pessoais além do nome já
resolvido. **Não deve permanecer permanentemente habilitado** após a validação
em produção. Também existe
[`scripts/diagnose-report-attendances.js`](../scripts/diagnose-report-attendances.js)
(somente leitura, `--start-date --end-date [--uid|--name]`) para investigar
manualmente contra o Firebase real.

## Validação em produção

1. Abrir **Metas Diárias** (nível executivo) → confirmar os 3 indicadores
   oficiais + Interação Comercial; confirmar Leads Qualificados = `0,5`.
2. Abrir **Metas Mensais** → confirmar os mesmos 3 nomes (Novos Clientes,
   Leads Qualificados, Atendimentos Realizados).
3. Preencher resultados de teste (criar deals/atendimentos de teste).
4. Login como Lucas Vizentin → abrir **Relatórios** → gerar relatório →
   confirmar bloco "Percentual médio da meta".
5. Login como Fernando Fadel → mesmo fluxo.
6. Login como outro usuário → confirmar que o bloco não aparece e que uma
   chamada direta ao endpoint (se tentada) retorna 403.
7. Testar filtro de 1 dia e de vários dias no relatório.
8. **Confirmar os UIDs reais** `lucas_vizentin` e `fernando_fadel_mphd4rj6`
   contra o Firebase de produção antes de considerar a permissão
   definitivamente correta — este passo não pôde ser feito neste ambiente.
9. **Validação específica da correção de Atendimentos Realizados** (sem
   depender de testes sintéticos): selecionar o período `2026-07-01` a
   `2026-07-24` no relatório, sem visitar Agenda/Minhas Metas antes; confirmar
   que "Atendimentos Realizados" deixa de mostrar `0/48` para **Felipe dos
   Santos** e para um segundo colaborador com histórico real (ex.: Jéssica
   Lane); comparar o valor exibido contra os eventos reais em Agenda para o
   mesmo colaborador/período; recarregar a página (F5) e repetir sem visitar
   Agenda — o valor deve permanecer correto; confirmar que Novos Clientes e
   Leads Qualificados permanecem inalterados; confirmar que o "Percentual
   médio da meta" (média) muda de acordo com o novo realizado.
