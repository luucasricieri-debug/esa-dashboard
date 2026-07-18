# DIRECT-RUNTIME — Execução Direta do Project HTML

**Branch:** `core-v2`
**Data:** 2026-07-17
**Status:** GATE 1 CONCLUÍDO — Visual original executado diretamente

---

## Arquivo de Origem

```
docs/design-reference/energy-credits-claude-design/ESA Energia - Gestão de Créditos.dc.html
```

Arquivo `.dc.html` gerado pelo Claude Design. Contém:
- `<x-dc>` — template HTML completo da UI com interpolações `{{ variavel }}`
- `<script type="text/x-dc" data-dc-script>` — classe `Component extends DCLogic` com estado e lógica da UI (mock data embutido)
- Referência a `support.js` — DC runtime

---

## Arquivo Público Criado

```
energy-credits-v2.html       (raiz do repositório)
```

Cópia direta do `.dc.html` com um único ajuste de path:

| Original | Ajustado |
|---|---|
| `<script src="./support.js">` | `<script src="/docs/design-reference/energy-credits-claude-design/support.js">` |

Nenhum outro conteúdo foi alterado. DOM, CSS, layout e lógica preservados integralmente.

---

## Assets Ajustados

| Asset | Ação |
|---|---|
| `support.js` | Path relativo corrigido para path absoluto do servidor |
| React 18.3.1 UMD | Carregado de `unpkg.com` pelo próprio `support.js` (requer internet) |
| ReactDOM 18.3.1 UMD | Idem |

Nenhum asset local foi copiado. Nenhum CSS externo foi importado.

---

## Como o DC Runtime Funciona

1. `support.js` injeta `<style>x-dc{display:none!important}</style>` sincronamente (sem flash de HTML cru)
2. Carrega `react@18.3.1` e `react-dom@18.3.1` UMD do `unpkg.com`
3. O DC runtime parseia o `<x-dc>` template e o script `data-dc-script`
4. Instancia `Component extends DCLogic` (classe no HTML, dados mock embutidos)
5. Renderiza via `ReactDOM.createRoot` em `#dc-root` (substitui `<x-dc>`)
6. A UI completa aparece — sidebar, topbar, telas, modais, drawers, gráficos

---

## Integração Experimental

```
http://localhost:<PORTA>/?energyCreditsDirect=1
```

Script adicionado no `<head>` de `index.html` (primeira tag após `<meta charset>`):

```html
<script>if(new URLSearchParams(location.search).get('energyCreditsDirect')==='1'){location.replace('/energy-credits-v2.html');}</script>
```

Sem a query string, o dashboard legado funciona normalmente.

---

## URL Exata

```
http://localhost:8080/energy-credits-v2.html
```

Ou qualquer servidor local servindo a raiz do repositório (Live Server VSCode, `npx serve .`, etc.).

---

## Limitações

| Limitação | Detalhe |
|---|---|
| Requer internet | React e ReactDOM são carregados de `unpkg.com` |
| Dados mock | Todos os dados são mock embutidos no `data-dc-script` — nenhum dado real |
| Provider não conectado | Gate 1: visual apenas. Gate 2 conecta o provider real |
| Nenhum CI/CD | Arquivo copiado diretamente — não há build step |

---

## Próximos Passos para Conectar Dados Reais (Gate 2)

O `.dc.html` expõe props configuráveis via `data-props` no elemento `data-dc-script`:

```json
{
  "sidebarRecolhida": { "type": "boolean", "default": false },
  "telaInicial":      { "type": "enum", "default": "dashboard" },
  "modoRateioInicial":{ "type": "enum", "default": "manual" }
}
```

A API pública do DC runtime para injeção de dados:

```js
// Após o boot do runtime:
window.__dcSetProps('ESA Energia - Gestão de Créditos', {
  // sobrescrever props do componente com dados reais
});
```

**Sem modificar o visual:** a lógica de dados fica fora do `.dc.html`.
O componente `DCLogic` recebe as props sobrescritas e re-renderiza.

Alternativa para Gate 2: envolver `energy-credits-v2.html` com um script que
intercepta a inicialização do DC runtime e injeta o provider real via `window.__dcSetProps`.

---

## Arquivos Modificados

| Arquivo | Modificação |
|---|---|
| `energy-credits-v2.html` | Criado — cópia do `.dc.html` com path de `support.js` corrigido |
| `index.html` | Redirect `?energyCreditsDirect=1 → /energy-credits-v2.html` |
| `docs/.../DIRECT-RUNTIME.md` | Este documento |
