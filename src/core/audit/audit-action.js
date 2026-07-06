/**
 * ESA OS — Core / Audit
 * AuditAction
 *
 * Catálogo de ações auditáveis da plataforma ESA OS.
 * Define o vocabulário controlado de operações registradas na trilha de auditoria.
 *
 * Responsabilidades:
 * - Centralizar todos os tipos de ação reconhecidos pelo sistema de auditoria
 * - Prover metadados (label, categoria) para cada ação
 * - Ser a única fonte de verdade — nunca usar strings literais nos módulos
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não altera nenhum comportamento da aplicação em produção.
 */

/**
 * Ações auditáveis disponíveis na plataforma.
 *
 * TODO: Expandir conforme novos domains forem implementados
 * TODO: Persistir catálogo no banco para consulta via painel de compliance
 */
export const AUDIT_ACTION = {
  // ─── Dados ────────────────────────────────────────────────────────────────
  CREATE:  'CREATE',   // Criação de um recurso
  READ:    'READ',     // Leitura ou consulta de um recurso
  UPDATE:  'UPDATE',   // Atualização parcial ou total de um recurso
  DELETE:  'DELETE',   // Remoção de um recurso

  // ─── Sessão ───────────────────────────────────────────────────────────────
  LOGIN:   'LOGIN',    // Autenticação bem-sucedida
  LOGOUT:  'LOGOUT',   // Encerramento de sessão

  // ─── Controle de acesso ───────────────────────────────────────────────────
  ACCESS:  'ACCESS',   // Acesso a módulo ou recurso restrito

  // ─── Transferência de dados ───────────────────────────────────────────────
  EXPORT:  'EXPORT',   // Exportação de dados (CSV, iCal, PDF)
  IMPORT:  'IMPORT',   // Importação de dados externos

  // ─── Fluxo ────────────────────────────────────────────────────────────────
  MOVE:    'MOVE',     // Movimentação (ex: deal entre etapas do CRM)
  APPROVE: 'APPROVE',  // Aprovação de uma solicitação ou documento
  REJECT:  'REJECT',   // Rejeição de uma solicitação ou documento

  // ─── Execução ─────────────────────────────────────────────────────────────
  EXECUTE: 'EXECUTE',  // Execução de processo automatizado ou ação de IA
};

/**
 * Categoria de cada ação para agrupamento em relatórios de auditoria.
 *
 * TODO: Usar em filtros do painel de compliance
 */
export const AUDIT_ACTION_CATEGORY = {
  [AUDIT_ACTION.CREATE]:  'data',
  [AUDIT_ACTION.READ]:    'data',
  [AUDIT_ACTION.UPDATE]:  'data',
  [AUDIT_ACTION.DELETE]:  'data',
  [AUDIT_ACTION.LOGIN]:   'session',
  [AUDIT_ACTION.LOGOUT]:  'session',
  [AUDIT_ACTION.ACCESS]:  'access',
  [AUDIT_ACTION.EXPORT]:  'transfer',
  [AUDIT_ACTION.IMPORT]:  'transfer',
  [AUDIT_ACTION.MOVE]:    'flow',
  [AUDIT_ACTION.APPROVE]: 'flow',
  [AUDIT_ACTION.REJECT]:  'flow',
  [AUDIT_ACTION.EXECUTE]: 'automation',
};
