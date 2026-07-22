# CRM — Preservação de Atendimentos, Meta kWh Assinatura, Origem do Lead

## 1. Preservação do contador de Atendimentos

### Causa investigada

A missão anterior renomeou o **label** mensal de "Atendimentos" para
"Atendimentos Realizados". Auditoria completa (leitura + execução real)
confirmou que **os ids internos usados em `METAS` nunca foram alterados**:

- diário: `id: 'atendimentos'` (inalterado)
- mensal: `id: 'atend_mensal'` (inalterado)

`countMeta()` continua contando exatamente os mesmos registros de sempre —
eventos de agenda (`agEvs`) com `resultado === 'sucesso'`, autor/convidado
confirmado igual ao usuário, e `tipo_atendimento !== 'retomada'`. Nenhuma
lógica de contagem foi tocada pela renomeação do label.

**Lacuna real encontrada**: `assets/performance-goals.js` não reconhecia o
alias `atendimento_realizado` (singular, com underscore) explicitamente
listado como obrigatório — corrigido. Também foi adicionado
`atendimentos_realizados` (plural) por completude, e uma checagem estrutural
(`CANONICAL_TO_LEGACY_METAS_ID`) que documenta explicitamente, em código, que
o id histórico nunca muda quando o label muda.

### Chave canônica

`completedAttendances` — label oficial "Atendimentos Realizados".

### Aliases aceitos (leitura)

```
atendimento, atendimentos, atendimento_realizado, atendimentos_realizados,
atendimentosRealizados, Atendimentos Realizados, completedAttendances,
atend_mensal
```

Todos resolvidos por `ESAPerformanceGoals.normalizeIndicatorKey()`
(`assets/performance-goals.js`) — nunca por comparação de string espalhada
pelo código.

### Id histórico preservado

```js
CANONICAL_TO_LEGACY_METAS_ID.completedAttendances = { daily: 'atendimentos', monthly: 'atend_mensal' }
```

Nenhum id foi renomeado, nenhum contador novo foi criado, nenhum dado
histórico foi apagado ou migrado.

## 2. Meta kWh Assinatura

### Campo real de kWh encontrado

`d.kwh` no objeto do deal (`crmDeals/{id}`). Já era usado em todo o CRM antes
desta correção: exibição no card (`crmCardHtml`), no detalhe/edição
(`cd-valor` quando `funil === 'assinatura_energia'`), nos totais de coluna do
kanban, e nos gráficos de relatório. **Nenhum campo novo foi criado.**

### Regra de contabilização

Um lead contribui para "Meta kWh Assinatura" quando, simultaneamente:

- `funil === 'assinatura_energia'`;
- `etapa` atual é **Conclusão da GD** ou **Início do faturamento** (aceita
  variações de acentuação/capitalização: "Conclusao da GD", "conclusão da
  gd", "Inicio do Faturamento", "Início de Faturamento" — normalizado via
  `isEligibleAssinaturaStage()`, que remove acentos e caixa antes de comparar);
- `d.kwh` é um número finito **positivo** (kWh inválido, ausente, zero ou
  negativo não contribui — nunca gera `NaN`/`Infinity`, nunca soma negativo).

### Estágios elegíveis

```
Conclusão da GD
Início do faturamento
```

(mais as variações de acentuação/capitalização listadas acima).

### Bug encontrado e corrigido

O case `kwh_exec` de `countMeta()` comparava:

```js
if(d.captador!==_en&&d.responsavel!==_en) return;
```

Esses campos (`d.captador`, `d.responsavel`) **nunca são gravados em nenhum
deal real** — toda criação de deal grava `captadorNome`/`responsavelNome`
(confirmado em todos os pontos de criação: `crmSaveDeal`, fluxos automáticos
de qualificação de prospect, edição). Como `undefined !== nome_do_usuário` é
sempre `true`, essa condição **sempre** retornava (excluía todo deal), fazendo
"Meta kWh Assinatura" retornar **sempre 0** para qualquer executivo. Corrigido
para `d.captadorNome===_en||d.responsavelNome===_en`.

A lógica de soma (antes duplicada em `kwh_assinatura` e `kwh_exec`) foi
consolidada em uma única função `_sumKwhAssinatura(filterFn)` — elimina o
risco desse tipo específico de bug (nome de campo divergente) se recorrer no
futuro.

### Idempotência

O cálculo é **derivado do estado atual** dos deals a cada chamada
(`Object.values(crmDeals).forEach(...)`), nunca um acumulador incremental.
Isso garante, por construção:

- **Duas abas / salvar repetidamente**: cada chamada recalcula do zero a
  partir do estado atual — nunca soma duas vezes.
- **Trocar entre os dois estágios elegíveis** (Conclusão da GD ↔ Início do
  faturamento): o deal ainda é somado **uma única vez**, porque
  `Object.values` itera cada deal no máximo uma vez por chamada.
- **Editar o lead**: o próximo recálculo usa o `kwh`/`etapa` atuais — não há
  double-counting possível.

### Alteração de kWh

Se o `kwh` do lead for alterado **depois** de estar em estágio elegível, o
próximo recálculo usa o **novo** valor — nunca soma o novo sobre o antigo
(não há acumulador, o valor é lido ao vivo a cada chamada).

### Saída/retorno de estágio (política)

**Política adotada**: o indicador representa o **estado atual da carteira
elegível**.

- Lead sai de Conclusão da GD/Início do faturamento → deixa de contar no
  próximo recálculo.
- Lead volta a um estágio elegível → volta a contar, uma única vez.

Não há acúmulo irreversível — é sempre um reflexo fiel do estado presente dos
deals, consistente com a recomendação da tarefa.

## 3. Origem do Lead

### Fonte única

`assets/lead-origin.js` (mesmo padrão UMD de `performance-goals.js`) —
carregado via `<script src="/assets/lead-origin.js">` em `index.html`.

### Origens oficiais

| id oficial            | Label              |
|------------------------|---------------------|
| `active_prospecting`    | Prospecção Ativa    |
| `sdr`                   | SDR                 |
| `paid_traffic`          | Tráfego Pago        |
| `ambassadors`           | Embaixadores        |

### Validação

- **Frontend**: campo `<select id="cd-origem">` obrigatório no modal de
  criação/edição de deal (`Origem do Lead *`), com opção inicial "Selecione..."
  (nunca pré-selecionado).
- **Validação de negócio** (não apenas HTML `required`): `crmSaveDeal()`
  chama `ESALeadOrigin.validateLeadOriginForSave(valor)` **antes** de
  qualquer escrita no Firebase (`fbSet`/`fbPatch`). Rejeita ausência
  (`reason: 'missing'`) e qualquer valor fora das 4 opções oficiais
  (`reason: 'invalid'`), com a mensagem exata "Selecione a origem do lead."

**Ressalva sobre "backend"**: este CRM legado escreve deals **diretamente**
do browser para o Firebase RTDB via REST (`fbSet`/`fbPatch`), sem nenhuma
Netlify Function intermediária para criação/edição de deals, e não há um
arquivo de regras do Firebase (`database.rules.json`) versionado neste
repositório. Portanto, **não existe hoje um ponto de imposição server-side
real** para esta escrita específica — a mesma limitação arquitetural já
existe para todos os outros campos do deal. A validação implementada
(`ESALeadOrigin.validateLeadOriginForSave`) é a camada de imposição mais
forte disponível nesta arquitetura: uma função de negócio centralizada,
chamada antes de qualquer escrita, mais forte que `required` do HTML (que um
usuário pode contornar via DevTools), mas não um gate de rede verdadeiro. Se
uma imposição de rede for exigida no futuro, o caminho recomendado é (a)
adicionar regras de validação no Firebase Console/`database.rules.json`, ou
(b) migrar a escrita de deals para uma Netlify Function dedicada — ambos fora
do escopo desta missão.

### Compatibilidade com leads antigos

- Leads sem `origem` **continuam visíveis** e editáveis normalmente — nunca
  bloqueados, nunca apagados.
- Ao abrir para edição, `ESALeadOrigin.normalizeLeadOrigin(d.origem)` tenta
  reconhecer o valor existente. Se reconhecido (alias histórico exato:
  `prospeccao`, `prospecção`, `trafego`, `tráfego pago`, `embaixador`,
  `indicação embaixador`), o select já vem pré-selecionado com o id
  canônico correspondente.
- Se **não** reconhecido — incluindo o padrão dinâmico pré-existente
  `"Prospecção " + nomeDoUsuário"` usado pelos fluxos automáticos de
  qualificação de prospect — o campo fica **vazio** e um aviso "Origem não
  informada — selecione para continuar." é exibido. **Nenhum valor é
  adivinhado silenciosamente.**
- Ao editar e salvar um lead antigo sem origem reconhecida, o preenchimento
  passa a ser **obrigatório** (mesma validação de criação).
- O dado histórico original nunca é apagado até que o usuário
  explicitamente salve uma nova origem.

### Escopo não coberto nesta missão (documentado, não implementado)

Os fluxos **automáticos** de criação de deal (disparados por qualificação de
prospect, não pelo formulário principal `crmSaveDeal`) continuam gravando o
padrão histórico `origem: 'Prospecção ' + nomeDoUsuário`, sem passar pela
nova validação. Alterar esses fluxos exigiria tocar em múltiplos pontos de
criação automática de deal, ampliando significativamente o escopo desta
missão — deixado como próximo passo, não implementado agora.

### Relatórios

Nesta missão: `origem` é persistida no deal, exibida no formulário de
edição/detalhe, e incluída em `crmDeals` (portanto já disponível em qualquer
consumidor futuro de relatórios sem refatoração destrutiva). Filtro por
origem em telas de relatório **não foi implementado** nesta missão, para não
ampliar o escopo além do pedido mínimo ("preparar a estrutura").

## Validação em produção

1. Abrir **Metas Diárias/Mensais** → confirmar "Atendimentos Realizados"
   continua exibindo valores reais (não zerado) para um executivo com
   atendimentos registrados no mês.
2. Confirmar "Meta kWh Assinatura" (mensal, nível executivo) passa a exibir
   valores reais somados a partir de leads em Conclusão da GD/Início do
   faturamento — antes desta correção, sempre aparecia 0 por causa do
   bugfix descrito acima.
3. Criar um novo lead no CRM → confirmar que salvar sem selecionar "Origem
   do Lead" é bloqueado com a mensagem "Selecione a origem do lead.".
4. Editar um lead antigo sem origem → confirmar aviso "Origem não
   informada" e que salvar sem selecionar continua bloqueado.
5. Editar um lead com origem reconhecível (ex.: valor histórico
   "tráfego pago") → confirmar pré-seleção correta.
6. Confirmar que nenhum dado histórico de `origem`, `atendimentos` ou `kwh`
   foi apagado ou sobrescrito por esta correção.
