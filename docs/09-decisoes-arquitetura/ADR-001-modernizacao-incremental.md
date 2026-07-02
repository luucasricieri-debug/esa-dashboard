# ADR-001 — Modernização Incremental da ESA Business Platform

## Status

✅ Aprovado

---

## Contexto

A ESA já possui uma plataforma comercial operacional utilizada diariamente pelo time.

Essa plataforma contém:

- CRM
- Dashboard
- Agenda
- Metas
- Indicadores
- Funis Comerciais
- Solana IA
- Firebase
- Upload de Arquivos
- Controle de Usuários
- Controle de Permissões

Grande parte dessa lógica encontra-se atualmente concentrada em um único arquivo (`index.html`), funcionando como um monólito operacional.

O objetivo do projeto NÃO é reescrever esse sistema do zero.

O objetivo é transformá-lo, gradualmente, em um ERP corporativo.

---

## Decisão

A ESA Business Platform será construída através de Modernização Incremental.

Todo módulo novo será criado na nova arquitetura.

O sistema atual continuará funcionando até que cada módulo seja substituído.

Nenhuma regra comercial poderá ser perdida durante esse processo.

---

## Princípios

• Preservar a operação do Comercial.

• Não alterar regras de negócio sem documentação.

• Não alterar indicadores sem validação.

• Toda funcionalidade nova deverá possuir documentação.

• Segurança será requisito obrigatório.

• Todos os módulos deverão reutilizar componentes sempre que possível.

---

## Objetivo Final

Transformar o Dashboard ESA na ESA Business Platform.

Um ERP completo voltado ao setor de energia.
