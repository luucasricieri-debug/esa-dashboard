# Gate 4 — Promoção do Runtime Direto como Entrada Oficial

## Objetivo

Promover `/energy-credits-v2.html?runtime=real` como entrada oficial do módulo "Gestão de Créditos", com rollback seguro via `?energyCreditsLegacy=1`.

---

## Prioridade de Resolução

| Condição | Destino |
|---|---|
| `?energyCreditsLegacy=1` presente | Modo legado (React app via legacy-bridge) |
| `?energyCreditsDirect=1` presente | Runtime direto (`/energy-credits-v2.html?runtime=real`) |
| `goPage('creditos')` normal | Runtime direto (`/energy-credits-v2.html?runtime=real`) |

---

## Arquivos Alterados

### `index.html` (linha 5)

**Antes:**
```javascript
if(new URLSearchParams(location.search).get('energyCreditsDirect')==='1'){
  location.replace('/energy-credits-v2.html');
}
```

**Depois:**
```javascript
(function(){
  var p = new URLSearchParams(location.search);
  if (p.get('energyCreditsLegacy') === '1') return; // rollback: nunca redireciona
  if (p.get('energyCreditsDirect') === '1') {
    location.replace('/energy-credits-v2.html?runtime=real');
  }
})();
```

### `src/ui/energy-credits/legacy-bridge.js`

Patch `window.goPage('creditos')` atualizado:
- Se `energyCreditsLegacy=1` **NÃO** está presente → `window.location.assign('/energy-credits-v2.html?runtime=real')`
- Se `energyCreditsLegacy=1` está presente → comportamento legado (React mount) preservado intacto

### `energy-credits-v2.html`

**Telemetria adicionada:**
- `console.info('[ESA Gate4] module_opened', { mode })` — quando `_initRealMode` detecta runtime real
- `console.info('[ESA Gate4] init_failure', { error })` — quando `_initRealMode` falha
- `console.info('[ESA Gate4] back_to_dashboard')` — quando usuário clica em "← Dashboard ESA"

**Nav item adicionado:**
- "Dashboard ESA" com ícone `chevronLeft` no final da nav lateral
- `onClick`: `history.back()` (com fallback para `window.location.assign('/')`)
- Cor: `#94a3b8` (muted, não entra em conflito com itens de view ativos)

**Telemetria em legacy-bridge:**
- `console.info('[ESA Bridge] Gestão de Créditos → runtime direto (Gate 4)')` — acesso normal
- `console.info('[ESA Bridge] Gestão de Créditos → modo legado (rollback energyCreditsLegacy=1)')` — rollback

---

## Fluxo de Navegação

```
Usuário clica "Gestão de Créditos" no menu legado
        │
        ▼
window.goPage('creditos') [legacy-bridge patch]
        │
        ├─ energyCreditsLegacy=1 → React mount (legado) ← rollback
        │
        └─ (normal) → window.location.assign('/energy-credits-v2.html?runtime=real')
                                │
                                ▼
                        energy-credits-v2.html monta
                        bridge.js inicia real provider
                        _initRealMode() chamado
                        console: [ESA Gate4] module_opened
```

---

## Rollback

Para reverter ao modo legado sem alterar código:

```
https://seu-dashboard.com/index.html?energyCreditsLegacy=1
```

O param `energyCreditsLegacy=1` impede qualquer redirect e mantém o `legacy-bridge.js` no caminho de mount React original.

---

## Invariantes

- **Não há merge em main nesta missão.** Branch `core-v2` only.
- **Código legado não foi removido.** `legacy-bridge.js` e o React app preservados intactos.
- **Visual não foi alterado.** Nenhum estilo existente foi modificado.
- O nav item "Dashboard ESA" usa `history.back()` — o usuário retorna à página anterior no histórico (index.html).
- `?runtime=real` está SEMPRE presente na URL do runtime direto — nunca navegar para `energy-credits-v2.html` sem ele.

---

## Testes

`src/ui/energy-credits/direct-runtime/tests/promotion-gate4.manual-test.ts`

Suites BM–BQ.
