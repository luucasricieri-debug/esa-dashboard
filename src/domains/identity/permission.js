/**
 * ESA OS — Identity Domain
 * Permission
 *
 * Representa uma capacidade de acesso granular da plataforma.
 * Cada Permission define o que pode ser feito (action) sobre um recurso (resource).
 *
 * Responsabilidades:
 * - Modelar uma única regra de acesso
 * - Suportar verificação por resource + action
 * - Ser composável dentro de um Role
 * - Ser serializada/desserializada de forma independente
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Nenhuma regra comercial existente é alterada por este módulo.
 */

/**
 * Representa uma permissão da plataforma ESA.
 */
export class Permission {
  /**
   * @param {string} id       - Identificador único no formato 'resource:action' (ex: 'crm:read')
   * @param {string} resource - Recurso alvo (ex: 'crm', 'users', 'solana', 'agenda')
   * @param {string} action   - Ação permitida (ex: 'read', 'write', 'delete', 'manage', 'access')
   * @param {string} label    - Descrição legível para exibição em UI
   */
  constructor(id, resource, action, label = '') {
    this.id = id;
    this.resource = resource;
    this.action = action;
    this.label = label;
  }

  /**
   * Verifica se esta Permission cobre o recurso e ação solicitados.
   *
   * @param {string} resource
   * @param {string} action
   * @returns {boolean}
   *
   * TODO: Implementar wildcard por resource ('*') e por action ('*')
   * TODO: Suportar hierarquia de actions (ex: 'manage' implica 'read' e 'write')
   */
  matches(resource, action) {
    // TODO: implementar lógica de matching com wildcards
    return false;
  }

  /**
   * Retorna representação legível no formato 'resource:action'.
   * @returns {string}
   */
  toString() {
    // TODO: implementar
    return '';
  }

  /**
   * Serializa a Permission para objeto plano.
   * @returns {{ id: string, resource: string, action: string, label: string }}
   *
   * TODO: Integrar com camada de persistência do Identity domain
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói uma Permission a partir de objeto serializado.
   * @param {{ id: string, resource: string, action: string, label?: string }} data
   * @returns {Permission}
   *
   * TODO: Validar schema do objeto recebido antes de instanciar
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Permission('', '', '');
  }
}

/**
 * Catálogo de permissões da plataforma ESA OS.
 *
 * Organizado por domínio funcional. Cada entrada mapeia
 * diretamente a uma capacidade descrita no inventário técnico.
 *
 * TODO: Persistir catálogo no banco de dados e carregar dinamicamente.
 * TODO: Expandir conforme novos domínios (Financeiro, Engenharia, etc.) forem implementados.
 */
export const PERMISSIONS = {
  // ─── CRM ────────────────────────────────────────────────────────────────
  CRM_READ:   new Permission('crm:read',   'crm', 'read',   'Visualizar CRM'),
  CRM_WRITE:  new Permission('crm:write',  'crm', 'write',  'Criar e editar deals'),
  CRM_DELETE: new Permission('crm:delete', 'crm', 'delete', 'Remover deals'),
  CRM_MANAGE: new Permission('crm:manage', 'crm', 'manage', 'Gerenciar todo o CRM'),

  // ─── Usuários ───────────────────────────────────────────────────────────
  USERS_READ:   new Permission('users:read',   'users', 'read',   'Visualizar usuários'),
  USERS_WRITE:  new Permission('users:write',  'users', 'write',  'Criar e editar usuários'),
  USERS_DELETE: new Permission('users:delete', 'users', 'delete', 'Remover usuários'),

  // ─── Solana IA ──────────────────────────────────────────────────────────
  SOLANA_ACCESS: new Permission('solana:access', 'solana', 'access', 'Acessar Solana IA'),
  SOLANA_MANAGE: new Permission('solana:manage', 'solana', 'manage', 'Configurar Solana IA'),

  // ─── Indicadores ────────────────────────────────────────────────────────
  INDICATORS_OWN:  new Permission('indicators:own',  'indicators', 'read',   'Ver próprios indicadores'),
  INDICATORS_TEAM: new Permission('indicators:team', 'indicators', 'manage', 'Ver indicadores da equipe'),
  INDICATORS_CRM:  new Permission('indicators:crm',  'indicators', 'crm',    'Ver Indicadores CRM'),

  // ─── Prospecções ────────────────────────────────────────────────────────
  PROSPECTIONS_READ:  new Permission('prospections:read',  'prospections', 'read',  'Ver histórico de prospecções'),
  PROSPECTIONS_WRITE: new Permission('prospections:write', 'prospections', 'write', 'Registrar prospecções'),

  // ─── Agenda ─────────────────────────────────────────────────────────────
  AGENDA_READ:   new Permission('agenda:read',   'agenda', 'read',   'Visualizar agenda'),
  AGENDA_WRITE:  new Permission('agenda:write',  'agenda', 'write',  'Criar atividades'),
  AGENDA_MANAGE: new Permission('agenda:manage', 'agenda', 'manage', 'Editar qualquer atividade'),

  // ─── Time ───────────────────────────────────────────────────────────────
  TEAM_VIEW: new Permission('team:view', 'team', 'read', 'Visualizar Visão do Time'),

  // ─── Marketing ──────────────────────────────────────────────────────────
  MARKETING_READ:  new Permission('marketing:read',  'marketing', 'read',  'Ver tarefas de marketing'),
  MARKETING_WRITE: new Permission('marketing:write', 'marketing', 'write', 'Criar tarefas de marketing'),

  // ─── Oportunidades ──────────────────────────────────────────────────────
  OPPORTUNITIES_READ:  new Permission('opportunities:read',  'opportunities', 'read',  'Ver oportunidades'),
  OPPORTUNITIES_WRITE: new Permission('opportunities:write', 'opportunities', 'write', 'Criar oportunidades'),

  // ─── Proposta ───────────────────────────────────────────────────────────
  PROPOSAL_ACCESS: new Permission('proposal:access', 'proposal', 'access', 'Acessar Gerador de Proposta'),

  // ─── Relatórios ─────────────────────────────────────────────────────────
  REPORTS_ACCESS: new Permission('reports:access', 'reports', 'access', 'Acessar Relatórios'),
};
