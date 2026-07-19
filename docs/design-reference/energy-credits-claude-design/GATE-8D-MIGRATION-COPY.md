# Gate 8D — Cópia Verificada para Organização ESA

**Classificação anterior:** `DRY_RUN_READY` (Gate 8C)  
**Classificação após Gate 8D:** `COPY_VERIFIED` (após execução real)  
**Próxima etapa:** Gate 8E — Cutover (ativar org mode; remover fallback legado após 30 dias)

---

## 1. Status de Execução

| Condição | Estado |
|---------|-------|
| Infraestrutura construída | ✓ |
| Testes passando (103 novos) | ✓ |
| `FIREBASE_SERVICE_ACCOUNT_JSON` configurada | PENDENTE |
| `DATABASE_URL` configurada | PENDENTE |
| Gate 8C classificado como READY_FOR_COPY | PENDENTE (foi BLOCKED — sem credenciais) |
| Execução real executada | PENDENTE |

> **Bloqueio ativo:** Credenciais Firebase não estão configuradas no ambiente de execução.
> Configure `FIREBASE_SERVICE_ACCOUNT_JSON` e `DATABASE_URL` e execute o preflight
> antes de prosseguir.

---

## 2. Pré-condições Obrigatórias (Section 0)

TODAS devem passar antes de qualquer escrita. O script aborta com erro em qualquer falha.

- [ ] Working tree clean (`git status`)
- [ ] Branch `main`, sincronizado com `origin/main`
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` válida (project_id, client_email, private_key, type)
- [ ] `DATABASE_URL` válida (`*.firebaseio.com`)
- [ ] Gate 8C classificado como `DRY_RUN_READY_FOR_COPY` (re-executar com credenciais)
- [ ] sourceUid confirmado e existente no RTDB
- [ ] targetOrganizationId confirmado
- [ ] Destino `organizations/{orgId}/energyCredits/` vazio
- [ ] Hash da origem confere com o Gate 8C
- [ ] Contagem da origem confere com o Gate 8C

---

## 3. Sequência de Execução

### Passo 0 — Re-executar dry-run com credenciais

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON='<service-account-json>'
export DATABASE_URL='https://agenda-executiva-esa-default-rtdb.firebaseio.com'

node scripts/migrate-energy-credits-to-organization.js \
  --dry-run \
  --source-uid <SOURCE_UID> \
  --target-organization-id <TARGET_ORG_ID> \
  --report-file reports/gate-8d-preflight-dry-run.json
```

Esperado: classificação `DRY_RUN_READY_FOR_COPY`.

### Passo 1 — Preflight check (read-only)

```bash
node scripts/gate8d-preflight.js \
  --source-uid <SOURCE_UID> \
  --target-organization-id <TARGET_ORG_ID> \
  --dry-run-report reports/gate-8d-preflight-dry-run.json
```

Esperado: `PREFLIGHT_READY`. Se `PREFLIGHT_BLOCKED`: PARAR.

### Passo 2 — Criar organização ESA

```bash
node scripts/create-initial-organization.js \
  --name "ESA" \
  --slug "esa" \
  --owner-uid <SOURCE_UID>
```

Idempotente — se organização já existir com o slug, reutiliza e não duplica.
Confirmar organizationId gerado.

### Passo 3 — Copiar dados

```bash
node scripts/migrate-energy-credits-to-organization.js \
  --source-uid <SOURCE_UID> \
  --target-organization-id <ORG_ID> \
  --dry-run-report reports/gate-8d-preflight-dry-run.json \
  --backup-dir backups/gate-8d \
  --report-file reports/gate-8d-migration-result.json
```

O script:
1. Valida credenciais
2. Verifica preflight (source exists, dest empty, hash matches dry-run)
3. Cria backup em `backups/gate-8d/<timestamp>/`
4. Valida backup imediatamente
5. Copia dados em lotes de 100 (multipath atomic update)
6. Salva checkpoint por collection (resumível)
7. Cria audit log de migração
8. Verifica pós-cópia (contagens e hashes)
9. Confirma origem intacta
10. Gera relatório JSON

### Passo 4 — Verificar relatório

```bash
cat reports/gate-8d-migration-result.json | node -e "
  const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Classificação:', r.classification);
  console.log('Copiados:', r.copy.totalCopied);
  console.log('Origem intacta:', r.originIntact);
"
```

---

## 4. Estrutura do Backup

```
backups/gate-8d/<timestamp>/
├── source-energy-credits.json        # Dados completos da origem (PII real)
├── destination-organization.json     # Snapshot pré-migração do destino
├── source-hash.json                  # Hash global + hashes por collection
├── destination-hash.json             # Hashes do destino (esperado vazio)
└── backup-manifest.json              # Manifest com contagens, hashes, metadados
```

**⚠ Backups NUNCA são commitados.** O path `backups/` está no `.gitignore`.  
PII operacional é preservada no backup local para possibilitar restauração.  
Relatórios versionados usam `maskedSourceUid` (ex: `abcd****efgh`).

**Validade do backup:** Manter por mínimo 30 dias pós-cutover.

---

## 5. Transformações Aplicadas na Cópia

| Campo | Antes | Depois |
|-------|-------|--------|
| `organizationId` | `uid_do_usuario` | `orgId_da_organizacao` |
| `version` | ausente | `1` |
| `updatedBy` | ausente | `"migration"` |
| `id` | preservado | preservado |
| `createdAt` | preservado | preservado |
| `updatedAt` | preservado | preservado |

---

## 6. Lotes e Checkpoint

- Lote máximo: **100 registros** por `db.ref('/').update(batch)` (atomic multipath)
- Checkpoint: `<report-file>.checkpoint.json` — salvo após cada collection
- Retomada: collection com `checkpoint[col] === 'done'` é pulada
- Checkpoint removido automaticamente após `COPY_VERIFIED`
- Interrupção + retomada é idempotente — nenhum registro é duplicado

---

## 7. Paths Firebase

| Tipo | Path |
|------|------|
| Origem (read-only) | `users/{sourceUid}/energyCredits/{col}/{id}` |
| Destino (write) | `organizations/{orgId}/energyCredits/{col}/{id}` |
| Audit log | `organizations/{orgId}/auditLog/migration_{ts}` |
| Idempotência org | `organizations/{orgId}/idempotency/{requestId}` |

**Origem nunca é escrita.** O script não tem nenhum `db.ref('users/...).set()` no path de cópia.

---

## 8. Verificação Pós-Cópia

| Item | Verificação |
|------|------------|
| Contagem total | origem == destino |
| Contagem por collection | origem[col] == destino[col] |
| IDs | todos preservados |
| organizationId | `targetOrganizationId` em todos os registros |
| version | presente em todos os registros migrados |
| Origem intacta | contagem pós-cópia == contagem pré-cópia |

**Classificações:**

| Classificação | Condição |
|--------------|---------|
| `COPY_VERIFIED` | Todas as contagens conferem |
| `COPY_VERIFIED_WITH_WARNINGS` | Contagens conferem, avisos menores |
| `COPY_FAILED_ROLLBACK_REQUIRED` | Divergência de contagem ou erro de cópia |

---

## 9. Rollback

Se `COPY_FAILED_ROLLBACK_REQUIRED`:

1. Não tocar na origem (`users/{uid}/energyCredits/` — intacta)
2. Remover SOMENTE o destino criado pelo script:

```bash
# Executar APENAS se COPY_FAILED_ROLLBACK_REQUIRED
firebase database:remove organizations/<ORG_ID>/energyCredits/ --project <PROJECT_ID>
```

3. Restaurar do backup se necessário:
   - Arquivo: `backups/gate-8d/<timestamp>/source-energy-credits.json`
   - Verificar hash: `backups/gate-8d/<timestamp>/source-hash.json`

4. Não apagar a organização (pode ser reutilizada na próxima tentativa)

---

## 10. Scripts

| Script | Propósito |
|-------|----------|
| `scripts/gate8d-preflight.js` | Valida todas as condições (read-only) |
| `scripts/gate8d-backup.js` | Cria e valida backup local |
| `scripts/create-initial-organization.js` | Cria organização + membership (idempotente) |
| `scripts/migrate-energy-credits-to-organization.js` | Dry-run (--dry-run) e cópia real (sem --dry-run) |

---

## 11. Segurança

- `FIREBASE_SERVICE_ACCOUNT_JSON` lida do ambiente — nunca commitada
- `private_key` nunca aparece em logs, relatórios ou saída de terminal
- UID do usuário mascarado nos relatórios: `abcd****efgh`
- Backups com PII ficam APENAS local (`backups/` no `.gitignore`)
- Audit log não contém PII — apenas IDs, action e timestamp
- O script valida credenciais ANTES de qualquer conexão Firebase

---

## 12. Checklist Gate 8E (Cutover)

- [ ] `COPY_VERIFIED` confirmado
- [ ] Snapshot org mode testado (`dataSource: 'organization'`, `migrationRequired: false`)
- [ ] Escrita controlada em org mode testada (version, idempotency)
- [ ] Dual-read desativado: snapshot lê APENAS `organizations/{orgId}/`
- [ ] Fallback legado removido do bootstrap
- [ ] Monitorar 24h sem erros
- [ ] `users/{uid}/energyCredits/` removido após 30 dias (Gate 8E)
