# ESA Core v2

## Objetivo

O ESA Core v2 é o núcleo da evolução da ESA Dashboard para ESA OS.

Ele será desenvolvido em paralelo ao sistema atual, sem quebrar o `index.html` existente.

---

## Responsabilidades do Core

- Inicialização da aplicação
- Sessão do usuário
- Autenticação
- Permissões
- Auditoria
- Eventos
- Configurações globais
- Integrações compartilhadas

---

## Regra de Ouro

Nenhum módulo novo deverá acessar diretamente dados, permissões ou serviços externos sem passar pelo Core.

---

## Estratégia

O Core v2 será introduzido de forma incremental.

Primeiro criaremos os arquivos e contratos.

Depois conectaremos serviços.

Depois migraremos funcionalidades do `index.html`, uma por vez.

---

## Status

Em construção.