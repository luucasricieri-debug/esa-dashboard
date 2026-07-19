# Gate 6 — Provider Injection: Standalone Bootstrap

## Objetivo

Conectar o runtime standalone (`energy-credits-v2.html?runtime=real`) ao provider real da ESA OS sem duplicar o Core, sem usar mocks e sem acesso direto ao Firebase na UI.

---

## Cadeia de criação do provider

```
src/core/app.js
  └── ESAApplication (singleton in-memory)
        └── ESA.initialize()
              └── registra integrations, event bus, logger
                    └── EnergyCreditsUIProvider(ESA)
                          └── window.__ESA_UI_PROVIDER__
                                └── createEsaRuntimeProvider(provider)
                                      └── window.ESA_ENERGY_CREDITS_RUNTIME
                                            └── DC Component (energy-credits-v2.html)
```

---

## Arquivos criados / alterados

| Arquivo | Operação | Motivo |
|---|---|---|
| `src/ui/energy-credits/direct-runtime/bootstrap/standaloneProviderBootstrap.ts` | Criado | Bootstrap IIFE que inicializa ESA e expõe UIProvider |
| `src/ui/energy-credits/direct-runtime/vite.provider-bootstrap.config.ts` | Criado | Config Vite para bundlar o bootstrap como IIFE |
| `assets/energy-credits-runtime/provider-bootstrap.js` | Gerado | Bundle IIFE do bootstrap (439 kB — inclui ESA Core completo) |
| `src/ui/energy-credits/direct-runtime/bridge/runtimeBridge.ts` | Alterado | Trata `esa:ui-provider:ready` e `esa:ui-provider:error` |
| `assets/energy-credits-runtime/bridge.js` | Gerado | Rebuild com handlers de provider events |
| `energy-credits-v2.html` | Alterado | Adiciona `<script src="provider-bootstrap.js">` entre support.js e bridge.js |
| `src/ui/energy-credits/direct-runtime/tsconfig.json` | Alterado | `allowJs: true` para resolver imports de `.js` no TypeScript |

---

## Ordem de carregamento (energy-credits-v2.html)

```html
<!-- 1. Funções utilitárias síncronas (num, fmt, etc.) -->
<script src="/assets/energy-credits-runtime/support.js"></script>

<!-- 2. Inicializa ESA Core e expõe window.__ESA_UI_PROVIDER__ -->
<script src="/assets/energy-credits-runtime/provider-bootstrap.js"></script>

<!-- 3. Lê __ESA_UI_PROVIDER__ → cria runtime contract → window.ESA_ENERGY_CREDITS_RUNTIME -->
<script src="/assets/energy-credits-runtime/bridge.js"></script>
```

Todos os três são IIFEs síncronos. Quando `bridge.js` executa, `__ESA_UI_PROVIDER__` já está disponível via leitura direta — não há espera por evento no caminho principal.

---

## Protocolo de eventos

### Caminho síncrono (primário — IIFE antes do bridge)

```
provider-bootstrap.js (IIFE) executa
  → window.__ESA_UI_PROVIDER__ = provider          (síncrono)
  → window.__ESA_UI_PROVIDER_STATUS__ = { ready }   (síncrono)
  → dispatchEvent('esa:ui-provider:ready')           (síncrono, mas sem listener ainda)
bridge.js (IIFE) executa
  → window.__ESA_UI_PROVIDER__ ✓ (já presente)
  → initBridge() → resolveRealProvider() → createEsaRuntimeProvider(provider)
  → window.ESA_ENERGY_CREDITS_RUNTIME = rt
  → dispatchEvent('esa:runtime:ready', { mode: 'real' })
DC Component (DOMContentLoaded)
  → _initRealMode() → usa rt → inicializa dashboard real
```

### Caminho assíncrono (fallback — module script ou carregamento tardio)

```
bridge.js executa
  → window.__ESA_UI_PROVIDER__ não presente
  → registra listener: 'esa:ui-provider:ready' (once)
  → registra listener: 'esa:ui-provider:error'
provider-bootstrap.js executa posteriormente
  → window.__ESA_UI_PROVIDER__ = provider
  → dispatchEvent('esa:ui-provider:ready')
  → listener do bridge dispara → initBridge() → ...
```

### Caminho de falha do bootstrap

```
provider-bootstrap.js lança exceção
  → window.__ESA_UI_PROVIDER_STATUS__ = { status: 'error', reason: 'bootstrap_failed' }
  → window.__ESA_UI_PROVIDER_ERROR__ = { code, message }
  → dispatchEvent('esa:ui-provider:error', { code: 'bootstrap_failed' })
bridge.js
  → listener 'esa:ui-provider:error' dispara
  → window.__ESA_RUNTIME_STATUS__ = { error, reason: code }
  → dispatchEvent('esa:runtime:error', { reason: code })
DC Component
  → _rtStatus = 'error' → tela de erro honesta (sem demo fallback)
```

---

## Globals de coordenação

| Global | Tipo | Produtor | Consumidor |
|---|---|---|---|
| `window.__ESA_UI_PROVIDER__` | `unknown` (EnergyCreditsUIProvider) | provider-bootstrap.js | bridge.js → resolveRealProvider() |
| `window.__ESA_UI_PROVIDER_STATUS__` | `{ status, reason? }` | provider-bootstrap.js | bridge.js (async fallback) |
| `window.__ESA_UI_PROVIDER_ERROR__` | `{ code, message }` | provider-bootstrap.js | bridge.js (async fallback) |
| `window.ESA_OS` | `ESAApplication` | provider-bootstrap.js | legacy-bridge.js, debug console |
| `window.__ESA_RUNTIME_STATUS__` | `{ status, reason? }` | bridge.js | DC Component (_initRealMode) |
| `window.ESA_ENERGY_CREDITS_RUNTIME` | `EnergyCreditsRuntimeContract` | bridge.js | DC Component |

---

## Estado atual da autenticação

O ESA Core é **inteiramente in-memory** neste gate. O `FirebaseService` é um stub que não conecta ao Firebase real.

- **Não existe verificação de sessão** — o bootstrap não autentica o usuário.
- **Não existe filtro por `organizationId`** — queries retornam dados globais do read model em memória.
- **`window.ESA_OS = ESA`** é exposto para facilitar gates futuros que precisem injetar estado de autenticação.
- **Consequência atual**: `?runtime=real` abre o dashboard real com read model vazio (zeros). Dados só existem se importados via CSV Import na mesma sessão.

A integração com Firebase Auth e Firestore é o escopo do Gate 7.

---

## Invariantes de segurança

- Sem PII em logs — apenas `[ESA Standalone] provider_initialized` / `bootstrap_failed`
- Sem `calculationMemory` no bootstrap
- Sem acesso direto ao Firestore ou Firebase na UI
- Sem credenciais hardcoded
- Sem login paralelo (`createUserWithEmailAndPassword` não chamado)
- Sem demo fallback no modo real — falha de bootstrap → erro honesto
- Sem duplicação do Core — ESA Core bundlado apenas em `provider-bootstrap.js`

---

## Testes

Arquivo: `src/ui/energy-credits/direct-runtime/tests/gate6-provider-injection.manual-test.ts`

Suites CQ–CV — 51 assertions:
- CQ (12): estrutura do bootstrap source
- CR (9): bundle provider-bootstrap.js
- CS (10): handlers no bridge.ts e bridge.js
- CT (8): ordem de carregamento no HTML
- CU (5): end-to-end com Core em memória
- CV (7): invariantes de segurança
