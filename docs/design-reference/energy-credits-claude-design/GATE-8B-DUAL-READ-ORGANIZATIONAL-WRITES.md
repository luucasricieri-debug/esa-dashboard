# Gate 8B — Dual-Read e Escritas Organizacionais

**Classificação anterior:** `MULTITENANCY_FOUNDATION_READY` (Gate 8A)
**Classificação após Gate 8B:** `DUAL_READ_ORG_WRITES_READY`
**Próxima etapa:** Gate 8C — Cutover e remoção do path legacy

---

## 1. Dual-Read de Snapshot

### Algoritmo

```
snapshot(uid, organizationId?):
  if organizationId presente:
    1. Validar membership do uid na org (backend)
    2. Ler organizations/{orgId}/energyCredits/
    3. Se org tem dados → return { data, dataSource: 'organization', migrationRequired: false }
    4. Fallback: ler users/{uid}/energyCredits/
    5. return { data, dataSource: 'legacy-single-user', migrationRequired: true }
  else (single-user):
    1. Ler users/{uid}/energyCredits/
    2. return { data, dataSource: 'legacy-single-user', migrationRequired: false }
```

### Garantias

- Nunca mescla dados de org e legacy — apenas UMA fonte por snapshot
- `data` sempre contém exatamente 12 collections (backward compat)
- `dataSource` e `migrationRequired` são campos top-level (não dentro de `data`)
- Requests sem `organizationId` seguem o path single-user inalterado

### SnapshotResult (TypeScript)

```typescript
interface SnapshotResult {
  data:              Record<string, unknown[]>; // 12 collections
  dataSource:        'organization' | 'legacy-single-user';
  migrationRequired: boolean;
}
```

---

## 2. Escritas Organizacionais com Versionamento

### Path Firebase

```
Mode single-user:  users/{uid}/energyCredits/{collection}/{id}
Mode organization: organizations/{orgId}/energyCredits/{collection}/{id}
```

### Protocolo de Escrita em Org Mode

```
set(organizationId, path, value, expectedVersion, clientRequestId):
  1. Validar token → uid
  2. Validar membership uid→org no backend (users/{uid}/memberships/{orgId})
  3. Verificar permissão (create ou update) a partir do role do membership
  4. Checar idempotência: organizations/{orgId}/idempotency/{clientRequestId}
     → se registrado: return { ok: true, idempotent: true }
  5. Firebase RTDB transaction:
     create (expectedVersion=0):
       current === null → write { ...entity, version: 1, updatedAt, updatedBy }
       current !== null → abort → 409
     update (expectedVersion≥1):
       current.version === expectedVersion → write { ...entity, version: N+1, updatedAt, updatedBy }
       current.version !== expectedVersion → abort → 409
  6. Se committed=false → 409 com { code: 'version_conflict', expectedVersion, currentVersion }
  7. Registrar idempotência: organizations/{orgId}/idempotency/{clientRequestId}
  8. Audit log (best-effort): organizations/{orgId}/auditLog/{id}
  9. return { ok: true, version: N }
```

### VersionedRecord — campos adicionados em org mode

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `version` | number | Incremental; create = 1 |
| `updatedAt` | number | Epoch ms |
| `updatedBy` | string | uid do operador |

---

## 3. Idempotência

| Campo | Origem | Destino no RTDB |
|-------|--------|-----------------|
| `clientRequestId` | browser (UUID gerado por `setVersioned`) | `organizations/{orgId}/idempotency/{clientRequestId}` |
| `serverRequestId` | backend (UUID por request) | Resposta HTTP + `_requestId` no entity (single-user) |

A idempotência cobre somente operações `set` em org mode.
Path `organizations/{orgId}/idempotency/` fica FORA de `energyCredits/` — não aparece em snapshots.

---

## 4. HTTP 409 — Conflito de Versão

```json
{
  "ok": false,
  "code": "version_conflict",
  "error": "Conflito de versão",
  "expectedVersion": 2,
  "currentVersion": 3
}
```

**Causas:**
- Update com `expectedVersion` desatualizado (outro cliente atualizou antes)
- Create para entidade que já existe no path org

**Comportamento no cliente:**
- `VersionConflictException` lançada por `httpFirebaseClient.setVersioned()`
- `persistentUiProvider` captura e retorna `{ ok: false, errors: [{ code: 'VERSION_CONFLICT' }] }`
- UI mostra mensagem de erro (sem crash)

---

## 5. Permissões por Operação

| Operação | Permissão exigida |
|----------|------------------|
| `snapshot` | `energyCredits.read` |
| `get` | `energyCredits.read` |
| `set` (create, expectedVersion=0) | `energyCredits.create` |
| `set` (update, expectedVersion≥1) | `energyCredits.update` |

Role e permissões calculados do membership no backend. Nunca confiados do browser.

---

## 6. Audit Log Organizacional

**Path:** `organizations/{orgId}/auditLog/{uid}_{entityId}_{timestamp}`

**Campos:**
```json
{
  "id": "uid_entityId_ts",
  "requestId": "server-trace-uuid",
  "uid": "operador-uid",
  "organizationId": "org-id",
  "targetId": "entity-id",
  "action": "create | update",
  "completedAt": 1721390000000
}
```

**Garantias:**
- Best-effort (nunca bloqueia a operação principal)
- Fora de `energyCredits/` — não aparece em snapshots
- Sem PII — apenas IDs, action e timestamp

---

## 7. Org Names em availableOrganizations

`organization-context.js` carrega nomes das organizações em paralelo via `Promise.all`.
Antes do Gate 8B retornava `name: ''` (placeholder). Agora carrega `org.name` de `organizations/{orgId}`.

```javascript
const availableOrganizations = await Promise.all(
  activeMemberships.map(async m => {
    const orgData = await db.ref(`organizations/${m.organizationId}`).once('value').then(s => s.val());
    return { id: m.organizationId, name: orgData?.name || '', role: m.role };
  }),
);
```

---

## 8. Propagação de Contexto no Bootstrap

```
standaloneProviderBootstrap.ts:
  Step 1: resolveSessionToken() → token
  Step 2: resolveOrganizationContext(token) → orgContext
  Step 3: ESA.initialize()
  Step 4: createHttpFirebaseClient(token, orgContext)  ← Gate 8B: baked org context
           loadEnergyCreditsSnapshot(token, orgContext) ← Gate 8B: dual-read
           snapshot = snapshotResult.data
  Step 5-6: hydrateFromSnapshot(snapshot) + hydrateReadModel
  Step 7: createEnergyCreditsFirebaseRepository(httpClient)
  Step 8: EnergyCreditsUIProvider(ESA)
  Step 9: createPersistentUiProvider(inner, firebaseRepo, memoryRepo, ESA, uid, orgContext, httpClient)
                                                                          ↑ Gate 8B: +2 args
  Step 10: window.__ESA_UI_PROVIDER__ + dispatch ready
```

---

## 9. Backward Compatibility

Requests sem `organizationId` no body são tratados IDENTICAMENTE ao Gate 7.1:
- Path: `users/{uid}/energyCredits/`
- Sem validação de membership
- Sem transactions (last-write-wins)
- `dataSource: 'legacy-single-user'`, `migrationRequired: false`
- Nenhum teste existente (Gate 7.1 / homologação) é quebrado

---

## 10. Checklist Gate 8C

- [ ] Executar script de migração em staging (Gate 8A doc, step 6)
- [ ] Verificar contagens e hashes pós-cópia
- [ ] Aprovar cutover com stakeholders
- [ ] Desativar dual-read: snapshot lê somente `organizations/{orgId}/`
- [ ] Monitorar 24h sem erros
- [ ] Remoção futura de `users/{uid}/energyCredits/` (30 dias pós-cutover)
