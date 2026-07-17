# INTEGRATION-CSS-AUDIT — Missão 23

**Data:** 2026-07-17  
**Branch:** `core-v2`  
**Contexto:** Módulo React de Gestão de Créditos integrado ao dashboard legado via `legacy-bridge.js`

---

## 1. Arquivos Auditados

| Arquivo | Papel |
|---|---|
| `index.html` — `<style>` inline | CSS global do dashboard legado (via tag inline) |
| `assets/energy-credits/energy-credits-react.css` | Bundle CSS compilado do módulo React (Tailwind v4) |
| `src/ui/energy-credits/react-app/src/index.css` | CSS fonte do módulo React (Tailwind imports + vars) |
| `src/ui/energy-credits/legacy-bridge.js` | Montagem e controle de visibilidade do host |

---

## 2. Conflitos Encontrados

### 2.1 Dois headers visíveis em modo imersivo (CRÍTICO)

**Causa:** O modo imersivo original mantinha o `.topbar` do legado visível (`flex-shrink:0; position:static`), consumindo 58px. O React Shell tem seu próprio `header h-16` (64px). Total de header visível: **122px**.

**Efeito:** Legado header + React header empilhados → aparência comprimida, "legacy header above the module".

**Fix:** `body.esa-energy-credits-active .topbar { display:none!important }` — oculta o topbar legado. Botão de volta adicionado ao header do React Shell.

---

### 2.2 Shell com `min-h-screen` em host com `overflow:hidden` (CRÍTICO)

**Causa:** O Shell React usa `<div className="flex min-h-screen ...">` (altura mínima = 100vh). O host `#esa-energy-credits-react-root` tem `overflow:hidden`. Como o host era menor que 100vh (descontado o topbar), o conteúdo era **cortado** na parte inferior.

**Adicionalmente:** A área `<main>` do Shell não tinha `overflow-y-auto`, então qualquer conteúdo longo ficava clippado sem possibilidade de scroll.

**Fix:**  
- Shell: `min-h-screen` → `h-full` (preenche o host exatamente)  
- `<main>`: adicionado `overflow-y-auto`

---

### 2.3 Tailwind Preflight global poluindo legacy dashboard

**Causa:** O bundle `energy-credits-react.css` é carregado em `<head>` antes do `<style>` legado (linha 12 do `index.html`). O Tailwind v4 inclui em `@layer base`:

```css
html, :host {
  font-family: var(--default-font-family, ui-sans-serif, system-ui, sans-serif, ...);
}
button, input, select, optgroup, textarea {
  font: inherit;
  background-color: transparent;
  border-radius: 0;
}
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
```

**Impacto no legado:** Como `@layer base` tem especificidade menor que CSS sem layer, as regras explícitas do legado (`.btn`, `.card`, etc.) sobrepõem os resets do Tailwind. **Impacto real: mínimo** — as regras do Tailwind @layer base perdem para as regras do legado.

**Impacto no módulo React:** Os botões e inputs dentro do `#esa-energy-credits-react-root` herdavam `font-family: DM Sans` do `body` legado em vez de `ui-sans-serif` pretendido. Também herdavam `font-size` não controlado.

**Fix:** CSS namespace em `#esa-energy-credits-react-root` redefine `font-family`, `font-size: 14px`, e reseta `button/input/select/textarea` explicitamente.

---

### 2.4 Variáveis CSS do React definidas em `:root` (OBSERVAÇÃO)

**Causa:** O Tailwind v4 define `--background`, `--foreground`, `--border`, etc. em `:root`. O legado usa `--bg`, `--bk`, `--g`, etc. — nomes diferentes.

**Impacto:** Nenhum conflito de nomes. As variáveis coexistem sem sobrescrita.

**Ação:** Nenhuma.

---

### 2.5 Classes legadas que poderiam colidir (VERIFICADO — sem conflito real)

| Classe legada | Conflito potencial | Resultado verificado |
|---|---|---|
| `.btn` | React components poderiam usar `.btn` | React usa classes Tailwind puras, não `.btn` |
| `.card` | Idem | Não usa `.card` |
| `.badge` | Idem | Não usa `.badge` |
| `.tab` | Idem | Não usa `.tab` como className |
| `.tbl` | Idem | Não usa `.tbl` |
| `.modal` | Idem | Não usa `.modal` |
| `.content` | `#content` é o elemento legado oculto | Sem conflito — `#content` é `id`, não classe |

**Fix adicional (preventivo):** Namespace CSS adiciona `all: unset` para `.btn`, `.card`, `.badge`, `.tab` dentro de `#esa-energy-credits-react-root` para garantir que futuros usos acidentais dessas classes não herdem estilos legados.

---

### 2.6 Preview banner tomando espaço externo

**Causa:** `#esa-preview-banner` é um irmão do host no flex column do `.main`. Em modo imersivo, ocupava espaço entre o topbar (agora oculto) e o host.

**Status:** O banner (modo de prévia) é mantido como `flex-shrink:0` — tomará espaço apenas quando visível (em desenvolvimento). Em produção o banner fica `display:none`. Comportamento aceitável.

---

### 2.7 Banner `#esa-back-btn` removido

**Causa:** Com o topbar ocultado, o `#esa-back-btn` dentro do topbar também desaparece.

**Fix:** Botão "← Dashboard" adicionado ao header do React Shell, usando o callback `onExit` passado via `mountEnergyCreditsReactApp`. O bridge já passava `onExit: () => window.goPage('prosp')`.

---

## 3. Restrições Respeitadas

| Restrição | Status |
|---|---|
| Sem iframe | ✅ — apenas CSS namespace |
| Sem Shadow DOM | ✅ — não aplicável |
| Core / Billing Engine intocados | ✅ |
| provider-adapter.ts intocado | ✅ |
| Sem mocks adicionados | ✅ |
| `main` intocado | ✅ |
| Firebase Rules intocadas | ✅ |
| Alterações mínimas em `index.html` | ✅ — apenas bloco de imersão CSS atualizado |
| `legacy-bridge.js` intocado | ✅ — sem alterações necessárias (onExit já estava passado) |

---

## 4. Alterações por Arquivo

### `index.html`
- Bloco imersivo: ocultar `.topbar` com `display:none!important`
- Remoção da linha `#esa-back-btn{display:inline-flex!important}` (botão migrado para Shell)
- Host: adiciona `overflow:hidden` explícito (sem mudança funcional — já era o comportamento)

### `src/ui/energy-credits/react-app/src/mountEnergyCreditsReactApp.tsx`
- Passa `options?.onExit` ao `Shell`

### `src/ui/energy-credits/react-app/src/components/esa/Shell.tsx`
- Prop `onExit?: () => void` adicionada
- `min-h-screen` → `h-full` no container raiz
- `overflow-y-auto` adicionado ao `<main>`
- Botão "← Dashboard" no header quando `onExit` está presente
- Import `ArrowLeft` de lucide-react

### `src/ui/energy-credits/react-app/src/index.css`
- Namespace CSS reset para `#esa-energy-credits-react-root`
- Reset de `button`, `input`, `select`, `textarea`
- `all: unset` preventivo para `.btn`, `.card`, `.badge`, `.tab`
