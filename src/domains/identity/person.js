/**
 * ESA OS — Identity Domain
 * Person
 *
 * Representa uma pessoa com identidade na plataforma ESA.
 * É a entidade central do domínio Identity.
 *
 * Responsabilidades:
 * - Armazenar os dados de identidade de um usuário (uid, nome, login)
 * - Associar-se a um Role para definir capacidades de acesso
 * - Delegar verificações de permissão ao Role associado
 * - Relacionar-se com uma Organization como membro
 * - Suportar serialização independente de qualquer mecanismo de persistência
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * A classe Person não lê nem escreve em Firebase, sessionStorage ou localStorage.
 * Não contém passHash nem qualquer dado sensível de autenticação —
 * essas responsabilidades pertencem ao módulo Session.
 */

/**
 * Representa uma pessoa com identidade na plataforma.
 */
export class Person {
  /**
   * @param {string}      uid          - Identificador único da pessoa (ex: 'lucas_vizentin')
   * @param {string}      name         - Nome completo
   * @param {string}      login        - Login de acesso (ex: 'lucas.vizentin')
   * @param {Role|null}   role         - Role associado que define permissões
   * @param {string|null} gestorUid    - UID do gestor direto (null para topo da hierarquia)
   * @param {string|null} cargo        - Cargo descritivo (ex: 'Diretor Comercial')
   * @param {number|null} createdAt    - Timestamp de criação (ms desde epoch)
   * @param {string|null} createdBy    - UID de quem criou este usuário
   */
  constructor(uid, name, login, role = null, gestorUid = null, cargo = null, createdAt = null, createdBy = null) {
    this.uid = uid;
    this.name = name;
    this.login = login;
    this.role = role;
    this.gestorUid = gestorUid;
    this.cargo = cargo;
    this.createdAt = createdAt;
    this.createdBy = createdBy;
  }

  /**
   * Verifica se esta Person possui uma permissão pelo id.
   * Delega a verificação ao Role associado.
   *
   * @param {string} permissionId - Ex: 'crm:read'
   * @returns {boolean}
   *
   * TODO: Retornar false explicitamente quando role for null (sem acesso)
   * TODO: Suportar permissões concedidas individualmente (fora do Role)
   */
  hasPermission(permissionId) {
    // TODO: implementar delegação para this.role.hasPermission(permissionId)
    return false;
  }

  /**
   * Retorna o Role desta Person.
   * @returns {Role | null}
   */
  getRole() {
    // TODO: implementar
    return null;
  }

  /**
   * Verifica se esta Person está em posição de gerência (rank <= 1).
   * @returns {boolean}
   *
   * TODO: Delegar para this.role.isManagement()
   */
  isManagement() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se esta Person é superior hierarquicamente a outra.
   * @param {Person} otherPerson
   * @returns {boolean}
   *
   * TODO: Implementar via comparação de this.role.rank < otherPerson.role.rank
   */
  outranks(otherPerson) {
    // TODO: implementar
    return false;
  }

  /**
   * Retorna o primeiro nome da Person.
   * @returns {string}
   *
   * TODO: Tratar nomes compostos com partícula (ex: 'de', 'da')
   */
  getFirstName() {
    // TODO: implementar
    return '';
  }

  /**
   * Retorna as iniciais da Person para uso em avatares.
   * @returns {string}  - Ex: 'LV' para 'Lucas Vizentin'
   *
   * TODO: Tratar nomes com uma única palavra
   */
  getInitials() {
    // TODO: implementar
    return '';
  }

  /**
   * Serializa a Person para objeto plano (sem dados sensíveis).
   * @returns {{ uid: string, name: string, login: string, role: string, gestorUid: string|null }}
   *
   * TODO: Definir quais campos são públicos vs. restritos
   * TODO: Nunca incluir passHash ou tokens na serialização
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói uma Person a partir de objeto serializado.
   * Requer um Role já resolvido; não resolve role por id internamente.
   *
   * @param {Object}   data
   * @param {Role|null} resolvedRole - Role já instanciado para este uid
   * @returns {Person}
   *
   * TODO: Validar campos obrigatórios antes de instanciar
   * TODO: Integrar com RoleRepository quando disponível
   */
  static fromJSON(data, resolvedRole = null) {
    // TODO: implementar
    return new Person('', '', '');
  }
}
