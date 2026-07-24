# CRM — Confiabilidade da Autenticação de Upload de Anexos

## Login mobile: autenticação por login interno OU e-mail cadastrado (missão mais recente)

### Incidente

No acesso mobile, o autofill do navegador preenche o campo **Login** com o
e-mail cadastrado do usuário (ex.: `lucas@esacapitalenergia.com.br`). O
sistema retornava "Usuário não encontrado.", mesmo o usuário existindo —
cadastrado com o login interno `lucas_vizentin`.

### Causa

`doLogin()` (`index.html`) e `resolveUserByLogin()`
(`netlify/functions/_shared/user-identity.js`) só comparavam o identificador
digitado contra o campo `login` de cada registro em `users/{uid}` — nunca
contra `email`. Um usuário com `login: "lucas_vizentin"` e
`email: "lucas@esacapitalenergia.com.br"` só conseguia entrar digitando
exatamente `lucas_vizentin`; qualquer outra forma (o próprio e-mail,
preenchido automaticamente pelo navegador) resultava em "não encontrado".

O campo `email` já existia e era usado em outro lugar do sistema
(`organization-members.js:177`, `login = u.login || u.email || ''`, como
fallback de exibição) — confirmando que é um campo real do schema, não
inventado para esta correção.

### Campo usado no Firebase

`users/{uid}.email` (string) — o único campo de e-mail realmente encontrado
no banco (não existe `.mail` nem variações; não inventamos nenhum). Quando
ausente, o usuário só pode ser resolvido por `login`.

### Resolução canônica

Nova fonte única: [`assets/user-identity-resolution.js`](../assets/user-identity-resolution.js)
(UMD — usada por backend via `require()` e por `index.html` via
`<script src="/assets/user-identity-resolution.js">`, mesmo padrão de
`performance-goals.js`/`lead-origin.js`/`attendance-performance.js`).

`resolveUserIdentifier(usersMap, identifier)`:

1. Normaliza o identificador: `trim()` + minúsculas (só para comparação —
   nunca altera o valor original armazenado).
2. Compara contra `login` de cada registro — correspondência **exata**
   (nunca substring/prefixo). Exatamente 1 resultado → resolve. Mais de 1
   (conflito de dados) → falha segura (`null`).
3. Se não resolveu por login, compara contra `email` — mesma regra de
   correspondência exata e falha segura em conflito.
4. Se ainda não resolveu, tenta o identificador como uid direto: só quando
   ele não contém caracteres proibidos em chave do Firebase (`. # $ [ ] /`)
   e existe literalmente como chave em `usersMap`.
5. **Nunca** usa `displayName`/`name` para resolução — esses campos são
   apenas para exibição.

`resolveUserByLogin(db, identifier)` (`_shared/user-identity.js`) agora só
faz a leitura (`db.ref('users').once('value')`) e delega toda a lógica de
correspondência a `resolveUserIdentifier()` — garantindo que backend e
frontend usem exatamente a mesma regra, sem risco de divergência futura.

`canonicalSessionLogin(user)` retorna `user.login` quando presente, ou
`user.email` como alternativa (usuário legado só com e-mail) — usado para
persistir o identificador de sessão (nunca o texto bruto digitado, que pode
ter sido o e-mail mesmo para um usuário com login interno cadastrado).

### Usuários legados

Cenários suportados (apenas os realmente possíveis no schema atual):
usuário com `login` e `email`; usuário só com `login` (sem `email`);
usuário só com `email` (sem `login` — resolvido e sessão mantida via
`canonicalSessionLogin`); `uid` (chave do Firebase) diferente do valor do
campo `login`. **Não inventamos** suporte a campos como `.mail` ou a
"login contendo e-mail" como um caso especial — um `login` que por acaso
tenha formato de e-mail já funciona normalmente, pois a comparação é sempre
por valor exato do campo, não por formato.

Diagnóstico somente leitura:
[`scripts/diagnose-users-without-email.js`](../scripts/diagnose-users-without-email.js)
— conta usuários com/sem `email`, com/sem `login`, e o caso extremo sem
nenhum dos dois (inacessível por identificador) — nunca expõe e-mail/login
completos (sempre mascarados), nunca escreve no Firebase. **Não executado
contra produção real nesta sessão** (sem `FIREBASE_SERVICE_ACCOUNT_JSON`/
`DATABASE_URL` neste ambiente, mesma limitação de todo diagnóstico já criado
neste projeto).

### Mobile e autofill

Campo de login (`index.html`, tela de autenticação):

```html
<input type="text" id="auth-login" placeholder="seu.login ou e-mail"
  autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false">
<div>Use seu login ou e-mail cadastrado.</div>
```

- `autocomplete="username"` (não `"email"`) — o campo aceita AMBOS os
  formatos; usar `"email"` sinalizaria erroneamente ao navegador/gerenciador
  de senhas que só e-mail é aceito.
- `type="text"` preservado — nunca `type="email"`, que alguns navegadores
  validam/formatam de forma a atrapalhar um login interno com underscore.
- `autocapitalize="off"`/`autocorrect="off"`/`spellcheck="false"` — evita que
  o teclado mobile capitalize a primeira letra ou "corrija" o login.
- **`inputmode="email"` deliberadamente NÃO foi usado**: embora acrescente
  atalhos de teclado (`@`, `.com`) em dispositivos móveis, não há garantia,
  testável a partir deste ambiente, de que todos os teclados mobile mantêm o
  underscore igualmente acessível nesse modo — a decisão conservadora foi
  não arriscar a entrada de `lucas_vizentin`. Reavaliar apenas com teste real
  em dispositivos físicos.
- Nenhum código de `doLogin()`/`resolveUserIdentifier()` filtra, substitui ou
  trunca o caractere `_` em nenhum momento — o underscore é preservado
  integralmente do input até a comparação.

### Mensagens

Mensagem única e genérica para qualquer falha de identificação/senha:
**"Usuário ou senha inválidos."** — usada em `doLogin()` (index.html) e em
`session-init.js` (antes: "Login ou senha inválidos", "Usuário não
encontrado.", "Senha incorreta." — três mensagens distintas que permitiam
enumerar contas existentes por tentativa/erro). Nunca mais diferenciar
"usuário não encontrado" de "senha incorreta" em nenhuma resposta visível ao
usuário.

### Token de sessão

Após resolver por e-mail, o token continua sendo emitido com o **uid
canônico** (a chave do Firebase, nunca o e-mail) — `generateToken(userKey,
secret)`, inalterado. `session-token.js` (Path B, renovação por uid+login)
passou a comparar contra `canonicalSessionLogin(user)` (login OU e-mail),
não mais só `user.login` — preserva a renovação para usuários legados que só
têm e-mail cadastrado. Upload do CRM (`crm-upload.js`) e resolução de
contexto organizacional (`organization-members.js`) não foram alterados e
continuam funcionando sem alteração (validado com os mesmos testes
existentes, mais os novos cenários desta missão).

### Validação em produção

1. Rodar `node scripts/diagnose-users-without-email.js` com credenciais
   reais para confirmar quantos usuários ainda dependem exclusivamente do
   login interno.
2. Em um celular real, deixar o navegador preencher o campo Login via
   autofill com o e-mail cadastrado de um usuário real (ex.: Lucas
   Vizentin) → confirmar login bem-sucedido, sem "Usuário não encontrado.".
3. Repetir o login digitando manualmente o login interno (`lucas_vizentin`)
   → confirmar que continua funcionando exatamente como antes.
4. Testar e-mail com letras maiúsculas e com espaços acidentais (comum em
   autofill/copy-paste) → confirmar que ainda resolve.
5. Testar senha incorreta e e-mail/login inexistente → confirmar a MESMA
   mensagem genérica nos dois casos.
6. Confirmar que o token emitido tem o uid canônico (não o e-mail) — via
   `CRM_UPLOAD_AUTH_DIAGNOSTICS=true`, campo `uidPresent`/`loginPresent`.
7. Confirmar que upload de CRM e troca/seleção de organização continuam
   funcionando normalmente para um usuário que logou por e-mail.
8. Confirmar visualmente, em um teclado mobile real, que o campo login ainda
   permite digitar `_` sem dificuldade extra.

## 0. HTTP 401 para alguns usuários (missão de resolução canônica de identidade)

A correção anterior (renovação automática, ver seção "Causa raiz" abaixo)
resolveu o "Token inválido: token expirado" — mas outros usuários continuaram
recebendo `401` genérico ("HTTP 401") ao anexar arquivos.

### Qual endpoint retornava 401 e em qual etapa

`crm-upload.js`, na etapa `upload_initial_auth` (validação inicial do token,
antes de qualquer verificação de permissão). Para os usuários afetados, a
tentativa de renovação (`session-token.js`, Path B) **também falhava**, sem
sequer chegar a fazer uma chamada de rede — ver causa exata abaixo.

### Por que afetava apenas alguns usuários

`doLogin()` (`index.html`) e `session-init.js` resolviam o **uid da sessão**
a partir do **campo** `.uid` dentro do valor do registro em
`users/{alguma-chave}` (`Object.values(users).find(u => u.login === login)`),
em vez da **chave** do Firebase sob a qual o registro está armazenado
(`Object.entries(users).find(([key, u]) => ...)`).

Isso funcionava perfeitamente para usuários cujo registro tinha `.uid` igual
à própria chave (o caso comum, e o único caso testado antes). Falhava
silenciosamente para:

- usuários **legados**, cujo registro nunca teve o campo `.uid` preenchido
  (criados antes dessa convenção existir);
- usuários cujo campo `.uid` divergisse da chave real (registro criado/
  editado manualmente no Firebase, ou por um fluxo antigo).

### Schema dos tokens afetados

Como `JSON.stringify` descarta chaves com valor `undefined`,
`generateToken(undefined, secret)` — o que acontecia quando `user.uid` era
`undefined` — produzia um token HMAC **estruturalmente válido e assinado
corretamente**, mas cujo payload **literalmente não continha a claim `uid`**:
`{"iat":...,"exp":...,"purpose":"crm-upload","iss":"esa-dashboard","aud":"crm-upload","version":2}`
— sem `"uid"` nenhum. `verifyToken()` sempre rejeitou isso (`!payload.uid`),
mas antes desta correção classificava como `invalid_session` genérico —
agora classificado especificamente como **`legacy_session`**.

### Diferença entre uid e login

`login` é o identificador que o usuário digita (estável, escolhido por ele).
`uid` é — e sempre deveria ter sido tratado como — a **chave do Firebase**
sob `users/{uid}`, nunca um campo redundante dentro do valor. Nesta correção,
`uid` deixou de ser lido de qualquer campo e passou a ser **sempre** a chave
resolvida por varredura de `login` (`resolveUserByLogin()`).

### Causa exata

1. `doLogin()`/`session-init.js` resolviam uid via `Object.values(...).find(...).uid`.
2. Para um registro sem `.uid`, `_sessObj.uid` (e o token gerado) ficavam sem uid utilizável.
3. `crm-upload.js` rejeitava esse token (`legacy_session`).
4. `authenticatedFetch()` tentava renovar via `refreshSessionToken()` (Path B),
   que também lê `sess.uid` do `sessionStorage` — **igualmente ausente** —
   então `refreshSessionToken()` lançava `renewal_failed` **sem nunca chamar
   `session-token.js`**. O usuário nunca conseguia se recuperar, nem
   tentando de novo, nem em outra aba, nem apenas esperando.

### Função corrigida

- `netlify/functions/_shared/user-identity.js` (novo):
  `resolveUserByLogin(db, login)` — varre `users`, retorna sempre `{ uid: <chave>, user }`.
  `resolveAuthenticatedUserIdentity(db, sessionToken, secret)` — resolução
  canônica usada por `crm-upload.js`: valida o token, extrai uid do payload
  já verificado, confirma usuário ativo, retorna `{ uid, user, role, tokenVersion }`.
- `session-init.js` — usa `resolveUserByLogin()` para emitir o token com a
  CHAVE como uid, nunca `userEntry.uid`.
- `index.html` — `doLogin()`/`resumeSession()` corrigidos da mesma forma:
  `CU.uid` e `sessionStorage.esa_session.uid` são sempre a chave resolvida,
  nunca o campo `.uid` do registro (que pode faltar).

### Compatibilidade com sessão legada

Sessões **já emitidas** antes desta correção, para usuários sem `.uid`, não
são aceitas silenciosamente nem migradas automaticamente — falham com
`legacy_session` e exigem **um novo login**. Como `doLogin()`/`session-init.js`
agora sempre resolvem a chave corretamente, o próximo login desse mesmo
usuário já emite um token totalmente funcional — sem qualquer migração de
dados no Firebase (o registro do usuário nunca precisou ser alterado; só a
forma de RESOLVER o uid a partir dele).

### Padronização de erros (todos os endpoints envolvidos)

Toda resposta de erro do fluxo de upload agora é JSON com `ok`, `code`,
`stage`, `message`, `requestId`:

| status | code | stage | mensagem |
|---|---|---|---|
| 401 | `token_expired` | `upload_initial_auth` | Sessão expirada. |
| 401 | `legacy_session` | `upload_initial_auth` ou `session_refresh` | Sua sessão precisa ser atualizada. |
| 401 | `invalid_session` | `upload_initial_auth` ou `session_refresh` | Sessão inválida. |
| 403 | `no_permission` | `permission_check` | Usuário sem permissão. |

Nunca `HTTP 401` cru; nunca HTML em erro esperado.

### Retry (reforçado)

`AUTH_RETRYABLE_CODES = ['token_expired', 'invalid_session', 'legacy_session']`
— `authenticatedFetch()` tenta renovar (uma única vez) para estes três; nunca
para `no_permission` nem para erros de payload (`file_too_large` etc.).
`parseAuthResponse()` (novo) lê `response.text()` primeiro e só então tenta
`JSON.parse` — nunca chama `response.json()` direto (que lançaria em corpo
vazio/HTML) — preserva `status`/`code`/`stage`/`requestId` mesmo quando o
corpo não é JSON válido.

### Múltiplas abas

`sessionStorage` é isolado por aba por natureza do browser —
`getStoredSession()`/`getValidSessionToken()` sempre leem o valor mais
recente no momento do envio (nunca um valor capturado na abertura do modal),
então cada aba renova seu próprio token de forma independente sem afetar as
demais (testado em `RP23`, `FR23-26`).

### Permissões

`no_permission` continua sendo sempre `403`, nunca `401` — confirmado que
nenhuma role autorizada (`diretor`, `trafego`, `gestor`, `engenharia`,
`executivo`, `sdr`, `jackeline`) foi afetada pela correção; o problema nunca
foi de permissão, sempre de resolução de identidade.

### Diagnóstico

Flag `CRM_UPLOAD_AUTH_DIAGNOSTICS=true` (`_shared/auth-diagnostics.js`) —
quando ativa, inclui um campo `diagnostics` nas respostas 401/403 de
`crm-upload.js`/`session-token.js` com `tokenPresent`, `tokenVersion`,
`uidPresent`, `loginPresent`, `issuerValid`, `audienceValid`, `expired`,
`refreshAttempted`, `refreshSucceeded` — nunca o token, a assinatura, o
secret ou conteúdo de arquivo.

`scripts/diagnose-crm-upload-user.js` (novo, somente leitura) — compara um
usuário que funciona com um que falha: existência em `users/{uid}` e
`users/{login}`, se o campo `.uid` está presente e bate com a chave,
capacidade de renovação via Path B, aliases de login duplicados. **Não
executado contra produção real nesta sessão** (sem
`FIREBASE_SERVICE_ACCOUNT_JSON`/`DATABASE_URL` neste ambiente).

## Causa raiz (missão anterior — renovação automática)

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
| `renewal_failed`           | "Sua sessão não pôde ser renovada. Entre novamente e tente enviar o arquivo." |
| `invalid_session`          | "Sua sessão não pôde ser renovada. Entre novamente e tente enviar o arquivo." |
| `legacy_session`           | "Sua sessão não pôde ser renovada. Entre novamente e tente enviar o arquivo." |
| `no_permission`            | "Sem permissão para upload no CRM."                                |
| `file_too_large`           | "O arquivo excede o limite de 10 MB."                              |
| `unsupported_file_type`    | "Formato de arquivo não permitido."                                |
| `upload_failed` (padrão)   | "Não foi possível enviar o arquivo. Tente novamente."              |

"Token inválido" e "HTTP 401" nunca são exibidos ao usuário final.

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

### Validação adicional desta missão (resolução canônica de identidade)

- [ ] Rodar `node scripts/diagnose-crm-upload-user.js --uid <uid> --login <login>`
      para o usuário que hoje recebe 401, comparando com um que funciona —
      confirmar `storedUidFieldPresent`/`storedUidFieldMatchesKey`.
- [ ] Para o usuário afetado: logout completo (fechar todas as abas) → login
      → abrir Deal → anexar PDF → confirmar 200 (upload funciona pela
      primeira vez).
- [ ] Repetir para Lucas Vizentin, Fernando Fadel, um usuário que já
      funcionava, e o usuário antes bloqueado — todos devem funcionar
      igualmente após um novo login.
- [ ] Confirmar que sessões antigas (sem novo login) continuam recebendo
      `legacy_session` de forma clara, nunca "HTTP 401" cru.
- [ ] Ativar `CRM_UPLOAD_AUTH_DIAGNOSTICS=true` temporariamente se qualquer
      caso permanecer obscuro; desativar depois de confirmado.
