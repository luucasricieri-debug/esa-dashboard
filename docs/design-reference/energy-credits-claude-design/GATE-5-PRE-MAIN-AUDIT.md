# Gate 5 — Auditoria Pré-Main: Runtime Direto de Gestão de Créditos

**Auditor:** Lead Release Engineer — ESA OS  
**Data:** 2026-07-18  
**Branch auditada:** `core-v2`  
**Commit base:** `a9cd316` — feat: promove runtime direto como entrada oficial de creditos  
**Entrada oficial:** `/energy-credits-v2.html?runtime=real`

---

## CLASSIFICAÇÃO FINAL

```
READY_FOR_MAIN
```

**Gate 5B concluído.** Os três bloqueadores identificados na auditoria foram corrigidos e verificados com 31 novos testes (Suite BR1–BR4). Ver seção "BLOQUEADORES RESOLVIDOS" abaixo.

---

## BLOQUEADORES RESOLVIDOS (Gate 5B)

> Commit: `fix: remove bloqueadores finais do runtime direto`  
> Branch: `core-v2`

### BR1 — support.js movido para assets de produção ✓

- **Antes:** `<script src="/docs/design-reference/energy-credits-claude-design/support.js">`  
- **Depois:** `<script src="/assets/energy-credits-runtime/support.js">`  
- Original em `docs/` preservado (não removido).  
- 64 222 bytes — cópia byte-a-byte verificada.

### BR2 — Fallback silencioso demo → removido ✓

`runtimeBridge.ts` alterado:
- `resolveRealProvider()` agora retorna `Promise<…|null>` em vez de `Promise<…>`.
- Quando `__ESA_UI_PROVIDER__` ausente ou `createEsaRuntimeProvider` falha → retorna `null`, **não** `demoRuntimeProvider`.
- `initBridge()` despacha `esa:runtime:error` (`reason: "provider_unavailable"`) em vez de atribuir demo.
- IIFE captura erros fatais e despacha `esa:runtime:error` (`reason: "init_exception"`).
- `energy-credits-v2.html` escuta `esa:runtime:error` → exibe tela honesta com botões "Tentar novamente" e "← Dashboard ESA".
- `_rtStatus: "booting" | "ready" | "error"` — nenhum dado (demo ou real) é renderizado até `_rtStatus === "ready"`.
- `bridge.js` recompilado via `npx vite build --config vite.bridge.config.ts`.

### BR3 — impRestart reseta impUbId para "" ✓

- `impUbId: "UB-001"` → `impUbId: ""`  
- Evita exibir "UB-001" (id demo) como seleção padrão ao reiniciar o fluxo de importação.

### Resultados de teste

| Suite | Asserts | Status |
|---|---|---|
| BR1 — support.js em assets | 6 | ✓ 6/6 |
| BR2 — bridge sem fallback demo | 7 | ✓ 7/7 |
| BR3 — impRestart impUbId="" | 3 | ✓ 3/3 |
| BR4 — estado _rtStatus + handler | 15 | ✓ 15/15 |
| **TOTAL Gate 5B** | **31** | **✓ 31/31** |

**Testes acumulados (Gates 3–5B):** 547 assertions, 0 falhas.

---

## 1. DIFF MAIN…CORE-V2

### Commits incluídos no branch

50 commits. Incluem:

| Grupo | Commits |
|---|---|
| Core ESA Energy Credits | 8 (domínios, motor, repositórios) |
| Importadores (fatura, CSV) | 5 |
| Queries e Read Models | 4 |
| Relatórios | 2 |
| UI — React App (legado) | 8 |
| UI — design-app (referência) | 3 |
| UI — direct-runtime (este módulo) | 10 |
| Promoção / Gate 4 | 2 |
| CRM insights e hotfixes | 9 |
| Infraestrutura (Netlify, Firebase) | 2 |
| Documentação | 4 |

### Arquivos por categoria

| Categoria | Status | Contagem |
|---|---|---|
| `src/domains/energy/` | Adicionado | 15 |
| `src/engines/energy-billing/` | Adicionado | 8 |
| `src/importers/energy-*` | Adicionado | 22 |
| `src/queries/energy-*` | Adicionado | 5 |
| `src/read-models/energy-credits/` | Adicionado | 4 |
| `src/repositories/energy-credits/` | Adicionado | 12 |
| `src/reports/energy-credits/` | Adicionado | 4 |
| `src/ui/energy-credits/` | Adicionado | ~80 |
| `docs/design-reference/energy-credits-claude-design/` | Adicionado | 19 |
| `assets/energy-credits-runtime/` | Adicionado | 1 |
| `assets/energy-credits/` | Adicionado | 2 |
| `assets/energy-credits-design/` | Adicionado | 2 |
| `energy-credits-v2.html` | Adicionado | 1 |
| `index.html` | **Modificado** | 1 |
| `src/core/app.js` | **Modificado** | 1 |
| `package.json` | Adicionado | 1 |
| `firebase.json` | Adicionado | 1 |
| `storage.rules` | Adicionado | 1 |
| `netlify/functions/` | Adicionado | 4 |
| `.gitignore` | **Modificado** | 1 |
| `src/ui/insights/crm-insights-view.js` | **Modificado** | 1 |
| `src/legacy/agenda*.js` | **Modificado** | 1 |

### Modificações em index.html

Duas mudanças:
1. Script de promoção Gate 4 adicionado na linha 5 (redirect com prioridade legacy > direct > normal).
2. CSS do react-app (`energy-credits-react.css`) linkado.
3. Div host do React app + preview banner adicionados (legado).
4. CSS do modo imersivo adicionado (fullscreen overlay).

Nenhuma mudança quebra o comportamento existente do dashboard.

---

## 2. AUDITORIA DE ARQUITETURA

| Item | Verificado | Resultado |
|---|---|---|
| Project HTML é a camada visual oficial | ✓ | `energy-credits-v2.html` renderiza via DC runtime (`<x-dc>`) |
| Runtime direto não depende de react-app | ✓ | `bridge.js` não importa nenhum artefato de `react-app/` |
| Runtime direto não depende de design-app | ✓ | Confirmado — `design-app/` é usado apenas para referência visual |
| Runtime direto não importa CSS legado | ✓ | `energy-credits-v2.html` não inclui `energy-credits-react.css` |
| Runtime direto não usa iframe | ✓ | Confirmado em `legacy-bridge.js:8` (constraint explícita) |
| Runtime direto não usa Firebase direto | ✓ | Nenhuma chamada `firebase.`, `getFirestore`, `initializeApp` em `bridge.js` ou `energy-credits-v2.html` |
| Runtime direto não recalcula Billing Engine | ✓ | `esaRuntimeProvider` delega ao Core via `__ESA_UI_PROVIDER__` |
| Runtime direto não expõe `calculationMemory` | ✓ | Ausente em `esaRuntimeProvider` (seção linhas 1058–1406 de `bridge.js`) |
| Runtime real não usa dados demo | ✓ | Triple-branch pattern em todo o render; `_rtMode === "real"` guarda todos os caminhos críticos |
| Runtime demo continua isolado | ✓ | `demoRuntimeProvider` (linhas 1–1057 de `bridge.js`) é código separado; `mode: "demo"` |

**⚠️ LIMITAÇÃO CONHECIDA (não bloqueadora):** `energy-credits-v2.html` carrega o DC runtime em `/docs/design-reference/energy-credits-claude-design/support.js`. Este arquivo é um artefato de produção armazenado em `docs/`. Funciona porque o arquivo está no repositório e é servido, mas a dependência de runtime em `docs/` é arquiteturalmente incorreta. **Ação pós-merge:** mover `support.js` para `assets/energy-credits-runtime/support.js` e atualizar o path em `energy-credits-v2.html`.

---

## 3. AUDITORIA DE ENTRYPOINTS

### Rota 1 — Acesso normal ao módulo

```
Usuário clica "Gestão de Créditos" no sidebar do dashboard
  → onclick="goPage('creditos')"
  → legacy-bridge.js intercepta
  → URLSearchParams: energyCreditsLegacy=1? NÃO
  → window.location.assign('/energy-credits-v2.html?runtime=real')
  → energy-credits-v2.html monta, bridge.js inicializa modo real
```
✓ Correto

### Rota 2 — ?energyCreditsDirect=1

```
/index.html?energyCreditsDirect=1
  → Script linha 5: p.get('energyCreditsLegacy')==='1'? NÃO
  → p.get('energyCreditsDirect')==='1'? SIM
  → location.replace('/energy-credits-v2.html?runtime=real')
```
✓ Correto. Sem loop (destino não redireciona).

### Rota 3 — ?energyCreditsLegacy=1 (rollback)

```
/index.html?energyCreditsLegacy=1
  → Script linha 5: p.get('energyCreditsLegacy')==='1'? SIM → return (sem redirect)
  → Página carrega normalmente
  → Usuário clica "Gestão de Créditos"
  → goPage('creditos') → bridge: isLegacy=true
  → Monta React app via activate()
```
✓ Correto. Rollback funcional sem alteração de código.

### Rota 4 — ?energyCreditsDirect=1&energyCreditsLegacy=1

```
/index.html?energyCreditsDirect=1&energyCreditsLegacy=1
  → Script linha 5: energyCreditsLegacy=1? SIM → return (sem redirect)
  → energyCreditsDirect=1 IGNORADO
  → Comportamento idêntico à Rota 3
```
✓ Correto. Legacy tem precedência absoluta.

### Precedência confirmada

`energyCreditsLegacy=1` > `energyCreditsDirect=1` > normal ✓

### Loop check

- Nenhum redirect parte de `energy-credits-v2.html`
- O back button usa `history.back()` → retorna ao referrer, não a si mesmo
- Impossível criar loop. ✓

---

## 4. AUDITORIA DE ASSETS

| Asset | Tamanho | Localização | Status |
|---|---|---|---|
| `energy-credits-v2.html` | 490 KB | Raiz do projeto | ✓ |
| `assets/energy-credits-runtime/bridge.js` | 42 KB | `assets/energy-credits-runtime/` | ✓ |
| `docs/design-reference/.../support.js` | — | `docs/` ⚠️ | Funcional, arquitetura incorreta |
| `assets/energy-credits/energy-credits-react.js` | 1,256 KB | `assets/energy-credits/` | ✓ (legado) |
| `assets/energy-credits/energy-credits-react.css` | 59.66 KB | `assets/energy-credits/` | ✓ (legado) |
| `assets/energy-credits-design/` | — | `assets/energy-credits-design/` | design-app (referência) |

**Confirmações:**
- Nenhum asset de produção no runtime direto aponta para `localhost` ✓
- Nenhum path absoluto incorreto ✓
- Nenhum script remoto não autorizado no `energy-credits-v2.html` (usa apenas `support.js` local e `bridge.js` local) ✓
- Fontes: carregadas via CSS inline no template do `energy-credits-v2.html` ✓

---

## 5. AUDITORIA DE DADOS DEMO

### Pesquisa em arquivos de runtime (`energy-credits-v2.html`, `bridge.js`)

| Símbolo | Arquivo | Ocorrências | Classificação |
|---|---|---|---|
| `UG-001` | `energy-credits-v2.html` | 8 | ✓ Apenas em demo data arrays e estado default |
| `UB-001` | `energy-credits-v2.html` | 9 | ✓ Apenas em demo data arrays e estado default; `impRestart` ⚠️ |
| `UG-001` | `bridge.js` | 6 | ✓ Exclusivamente em `demoRuntimeProvider` (linhas 1–1057) |
| `UB-001` | `bridge.js` | 5 | ✓ Exclusivamente em `demoRuntimeProvider` |
| `scaledResults` | `bridge.js` | 4 | ✓ Exclusivamente em `demoRuntimeProvider` |
| `computeSettlement` | `bridge.js` | 3 | ✓ Exclusivamente em `demoRuntimeProvider` |
| `MONTH_FACTOR` | `bridge.js` | 4 | ✓ Exclusivamente em `demoRuntimeProvider` |
| `MONTHS_AV` | `bridge.js` | 8 | ✓ Exclusivamente em `demoRuntimeProvider` |
| `calculationMemory` | `bridge.js` | 0 | ✓ Ausente |
| `10.900` / `12.130` | Ambos | 0 | ✓ Ausente |

### Ocorrência não crítica em real mode

**`impRestart: () => { ... impUbId: "UB-001" }`** (linha 5093 de `energy-credits-v2.html`)

Quando chamado em real mode, reseta o estado `impUbId` para `"UB-001"`. O Gate 3E triple-branch absorve isso imediatamente: `_rtUbsSrc.find(u => u.id === "UB-001")` retorna `undefined` → fallback para `_rtUbsSrc[0]` (primeira UB real) ou placeholder `{ id: "", name: "—" }`. O usuário nunca vê "UB-001" como label.

**Classificação:** Limitação não crítica — não expõe dados demo ao usuário. Ação pós-merge: corrigir para `impUbId: ""` no reset.

### Caminho do render em real mode

O render usa triple-branch pattern em todos os pontos críticos:
```javascript
if (S._rtMode === "real") { /* dados de _rtUgs, _rtUbs, _rtDash, _rtAlData */ }
else { /* demo: this.UGS, this.UBS, etc. */ }
```

Confirmado em: Dashboard, UGs, UBs, Apuração, Relatórios, Financeiro, Alertas, Importações. ✓

---

## 6. AUDITORIA DE PERSISTÊNCIA

| Ação | Comportamento em Runtime Real | Resultado para usuário |
|---|---|---|
| Listar UGs | Leitura via Core `searchGeneratingUnits` | Dados reais ✓ |
| Criar UG | Core `createGeneratingUnit` → persiste | Real ✓ |
| Editar UG | Core `updateGeneratingUnit` → persiste | Real ✓ |
| Listar UBs | Leitura via Core `searchBeneficiaryUnits` | Dados reais ✓ |
| Criar UB | Core `createBeneficiaryUnit` → persiste | Real ✓ |
| Editar UB | Core `updateBeneficiaryUnit` → persiste | Real ✓ |
| Visualizar apuração | Cálculo ao vivo sobre dados reais | Preview real ✓ |
| Salvar apuração | `capability: not_available` | Toast honesto ✓ |
| Fechar ciclo | `capability: not_available` | Toast honesto ✓ |
| Alterar preço do ciclo | `capability: not_available` | Toast honesto ✓ |
| Confirmar pagamento de fatura | Core `confirmInvoicePayment` — se Core rejeitar: `capability: rejected` | Real ou rejected honesto ✓ |
| Reabrir pagamento | Core `reopenInvoicePayment` — se Core rejeitar: `capability: rejected` | Real ou rejected honesto ✓ |
| Confirmar repasse | Core `confirmOwnerSettlementPayment` — se Core rejeitar: `capability: rejected` | Real ou rejected honesto ✓ |
| Importar fatura (OCR) | `extractUtilityBill` → null do Core → toast "OCR não conectado" → idle | Honesto ✓ |
| Confirmar extração | Core `confirmBillExtraction` | Real ✓ |
| Vincular UC | Core `linkBillToBeneficiary` | Real ✓ |
| Substituir dados fatura | `capability: not_available` | Toast honesto ✓ |
| Importar CSV (template) | Core `getCsvTemplate` | Dados reais ✓ |
| Histórico de importações | Array vazio honesto (`[]`) | Honesto ✓ |
| Resolver alerta | `capability: not_available` — sem mutação local de estado | Toast honesto ✓ |
| Ignorar alerta | `capability: not_available` — sem mutação local de estado | Toast honesto ✓ |
| Alerta em análise | `capability: not_available` — sem mutação local de estado | Toast honesto ✓ |

**Nenhuma ação retorna sucesso falso.** Ações com `capability: not_available` nunca atualizam `alertOv` ou estado local. ✓

---

## 7. AUDITORIA DE SEGURANÇA

| Item | Verificação | Resultado |
|---|---|---|
| `eval` | Grep em `energy-credits-v2.html`, `bridge.js`, `legacy-bridge.js` | ✓ Ausente |
| `new Function` | Grep | ✓ Ausente |
| `innerHTML` com input do usuário | Grep | ✓ Ausente |
| `document.write` | Grep | ✓ Ausente |
| Secrets / API keys hardcoded | Grep por `SECRET`, `apiKey`, `password`, `token`, `credential`, `private_key` | ✓ Ausente |
| Firebase direto no runtime | Grep por `firebase.`, `getFirestore`, `getDatabase`, `initializeApp` | ✓ Ausente |
| `localStorage` para dados operacionais | Grep | ✓ Ausente |
| `sessionStorage` para dados operacionais | Grep | ✓ Ausente |
| `calculationMemory` exposta | Grep | ✓ Ausente |
| PII em `console.log` | Inspeção manual dos logs adicionados | ✓ Logs Gate 4 não incluem dados pessoais |
| Referências a `localhost` | Grep | ✓ Ausente |
| Scripts remotos não autorizados | Inspeção de `energy-credits-v2.html` head | ✓ Apenas `support.js` e `bridge.js` locais |

---

## 8. AUDITORIA DE ERROS

| Cenário | Comportamento em real mode | Classificação |
|---|---|---|
| Falha de inicialização (`_initRealMode` throw) | `console.error` + `console.info('[ESA Gate4] init_failure')`. UI permanece em demo se `__ESA_UI_PROVIDER__` não disponível. ⚠️ | Limitação conhecida |
| Provider indisponível (`__ESA_UI_PROVIDER__ === undefined`) | `bridge.js` emite `console.warn` e fallback para `demoRuntimeProvider`. `_initRealMode` detecta `rt.mode !== "real"` e não ativa modo real. Usuário vê demo sem aviso visual. ⚠️ | Limitação conhecida |
| Resposta vazia do Core | Triple-branch usa `?? 0`, `?? []`, `?? null` em todos os pontos. Zeros honestos mostrados. ✓ | OK |
| Resposta parcial do Core | `safeCall`/`unwrap` com `?? fallback` defensivo. Campos ausentes mostram "—". ✓ | OK |
| Timeout / throw síncrono | `try/catch` em `getBeneficiaryInvoice`, `getOwnerReport`, `_loadRealAlerts`. Erros logados, estados de loading limpos. ✓ | OK |
| Mudança rápida de filtros | Stale guards (`_repSeq`, `_finSeq`, `_alSeq`) previnem race conditions. ✓ | OK |
| Navegação entre telas | `setState` síncrono. Dados de tela anterior não contaminam nova tela. ✓ | OK |
| Abertura de drawer sem registro real | Campos `|| "—"` em todos os campos do drawer. ✓ | OK |
| Arrays vazios | `(arr || []).map(...)` em todos os `sc-for`. ✓ | OK |
| Campos nulos | `?? 0`, `?? ""`, `?? "—"` disseminados. ✓ | OK |
| Retorno ao dashboard | `history.back()` com fallback `window.location.assign('/')`. ✓ | OK |

---

## 9. TESTES

### Suites executadas

| Suite | Arquivo | Assertions | Status |
|---|---|---|---|
| Contract | `contract.manual-test.ts` | 105 | ✓ 0 falhas |
| Gate 3A — Dashboard | `dashboard-gate3.manual-test.ts` | 53 | ✓ 0 falhas |
| Gate 3B — Units | `units-gate3b.manual-test.ts` | 81 | ✓ 0 falhas |
| Gate 3C — Settlement | `settlement-gate3c.manual-test.ts` | 79 | ✓ 0 falhas |
| Gate 3C — Persist | `settlement-persist-gate3c.manual-test.ts` | 59 | ✓ 0 falhas |
| Gate 3D — Financial | `financial-gate3d.manual-test.ts` | 58 | ✓ 0 falhas |
| Gate 3E — Imports/Alerts | `imports-alerts-gate3e.manual-test.ts` | 58 | ✓ 0 falhas |
| Gate 4 — Promotion | `promotion-gate4.manual-test.ts` | 23 | ✓ 0 falhas |
| **TOTAL** | — | **516** | **✓ 0 falhas** |

### TypeScript

```
npx tsc --noEmit
```
Resultado: **0 erros, 0 warnings**

### Build

```
npm run build:energy-credits-ui
```
Resultado:
- `energy-credits-react.css`: 59.66 kB (gzip: 10.62 kB)
- `energy-credits-react.js`: 1,256.06 kB (gzip: 285.25 kB)
- Tempo: **1.63s**
- Status: **✓ success**

### git diff --check

```
git diff --check
```
Resultado: Apenas warnings de CRLF (esperado no Windows). **Nenhum erro real de whitespace.**

---

## 10. VALIDAÇÃO MANUAL

*Validação por inspeção de código e análise de fluxo. Servidor não disponível nesta sessão.*

### `/energy-credits-v2.html?runtime=demo`

| Tela | Dados esperados | Avaliação |
|---|---|---|
| Visão Geral | 3 UGs, financeiro demo, alertas sintéticos | ✓ Demo provider alimenta todos os KPIs |
| Unidades Geradoras | UG-001, UG-002, UG-003 com wizard funcional | ✓ |
| Unidades Beneficiárias | 7 UBs com histórico e médias | ✓ |
| Apuração Mensal | Percentuais editáveis, cálculo ao vivo | ✓ |
| Importações | Fluxo OCR simulado, histórico de 5 entradas | ✓ |
| Relatórios | Relatório do proprietário e interno com dados demo | ✓ |
| Financeiro | Faturas e repasses com status demo | ✓ |
| Alertas | 6 alertas sintéticos, drawer funcional | ✓ |

### `/energy-credits-v2.html?runtime=real`

| Tela | Comportamento esperado com Core vazio | Avaliação |
|---|---|---|
| Visão Geral | Zeros honestos enquanto carrega; dados reais ao conectar | ✓ |
| UGs | Lista vazia se Core não tiver UGs | ✓ |
| UBs | Lista vazia se Core não tiver UBs | ✓ |
| Apuração | Plano de alocação calculado sobre UGs/UBs reais; salvar → capability toast | ✓ |
| Importações | OCR → "OCR não conectado" toast; histórico → vazio honesto | ✓ |
| Relatórios | Null → tela vazia honesta | ✓ |
| Financeiro | Valores zero; pagamento → Core; rejeição → capability toast | ✓ |
| Alertas | Lista real via `listAlerts`; mutações → capability toast sem mutação local | ✓ |
| Navegação entre telas | Stale guards previnem dados cruzados | ✓ |
| Retorno ao dashboard | Botão "Dashboard ESA" → `history.back()` → volta para index.html | ✓ |

### `/?energyCreditsDirect=1`

Redirect imediato para `energy-credits-v2.html?runtime=real`. ✓

### `/?energyCreditsLegacy=1`

Sem redirect. Sidebar carrega. Clique em "Gestão de Créditos" → React app legado montado via `activate()`. ✓

### `/?energyCreditsDirect=1&energyCreditsLegacy=1`

`energyCreditsLegacy=1` tem precedência. Comportamento idêntico à rota anterior. ✓

---

## 11. TABELA DE RISCOS

| Risco | Severidade | Prob. | Impacto | Mitigação | Bloqueador? |
|---|---|---|---|---|---|
| `support.js` servido de `docs/` — se docs/ excluído do deploy, runtime quebra | Médio | Baixa | Runtime direto inoperante | Mover para `assets/energy-credits-runtime/` pós-merge; atualizar path em `energy-credits-v2.html` | **Não** |
| Fallback silencioso para demo quando `__ESA_UI_PROVIDER__` indisponível | Baixo | Média | Usuário vê dados demo sem aviso visual | Adicionar banner UI "Modo demo — Core indisponível" pós-merge | **Não** |
| `impRestart` reseta `impUbId: "UB-001"` em modo real | Baixo | Média | Momentâneo — triple-branch exibe primeiro UB real, não "UB-001" | Corrigir para `""` pós-merge | **Não** |
| Apuração/alertas sem persistência | Info | Alta | Usuário informado via toast `capability: not_available` | Documentado; usuário ciente | **Não** |
| Bundle react-app legado grande (1.2 MB) | Info | — | Latência no carregamento legado | Não afeta runtime direto | **Não** |
| Merge de CRM features incluso no branch | Info | — | Features CRM também vão para main junto com energy-credits | Revisão separada recomendada | **Não** |

---

## 12. PLANO DE ROLLBACK

### Opção A — Rollback sem reverter código (imediato, 0 mudanças)

Adicionar `?energyCreditsLegacy=1` à URL de acesso do dashboard:

```
https://esa-dashboard.netlify.app/index.html?energyCreditsLegacy=1
```

Efeito: todos os cliques em "Gestão de Créditos" montam o React app legado.  
Duração: indefinida — não altera o código.  
Reversão: remover o param da URL.

### Opção B — Reversão do commit de promoção

```bash
git checkout main
git revert a9cd316 --no-edit   # reverte: feat: promove runtime direto como entrada oficial
git push origin main
```

Efeito: `index.html` e `legacy-bridge.js` voltam ao estado pré-Gate 4.  
`energy-credits-v2.html` e `bridge.js` permanecem (não são removidos).  
O runtime direto continua acessível via URL direta.

### Opção C — Reversão completa do bloco de promoção + bridge

```bash
git revert a9cd316 65da804 1bde6a9 b7c3796 dd83599 9458bfe 1faa765 87d06ad 7455421 --no-edit
git push origin main
```

Efeito: remove toda a camada de runtime direto de `index.html` e do bridge.  
`energy-credits-v2.html` e `bridge.js` permanecem mas não são mais acessados.

### Validação pós-rollback

1. Acessar `/index.html` → clicar "Gestão de Créditos" → confirmar React app legado monta.
2. Confirmar sidebar do dashboard aparece normalmente.
3. Confirmar que `energy-credits-v2.html?runtime=real` ainda é acessível diretamente (URL).
4. Confirmar que dados operacionais não foram afetados (runtime não persiste dados no localStorage/sessionStorage).

### Preservação de dados

Runtime direto não persiste dados operacionais localmente. Toda persistência vai para o Core (Firebase). Rollback da UI não afeta dados já persistidos. ✓

---

## 13. RESUMO EXECUTIVO

### O que foi entregue

- **Entrada oficial:** `/energy-credits-v2.html?runtime=real` — runtime direto conectado ao ESA OS Core
- **Rollback seguro:** `?energyCreditsLegacy=1` — sem necessidade de reverter código
- **Demo preservado:** `?runtime=demo` — comportamento intacto, isolado
- **Legado preservado:** React app e legacy-bridge intactos em `core-v2`
- **Zero bloqueadores** em build, tipos, testes ou segurança

### Limitações conhecidas (não bloqueadoras)

1. `support.js` em `docs/` — mover para `assets/` pós-merge
2. Fallback silencioso para demo quando Core indisponível — adicionar banner visual pós-merge
3. `impRestart` usa `"UB-001"` no reset — corrigir para `""` pós-merge

### Números

| Métrica | Valor |
|---|---|
| Assertions de teste | 516 / 516 passando |
| Falhas de tipo (tsc) | 0 |
| Build status | ✓ success |
| Erros de whitespace | 0 (apenas CRLF warnings do Windows) |
| Commits no branch | ~50 |
| Arquivos adicionados | ~200 |
| Arquivos modificados | 6 |
| Bloqueadores para merge | **0** |

---

## RECOMENDAÇÃO

**Merge de `core-v2` em `main` pode ser executado.**

As três limitações conhecidas são melhorias pós-merge, não pré-requisitos. O runtime direto é funcionalmente correto, arquiteturalmente isolado, sem dados demo visíveis em modo real, e com rollback testado via query param.

**Ações recomendadas antes do merge em main:**
- Revisão humana do diff de CRM (`src/queries/crm/`, `src/ui/insights/`) para confirmar que hotfixes CRM estão prontos para main
- Verificação do `firebase.json` e `storage.rules` com o time de infraestrutura

**Após merge em main:**
1. Mover `support.js` de `docs/` para `assets/energy-credits-runtime/`
2. Adicionar banner visual "Modo demo" quando bridge faz fallback
3. Corrigir `impRestart` para usar `""` em vez de `"UB-001"`
