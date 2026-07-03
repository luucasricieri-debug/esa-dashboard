/**
 * ESA OS — Identity Domain
 * Role
 *
 * Representa um papel (função) de usuário na plataforma.
 * Um Role agrupa um conjunto de Permission e define a posição
 * hierárquica de uma Person dentro da organização.
 *
 * Responsabilidades:
 * - Encapsular um conjunto coeso de Permission
 * - Definir o rank hierárquico (0 = topo)
 * - Verificar se possui determinada permissão
 * - Comparar níveis entre Roles
 * - Ser serializado para persistência
 *
 * Hierarquia atual da plataforma:
 *   rank 0 → diretor
 *   rank 1 → gestor, trafego
 *   rank 2 → executivo, sdr, jackeline, engenharia, marketing
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Os identificadores de role espelham os do legado para facilitar
 * a futura migração, mas não compartilham nenhum estado.
 */

import { PERMISSIONS } from './permission.js';

/**
 * Representa um papel de acesso na plataforma ESA.
 */
export class Role {
  /**
   * @param {string}       id          - Identificador do role (ex: 'diretor', 'gestor')
   * @param {string}       label       - Nome legível para exibição
   * @param {number}       rank        - Nível hierárquico (menor = mais alto)
   * @param {Permission[]} permissions - Lista de permissões concedidas
   */
  constructor(id, label, rank, permissions = []) {
    this.id = id;
    this.label = label;
    this.rank = rank;
    this.permissions = permissions;
  }

  /**
   * Verifica se este Role possui uma Permission pelo id.
   * @param {string} permissionId - Ex: 'crm:read'
   * @returns {boolean}
   *
   * TODO: Integrar com Permission.matches() para suportar wildcards
   */
  hasPermission(permissionId) {
    // TODO: implementar lookup por id e por wildcard
    return false;
  }

  /**
   * Retorna todas as permissões deste Role.
   * @returns {Permission[]}
   *
   * TODO: Suportar herança de permissões entre roles (ex: gestor herda de executivo)
   */
  getPermissions() {
    // TODO: implementar, incluindo herança
    return [];
  }

  /**
   * Verifica se este Role está hierarquicamente acima de outro.
   * @param {Role} otherRole
   * @returns {boolean}
   */
  isAbove(otherRole) {
    // TODO: implementar comparação de rank
    return false;
  }

  /**
   * Verifica se este Role tem acesso de gerenciamento (rank <= 1).
   * @returns {boolean}
   *
   * TODO: Extrair critério de "management" para config do domain
   */
  isManagement() {
    // TODO: implementar
    return false;
  }

  /**
   * Serializa o Role para objeto plano.
   * @returns {{ id: string, label: string, rank: number }}
   *
   * TODO: Incluir lista de permission ids na serialização
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói um Role a partir de objeto serializado.
   * @param {{ id: string, label: string, rank: number }} data
   * @returns {Role}
   *
   * TODO: Reidrataro conjunto de Permission a partir dos ids
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Role('', '', 99);
  }
}

/**
 * Catálogo de Roles da plataforma ESA OS.
 *
 * Cada Role reflete o modelo de acesso documentado no inventário técnico.
 * As permissões atribuídas a cada Role devem reproduzir fielmente
 * as regras de acesso implementadas no Dashboard legado antes da migração.
 *
 * TODO: Carregar dinamicamente do banco de dados.
 * TODO: Permitir que o Diretor customize permissões via painel de administração.
 */
export const ROLES = {
  DIRETOR: new Role(
    'diretor',
    'Diretor Comercial',
    0,
    [
      PERMISSIONS.CRM_MANAGE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_WRITE,
      PERMISSIONS.USERS_DELETE,
      PERMISSIONS.SOLANA_ACCESS,
      PERMISSIONS.SOLANA_MANAGE,
      PERMISSIONS.INDICATORS_OWN,
      PERMISSIONS.INDICATORS_TEAM,
      PERMISSIONS.INDICATORS_CRM,
      PERMISSIONS.PROSPECTIONS_READ,
      PERMISSIONS.PROSPECTIONS_WRITE,
      PERMISSIONS.AGENDA_MANAGE,
      PERMISSIONS.TEAM_VIEW,
      PERMISSIONS.MARKETING_WRITE,
      PERMISSIONS.OPPORTUNITIES_WRITE,
      PERMISSIONS.PROPOSAL_ACCESS,
      PERMISSIONS.REPORTS_ACCESS,
    ]
  ),

  GESTOR: new Role(
    'gestor',
    'Gerente',
    1,
    [
      PERMISSIONS.CRM_MANAGE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_WRITE,
      PERMISSIONS.SOLANA_ACCESS,
      PERMISSIONS.SOLANA_MANAGE,
      PERMISSIONS.INDICATORS_OWN,
      PERMISSIONS.INDICATORS_TEAM,
      PERMISSIONS.INDICATORS_CRM,
      PERMISSIONS.PROSPECTIONS_READ,
      PERMISSIONS.PROSPECTIONS_WRITE,
      PERMISSIONS.AGENDA_MANAGE,
      PERMISSIONS.TEAM_VIEW,
      PERMISSIONS.MARKETING_WRITE,
      PERMISSIONS.OPPORTUNITIES_WRITE,
      PERMISSIONS.PROPOSAL_ACCESS,
      PERMISSIONS.REPORTS_ACCESS,
    ]
  ),

  TRAFEGO: new Role(
    'trafego',
    'Gerente de Tráfego',
    1,
    [
      PERMISSIONS.CRM_MANAGE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_WRITE,
      PERMISSIONS.INDICATORS_OWN,
      PERMISSIONS.INDICATORS_TEAM,
      PERMISSIONS.INDICATORS_CRM,
      PERMISSIONS.PROSPECTIONS_READ,
      PERMISSIONS.PROSPECTIONS_WRITE,
      PERMISSIONS.AGENDA_MANAGE,
      PERMISSIONS.TEAM_VIEW,
      PERMISSIONS.MARKETING_WRITE,
      PERMISSIONS.OPPORTUNITIES_WRITE,
      PERMISSIONS.PROPOSAL_ACCESS,
      PERMISSIONS.REPORTS_ACCESS,
    ]
  ),

  EXECUTIVO: new Role(
    'executivo',
    'Executivo de Vendas',
    2,
    [
      PERMISSIONS.CRM_READ,
      PERMISSIONS.CRM_WRITE,
      PERMISSIONS.INDICATORS_OWN,
      PERMISSIONS.PROSPECTIONS_READ,
      PERMISSIONS.PROSPECTIONS_WRITE,
      PERMISSIONS.AGENDA_MANAGE,
      PERMISSIONS.OPPORTUNITIES_READ,
      PERMISSIONS.PROPOSAL_ACCESS,
      PERMISSIONS.REPORTS_ACCESS,
    ]
  ),

  SDR: new Role(
    'sdr',
    'SDR',
    2,
    [
      PERMISSIONS.INDICATORS_OWN,
      PERMISSIONS.PROSPECTIONS_READ,
      PERMISSIONS.PROSPECTIONS_WRITE,
      PERMISSIONS.AGENDA_WRITE,
      PERMISSIONS.REPORTS_ACCESS,
    ]
  ),

  JACKELINE: new Role(
    'jackeline',
    'Relações Públicas',
    2,
    [
      PERMISSIONS.INDICATORS_OWN,
      PERMISSIONS.PROSPECTIONS_READ,
      PERMISSIONS.PROSPECTIONS_WRITE,
      PERMISSIONS.AGENDA_MANAGE,
    ]
  ),

  ENGENHARIA: new Role(
    'engenharia',
    'Engenharia',
    2,
    [
      PERMISSIONS.INDICATORS_OWN,
      PERMISSIONS.PROSPECTIONS_READ,
      PERMISSIONS.PROSPECTIONS_WRITE,
      PERMISSIONS.AGENDA_WRITE,
    ]
  ),

  MARKETING: new Role(
    'marketing',
    'Marketing',
    2,
    [
      PERMISSIONS.INDICATORS_OWN,
      PERMISSIONS.PROSPECTIONS_READ,
      PERMISSIONS.PROSPECTIONS_WRITE,
      PERMISSIONS.AGENDA_WRITE,
      PERMISSIONS.MARKETING_WRITE,
    ]
  ),
};

/**
 * Resolve um Role pelo seu id string.
 * @param {string} id - Ex: 'diretor', 'gestor'
 * @returns {Role | null}
 *
 * TODO: Buscar do repositório de roles quando persistência estiver implementada
 */
export function getRoleById(id) {
  // TODO: implementar lookup dinâmico
  return null;
}
