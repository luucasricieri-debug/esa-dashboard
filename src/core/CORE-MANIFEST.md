# Core Manifest

## Objetivo

Este documento define os componentes oficiais do ESA Core v2.

---

## Arquivos previstos

### app.js
Responsável pela inicialização da aplicação v2.

### session.js
Responsável por sessão, persistência temporária e recuperação de usuário logado.

### auth.js
Responsável por autenticação.

### permissions.js
Responsável por autorização e regras de acesso.

### events.js
Responsável pelo registro de eventos internos da plataforma.

### audit.js
Responsável por trilha de auditoria.

### config.js
Responsável por configurações globais da aplicação.

---

## Regra

Nenhum arquivo do Core deverá alterar comportamento do sistema atual até ser explicitamente conectado ao `index.html`.

---

## Status

Planejado.