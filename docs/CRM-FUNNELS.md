# CRM — Funis Comerciais

## Fonte única de configuração

Todos os funis do CRM (Kanban de `index.html`) são definidos em um único
objeto, `CRM_FUNIS` (const, próximo ao topo do script principal). Nenhuma
outra função reimplementa a lista de funis ou de etapas — todo o Kanban,
seletor de funil, criação/edição de deal, drag-and-drop, filtros, busca e os
relatórios ("Indicadores CRM") iteram genericamente sobre este objeto
(`Object.keys(CRM_FUNIS)` / `Object.entries(CRM_FUNIS)` / `CRM_FUNIS[funilKey].etapas`).
Isso significa que adicionar um funil novo é, por design, uma mudança
**apenas de configuração** — nenhuma função genérica precisa ser alterada.

```js
const CRM_FUNIS = {
  venda_ufv: {nome:'Venda UFV', etapas:[...]},
  eletromobilidade: {nome:'Eletromobilidade', etapas:[...]},
  copel: {nome:'Análise Copel', etapas:[...]},
  assinatura_energia: {nome:'Assinatura de Energia', etapas:[...]},
  pre_vendas: {nome:'Pré-vendas', etapas:[...]},
  om: {nome:'Funil O&M', etapas:[...]},
  compra_energia: {
    nome: 'Compra de Energia',
    etapas: ['Lead','Proposta','Visita Técnica','Documentação','Contrato','Pagamento Adesão','Homologação'],
    etapaIds: ['lead','proposta','visita_tecnica','documentacao','contrato','pagamento_adesao','homologacao'],
  },
};
```

Cada entrada tem:

- **chave do objeto** — o id interno estável do funil (nunca o nome
  visível). Ex.: `venda_ufv`, `assinatura_energia`, `compra_energia`.
- **`nome`** — o label visível exibido na aba do seletor de funil, no
  dropdown do modal de deal e nos relatórios.
- **`etapas`** — array de strings, na ordem exibida no Kanban. **Esta é a
  mesma string gravada em `deal.etapa`** — não existe, em nenhum funil deste
  projeto, uma tabela separada de id/label por etapa; o label (com
  acentuação) É o valor persistido.

## Funil "Compra de Energia"

| Item | Valor |
|---|---|
| Id interno (chave em `CRM_FUNIS`) | `compra_energia` |
| Nome visível | `Compra de Energia` |
| Etapa inicial | `Lead` |
| Etapa final | `Homologação` |
| Nº de etapas | 7 |

### Etapas (ordem exibida no Kanban = ordem persistida)

| # | Label (persistido em `deal.etapa`) | Id interno de referência (`etapaIds[n]`) |
|---|---|---|
| 1 | Lead | `lead` |
| 2 | Proposta | `proposta` |
| 3 | Visita Técnica | `visita_tecnica` |
| 4 | Documentação | `documentacao` |
| 5 | Contrato | `contrato` |
| 6 | Pagamento Adesão | `pagamento_adesao` |
| 7 | Homologação | `homologacao` |

### Por que existe `etapaIds` e por que ele nunca é gravado no Firebase

Todo o CRM existente (drag-and-drop, filtros, relatórios, Kanban) já trata
`deal.etapa` como o **label acentuado exato** (ex.: `"Visita Técnica"`, não
`"visita_tecnica"`) — nenhum outro funil deste projeto tem um id de etapa
separado do label. Criar um schema paralelo (`etapa` + um novo campo de id)
só para este funil obrigaria duplicar/ramificar toda a lógica genérica que já
funciona para os 6 funis existentes, e violaria a instrução explícita de não
criar campos paralelos quando o projeto já possui uma chave oficial.

`etapaIds` existe apenas como **metadado de configuração** (dentro de
`CRM_FUNIS.compra_energia`, nunca no registro do deal) para dar um
identificador estável e sem acento a cada etapa — útil para código futuro,
scripts, ou testes que precisem referenciar uma etapa sem depender da grafia
exata do label. **Nunca é lido por nenhuma função de renderização, filtro ou
persistência** — `deal.etapa` continua sendo, para todos os efeitos, a
string do label.

## Persistência (schema do deal)

Nenhum campo novo foi criado. Reaproveita exatamente os campos já oficiais
de qualquer deal do CRM:

| Campo | Uso para Compra de Energia |
|---|---|
| `funil` | sempre `'compra_energia'` |
| `etapa` | sempre um dos 7 labels da tabela acima (nunca um id sem acento) |
| `etapaTs` | timestamp da última mudança de etapa — igual a todos os funis |
| `origem` | Origem do Lead (id canônico validado por `ESALeadOrigin`, `assets/lead-origin.js`) — obrigatória, igual a todos os funis |
| `responsavelUid` / `responsavelNome` | igual a todos os funis |
| `captadorUid` / `captadorNome` | igual a todos os funis |
| `nome`, `empresa`, `telefone`, `produto`, `valor`, `status` | iguais a todos os funis |
| `arquivos` | anexos do deal — igual a todos os funis, nunca tocado pela movimentação de etapa |
| `historico` | uma entrada por movimentação de etapa (`{ts, de, para, autorUid, autorNome}`) — igual a todos os funis |

**Não foram criados** `estagio`, `stage`, `coluna`, nem qualquer campo
paralelo a `funil`/`etapa` — o schema é idêntico ao de qualquer outro deal do
CRM, só o *valor* de `funil` e o conjunto de valores válidos de `etapa`
mudam.

## Compatibilidade com o CRM atual

Auditoria confirmou que TODO o código relevante já é genérico sobre
`CRM_FUNIS` — nenhuma função precisou de tratamento especial para o novo
funil:

- **Seletor de funil** (abas no topo do CRM e `<select>` do modal de deal):
  `Object.entries(CRM_FUNIS)`/`crmPopulateFunilSelect()` — genérico.
- **Colunas do Kanban**: `crmKanbanHtml()` usa `CRM_FUNIS[crmFunilAtual].etapas`
  — genérico; renderiza exatamente as 7 colunas na ordem configurada.
- **Criação/edição de deal**: `crmOpenNew()`/`crmSaveDeal()` leem
  `funil`/`etapa` dos `<select>` populados dinamicamente — genérico; Origem
  do Lead validada por `ESALeadOrigin` independente do funil.
- **Drag-and-drop**: `crmMoveDeal(id, novaEtapa)` só recebe a string da nova
  etapa e faz `fbPatch` — nenhuma lógica depende do funil.
- **Filtros/busca**: `crmFilteredDeals()` filtra por `d.funil===crmFunilAtual`
  primeiro, depois por responsável/status/produto — genérico; a busca textual
  (`crmApplySearch()`) opera sobre os cards já renderizados, sem depender do
  funil.
- **Relatórios ("Indicadores CRM")**: gráficos de pizza/barra iteram
  `Object.keys(CRM_FUNIS)` — o novo funil aparece automaticamente nos
  gráficos gerais. A única exceção é o gráfico "Valor total em negociação
  por etapa — Funil Venda UFV", que é **intencionalmente específico** do
  funil Venda UFV (não deveria e não precisa incluir outros funis).
- **Meta kWh Assinatura / indicadores de Assinatura de Energia**: a soma
  (`_sumKwhAssinatura()`) filtra explicitamente `d.funil==='assinatura_energia'`
  — deals de Compra de Energia nunca são somados a esse indicador, mesmo que
  atinjam a etapa "Homologação" (que não existe no funil de Assinatura de
  Energia, então não haveria confusão de nomes de qualquer forma).
- **"Leads Qualificados"** (relatório "Percentual médio da meta"): esse
  indicador já contava, antes desta missão, qualquer deal com
  `etapa==='Lead'`, **independente do funil** (é assim que já funciona hoje
  para Venda UFV, Eletromobilidade, Análise Copel, Assinatura de Energia e
  O&M — todos usam `'Lead'` como etapa inicial). Deals de Compra de Energia
  passam a participar dessa mesma contagem pré-existente, exatamente como os
  demais funis não-Assinatura já participam — **nenhuma fórmula foi
  alterada** nesta missão.

## Homologação (etapa final)

Nesta missão, "Homologação" é apenas mais uma etapa do Kanban — não dispara
nenhuma ação automática:

- Não contabiliza vendas automaticamente (`status` do deal continua sendo
  gerenciado manualmente, como em qualquer outro funil).
- Não altera nenhuma meta comercial nem a Meta kWh Assinatura.
- Não gera faturamento nem contratos automaticamente.
- Não integra com Gestão de Créditos.

## Mobile

Nenhuma alteração de CSS/layout foi necessária — o Kanban já era responsivo
para qualquer número de colunas/funis:

- `.crm-board{overflow-x:auto}` — rolagem horizontal nativa entre as 7
  colunas (mesmo padrão dos outros funis, que já têm até 10 colunas).
- `.crm-funnel-tabs{flex-wrap:wrap}` — a aba "Compra de Energia" quebra para
  a próxima linha em telas estreitas, sem cortar nem esconder as demais.
- `.crm-col{min-width:250px;max-width:250px}` — colunas com largura fixa e
  legível; nenhuma é cortada de forma irreversível (o container rola, nunca
  colapsa uma coluna).
- Modal de criação/edição de deal é o mesmo modal genérico usado por todos
  os funis, já validado em mobile.

## Testes

`src/ui/energy-credits/direct-runtime/tests/crm-compra-energia-funnel.manual-test.ts`
(112 assertions, execução real via extração de `index.html` para sandbox
`vm`, nunca apenas checagem de string): configuração do funil (id, 7 etapas,
ordem, labels, ids sem acento, etapa inicial/final); funis existentes
inalterados (regressão, comparação byte-a-byte contra os arrays conhecidos);
criação real de lead via `crmSaveDeal()` (funil/etapa/origem/responsável/
captador persistidos corretamente); movimentação real via `crmMoveDeal()`
por todas as 6 transições e retorno de etapa (histórico, anexos, origem,
responsável e captador preservados a cada movimentação, sem duplicar o
deal); persistência simulando reload (reconstrução a partir do estado
gravado no Firebase fake); isolamento entre funis via `crmFilteredDeals()`
(o lead nunca aparece em outro funil); filtros por responsável/status
continuam funcionando; Meta kWh Assinatura comprovadamente não soma deals de
Compra de Energia; checagens estáticas de generalidade (seletor/etapas
nunca hardcoded) e de CSS mobile.

## Validação em produção

1. Login como usuário com acesso ao CRM (`crmCanManage()`) → abrir **CRM**.
2. Confirmar a aba **"Compra de Energia"** aparece junto das demais, sem
   alterar a ordem ou remover nenhuma aba existente.
3. Selecionar "Compra de Energia" → confirmar as **7 colunas** na ordem:
   Lead, Proposta, Visita Técnica, Documentação, Contrato, Pagamento
   Adesão, Homologação.
4. Clicar em "+ Novo Deal" → confirmar que o funil pré-selecionado é
   "Compra de Energia" e a etapa pré-selecionada é "Lead".
5. Preencher nome, responsável e **Origem do Lead** (obrigatória) → salvar
   → confirmar o card aparece na coluna Lead.
6. Arrastar o card por todas as etapas, em ordem, até Homologação →
   confirmar que cada movimentação persiste (recarregar a página após cada
   uma, se possível, para confirmar).
7. Arrastar de volta para uma etapa anterior (ex.: Homologação → Contrato)
   → confirmar que funciona sem restrição.
8. Recarregar a página → reabrir "Compra de Energia" → confirmar que o
   card está na etapa correta, com anexos/observações/origem preservados.
9. Abrir outro funil (ex.: Venda UFV) → confirmar que o lead de Compra de
   Energia **não aparece**.
10. Voltar para "Compra de Energia" → confirmar que o lead **reaparece**.
11. Testar filtro por responsável/status/produto com o funil "Compra de
    Energia" selecionado → confirmar que filtram corretamente.
12. Buscar pelo nome do lead de teste na busca do CRM → confirmar que
    aparece.
13. Confirmar em **Metas** (Meta kWh Assinatura) que o valor não mudou
    após criar/mover o lead de teste.
14. Testar todo o fluxo acima em um celular real: aba acessível, colunas
    roláveis horizontalmente, cards legíveis, modal de criação utilizável,
    movimentação/alteração de etapa funcional.
15. Excluir o(s) deal(s) de teste criados nesta validação, se aplicável.
