/**
 * ESA OS — CRM Domain
 * Proposal
 *
 * Representa uma proposta comercial formal vinculada a um Deal.
 * É o documento que formaliza a oferta da ESA ao cliente após diagnóstico.
 *
 * Responsabilidades:
 * - Modelar os dados estruturados de uma proposta comercial
 * - Vincular a proposta a um Deal e a um cliente específico
 * - Rastrear o ciclo de vida da proposta (rascunho, enviada, aceita, recusada)
 * - Preparar estrutura para integração futura com o Gerador de Proposta
 * - Suportar versionamento de propostas (revisões)
 *
 * Relação com o Gerador de Proposta (legado):
 *   O Dashboard atual delega a geração de propostas para o app externo
 *   esa-proposal-spark.lovable.app via iframe.
 *   Esta classe NÃO se integra com esse sistema ainda.
 *   A integração será implementada como ProposalGeneratorService
 *   em etapa futura, mantendo o iframe como fallback.
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Nenhuma regra comercial do Gerador de Proposta atual é alterada.
 */

/**
 * Status do ciclo de vida de uma Proposal.
 *
 * TODO: Adicionar status EXPIRED para propostas com validade vencida
 * TODO: Adicionar status REVISED quando uma revisão substituir a proposta atual
 */
export const PROPOSAL_STATUS = {
  DRAFT:    'draft',    // Rascunho — em elaboração, não enviada ao cliente
  SENT:     'sent',     // Enviada ao cliente, aguardando retorno
  VIEWED:   'viewed',   // Cliente visualizou a proposta (rastreamento futuro)
  ACCEPTED: 'accepted', // Proposta aceita — Deal move para Fechado Ganho
  REJECTED: 'rejected', // Proposta recusada — registrar motivo para análise
  REVISED:  'revised',  // Revisada — substituída por nova versão
};

/**
 * Tipos de proposta suportados na plataforma ESA.
 *
 * TODO: Expandir com tipos específicos de cada pipeline (ex: O&M, Copel)
 */
export const PROPOSAL_TYPE = {
  UFV:          'ufv',          // Sistema fotovoltaico (venda)
  ELECTROMOB:   'electromob',   // Eletromobilidade (carregadores EV)
  SUBSCRIPTION: 'subscription', // Assinatura de Energia
  OM:           'om',           // Operação e Manutenção
  CUSTOM:       'custom',       // Proposta personalizada / outros
};

/**
 * Representa uma proposta comercial no CRM ESA OS.
 */
export class Proposal {
  /**
   * @param {string}      id              - Identificador único da proposta
   * @param {string}      dealId          - ID do Deal vinculado
   * @param {string}      type            - Tipo: PROPOSAL_TYPE.*
   * @param {string}      status          - Status: PROPOSAL_STATUS.*
   * @param {string}      clientName      - Nome do cliente destinatário
   * @param {string}      responsibleUid  - UID da Person que elaborou a proposta
   * @param {number}      value           - Valor total da proposta (R$)
   * @param {number|null} kwhValue        - Valor em kWh (para Assinatura de Energia)
   * @param {string}      description     - Escopo resumido da proposta
   * @param {string}      terms           - Condições comerciais (prazo, pagamento, garantia)
   * @param {number|null} validUntil      - Data de validade (timestamp ms)
   * @param {number}      version         - Número da versão (1 = original, 2+ = revisões)
   * @param {string|null} fileUrl         - URL do arquivo PDF gerado (Firebase Storage futuro)
   * @param {string|null} externalRefId   - ID no sistema externo (Gerador de Proposta legado)
   * @param {number}      createdAt       - Timestamp de criação (ms desde epoch)
   * @param {string}      createdBy       - UID de quem criou
   * @param {number|null} sentAt          - Timestamp de envio ao cliente
   * @param {number|null} closedAt        - Timestamp de aceite ou recusa
   */
  constructor(
    id,
    dealId,
    type,
    status = PROPOSAL_STATUS.DRAFT,
    clientName = '',
    responsibleUid = '',
    value = 0,
    kwhValue = null,
    description = '',
    terms = '',
    validUntil = null,
    version = 1,
    fileUrl = null,
    externalRefId = null,
    createdAt = Date.now(),
    createdBy = '',
    sentAt = null,
    closedAt = null
  ) {
    this.id = id;
    this.dealId = dealId;
    this.type = type;
    this.status = status;
    this.clientName = clientName;
    this.responsibleUid = responsibleUid;
    this.value = value;
    this.kwhValue = kwhValue;
    this.description = description;
    this.terms = terms;
    this.validUntil = validUntil;
    this.version = version;
    this.fileUrl = fileUrl;
    this.externalRefId = externalRefId;
    this.createdAt = createdAt;
    this.createdBy = createdBy;
    this.sentAt = sentAt;
    this.closedAt = closedAt;
  }

  /**
   * Marca a proposta como enviada ao cliente.
   * @param {string} sentBy - UID de quem enviou
   *
   * TODO: Setar status = SENT e sentAt = Date.now()
   * TODO: Disparar evento 'proposal:sent' para registro no histórico do Deal
   * TODO: Futuramente integrar com e-mail ou WhatsApp para envio automático
   */
  markAsSent(sentBy = '') {
    // TODO: implementar
  }

  /**
   * Registra aceite da proposta pelo cliente.
   * @param {string} acceptedBy - UID de quem registrou o aceite
   *
   * TODO: Setar status = ACCEPTED e closedAt = Date.now()
   * TODO: Disparar evento 'proposal:accepted' que fechará o Deal como WON
   */
  accept(acceptedBy = '') {
    // TODO: implementar
  }

  /**
   * Registra recusa da proposta pelo cliente.
   * @param {string} reason      - Motivo da recusa
   * @param {string} rejectedBy  - UID de quem registrou a recusa
   *
   * TODO: Setar status = REJECTED e closedAt = Date.now()
   * TODO: Armazenar motivo para análise de win/loss
   */
  reject(reason, rejectedBy = '') {
    // TODO: implementar
  }

  /**
   * Cria uma revisão desta proposta, incrementando o version.
   * @returns {Proposal} - Nova instância com version + 1 e status = DRAFT
   *
   * TODO: Marcar a proposta atual como REVISED antes de retornar a revisão
   * TODO: Copiar todos os campos e resetar sentAt, closedAt
   */
  createRevision() {
    // TODO: implementar
    return new Proposal('', this.dealId, this.type);
  }

  /**
   * Verifica se a proposta ainda está dentro do prazo de validade.
   * @returns {boolean}
   *
   * TODO: Considerar fuso horário da organização
   */
  isValid() {
    // TODO: implementar comparação de validUntil com Date.now()
    return false;
  }

  /**
   * Verifica se a proposta está em estado terminal (aceita, recusada ou revisada).
   * @returns {boolean}
   */
  isTerminal() {
    // TODO: implementar
    return false;
  }

  /**
   * Retorna o valor efetivo a ser exibido nos indicadores.
   * @returns {{ amount: number, unit: 'BRL' | 'kWh' }}
   *
   * TODO: Resolver unidade via tipo do Pipeline
   */
  getEffectiveValue() {
    // TODO: implementar
    return { amount: 0, unit: 'BRL' };
  }

  /**
   * Serializa a Proposal para objeto plano.
   * @returns {Object}
   *
   * TODO: Integrar com CRMRepository.saveProposal()
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói uma Proposal a partir de objeto serializado.
   * @param {Object} data
   * @returns {Proposal}
   *
   * TODO: Validar status e type contra os enums antes de instanciar
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Proposal('', '', PROPOSAL_TYPE.CUSTOM);
  }
}
