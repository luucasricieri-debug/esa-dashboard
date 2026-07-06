/**
 * ESA OS — Operations Domain
 * Technician
 *
 * Representa um técnico de campo da ESA ou empresa parceira.
 *
 * Responsabilidades:
 * - Modelar o perfil técnico de um profissional de campo
 * - Registrar habilidades, certificações e habilitações
 * - Controlar vencimento de certificações críticas (NR10, NR35)
 * - Vincular ao Identity Domain (Person) para autenticação e permissões
 *
 * Certificações previstas:
 * - NR10 — Segurança em Instalações e Serviços em Eletricidade
 * - NR35 — Trabalho em Altura
 * - NR10 SEP — Sistemas Elétricos de Potência (alta tensão)
 * - CREA/CFT — Habilitação profissional
 * - Treinamentos internos ESA
 *
 * IMPORTANTE:
 * Este arquivo NÃO valida documentos reais nesta versão.
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Vínculo com Identity Domain (personId) é apenas referência — sem import direto.
 */

/**
 * Certificações e habilitações técnicas.
 *
 * TODO: Adicionar integração com sistema de controle de vencimentos
 */
export const TECHNICIAN_CERTIFICATION = {
  NR10:           'NR10',          // Segurança em eletricidade
  NR10_SEP:       'NR10_SEP',      // NR10 + SEP (alta tensão)
  NR35:           'NR35',          // Trabalho em altura
  CREA:           'CREA',          // Registro profissional de Engenharia
  CFT:            'CFT',           // Conselho Federal dos Técnicos
  EV_INSTALLER:   'EV_INSTALLER',  // Certificação de instalador de EVSE
  SOLAR_INSTALLER:'SOLAR_INSTALLER', // Certificação de instalador fotovoltaico
  FIRST_AID:      'FIRST_AID',     // Primeiros socorros
  OTHER:          'OTHER',
};

/**
 * @typedef {Object} CertificationRecord
 * @property {string}      type      - TECHNICIAN_CERTIFICATION.*
 * @property {string}      number    - Número do certificado/registro
 * @property {number}      issuedAt  - Timestamp de emissão (ms)
 * @property {number}      expiresAt - Timestamp de vencimento (ms)
 * @property {string}      issuer    - Entidade emissora
 * @property {string}      [url]     - URL do certificado digitalizado
 */

/**
 * Técnico de campo.
 */
export class Technician {
  /**
   * @param {string}                personId       - UID da Person no Identity Domain
   * @param {string}                name           - Nome completo
   * @param {string}                organizationId - ID da organização
   * @param {string[]}              skills         - Lista de habilidades (ex: 'solar', 'ev', 'battery')
   * @param {CertificationRecord[]} certifications - Certificações e habilitações
   * @param {string}                teamId         - ID da FieldTeam atual (null se sem equipe)
   * @param {boolean}               active         - Técnico ativo
   * @param {string}                phone          - Telefone de campo
   * @param {Object}                metadata       - Dados extras (vehicleId, region, notes)
   */
  constructor(
    personId       = '',
    name           = '',
    organizationId = '',
    skills         = [],
    certifications = [],
    teamId         = null,
    active         = true,
    phone          = '',
    metadata       = {}
  ) {
    /** @type {string} */
    this.id = Technician._generateId();

    this.personId       = personId;
    this.name           = name;
    this.organizationId = organizationId;
    this.skills         = skills;

    /** @type {CertificationRecord[]} */
    this.certifications = certifications;

    this.teamId  = teamId;
    this.active  = active;
    this.phone   = phone;
    this.metadata = metadata;
  }

  /**
   * Verifica se o técnico possui uma certificação específica.
   * @param {string} certification - TECHNICIAN_CERTIFICATION.*
   * @returns {boolean}
   *
   * TODO: Verificar presença em certifications por tipo
   * TODO: NÃO verificar vencimento aqui — usar hasCertificationValid()
   */
  hasCertification(certification) {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se o técnico possui uma certificação válida (não vencida).
   * @param {string} certification - TECHNICIAN_CERTIFICATION.*
   * @param {number} [atTime]      - Timestamp de avaliação (padrão: agora)
   * @returns {boolean}
   *
   * TODO: Verificar hasCertification() E expiresAt > atTime
   */
  hasCertificationValid(certification, atTime = Date.now()) {
    // TODO: implementar
    return false;
  }

  /**
   * Retorna certificações próximas do vencimento.
   * @param {number} [thresholdDays] - Alertar se vence em até N dias (padrão: 30)
   * @returns {CertificationRecord[]}
   *
   * TODO: Filtrar certifications onde expiresAt < Date.now() + thresholdDays * 86400000
   */
  getExpiringCertifications(thresholdDays = 30) {
    // TODO: implementar
    return [];
  }

  /**
   * Verifica se o técnico possui uma habilidade específica.
   * @param {string} skill
   * @returns {boolean}
   *
   * TODO: Retornar skills.includes(skill)
   */
  hasSkill(skill) {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {Object}
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {Technician}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Technician();
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
