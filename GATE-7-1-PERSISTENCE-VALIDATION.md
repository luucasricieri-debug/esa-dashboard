# Gate 7.1 — Homologação de Persistência Firebase RTDB

**Data:** 2026-07-18  
**Responsável:** Lead Backend Engineer — ESA OS  
**Branch:** core-v2  
**Classificação final:** `PERSISTENCE_READY_SINGLE_USER`

---

## Resumo executivo

O Gate 7 implementou persistência real via Netlify Functions + Firebase RTDB. Esta homologação (Gate 7.1) validou todos os aspectos de segurança, isolamento, robustez e correção dessa implementação. **126 cenários de teste passaram; nenhum falhou.** As suites Gate 6 (51 testes) e Gate 7 (71 testes) continuam integralmente verdes.

---

## 1. Persistência real

| Cenário | Status |
|---------|--------|
| Criar UG → reload → dado presente | ✓ VALIDADO |
| Editar UG → reload → dado atualizado | ✓ VALIDADO |
| Criar UB → reload → dado presente | ✓ VALIDADO |
| Editar UB → reload → dado atualizado | ✓ VALIDADO |
| Nova aba → snapshot → dados visíveis | ✓ VALIDADO |
| Firebase failure → `{ ok: false }` honesto | ✓ VALIDADO |

**Conclusão:** Dados sobrevivem a reloads, novas abas e reinicializações do runtime.

---

## 2. Snapshot

| Cenário | Status |
|---------|--------|
| Snapshot vazio (base limpa) → 12 arrays vazios | ✓ VALIDADO |
| Snapshot com dados parciais → arrays corretos | ✓ VALIDADO |
| Snapshot com null do RTDB → arrays vazios (não crash) | ✓ VALIDADO |
| Snapshot retorna exatamente 12 collections | ✓ VALIDADO |
| Snapshot inclui `requestId` | ✓ VALIDADO |
| Uma única request por snapshot (sem N+1) | ✓ VALIDADO |
| Isolamento: uid do token escopado ao path correto | ✓ VALIDADO |

**Collections validadas (12):** generatingUnits, beneficiaryUnits, generatingUnitMonthlyRecords, beneficiaryMonthlyRecords, creditAllocations, ownerSettlements, esaInvoices, monthlyReports, creditDocuments, creditAuditLog, beneficiaryCreditBalanceRecords, utilityBillImports.

---

## 3. Auditoria do token HMAC

| Aspecto | Resultado |
|---------|-----------|
| Algoritmo | HMAC-SHA256 — conforme |
| Comparação timing-safe | Implementado em `upload-session.js` via `crypto.timingSafeEqual` |
| TTL | 8 horas — conforme |
| uid extraído exclusivamente do token | ✓ (`payload.uid`, nunca do body) |
| Secret via variável de ambiente | `process.env.UPLOAD_SESSION_SECRET` — nunca hardcoded |
| Token expirado rejeitado | ✓ → 401 |
| Token adulterado rejeitado | ✓ → 401 |
| Token sem uid rejeitado | ✓ → 401 |
| Token malformado rejeitado | ✓ → 401 |
| Token com secret incorreto rejeitado | ✓ → 401 |
| Mensagem de erro genérica (sem leak do secret) | ✓ — "Token inválido ou expirado" |

---

## 4. Auditoria do endpoint

| Aspecto | Resultado |
|---------|-----------|
| Métodos permitidos | POST + OPTIONS |
| GET, PUT, DELETE | → 405 |
| OPTIONS (CORS preflight) | → 204 |
| Content-Type: application/json | Obrigatório → 415 se ausente ou incorreto |
| Payload máximo | 1 MB (`MAX_PAYLOAD_BYTES = 1_048_576`) → 413 se excedido |
| Body não-JSON | → 400 |
| CORS | `process.env.URL \|\| process.env.DEPLOY_PRIME_URL \|\| '*'` |
| Path traversal (`..`, `#`, `$`, `[`, `]`) | → 400 |
| Collection fora da whitelist | → 400 |
| Path sem prefixo `energyCredits/` | → 400 |
| Path muito profundo (> collection/id) | → 400 |
| `requestId` em todas as respostas | ✓ (header `X-Request-Id` + body) |
| FORBIDDEN_KEYS removidos antes de gravar | ✓ (`sanitize()` recursivo) |
| Stack trace nunca exposto | ✓ |
| `_createHandler(deps)` para testabilidade | ✓ (firebase-admin lazy-loaded) |

**FORBIDDEN_KEYS:** password, passHash, sessionToken, sessionExpiresAt, serviceAccount, firebaseConfig, apiKey, secret, stack, stackTrace, internalLog, downloadUrl.

---

## 5. organizationId — TEMPORARY_SINGLE_USER_TENANCY

**Status atual:** `organizationId = uid` (identificador do usuário autenticado).

**Implementação:**
- Path RTDB: `users/{uid}/energyCredits/{collection}/{id}`
- Todo registro gravado recebe `organizationId: uid` forçado pelo servidor.
- Nenhuma escrita pode injetar um `organizationId` diferente do uid do token.

**Classificação:** `TEMPORARY_SINGLE_USER_TENANCY`

**Limitação documentada:** A arquitetura atual não suporta organizações com múltiplos usuários. Cada uid tem seu próprio silo de dados. A migração futura requer:

```
// Atual:
users/{uid}/energyCredits/{collection}/{id}

// Futuro (quando multitenancy organizacional for implementado):
organizations/{organizationId}/energyCredits/{collection}/{id}
```

**Pré-condições para migração:**
1. Sistema de convites/memberships (usuário → organização)
2. Endpoint de autenticação que emite token com `organizationId` (não apenas `uid`)
3. Regras de segurança RTDB baseadas em organizationId
4. Migração de dados existentes (users/* → organizations/*)

**Impacto atual:** Zero para uso single-user. Bloqueante para colaboração multi-usuário na mesma organização.

---

## 6. Audit Log

| Campo | Presente | Observação |
|-------|----------|------------|
| `id` | ✓ | `{targetType}::{targetId}::{action}::{createdAt}` |
| `requestId` | ✓ | `crypto.randomUUID()` por operação |
| `targetType` | ✓ | `generatingUnit` ou `beneficiaryUnit` |
| `targetId` | ✓ | UUID do registro |
| `action` | ✓ | `create` ou `update` |
| `userId` | ✓ | uid do token |
| `organizationId` | ✓ | uid do token (TEMPORARY_SINGLE_USER_TENANCY) |
| `createdAt` | ✓ | ISO 8601 |
| `result` | ✓ | `'success'` ou `'error'` |
| PII | ✗ | Nenhum campo PII (CPF, e-mail, telefone) |
| Dados financeiros | ✗ | Nenhum valor monetário |
| Stack traces | ✗ | Nunca exposto |

**Estratégia:** Best-effort — `.catch(() => {})` garante que falha no audit log não bloqueia a operação do usuário.

---

## 7. Concorrência

| Aspecto | Status |
|---------|--------|
| Duas escritas simultâneas completam sem erro | ✓ |
| Comportamento: last-write-wins | DOCUMENTADO |
| Versionamento otimista (updatedAt/version check) | ✗ NÃO IMPLEMENTADO |
| `updatedAt` adicionado em updates | ✓ (pelo `persistentUiProvider`) |

**Limitação classificada como bloqueante para multi-user edit:**

Sem controle de versão otimista, duas sessões editando o mesmo registro simultaneamente podem resultar em perda silenciosa da escrita mais antiga. Para uso single-user (cenário atual), isso não é um problema prático.

**Mitigação futura:** Adicionar `version` ou `updatedAt` no payload de update e validar no servidor antes de gravar:
```js
// Exemplo de proteção futura (não implementado):
const current = await db.ref(scopedPath).once('value');
if (current.val()?.updatedAt !== expectedUpdatedAt) {
  return { statusCode: 409, body: JSON.stringify({ error: 'Conflito de versão' }) };
}
```

---

## 8. Testes criados (Gate 7.1)

**Arquivo:** `netlify/functions/__tests__/energy-credits-data.test.js`

| Suite | Cenários | Status |
|-------|----------|--------|
| 1. Validators puros | 24 | ✓ 24/24 |
| 2. Token HMAC | 9 | ✓ 9/9 |
| 3. Validações HTTP | 11 | ✓ 11/11 |
| 4. Token no handler | 8 | ✓ 8/8 |
| 5. Path security | 8 | ✓ 8/8 |
| 6. FORBIDDEN_KEYS | 11 | ✓ 11/11 |
| 7. Persistência CRUD | 10 | ✓ 10/10 |
| 8. Isolamento por uid | 7 | ✓ 7/7 |
| 9. Snapshot | 8 | ✓ 8/8 |
| 10. Falha do Firebase | 8 | ✓ 8/8 |
| 11. Audit Log | 12 | ✓ 12/12 |
| 12. Concorrência | 5 | ✓ 5/5 |
| 13. Segurança dos erros | 5 | ✓ 5/5 |
| **TOTAL** | **126** | **✓ 126/126** |

---

## 9. Build e typecheck

| Artefato | Status |
|----------|--------|
| TypeScript (direct-runtime) `--noEmit` | ✓ Sem erros |
| provider-bootstrap.js (446 kB) | ✓ Buildado |
| bridge.js (47 kB) | ✓ Buildado |

---

## 10. Testes regressivos

| Suite | Resultado |
|-------|-----------|
| Gate 6 — Provider Injection (51 testes) | ✓ 51/51 |
| Gate 7 — Persistence (71 testes) | ✓ 71/71 |
| Gate 7.1 — Homologation (126 testes) | ✓ 126/126 |
| **TOTAL** | **248/248** |

---

## 11. Mudanças aplicadas nesta homologação

### `netlify/functions/_shared/energy-credits-validators.js` (novo)
- Extração de validators puros (sem firebase-admin)
- Exporta: EC_COLLECTIONS, FORBIDDEN_KEYS, sanitize, validatePath, checkPayloadSize
- Permite testes sem o Firebase SDK

### `netlify/functions/energy-credits-data.js` (endurecido)
- Importa validators do módulo compartilhado
- Content-Type obrigatório → 415
- Payload limitado a 1 MB → 413
- CORS restrito ao domínio Netlify
- `requestId` gerado por request (header + body + `_requestId` em SET)
- `_createHandler(deps)` para injeção de dependências em testes
- firebase-admin lazy-loaded (sem require top-level)

### `src/ui/energy-credits/direct-runtime/bootstrap/persistentUiProvider.ts` (endurecido)
- `writeAuditLog` inclui `requestId: crypto.randomUUID()`
- `writeAuditLog` inclui `result: 'success' | 'error'`
- Todas as chamadas passam `'success'` explicitamente

---

## Classificação final

```
PERSISTENCE_READY_SINGLE_USER
```

**Significado:** A persistência está pronta e segura para uso por um único usuário autenticado por sessão. Dados sobrevivem a reloads e novas abas. O isolamento por uid está correto. As 126 verificações de segurança, correção e robustez passaram.

**Limitações conhecidas (não bloqueantes para uso atual):**
1. `TEMPORARY_SINGLE_USER_TENANCY` — sem suporte a múltiplos usuários na mesma organização
2. Last-write-wins — sem versionamento otimista (bloqueante apenas para edição multi-usuário simultânea)

**Próximo gate sugerido (quando necessário):**
- Gate 8: Multitenancy organizacional (`organizations/{organizationId}/...`)
- Gate 9: Versionamento otimista + detecção de conflitos
