# CRM — Confiabilidade da Autenticação de Upload de Anexos

## Causa raiz

O modal "Arquivos do Deal" enviava o `sessionToken` armazenado em
`sessionStorage.esa_session` diretamente para `/.netlify/functions/crm-upload`
(`index.html`, função `crmUploadArquivo`). Esse token é emitido **uma única vez**,
no login, por `netlify/functions/session-init.js`, com TTL de 8 horas
(`netlify/functions/_shared/upload-session.js`, `TTL_SECONDS = 8 * 60 * 60`).

Nenhum fluxo do frontend jamais renovava esse token — nem mesmo `resumeSession()`
(chamada em toda reabertura da aplicação), que apenas reaproveitava o valor já
armazenado, por mais antigo que fosse. O endpoint de renovação já existia
(`netlify/functions/session-token.js`), mas **nunca era chamado por nenhum
código do frontend**.

Quando o usuário permanecia conectado por mais de 8 horas e tentava anexar um
arquivo, `verifyToken()` rejeitava o token expirado e `crm-upload.js` devolvia
`{ error: 'Token inválido: ' + e.message }` — literalmente
`"Token inválido: token expirado"` — repassado cru para a tela.

## Fluxo anterior

```
crmUploadArquivo()
  → lê sessionToken do sessionStorage (pode ter 8h+)
  → POST /crm-upload { sessionToken, ... }
  → se 401: errEl.textContent = 'Erro no upload: ' + e.message   // sem retry, sem renovação
```

## Fluxo corrigido

```
crmUploadArquivo()
  → authenticatedFetch('/crm-upload', buildBody)
      → token = getValidSessionToken()          // sessionStorage.esa_session.sessionToken
      → POST /crm-upload { sessionToken: token, ..., clientRequestId }
      → se ok: retorna
      → se code ∈ {token_expired, invalid_session}:
            newToken = refreshSessionToken()      // POST /session-token { uid, login } — Path B
            POST /crm-upload { sessionToken: newToken, ..., clientRequestId }  // MESMO arquivo, retry único
      → nunca tenta uma terceira vez
  → se falha final: mensagem amigável por code; arquivo NUNCA é limpo do input
  → se sucesso: input limpo, lista de anexos atualizada, toast de sucesso
```

## Emissão do token

- `session-init.js` (login) chama `generateToken(uid, secret)` — inalterado.
- O token agora carrega `iss: 'esa-dashboard'` e `aud: 'crm-upload'` (antes só
  havia `purpose: 'crm-upload'`, mantido por compatibilidade). TTL continua
  **8 horas** — não foi aumentado (aumentar TTL reduziria segurança sem
  resolver a causa real, que era a ausência de renovação).
- Não existe um segundo token dedicado ao upload: por decisão arquitetural
  (preferência explícita desta correção), o CRM reusa o mesmo `sessionToken`
  oficial usado por `organization-context`, `energy-credits-data` e
  `organization-members`, evitando duplicar a superfície de tokens.

## Validação (`_shared/upload-session.js`)

`verifyToken()` agora lança um `Error` com propriedade `.code`:

| Situação                          | `.code`          |
|-----------------------------------|------------------|
| Token ausente / formato inválido  | `invalid_session`|
| Assinatura inválida (adulterado)  | `invalid_session`|
| Payload malformado                | `invalid_session`|
| `uid`/`iat`/`exp` ausentes/inválidos | `invalid_session`|
| `iss` incorreto                   | `invalid_session`|
| `aud` incorreto                   | `invalid_session`|
| `purpose` incorreto               | `invalid_session`|
| Token estruturalmente válido, **expirado** | `token_expired` |

A expiração é checada **por último** — só depois de toda a validação
estrutural/assinatura/issuer/audience passar — para que `token_expired` seja
reservado exclusivamente ao caso "token legítimo, só o tempo passou" (o único
caso em que a renovação automática deve disparar).

Todos os outros consumidores de `verifyToken()` (`organization-context.js`,
`organization-members.js`, `energy-credits-data.js`) continuam funcionando sem
alteração — eles usam `catch { }` genérico e nunca inspecionavam `.message`
para decisão de fluxo; a mudança é estritamente aditiva.

## Renovação

`netlify/functions/session-token.js` — endpoint único de renovação, dois
caminhos:

- **Path A** — `{ sessionToken }`: revalida um token **ainda válido** e emite
  um novo (rotação proativa). Não serve para renovar um token já expirado
  (`verifyToken` rejeitaria antes de chegar à emissão).
- **Path B** — `{ uid, login }`: usado quando o token já expirou. Revalida
  `uid`+`login` contra `users/{uid}` no Firebase (mesmo mecanismo que
  `resumeSession()` já usava para restaurar sessão) e emite um token novo.
  `uid`/`login` não são segredo — já ficavam em `sessionStorage`/`localStorage`
  desde o login; a segurança real está na consulta ao Firebase, nunca em
  confiar cegamente no corpo da requisição.

O frontend (`refreshSessionToken()` em `index.html`) sempre usa o **Path B**,
porque é o único caminho capaz de renovar um token já expirado.

## Retry

`authenticatedFetch(url, buildBody)`:

1. Envia com o token atual (ou renova primeiro se não houver nenhum).
2. Se a resposta tiver `code: token_expired` ou `code: invalid_session`, chama
   `refreshSessionToken()` **uma única vez**.
3. Repete a mesma requisição **uma única vez** com o token novo.
4. Se essa segunda tentativa também falhar, não há terceira tentativa — retorna
   o erro para a UI decidir a mensagem.

`refreshSessionToken()` deduplica chamadas concorrentes na mesma aba (uma
`Promise` em voo é compartilhada) — duas renovações simultâneas na mesma aba
resultam em **uma única** chamada de rede a `session-token`.

## Arquivo preservado durante o retry

`fileBase64` é lido do `File` **antes** da primeira tentativa de rede e mantido
em uma variável local de `crmUploadArquivo()` — o mesmo `fileBase64` (e
`file.name`/`file.type`) é reenviado no retry, sem pedir ao usuário para
selecionar o arquivo de novo. O input (`fileInput.value = ''`) só é limpo
**após sucesso confirmado**; em qualquer falha (retry falhou, renovação
falhou, erro de validação) a seleção permanece intacta.

## Segurança

Nada foi enfraquecido:

- HMAC timing-safe mantido (`crypto.timingSafeEqual`).
- Validação de expiração mantida (TTL não aumentado).
- `iss`/`aud` agora validados explicitamente (endurecimento, não redução).
- `uid` sempre vem do payload do token verificado — nunca do body
  (`crm-upload.js` ignora qualquer `uid` enviado pelo cliente; testado em
  `CU19`).
- Limite de 10 MB mantido (`MAX_BYTES`), agora retornando `413 file_too_large`
  em vez de `400`.
- Whitelist de MIME mantida, agora retornando `415 unsupported_file_type`.
- `sanitizeFileName()` mantido; `dealId` continua validado por regex sem
  separadores de path (`isValidDealId`).
- Idempotência nova (`clientRequestId`) usa regex restrita
  (`isValidClientRequestId`) — nunca vira um path arbitrário no RTDB.
- Nenhum token, secret ou conteúdo de arquivo é logado — os logs de
  diagnóstico (`[crm-upload][diag]`, `[session-token][diag]`) só emitem
  `requestId`, `code` e uid mascarado (`lu***in`).

## Variáveis Netlify

Auditadas (não modificadas nesta correção):

- `UPLOAD_SESSION_SECRET` — mesmo secret usado na emissão (`session-init.js`,
  `session-token.js`) e na validação (`crm-upload.js`, `organization-context.js`,
  `organization-members.js`, `energy-credits-data.js`); todos leem
  `process.env.UPLOAD_SESSION_SECRET` diretamente, sem fallback divergente.
- `FIREBASE_SERVICE_ACCOUNT_JSON` / `DATABASE_URL` — usados via
  `_shared/firebase-admin.js` (`getFirebaseAdminApp()`), que já resolve
  `DATABASE_URL` do ambiente com fallback seguro (corrigido em missão anterior)
  e recusa reutilizar um app Firebase incompatível.
- Nenhum secret é impresso em log. Diagnóstico seguro disponível via
  `console.info` (`requestId`, `code`, `issuerExpected`/`audienceExpected` —
  nunca o token em si).

## Mensagens ao usuário

| `code` (backend)         | Mensagem exibida                                                  |
|---------------------------|--------------------------------------------------------------------|
| `token_expired` (durante retry) | "Tivemos que renovar sua sessão. Tentando enviar novamente..." (transitória, na barra de progresso) |
| `renewal_failed`           | "Sua sessão expirou. Faça login novamente para enviar o arquivo." |
| `invalid_session`          | "Sua sessão expirou. Faça login novamente para enviar o arquivo." |
| `no_permission`            | "Sem permissão para upload no CRM."                                |
| `file_too_large`           | "O arquivo excede o limite de 10 MB."                              |
| `unsupported_file_type`    | "Formato de arquivo não permitido."                                |
| `upload_failed` (padrão)   | "Não foi possível enviar o arquivo. Tente novamente."              |

"Token inválido" nunca é exibido ao usuário final.

## Rollback

Reverter o commit `fix: renova sessao ao enviar anexos no CRM` restaura o
comportamento anterior (sem renovação automática, mensagens cruas). Não há
migração de dados envolvida — apenas código (`index.html`,
`netlify/functions/crm-upload.js`, `netlify/functions/session-token.js`,
`netlify/functions/_shared/upload-session.js`). Tokens antigos (sem `iss`/`aud`)
emitidos antes desta correção deixam de validar após o deploy — isso é
esperado e idêntico ao comportamento de qualquer expiração normal: o usuário
é levado a renovar (Path B) ou refazer login, sem exigir nenhuma ação manual
de infraestrutura.

## Checklist de produção

- [ ] `UPLOAD_SESSION_SECRET` presente em Functions, contexto Production.
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` presente, `project_id` correto.
- [ ] `DATABASE_URL` presente e apontando para a instância RTDB real (ver
      missão de diagnóstico anterior — `ORGANIZATION_CONTEXT_DIAGNOSTICS=true`
      ainda ativo para confirmação).
- [ ] Login → esperar token expirar (ou usar token de teste já expirado) →
      abrir modal de Arquivos → selecionar PDF → Enviar → confirmar renovação
      automática + retry único + anexo aparece na lista.
- [ ] Testar arquivo de 11 MB → mensagem "O arquivo excede o limite de 10 MB.".
- [ ] Testar tipo de arquivo inválido → mensagem "Formato de arquivo não
      permitido.".
- [ ] Testar usuário sem nível de CRM → mensagem "Sem permissão para upload no
      CRM.".
- [ ] Testar duas abas com sessões diferentes → cada uma renova
      independentemente.
- [ ] Confirmar que nenhum token aparece nos logs do Netlify Functions.
- [ ] Confirmar download de anexo existente continua funcionando (URL não
      mudou de formato).
