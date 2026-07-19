# Gate 8F — Seletor de Organização e Gestão de Membros

**Branch:** main  
**Pré-requisito:** Gate 8E validado em produção (`tenancyMode=organization`, `dataSource=organization`)

---

## 1. Visão Geral

Gate 8F adiciona duas capacidades ao módulo standalone de créditos de energia ESA:

1. **Seletor discreto de organização** no cabeçalho do módulo — ativo quando o usuário pertence a múltiplas organizações.
2. **Área de gestão de membros** ("Organização") — lista, adiciona, altera papel, suspende e reativa memberships.

---

## 2. Endpoint: `organization-members`

### Path

`POST /.netlify/functions/organization-members`

### Autenticação

Bearer token HMAC. O `uid` do ator é sempre extraído do token — nunca do body.

### Ações

| `action`      | Permissão mínima              | Descrição                                      |
|---------------|-------------------------------|------------------------------------------------|
| `list`        | `organization.members.read`   | Lista membros com displayName e login          |
| `add`         | `organization.members.manage` | Adiciona usuário existente como membro         |
| `update-role` | `organization.members.manage` | Altera papel de um membro                      |
| `suspend`     | `organization.members.manage` | Suspende membership                            |
| `reactivate`  | `organization.members.manage` | Reativa membership suspenso                    |

### Roles com permissão

| Role      | members.read | members.manage |
|-----------|-------------|----------------|
| owner     | ✓           | ✓              |
| admin     | ✓           | ✓              |
| manager   | ✓           | —              |
| operator  | —           | —              |
| financial | —           | —              |
| viewer    | —           | —              |

### Corpo da requisição (exemplos)

**list:**
```json
{ "action": "list", "organizationId": "<orgId>" }
```

**add:**
```json
{ "action": "add", "organizationId": "<orgId>", "login": "ana.lima", "role": "viewer", "clientRequestId": "add-1234" }
```
ou por uid direto:
```json
{ "action": "add", "organizationId": "<orgId>", "targetUid": "<uid>", "role": "operator", "clientRequestId": "add-5678" }
```

**update-role:**
```json
{ "action": "update-role", "organizationId": "<orgId>", "targetUid": "<uid>", "newRole": "manager", "expectedVersion": 1, "clientRequestId": "role-xxx" }
```

**suspend / reactivate:**
```json
{ "action": "suspend", "organizationId": "<orgId>", "targetUid": "<uid>", "expectedVersion": 1, "clientRequestId": "sus-xxx" }
```

### Respostas

**Sucesso (200):**
```json
{ "ok": true, "requestId": "...", "data": { ... } }
```

**list responde com array em `data.data`:**
```json
{ "ok": true, "requestId": "...", "data": [ { "uid": "...", "displayName": "...", "login": "...", "role": "viewer", "status": "active", "version": 1 } ] }
```

---

## 3. Proteções de Segurança

| Regra                          | Código de erro               |
|-------------------------------|------------------------------|
| Sem membership do ator        | `organization_invalid` (403)  |
| Membership do ator inativo    | `membership_inactive` (403)   |
| Sem permissão para a ação     | `no_permission` (403)         |
| Self-role-change              | `self_role_change_forbidden` (403) |
| Alvo é owner (suspend/update-role) | `owner_protected` (403) |
| Promover para owner (owner fora de ALLOWED_ROLES) | `invalid_role` (400) |
| Versão conflitante            | `version_conflict` (409)      |
| Usuário alvo não encontrado   | `user_not_found` (404)        |
| Membership já existe          | `membership_already_exists` (409) |

- **Uid do ator**: sempre extraído do sessionToken verificado via HMAC; nunca do body.
- **Role/permissions**: calculados do membership no servidor; nunca confiados do browser.
- **Dual-path atômico**: toda escrita atualiza `organizations/{orgId}/members/{uid}` E `users/{uid}/memberships/{orgId}` em batch.
- **Idempotência**: `clientRequestId` → `organizations/{orgId}/idempotency/{clientRequestId}`.
- **Audit log**: sem PII — uid mascarado via `maskUid()`.

---

## 4. Seletor de Organização (UI)

O seletor aparece no cabeçalho do módulo standalone apenas quando `availableOrganizations.length > 1`.

- Lê `availableOrganizations` do `window.__ESA_ORG_CONTEXT__` (injetado pelo bootstrap).
- Ao trocar: grava `sessionStorage['esa_active_organization'] = newOrgId` e faz `window.location.reload()`.
- Race condition natural: reload completo garante que dados da org anterior não contaminem a nova.
- Sem múltiplas orgs: exibe badge estática com nome + ícone + badge de role.

### Render Values (orgSelector)

| Valor               | Tipo      | Descrição                                          |
|---------------------|-----------|----------------------------------------------------|
| `orgDisplayName`    | string    | Nome da org ou "Espaço pessoal"                    |
| `orgCurrentId`      | string    | organizationId ativo                               |
| `orgHasMultiple`    | boolean   | true se availableOrganizations.length > 1          |
| `orgSelectorOrgs`   | array     | Lista `{ id, name }` para o `<select>`             |
| `orgRoleBadge`      | object    | `{ show, bg, color, text }` para badge de role     |
| `onOrgSwitch`       | function  | Handler do `onChange` do `<select>`                |
| `orgSelectorIcon`   | SVG       | Ícone globe renderizado                            |

---

## 5. Tela de Membros (UI)

Rota: `view === "membros"` via nav "Organização".

### Capacidades por role

| Capability   | manager | admin | owner |
|-------------|---------|-------|-------|
| Ver lista   | ✓       | ✓     | ✓     |
| Adicionar   | —       | ✓     | ✓     |
| Alterar papel | —     | ✓     | ✓     |
| Suspender   | —       | ✓     | ✓     |
| Reativar    | —       | ✓     | ✓     |

### Render Values (membros)

| Valor                | Tipo      | Descrição                                        |
|----------------------|-----------|--------------------------------------------------|
| `membersCan.read`    | boolean   | Actor tem `organization.members.read`            |
| `membersCan.manage`  | boolean   | Actor tem `organization.members.manage`          |
| `memberRows`         | array     | Membros enriquecidos com badges e handlers       |
| `membersLoading`     | boolean   | Carregando lista                                 |
| `membersError`       | string    | Mensagem de erro                                 |
| `membersCount`       | number    | Total de membros                                 |
| `membersEmpty`       | boolean   | Lista vazia sem erro                             |
| `memberAddFormOpen`  | boolean   | Formulário de adição aberto                      |
| `memberAddLogin`     | string    | Login digitado no form                           |
| `memberAddRole`      | string    | Papel selecionado no form                        |
| `memberAddLoading`   | boolean   | Requisição de adição em progresso                |
| `memberAddError`     | string    | Erro de adição                                   |
| `memberAddSuccess`   | string    | Mensagem de sucesso                              |
| `onMemberAddToggle`  | function  | Abre/fecha formulário                            |
| `onMemberAddSubmit`  | function  | Dispara `_addMember(login, role)`                |
| `memberActionLoading`| string    | uid do membro com ação em progresso              |

### Cada `memberRow` contém

| Campo          | Tipo      | Descrição                                      |
|----------------|-----------|------------------------------------------------|
| `uid`          | string    | uid do membro                                  |
| `displayName`  | string    | Nome ou uid truncado                           |
| `login`        | string    | Login ou "—"                                   |
| `roleBadge`    | object    | `{ bg, color, text }` por role                 |
| `statusBadge`  | object    | `{ bg, color, text }` por status               |
| `isOwner`      | boolean   | Protege contra alterações                       |
| `isSelf`       | boolean   | Usuário logado                                  |
| `canUpdateRole`| boolean   | `manage && !owner && !self`                    |
| `canSuspend`   | boolean   | `manage && !owner && !self && active`          |
| `canReactivate`| boolean   | `manage && !self && suspended`                 |
| `onRoleChange` | function  | Chama `_updateMemberRole(uid, version, role)`  |
| `onSuspend`    | function  | Chama `_suspendMember(uid, version)`           |
| `onReactivate` | function  | Chama `_reactivateMember(uid, version)`        |

---

## 6. Métodos do Componente

| Método               | Descrição                                                         |
|----------------------|-------------------------------------------------------------------|
| `_getSessionToken()` | Lê sessionToken do `esa_session` (sessionStorage) ou `esa_remember` (localStorage) |
| `_loadMembers()`     | GET action:list → `_rtMembers`                                    |
| `_addMember(login, role)` | POST action:add com `clientRequestId` único → reload lista   |
| `_updateMemberRole(uid, version, newRole)` | POST action:update-role → toast + reload  |
| `_suspendMember(uid, version)` | POST action:suspend → toast + reload               |
| `_reactivateMember(uid, version)` | POST action:reactivate → toast + reload          |

`componentDidUpdate` dispara `_loadMembers()` na primeira entrada em `view === "membros"`.

---

## 7. Estado adicionado

```javascript
_rtOrgContext: null,               // window.__ESA_ORG_CONTEXT__ (injetado na _initRealMode)
_rtMembers: null,                  // array de MemberRecord ou null
_rtMembersLoading: false,
_rtMembersError: null,
_rtMemberAddLogin: "",
_rtMemberAddRole: "viewer",
_rtMemberAddLoading: false,
_rtMemberAddError: null,
_rtMemberAddSuccess: null,
_rtMemberAddFormOpen: false,
_rtMemberActionLoading: null,      // uid do membro com ação em andamento
```

---

## 8. Restrições Ativas

- **Sem convite por e-mail**: adição apenas por `login` ou `targetUid` de usuário já existente.
- **Sem criação de usuário**: endpoint retorna 404 se o usuário não for encontrado.
- **Sem alteração de owner**: protegido em update-role, suspend e no ALLOWED_ROLES.
- **Sem autoalteração**: self-role-change e self-suspend proibidos.
- **Sem promoção para owner**: `owner` fora de `ALLOWED_ROLES`.
- **Sem dados misturados**: org context isolado por `organizationId`; reload completo no switch.
- **Sem Billing Engine alterado**: módulo de apuração intacto.
- **Sem fallback removido**: single-user mode permanece intacto.

---

## 9. Testes

| Arquivo | Modo | Assertions |
|---------|------|------------|
| `netlify/functions/__tests__/organization-members.test.js` | `node` | 57 (MB01–MI05, 8 suites) |
| `netlify/functions/__tests__/energy-credits-data.test.js`  | `node` | 160 |
| `src/.../tests/gate8e-org-activation.manual-test.ts`       | `npx tsx` | 43 |

**Total acumulado: 260 assertions, 0 falhas.**

---

## 10. Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `energy-credits-v2.html` | Org selector HTML+state, membros HTML+state, render values, métodos, componentDidUpdate trigger, _initRealMode captura _rtOrgContext |
| `src/.../multitenancy/types.ts` | `MemberRecord` interface adicionada |

| Arquivo | Criado |
|---------|--------|
| `netlify/functions/organization-members.js` | Endpoint completo com 5 ações |
| `netlify/functions/__tests__/organization-members.test.js` | 57 assertions em 8 suites |
| `docs/.../GATE-8F-ORGANIZATION-MEMBERS.md` | Este documento |
