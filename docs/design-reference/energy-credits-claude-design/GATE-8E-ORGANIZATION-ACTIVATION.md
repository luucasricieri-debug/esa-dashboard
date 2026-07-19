# Gate 8E — Ativação do Modo Organizacional ESA

**Organização:** `1fda2931-8d9e-4a68-8fc5-3fd49d8367b1` (ESA)
**Owner:** `lucas_vizentin`
**Pré-requisito:** Gate 8D concluído (`COPY_VERIFIED_WITH_WARNINGS`)

---

## 1. Contexto

Após o Gate 8D concluir com `COPY_VERIFIED_WITH_WARNINGS` (zero registros operacionais copiados, usuário `lucas_vizentin` existe), o namespace organizacional está inicializado mas vazio de dados operacionais. O sistema precisa reconhecer este estado e retornar `dataSource: 'organization'` ao invés de fazer fallback para o modo legado (`users/{uid}/energyCredits`).

---

## 2. Problema resolvido

### Antes do Gate 8E

`energy-credits-data.js` usava apenas `hasOrgData(orgRaw)` para detectar org mode:

```javascript
// Bugado: só detecta org se houver dados operacionais (generatingUnits, etc.)
if (hasOrgData(orgRaw)) {
  return { dataSource: 'organization', ... };
}
// fallback para legacy mesmo quando org está inicializada via migration
```

Com zero registros operacionais (conforme `COPY_VERIFIED_WITH_WARNINGS`), `hasOrgData` retornava `false` → sistema voltava ao modo legado incorretamente.

### Depois do Gate 8E

Adicionada `hasMigrationMarker(raw)` que detecta namespace organizacional inicializado via marker em `organizations/{orgId}/energyCredits/_migration`:

```javascript
if (hasOrgData(orgRaw) || hasMigrationMarker(orgRaw)) {
  return { dataSource: 'organization', migrationRequired: false, ... };
}
```

---

## 3. Migration Marker

**Path RTDB:** `organizations/{orgId}/energyCredits/_migration`

**Estrutura:**
```json
{
  "gate": "8D",
  "status": "verified",
  "sourceUidMasked": "luca****ntin",
  "copiedRecords": 0,
  "classification": "COPY_VERIFIED_WITH_WARNINGS",
  "completedAt": "<ISO 8601>",
  "completedBy": "migration",
  "version": 1
}
```

**Invariantes:**
- `status === 'verified'` é o único valor que ativa org mode via marker
- `sourceUidMasked`: nunca o uid real (sem PII)
- Idempotente: não sobrescreve marker já existente com `status === 'verified'`

**Como gravar:**
```bash
node scripts/gate8e-write-migration-marker.js \
  --organization-id 1fda2931-8d9e-4a68-8fc5-3fd49d8367b1 \
  --source-uid lucas_vizentin \
  [--gate8d-report reports/gate-8d-copy-report.json] \
  [--dry-run]
```

Requer `FIREBASE_SERVICE_ACCOUNT_JSON` e `DATABASE_URL` no ambiente.

---

## 4. Sequência de bootstrap

```
1. resolveSessionToken()          → sessionToken ou erro (blocking)
2. resolveOrganizationContext()   → orgContext ou null (non-blocking)
   ├── GET /.netlify/functions/organization-context
   ├── server lê users/{uid}/memberships/{orgId}
   ├── server valida org.status === 'active'
   └── retorna tenancyMode, organizationId, role, permissions
3. loadEnergyCreditsSnapshot()    → snapshot + dataSource
   ├── POST /.netlify/functions/energy-credits-data (operation: snapshot)
   ├── server lê organizations/{orgId}/energyCredits
   ├── hasOrgData OR hasMigrationMarker → dataSource: 'organization'
   └── fallback: users/{uid}/energyCredits → dataSource: 'legacy-single-user'
4. hydrateFromSnapshot()          → repositório em memória
5. createPersistentUiProvider()   → provider com escrita organizacional
```

---

## 5. Error codes

| Código | Origem | Condição |
|--------|--------|----------|
| `organization_invalid` | `energy-credits-data.js` + `organization-context.js` | Membership ausente ou org não encontrada |
| `membership_inactive` | `energy-credits-data.js` | `membership.status !== 'active'` |
| `organization_inactive` | `organization-context.js` | `org.status !== 'active'` |
| `organization_context_failed` | `organization-context.js` | Exceção ao acessar RTDB para org |
| `no_permission` | `energy-credits-data.js` | Role sem permissão para a operação |
| `forbidden` | `organizationContextResolver.ts` | HTTP 403 genérico do endpoint |

Todos os códigos mapeados em:
- `ORG_CONTEXT_MESSAGES` em `standaloneProviderBootstrap.ts` (logs)
- Ternary chain em `energy-credits-v2.html` linha ~5030 (UI display)

---

## 6. sessionStorage: `esa_active_organization`

- **Chave:** `esa_active_organization`
- **Função de leitura:** `readActiveOrgId()` em `organizationContextResolver.ts`
- **Função de limpeza (logout):** `clearActiveOrganization()` — exportada do resolver
- **Uso:** enviado no body de `organization-context` como `{ organizationId }` para selecionar entre múltiplas orgs do mesmo usuário
- **Sem PII:** contém apenas o organizationId UUID

---

## 7. Segurança

- **Sem role do browser:** role calculado do `membership.role` no backend
- **Sem permissions do browser:** permissões calculadas via `ROLE_PERMISSIONS[role]`
- **Sem organizationId sem membership:** backend valida `users/{uid}/memberships/{orgId}` antes de servir dados organizacionais
- **Sem uid do body:** uid sempre extraído do sessionToken verificado via HMAC
- **Sem Firebase diretamente na UI:** toda leitura/escrita via Netlify Functions

---

## 8. Fallback e rollback

### Fallback (automático)

Se org context falha (endpoint indisponível, membership ausente, org inativa):
- `resolveOrganizationContext()` retorna `{ context: null, code: '<error_code>' }`
- `orgCode` logado com mensagem descritiva via `ORG_CONTEXT_MESSAGES`
- Bootstrap continua em **single-user mode** (tenancyMode não configurado)
- Snapshot usa path legado `users/{uid}/energyCredits`
- **Nenhuma tela de erro exibida** — degradação silenciosa para modo individual

### Rollback manual

Para desativar o org mode para um usuário específico, remover da sessionStorage:

```javascript
// No console do browser (somente para o usuário logado naquele navegador)
sessionStorage.removeItem('esa_active_organization');
location.reload();
```

Ou via código: `clearActiveOrganization()` do `organizationContextResolver.ts`.

---

## 9. Restrições ativas

- **Não ativar para outros usuários:** Gate 8E é exclusivo para `lucas_vizentin`
- **Não criar seletor visual:** UI não expõe seleção de organização
- **Não criar gestão de membros:** apenas leitura do membership existente
- **Não alterar Billing Engine:** Core não é modificado
- **Não alterar visual, CSS ou DOM:** zero mudanças de UI
- **Não confiar em role/permissions do browser:** calculados no backend
- **Não remover fallback legado:** single-user mode permanece intacto
- **Não criar UG/UB fictícia:** nenhum dado de exemplo gerado
- **Não apagar `users/{uid}/energyCredits`:** dados de origem preservados

---

## 10. Testes

| Arquivo | Execução | Assertions |
|---------|----------|------------|
| `netlify/functions/__tests__/energy-credits-data.test.js` | `node` | 160 (OA01–OA34 = 34 novos) |
| `src/ui/energy-credits/direct-runtime/tests/gate8e-org-activation.manual-test.ts` | `npx tsx` | 43 (MM01–MK10) |

---

## 11. Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `netlify/functions/energy-credits-data.js` | `hasMigrationMarker`, dual-read, membership split |
| `netlify/functions/organization-context.js` | `code` fields em todos os erros org |
| `src/.../standaloneProviderBootstrap.ts` | `ORG_CONTEXT_MESSAGES`, log de `orgCode` |
| `src/.../organizationContextResolver.ts` | `clearActiveOrganization()` exportada |
| `energy-credits-v2.html` | Mensagens para 3 novos códigos de erro |

| Arquivo | Criado |
|---------|--------|
| `scripts/gate8e-write-migration-marker.js` | Script idempotente para gravar `_migration` marker |
| `src/.../tests/gate8e-org-activation.manual-test.ts` | 43 testes estáticos |
| `docs/.../GATE-8E-ORGANIZATION-ACTIVATION.md` | Este documento |
