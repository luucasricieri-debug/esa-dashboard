# Gate 7 — Auditoria de Persistência: Pré-Implementação

## Objetivo

Mapear o estado do repositório ANTES da implementação do Gate 7, identificando lacunas, riscos e decisões de arquitetura necessárias para habilitar persistência real de créditos ESA Energia.

---

## Infraestrutura existente auditada

### Firebase Realtime Database

- **SDK**: `firebase-admin` (Node.js, Netlify Functions)
- **URL**: `https://agenda-executiva-esa-default-rtdb.firebaseio.com`
- **Acesso**: via `admin.database()` em `netlify/functions/_shared/firebase-admin.js`
- **Nota**: É RTDB, não Firestore. `admin.database()` e `.ref().once('value')`, não `getFirestore()`.

### Autenticação (HMAC)

- **Formato do token**: `base64url(payload).hmac_sha256`
- **Payload**: `{ uid, iat, exp, purpose: 'crm-upload' }` — TTL 8 horas
- **Armazenamento no browser**: `sessionStorage['esa_session']` (curto prazo) e `localStorage['esa_remember']` (remember-me)
- **Verificação**: `verifyToken(token, UPLOAD_SESSION_SECRET)` em `_shared/upload-session.js`

### Repositórios

| Classe | Tipo | Localização |
|---|---|---|
| `EnergyCreditsMemoryRepository` | Síncrono, Map em memória | `src/repositories/energy-credits/energy-credits-memory-repository.js` |
| `EnergyCreditsFirebaseRepository` | Assíncrono, injeta `firebaseClient` | `src/repositories/energy-credits/energy-credits-firebase-repository.js` |
| `EnergyCreditsRepositoryHydrator` | Síncrono | `src/repositories/energy-credits/energy-credits-repository-hydrator.js` |

**Limitação do hydrator existente**: `EnergyCreditsRepositoryHydrator` é síncrono — chama `repository.getSnapshot()` como se fosse sync. Incompatível com `EnergyCreditsFirebaseRepository` (async). O Gate 7 resolve isso com hidratação customizada no bootstrap.

### Read Model vs Memory Repository

Existem DOIS stores que precisam ser hidratados separadamente:

1. **Memory Repository** (`energyCreditsRepository`): destino de mutations (saves). Métodos: `saveGeneratingUnit`, `saveBeneficiaryUnit`, etc.
2. **Read Model** (`energyCreditsReadModel`): destino de queries. Alimentado por `hydrate(snapshot)`. Usado por `energyCreditsQueryService` que alimenta o UIProvider.

**Chave de discrepância (não crítica)**: o read model usa `monthlyStatements` mas o Firebase repo retorna `monthlyReports`. Hidratação com o que existe no Firebase — `monthlyStatements` fica vazio inicialmente (aceitável).

---

## Problemas identificados

### 1. Bug de ID em creates (crítico)

**Localização**: `src/ui/energy-credits/direct-runtime/providers/esaRuntimeProvider.ts`

```typescript
// ANTES (Gate 6) — bug silencioso
async createGeneratingUnit(input) {
  return (unwrap(uiProvider.createGeneratingUnit(input)) as MutationResult | null) ?? ok();
},
```

**Problema**: O domain validator (`validateGeneratingUnit`) REQUER `input.id`. O contrato `CreateGeneratingUnitInput` do runtime não inclui `id`. Quando `createGeneratingUnit(input)` é chamado sem `id`, a validação falha retornando `{ ok: false }`. A função `unwrap()` processa isso como `null`, e `null ?? ok()` retorna `{ ok: true }` — sucesso falso silencioso.

**Correção no Gate 7**: Injetar `id: crypto.randomUUID()` antes de chamar o UIProvider.

### 2. Ausência de hidratação assíncrona

**Problema**: O `EnergyCreditsRepositoryHydrator` é síncrono. Carregar dados do Firebase (assíncrono) exige uma estratégia personalizada.

**Solução**: No bootstrap do Gate 7, chamar `loadEnergyCreditsSnapshot(sessionToken)` (1 HTTP request para o Netlify Function) e depois hidratar sincronamente: `memoryRepo.hydrateFromSnapshot(snapshot)` + `ESA.hydrateEnergyCreditsReadModel(snapshot)`.

### 3. Sem verificação de sessão no bootstrap

**Problema (Gate 6)**: O bootstrap inicializava o ESA Core sem qualquer sessão autenticada. `?runtime=real` funcionava para qualquer usuário (ou sem usuário).

**Solução**: Validar sessão ANTES de qualquer operação. Sem token → `esa:ui-provider:error` com código `no_session`.

### 4. Sem persistência real nas mutations

**Problema**: `uiProvider.createGeneratingUnit(input)` criava a UG apenas em memória (sem `options.persist: true`). Após reload, a UG desaparecia.

**Solução**: `PersistentUiProvider` intercepta as 4 mutations (create/update UG+UB), escreve no Firebase primeiro, depois atualiza memória + read model.

### 5. Leituras não refletem mutations recentes

**Problema**: Após criar uma UG, `listGeneratingUnits()` consultava o read model que não tinha a nova UG (só o memory repo foi atualizado).

**Solução**: `syncStores()` em `persistentUiProvider.ts` atualiza tanto o memory repo quanto o read model após cada mutation bem-sucedida.

---

## Decisões de arquitetura

### Multitenância via uid

`organizationId = uid` (extraído do token). Todos os paths RTDB são prefixados com `users/${uid}/`. O Netlify Function NUNCA confia no `uid` do body — extrai EXCLUSIVAMENTE do token HMAC verificado.

### Firebase-first para writes

Sequência de cada mutation:
1. Validar domínio (sem persist) → obter entidade validada
2. Gravar no Firebase via Netlify Function (HTTP)
3. Se Firebase falhar → retornar `{ ok: false, errors: [BACKEND_UNAVAILABLE] }` — NUNCA retornar `persisted: true` sem confirmação
4. Se Firebase OK → atualizar memory repo + read model
5. Gravar audit log (best-effort, non-blocking)

### Snapshot eficiente (1 HTTP request)

A hidratação inicial faz UMA única requisição ao endpoint `/.netlify/functions/energy-credits-data` com `{ operation: 'snapshot' }`. O backend carrega `users/${uid}/energyCredits` em uma única operação RTDB e retorna todas as 12 collections formatadas.

### Sem PII em logs

Regra estrita:
- Browser: apenas `[ESA Standalone] provider_initialized` ou `bootstrap_failed`
- Netlify Function: sem `console.log` de uid, email, dados financeiros ou dados de entidade

### Sem dados financeiros no console

`calculationMemory`, `totalRevenue`, `balance`, `price`, `amount` não aparecem em nenhum log.

---

## Escopo do Gate 7

| Operação | Status Gate 7 |
|---|---|
| Criar UG | ✅ Firebase-first + memory + read model |
| Editar UG | ✅ Firebase-first + memory + read model |
| Criar UB | ✅ Firebase-first + memory + read model |
| Editar UB | ✅ Firebase-first + memory + read model |
| Salvar condições comerciais | ✅ via `updateGeneratingUnit(id, { purchasePrice, ... })` |
| Salvar recebedor/PIX | ✅ via `updateGeneratingUnit(id, { pixKey, pixType, ... })` |
| Confirmar pagamento de fatura | ⏸ Gate futuro |
| Confirmar repasse ao gerador | ⏸ Gate futuro |
| Fechar ciclo mensal | ⏸ Gate futuro |
| Importação CSV com persistência | ⏸ Gate futuro |

---

## Arquivos auditados

```
netlify/functions/_shared/firebase-admin.js
netlify/functions/_shared/upload-session.js
netlify/functions/session-init.js
src/repositories/energy-credits/energy-credits-firebase-repository.js
src/repositories/energy-credits/energy-credits-memory-repository.js
src/repositories/energy-credits/energy-credits-repository-hydrator.js
src/repositories/energy-credits/energy-credits-paths.js
src/repositories/energy-credits/index.js
src/read-models/energy-credits/energy-credits-read-model.js
src/core/app.js
src/ui/energy-credits/energy-credits-ui-provider.js
src/ui/energy-credits/direct-runtime/providers/esaRuntimeProvider.ts
src/services/firebase.js
index.html (auth storage pattern)
```
