# Gate 8A — Fundação de Multitenancy Organizacional

**Classificação anterior:** `PERSISTENCE_READY_SINGLE_USER`
**Classificação após Gate 8A:** `MULTITENANCY_FOUNDATION_READY`
**Próxima etapa:** Gate 8B — Migração de paths e escrita multi-org

---

## 1. Modelo Organizacional

### Estrutura Firebase RTDB

```
organizations/{organizationId}/
  id, name, slug, status, createdAt, updatedAt, createdBy

organizations/{organizationId}/members/{uid}/
  organizationId, uid, role, status, permissions[], createdAt, updatedAt

users/{uid}/memberships/{organizationId}/
  organizationId, uid, role, status, permissions[], createdAt, updatedAt

users/{uid}/energyCredits/          ← path atual, inalterado no Gate 8A
```

### Organization

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string | UUID gerado no backend |
| name | string | Nome exibido |
| slug | string | Identificador URL-safe único |
| status | `active \| suspended \| inactive` | |
| createdAt | number | epoch ms |
| updatedAt | number | epoch ms |
| createdBy | string | uid do criador |

### OrganizationMembership

| Campo | Tipo | Descrição |
|-------|------|-----------|
| organizationId | string | |
| uid | string | |
| role | OrganizationRole | |
| status | `active \| suspended \| pending` | |
| permissions | OrganizationPermission[] | Sobreposição por registro; vazio = herda da role |
| createdAt | number | |
| updatedAt | number | |

---

## 2. Roles

| Role | Descrição |
|------|-----------|
| `owner` | Controle total; gerencia membros |
| `admin` | Igual ao owner exceto por restrições futuras de billing |
| `manager` | Operação completa; sem delete nem gerência de membros |
| `operator` | Cria/atualiza/importa; sem acesso financeiro |
| `financial` | Acesso financeiro; sem criação de UGs/UBs |
| `viewer` | Somente leitura |

---

## 3. Matriz de Permissões

| Permission | owner | admin | manager | operator | financial | viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| energyCredits.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| energyCredits.create | ✓ | ✓ | ✓ | ✓ | | |
| energyCredits.update | ✓ | ✓ | ✓ | ✓ | | |
| energyCredits.delete | ✓ | ✓ | | | | |
| energyCredits.settlement.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| energyCredits.settlement.write | ✓ | ✓ | ✓ | | ✓ | |
| energyCredits.financial.read | ✓ | ✓ | ✓ | | ✓ | ✓ |
| energyCredits.financial.write | ✓ | ✓ | | | ✓ | |
| energyCredits.import | ✓ | ✓ | ✓ | ✓ | | |
| energyCredits.alerts.manage | ✓ | ✓ | ✓ | | | |
| organization.members.read | ✓ | ✓ | ✓ | | | |
| organization.members.manage | ✓ | ✓ | | | | |

**Fonte de verdade:** `multitenancy/permissionMatrix.ts` (TypeScript) +
`netlify/functions/organization-context.js` (Node.js backend).

Nunca hardcodar permissões em módulos individuais.

---

## 4. Contexto Organizacional

### OrganizationContext (retornado pelo backend)

```typescript
interface OrganizationContext {
  tenancyMode:             'single-user' | 'organization';
  organizationId:          string;
  organizationName:        string;
  uid:                     string;
  role:                    OrganizationRole | 'single-user';
  permissions:             OrganizationPermission[];
  availableOrganizations:  OrganizationSummary[];
}
```

### Resolução de organização ativa

1. Browser envia `sessionStorage["esa_active_organization"]` como `organizationId` no body.
2. Backend valida que o uid (do token) possui membership ativo nessa organização.
3. Se inválido → 403; backend nunca aceita organização sem membership comprovado.
4. Sem `esa_active_organization` → backend usa a primeira organização ativa do usuário.

**Regras:**
- `esa_active_organization` armazena APENAS o ID; nunca permissões ou role.
- `localStorage` não é usado para dados operacionais.
- O backend sempre revalida membership a cada request.

---

## 5. Endpoint `organization-context`

**URL:** `POST /.netlify/functions/organization-context`

**Auth:** `Authorization: Bearer {sessionToken}` (HMAC assinado pelo servidor)

**Request:**
```json
{ "organizationId": "optional_org_id" }
```

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "tenancyMode": "organization",
    "organizationId": "...",
    "organizationName": "...",
    "uid": "...",
    "role": "manager",
    "permissions": ["energyCredits.read", "..."],
    "availableOrganizations": [{ "id": "...", "name": "", "role": "manager" }]
  }
}
```

**Erros:**
| Status | Situação |
|--------|----------|
| 401 | Token ausente ou inválido |
| 403 | Organização sem membership; org/membership inativo |
| 500 | Firebase ou configuração indisponível |

**Garantias de segurança:**
- uid extraído exclusivamente do token HMAC; nunca do body.
- role e permissions calculados no backend; nunca vindos do browser.
- Cross-tenant bloqueado: organizationId do body é validado contra memberships do uid.

---

## 6. Fallback Single-User

Usuários sem nenhum membership ativo recebem:
```json
{
  "tenancyMode": "single-user",
  "organizationId": "{uid}",
  "role": "single-user",
  "permissions": [/* todas as permissions */],
  "availableOrganizations": []
}
```

O bootstrap continua usando `users/{uid}/energyCredits/` como antes.
Nenhuma funcionalidade atual é afetada.

---

## 7. Versionamento Otimista — Contrato Gate 8B

Toda entidade mutável adicionará estes campos no Gate 8B:

```typescript
interface VersionedRecord {
  version:   number;  // incrementado a cada escrita
  updatedAt: number;  // epoch ms
  updatedBy: string;  // uid
}
```

**Política de conflito:**
- Escritas enviam `expectedVersion`.
- Se `currentVersion !== expectedVersion` → HTTP 409 com `VersionConflictError`.
- Retry automático com backoff configurável.
- Máximo 3 retries por padrão (Gate 8B).

---

## 8. Plano de Migração de Dados

> ⚠️ NÃO EXECUTAR NESTA MISSÃO. Planejado para Gate 8B ou posterior.

### Caminho atual
```
users/{uid}/energyCredits/{collection}/{id}
```

### Caminho destino
```
organizations/{organizationId}/energyCredits/{collection}/{id}
```

### Etapas

1. **Inventário**
   - Listar todos os UIDs com dados em `users/{uid}/energyCredits/`
   - Contagem por coleção (generatingUnits, beneficiaryUnits, bills, credits)
   - Hash MD5 por documento para verificação pós-migração

2. **Criação da organização ESA**
   - Executar `scripts/create-initial-organization.js --dry-run` primeiro
   - Criar organização com `--owner-uid` do usuário principal

3. **Criação do membership owner**
   - Script cria automaticamente `users/{uid}/memberships/{orgId}` com `role: 'owner'`
   - Verificar manualmente antes de prosseguir

4. **Dry-run de migração**
   - Script de cópia lê `users/{uid}/energyCredits/` → imprime o que seria copiado
   - Validar contagens e amostra de documentos

5. **Backup**
   - Export completo de `users/{uid}/energyCredits/` via Firebase Admin SDK
   - Armazenar como JSON com timestamp

6. **Cópia (não move — apenas adiciona)**
   - Script copia cada documento para `organizations/{orgId}/energyCredits/`
   - Path antigo permanece inalterado durante dual-read

7. **Verificação**
   - Comparar contagens antes/depois
   - Comparar hash por documento
   - Amostra manual de 10 documentos em cada coleção

8. **Período de dual-read (Gate 8B)**
   - Backend lê de ambos os paths, priorizando organizations/
   - Escritas novas vão para organizations/ apenas
   - Monitorar por 7 dias sem incidentes

9. **Cutover**
   - Desativar dual-read; leitura exclusiva de organizations/
   - Verificar zero erros nas primeiras 24h

10. **Remoção futura (Gate 8C ou posterior)**
    - Após 30 dias sem incidentes, remover `users/{uid}/energyCredits/`
    - Script idempotente de remoção com dry-run

### Rollback
- Em qualquer ponto antes do cutover: nenhuma ação; path antigo inalterado
- Após cutover: reverter `energyCreditsDataPath` no backend para `users/{uid}/`
- Path `organizations/{orgId}/energyCredits/` pode ser mantido como backup

### Riscos
| Risco | Mitigação |
|-------|-----------|
| Cópia incompleta | Verificação por contagem + hash antes do cutover |
| Memberships ausentes | Verificar existência antes de migrar |
| Rollback lento | Path antigo nunca removido antes de Gate 8C |
| Conflito de IDs | IDs de documentos são UUIDs globais, sem colisão |

---

## 9. Script de Criação de Organização Inicial

**Arquivo:** `scripts/create-initial-organization.js`

```bash
# Dry-run (seguro, não escreve nada)
node scripts/create-initial-organization.js \
  --name "ESA Energia" \
  --slug "esa-energia" \
  --owner-uid "uid_do_usuario" \
  --dry-run

# Execução real
node scripts/create-initial-organization.js \
  --name "ESA Energia" \
  --slug "esa-energia" \
  --owner-uid "uid_do_usuario"
```

**Variáveis de ambiente necessárias:**
- `FIREBASE_SERVICE_ACCOUNT_JSON`

**Garantias:**
- Sem uid hardcoded
- Sem secrets no código
- Idempotente: mesma execução duas vezes é segura
- Gera relatório de tudo que foi/seria criado

---

## 10. Arquivos Criados no Gate 8A

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `multitenancy/types.ts` | TypeScript | Todos os contratos |
| `multitenancy/permissionMatrix.ts` | TypeScript | Matriz + hasPermission() |
| `multitenancy/organizationContextResolver.ts` | TypeScript | Resolver async |
| `netlify/functions/organization-context.js` | Node.js | Endpoint de contexto |
| `scripts/create-initial-organization.js` | Node.js | Script de criação |
| `tests/gate8a-multitenancy.manual-test.ts` | TypeScript | Suites de teste |

**Arquivos modificados:**
| Arquivo | Mudança |
|---------|---------|
| `bootstrap/standaloneProviderBootstrap.ts` | Integra resolveOrganizationContext() no passo 2 |

---

## 11. Checklist Gate 8B

- [ ] Implementar dual-read: organizations/ com fallback para users/
- [ ] Mudar escritas para organizations/{orgId}/energyCredits/
- [ ] Implementar versionamento otimista (VersionedRecord + 409)
- [ ] Carregar nomes das organizações disponíveis em availableOrganizations
- [ ] UI: seletor de organização ativa (sessionStorage["esa_active_organization"])
- [ ] Testes de integração com Firebase emulado
- [ ] Script de migração dry-run
- [ ] Executar migração em staging
- [ ] Verificação por hash pós-migração
- [ ] Aprovar cutover com stakeholders
