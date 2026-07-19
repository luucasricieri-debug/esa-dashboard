# Gate 8C — Dry-Run da Migração Organizacional

**Classificação anterior:** `DUAL_READ_ORG_WRITES_READY` (Gate 8B)  
**Classificação após Gate 8C:** `DRY_RUN_READY` (sem escrita, sem cutover)  
**Próxima etapa:** Gate 8D — Backup verificado + cópia real

---

## 1. Objetivo

Preparar e executar, em modo **read-only**, a inspeção da migração de dados de
`users/{uid}/energyCredits/` para `organizations/{orgId}/energyCredits/`.

**O que Gate 8C FAZ:**
- Inventaria a origem (usuário legado)
- Inventaria o destino (organização)
- Valida referências cruzadas entre collections
- Projeta as transformações de campos
- Gera hash SHA-256 por collection e para toda a origem
- Classifica a prontidão da migração
- Produz relatório JSON e plano de rollback textual

**O que Gate 8C NÃO FAZ:**
- Não copia dados
- Não altera a origem (`users/{uid}/energyCredits/`)
- Não altera o destino (`organizations/{orgId}/energyCredits/`)
- Não cria organização em produção
- Não ativa organization mode
- Não remove o fallback legado
- Não executa cutover
- Não altera o Billing Engine
- Não altera Firebase Rules
- Não apaga qualquer path

---

## 2. Scripts

### `scripts/create-initial-organization.js`

Cria uma organização e o membership do owner (dry-run safe).

```bash
# Dry-run (inspeciona sem criar)
node scripts/create-initial-organization.js \
  --name "ESA" \
  --slug "esa" \
  --owner-uid <UID_DO_OWNER> \
  --dry-run

# Criação real (Gate 8D)
node scripts/create-initial-organization.js \
  --name "ESA" \
  --slug "esa" \
  --owner-uid <UID_DO_OWNER>
```

**Garantias:**
- Idempotente: verifica slug antes de criar — nunca sobrescreve
- `--dry-run` imprime o relatório e sai sem escrever
- `organizationId` gerado via `crypto.randomUUID()` (estável se idempotência ativada)
- Role do owner fixado como `'owner'` no código — não configurável via CLI

**Paths criados (produção):**
```
organizations/{orgId}/                   — registro da organização
users/{ownerUid}/memberships/{orgId}/    — membership do owner
organizations/{orgId}/members/{ownerUid} — índice reverso
```

---

### `scripts/migrate-energy-credits-to-organization.js`

Dry-run de migração. **Exige `--dry-run` explícito** — aborta com erro se omitido.

```bash
node scripts/migrate-energy-credits-to-organization.js \
  --source-uid <UID>                         \
  --target-organization-id <ORG_ID>          \
  --dry-run                                  \
  --report-file reports/gate-8c-migration-dry-run.json
```

**Parâmetros opcionais:**
```
--verify-only              Apenas verifica; não projeta transformações
--include-collections a,b  Processar apenas estas collections
--exclude-collections c,d  Excluir estas collections
```

**Variáveis de ambiente:**
```
FIREBASE_SERVICE_ACCOUNT_JSON  — JSON da conta de serviço Firebase
DATABASE_URL                   — URL do RTDB (opcional; usa default ESA)
```

---

## 3. Collections Migradas

As 12 collections canônicas de `energyCredits`:

| Collection | Descrição |
|-----------|-----------|
| `generatingUnits` | Unidades geradoras |
| `beneficiaryUnits` | Unidades beneficiárias |
| `generatingUnitMonthlyRecords` | Registros mensais por UG |
| `beneficiaryMonthlyRecords` | Registros mensais por UB |
| `creditAllocations` | Alocações de crédito |
| `ownerSettlements` | Liquidações do proprietário |
| `esaInvoices` | Faturas ESA |
| `monthlyReports` | Relatórios mensais |
| `creditDocuments` | Documentos de crédito |
| `creditAuditLog` | Log de auditoria de créditos |
| `beneficiaryCreditBalanceRecords` | Saldo de créditos por beneficiária |
| `utilityBillImports` | Importações de faturas de energia |

---

## 4. Transformações Projetadas

Cada item migrado recebe os seguintes campos ajustados:

| Campo | Comportamento |
|-------|--------------|
| `organizationId` | Sobrescrito pelo `targetOrganizationId` |
| `version` | Criado com `1` se ausente |
| `updatedBy` | Definido como `'migration'` se ausente |
| `id` | Preservado (sem risco de colisão se destino vazio) |
| Timestamps (`updatedAt`, `createdAt`) | Preservados |

---

## 5. Validação de Referências Cruzadas

O script verifica referências entre collections via `REFERENCE_MAP`:

| De | Campo | Para |
|----|-------|------|
| `beneficiaryUnits` | `ugId` / `generatingUnitId` | `generatingUnits` |
| `generatingUnitMonthlyRecords` | `ugId` / `generatingUnitId` | `generatingUnits` |
| `beneficiaryMonthlyRecords` | `ubId` / `beneficiaryUnitId` | `beneficiaryUnits` |
| `creditAllocations` | `ugId` | `generatingUnits` |
| `creditAllocations` | `ubId` | `beneficiaryUnits` |
| `ownerSettlements` | `ugId` / `generatingUnitId` | `generatingUnits` |
| `esaInvoices` | `ubId` / `beneficiaryUnitId` | `beneficiaryUnits` |
| `beneficiaryCreditBalanceRecords` | `ubId` / `beneficiaryUnitId` | `beneficiaryUnits` |

Status: `valid` | `orphan` | `ambiguous`

---

## 6. Classificação Final

| Classificação | Condição |
|--------------|---------|
| `DRY_RUN_READY_FOR_COPY` | Sem bloqueadores, sem warnings |
| `DRY_RUN_READY_WITH_WARNINGS` | Sem bloqueadores, com avisos menores |
| `DRY_RUN_BLOCKED` | Firebase indisponível, usuário não existe, ou destino não vazio |

**Bloqueadores:**
- Firebase indisponível (FIREBASE_SERVICE_ACCOUNT_JSON ausente/inválida)
- Usuário origem não encontrado (nenhuma collection com dados)
- Destino já possui dados (`MIGRATION_DESTINATION_NOT_EMPTY`)

**Warnings:**
- Registros inválidos (sem `id` ou não-objeto)
- Registros com chaves proibidas (`password`, `sessionToken`, etc.)
- Referências órfãs
- Origem sem dados operacionais

---

## 7. Relatório JSON

```
reports/gate-8c-migration-dry-run.json
```

**Estrutura:**
```json
{
  "meta": { "gate": "8C", "mode": "dry-run", "timestamp": "...", ... },
  "source": {
    "maskedUid": "abcd****wxyz",
    "userExists": true,
    "firebaseUnavailable": false,
    "collections": [{ "collection": "...", "count": N, "hash": "...", ... }],
    "totalCount": N,
    "sourceHash": "<SHA-256 de todas as collections>"
  },
  "destination": { "hasOperationalData": false, "collections": [...] },
  "references": [{ "from": "...", "fromId": "...", "status": "valid|orphan", ... }],
  "projectedTransformations": [{ "collection": "...", "id": "...", "changes": [...] }],
  "classification": "DRY_RUN_READY_FOR_COPY",
  "blockers": [],
  "warnings": [],
  "risks": [...],
  "backupPlan": { "sourcePath": "...", "destinationPath": "...", "retentionDays": 30 },
  "recommendation": "..."
}
```

---

## 8. Hashing e Integridade

**SHA-256 por objeto:** campos ordenados recursivamente; campos efêmeros
(`updatedAt`, `createdAt`, `_requestId`, `_migrationTimestamp`) excluídos para
que o hash represente identidade de dados, não estado de sincronização.

**SHA-256 por collection:** hashes individuais ordenados por `id` e concatenados
com `|`. Determinístico independente da ordem de inserção.

**Hash da origem:** SHA-256 sobre todos os collection-hashes concatenados.
Usado no Gate 8D para verificar integridade pós-cópia.

---

## 9. Mascaramento de PII

Os seguintes campos são mascarados no relatório (nunca aparecem em texto claro):

`email`, `document`, `cpf`, `cnpj`, `phone`, `tel`, `cellphone`,
`pix`, `pixKey`, `token`, `sessionToken`, `bankAccount`, `iban`

O UID de origem também é mascarado: `abcd****efgh` (4 chars + `****` + 4 chars).

---

## 10. Plano de Rollback

**Em dry-run, não há o que desfazer.** O plano para a cópia real (Gate 8D):

1. Fazer backup de `users/{uid}/energyCredits/` antes da cópia
2. Verificar hash do backup contra `report.source.sourceHash`
3. Copiar para `organizations/{orgId}/energyCredits/`
4. Verificar hash do destino (deve ser igual ao do backup)
5. Manter `users/{uid}/energyCredits/` intacto por 30 dias
6. Em caso de falha: destino está vazio → rollback é apenas "não usar org mode"

---

## 11. Checklist Gate 8D

- [ ] Criar organização real: `create-initial-organization.js` sem `--dry-run`
- [ ] Verificar membership via console Firebase ou `organization-context.js`
- [ ] Fazer backup verificado de `users/{uid}/energyCredits/`
- [ ] Executar `migrate-energy-credits-to-organization.js` sem `--dry-run` (Gate 8D)
- [ ] Verificar hash pós-migração
- [ ] Testar snapshot dual-read em org mode (deve retornar `dataSource: 'organization'`)
- [ ] Monitorar 24h sem erros
- [ ] Remoção de `users/{uid}/energyCredits/` após 30 dias (Gate 8E)
