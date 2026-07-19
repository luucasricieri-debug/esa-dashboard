# Gate 7 — Persistência Real no Runtime de Créditos

## Objetivo

Conectar o runtime standalone (`energy-credits-v2.html?runtime=real`) ao Firebase Realtime Database via Netlify Functions, garantindo que todas as mutations (criar UG, editar UG, criar UB, editar UB) sejam persistidas e sobrevivam a reloads, novas abas e logout/login.

---

## Cadeia de persistência

```
Browser (energy-credits-v2.html)
  └── standaloneProviderBootstrap.ts (IIFE)
        ├── resolveSessionToken()               → lê sessionStorage/localStorage
        ├── loadEnergyCreditsSnapshot(token)    → POST /.netlify/functions/energy-credits-data
        │     └── memoryRepo.hydrateFromSnapshot(snapshot)
        │     └── ESA.hydrateEnergyCreditsReadModel(snapshot)
        ├── createEnergyCreditsFirebaseRepository(httpClient)
        ├── new EnergyCreditsUIProvider(ESA)    → inner provider (reads)
        └── createPersistentUiProvider(inner, firebaseRepo, memoryRepo, ESA, uid)
              └── window.__ESA_UI_PROVIDER__ = provider
                    └── bridge.js → esaRuntimeProvider.ts
                          └── window.ESA_ENERGY_CREDITS_RUNTIME
                                └── DC Component (energy-credits-v2.html)
```

---

## Arquivos criados / alterados

| Arquivo | Operação | Descrição |
|---|---|---|
| `netlify/functions/energy-credits-data.js` | Criado | Endpoint CRUD para RTDB, scoped por uid |
| `src/ui/energy-credits/direct-runtime/bootstrap/sessionResolver.ts` | Criado | Lê token HMAC de sessionStorage/localStorage |
| `src/ui/energy-credits/direct-runtime/bootstrap/httpFirebaseClient.ts` | Criado | HTTP client para o Netlify Function |
| `src/ui/energy-credits/direct-runtime/bootstrap/persistentUiProvider.ts` | Criado | Wrapper com estratégia Firebase-first para writes |
| `src/ui/energy-credits/direct-runtime/bootstrap/standaloneProviderBootstrap.ts` | Reescrito | Adiciona hidratação assíncrona, sessão, provider persistente |
| `src/ui/energy-credits/direct-runtime/providers/esaRuntimeProvider.ts` | Alterado | `await` nos writes + `crypto.randomUUID()` nos creates |
| `assets/energy-credits-runtime/provider-bootstrap.js` | Gerado | Rebuild (446 kB) com Gate 7 bundlado |
| `assets/energy-credits-runtime/bridge.js` | Gerado | Rebuild (47 kB) com `await` nos writes |
| `src/ui/energy-credits/direct-runtime/tests/gate7-persistence.manual-test.ts` | Criado | 71 assertions, suites CW–DB |
| `src/ui/energy-credits/direct-runtime/tests/gate6-provider-injection.manual-test.ts` | Alterado | CQ11 e CQ12 refinados para Gate 7 bootstrap |

---

## Netlify Function: energy-credits-data.js

**Endpoint**: `POST /.netlify/functions/energy-credits-data`

**Operações**:

| `operation` | Comportamento |
|---|---|
| `snapshot` | Carrega `users/{uid}/energyCredits` inteiro (1 query RTDB) |
| `get` | Lê `users/{uid}/{path}` (collection ou item) |
| `set` | Escreve `users/{uid}/{path}` com `organizationId: uid` forçado |

**Segurança**:
- Token HMAC validado ANTES de qualquer operação RTDB
- `uid` extraído exclusivamente do token verificado (nunca do body)
- Path limitado a `energyCredits/{collection}[/{id}]` com whitelist de 12 collections
- Sanitização recursiva (remove `FORBIDDEN_KEYS`)
- `organizationId: uid` adicionado a toda escrita — isolamento de tenant por linha
- Sem PII em logs

---

## Session Resolver: sessionResolver.ts

Lê o token de autenticação do browser storage:

```
sessionStorage['esa_session'] → { sessionToken: string }   (prioridade)
localStorage['esa_remember']  → { sessionToken: string }   (fallback)
```

Retorna `null` se não encontrado, inválido ou inacessível (modo privado estrito).

---

## HTTP Firebase Client: httpFirebaseClient.ts

Proxy HTTP para o Netlify Function. Interface compatível com `EnergyCreditsFirebaseRepository`:

```typescript
{ get(path): Promise<unknown>, set(path, value): Promise<void> }
```

`loadEnergyCreditsSnapshot(sessionToken)` faz 1 única requisição HTTP para o endpoint com `{ operation: 'snapshot' }` e retorna o snapshot completo de todas as 12 collections.

---

## Persistent UIProvider: persistentUiProvider.ts

Wrapper transparente via `Proxy`. Intercepta as 4 mutations, passa todo o resto ao inner provider.

**Protocolo Firebase-first**:

```
createGeneratingUnit(input):
  1. id = crypto.randomUUID()  (injetado antes da validação de domínio)
  2. inner.createGeneratingUnit({ ...input, id })  → validação de domínio
  3. Se domínio falha → retornar { ok: false, errors }
  4. firebaseRepo.saveGeneratingUnit(entity)  → HTTP → Netlify → RTDB
  5. Se Firebase falha → retornar { ok: false, errors: [BACKEND_UNAVAILABLE] }
  6. memoryRepo.saveGeneratingUnit(entity)    → atualiza session cache
  7. ESA.hydrateEnergyCreditsReadModel({ generatingUnits: [entity] }, { replace: false })
  8. firebaseRepo.appendCreditAuditLog(...)  → best-effort, non-blocking
  9. retornar { ok: true, data: entity }
```

`updateGeneratingUnit(id, patch)`:
1. Carrega entidade existente do memory repo (sincronamente)
2. Se não encontrada → `{ ok: false, errors: [GU_NOT_FOUND] }`
3. Mesmo protocolo Firebase-first do create (steps 4–9)

Idêntico para `createBeneficiaryUnit` e `updateBeneficiaryUnit`.

---

## Bootstrap Gate 7: standaloneProviderBootstrap.ts

Fluxo completo da inicialização:

```
1. resolveSessionToken()
   └── sem token → dispatchProviderError('no_session') → STOP

2. decodeUidFromToken(token)
   └── inválido/expirado → dispatchProviderError('invalid_session') → STOP

3. ESA.initialize()
   window.ESA_OS = ESA

4. httpClient = createHttpFirebaseClient(sessionToken)
   snapshot = await loadEnergyCreditsSnapshot(sessionToken)
   └── /.netlify/functions/energy-credits-data { operation: 'snapshot' }

5. memoryRepo.hydrateFromSnapshot(snapshot)   ← todas as 12 collections
6. ESA.hydrateEnergyCreditsReadModel(snapshot, { replace: true })

7. firebaseRepo = ESA.createEnergyCreditsFirebaseRepository(httpClient)
8. inner = new EnergyCreditsUIProvider(ESA)

9. provider = createPersistentUiProvider(inner, firebaseRepo, memoryRepo, ESA, uid)
10. window.__ESA_UI_PROVIDER__ = provider
11. dispatchEvent('esa:ui-provider:ready')
```

Qualquer exceção → `dispatchProviderError('bootstrap_failed')`.

---

## esaRuntimeProvider.ts — Alterações

Quatro métodos de escrita agora recebem `await` e propagam erros corretamente:

```typescript
// ANTES (bug: ?? ok() swallowava erros)
async createGeneratingUnit(input) {
  return (unwrap(uiProvider.createGeneratingUnit(input)) as MutationResult | null) ?? ok();
}

// DEPOIS (Gate 7)
async createGeneratingUnit(input) {
  const result = await uiProvider.createGeneratingUnit({ ...input, id: crypto.randomUUID() });
  if (result && typeof result === 'object' && result.ok === false) return result as MutationResult;
  return (unwrap(result) as MutationResult | null) ?? ok();
}
```

`crypto.randomUUID()` garante IDs estáveis (UUID v4) em vez dos IDs temporários `UG-001` que o wizard HTML gerava.

---

## Multitenância

- Cada record no RTDB tem `organizationId: uid` (forçado pelo Netlify Function)
- Nenhuma query é feita sem filtro de uid (path RTDB já é `users/${uid}/...`)
- Nenhum usuário pode ler dados de outro (o path RTDB inclui o uid verificado)
- Não é possível forjar o uid — ele vem EXCLUSIVAMENTE do token HMAC verificado no servidor

---

## Invariantes de segurança mantidos

- Sem PII em logs (browser e backend)
- Sem dados financeiros no console
- Sem `calculationMemory` exposto
- Sem acesso direto ao Firebase na UI (apenas via Netlify Function)
- Sem credenciais hardcoded
- Sem `persisted: true` sem confirmação do Firebase
- Sem fallback demo no modo real — erro honesto se sessão/Firebase falha
- Sem localStorage para dados operacionais (apenas token de sessão)
- Sem login paralelo, sem credenciais hardcoded
- Sem modificação da Billing Engine
- Sem alteração de visual, CSS, DOM

---

## Testes

Arquivo: `src/ui/energy-credits/direct-runtime/tests/gate7-persistence.manual-test.ts`

71 assertions (suites CW–DB):

| Suite | Foco | Assertions |
|---|---|---|
| CW | Netlify Function: segurança e estrutura | 14 |
| CX | HTTP Firebase Client | 9 |
| CY | Session Resolver | 7 |
| CZ | Persistent UIProvider: protocolo + comportamento | 20 |
| DA | Bootstrap Gate 7: hidratação e invariantes | 14 |
| DB | esaRuntimeProvider: await + UUID | 7 |

---

## Validação manual recomendada

1. Abrir `energy-credits-v2.html?runtime=real` com sessão ativa
2. Criar uma nova UG via wizard → verificar que a UG aparece na lista
3. Recarregar a página → a UG deve continuar presente (hidratada do Firebase)
4. Abrir nova aba → mesma UG visível
5. Fazer logout e login → UG ainda presente (persistida no Firebase)
6. Criar UG sem sessão → tela de erro honesta (sem demo fallback)
