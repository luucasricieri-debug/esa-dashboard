/**
 * ESA OS — CRM Domain
 * FollowUp
 *
 * Representa um acompanhamento estruturado de um Deal.
 * É o registro qualitativo de progresso: o que aconteceu, quem fez,
 * qual foi o resultado e quais são os próximos passos.
 *
 * Responsabilidades:
 * - Modelar o acompanhamento periódico de um Deal
 * - Registrar resultado, texto livre e dados do responsável
 * - Suportar múltiplos follow-ups por Deal (histórico cronológico)
 * - Preparar estrutura para análise futura por IA (Solana)
 * - Alimentar a linha do tempo (timeline) do Deal
 *
 * Diferença entre Activity e FollowUp:
 *   Activity → o que foi PLANEJADO ou FEITO (ligação, visita, reunião)
 *   FollowUp → o RESULTADO e PRÓXIMOS PASSOS após a interação
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * O legado armazena follow-ups em:
 *   crm/deals/{id}/historico/{key}  (CRM)
 *   prospections/{uid}/{id}/followups/{key}  (Prospecções)
 * Esta classe unifica ambos os contextos no novo modelo de domínio.
 */

/**
 * Status de progresso de um FollowUp.
 *
 * TODO: Definir transições válidas entre status como máquina de estados
 */
export const FOLLOWUP_STATUS = {
  IN_PROGRESS:      'in_progress',      // Em andamento — sem resolução definitiva
  MEETING_BOOKED:   'meeting_booked',   // Reunião agendada como próximo passo
  PROPOSAL_SENT:    'proposal_sent',    // Proposta comercial enviada ao cliente
  NEGOTIATING:      'negotiating',      // Em negociação ativa
  WON:              'won',              // Deal ganho
  LOST:             'lost',             // Deal perdido
  NO_RESPONSE:      'no_response',      // Sem resposta do cliente
};

/**
 * Tipos de FollowUp para categorização e filtragem.
 *
 * TODO: Expandir com tipos específicos de cada Pipeline (ex: 'laudo_tecnico' para O&M)
 */
export const FOLLOWUP_TYPE = {
  MANUAL:   'manual',    // Registrado manualmente pelo responsável
  CALL:     'call',      // Derivado de uma Activity do tipo CALL
  MEETING:  'meeting',   // Derivado de uma Activity do tipo MEETING
  IA:       'ia',        // Gerado ou sugerido pela Solana IA (futuro)
  SYSTEM:   'system',    // Gerado automaticamente pelo sistema (ex: mudança de etapa)
};

/**
 * Representa um acompanhamento de Deal no CRM ESA OS.
 */
export class FollowUp {
  /**
   * @param {string}      id              - Identificador único do follow-up
   * @param {string}      dealId          - ID do Deal vinculado
   * @param {string}      responsibleUid  - UID da Person que registrou
   * @param {string}      responsibleName - Nome do responsável (desnormalizado para histórico)
   * @param {string}      text            - Texto livre descrevendo o acompanhamento
   * @param {string}      status          - Status: FOLLOWUP_STATUS.*
   * @param {string}      type            - Tipo: FOLLOWUP_TYPE.*
   * @param {string}      nextStep        - Descrição do próximo passo acordado
   * @param {number|null} nextStepDate    - Data do próximo passo (timestamp ms)
   * @param {number}      createdAt       - Timestamp de criação (ms desde epoch)
   * @param {Object}      iaMetadata      - Metadados para análise futura pela Solana
   */
  constructor(
    id,
    dealId,
    responsibleUid,
    responsibleName,
    text,
    status = FOLLOWUP_STATUS.IN_PROGRESS,
    type = FOLLOWUP_TYPE.MANUAL,
    nextStep = '',
    nextStepDate = null,
    createdAt = Date.now(),
    iaMetadata = {}
  ) {
    this.id = id;
    this.dealId = dealId;
    this.responsibleUid = responsibleUid;
    this.responsibleName = responsibleName;
    this.text = text;
    this.status = status;
    this.type = type;
    this.nextStep = nextStep;
    this.nextStepDate = nextStepDate;
    this.createdAt = createdAt;
    this.iaMetadata = iaMetadata;
  }

  /**
   * Verifica se este FollowUp representa um desfecho positivo (Deal ganho).
   * @returns {boolean}
   *
   * TODO: Disparar evento 'deal:won' quando este método retornar true ao salvar
   */
  isWon() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se este FollowUp representa um desfecho negativo (Deal perdido).
   * @returns {boolean}
   *
   * TODO: Disparar evento 'deal:lost' para atualizar funil e métricas
   */
  isLost() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se há um próximo passo definido.
   * @returns {boolean}
   */
  hasNextStep() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se o próximo passo está vencido (nextStepDate no passado).
   * @returns {boolean}
   *
   * TODO: Gerar alerta automático quando próximo passo estiver vencido
   */
  isNextStepOverdue() {
    // TODO: implementar comparação com Date.now()
    return false;
  }

  /**
   * Retorna o label legível do status em português.
   * @returns {string}
   *
   * TODO: Suportar internacionalização (i18n) futuramente
   */
  getStatusLabel() {
    // TODO: implementar mapeamento de FOLLOWUP_STATUS para string pt-BR
    return '';
  }

  /**
   * Prepara os dados deste FollowUp para análise pela Solana IA.
   * @returns {Object}
   *
   * TODO: Extrair sentimento, objeções e intenção do texto usando NLP
   * TODO: Sugerir próxima ação com base no padrão de follow-ups similares
   */
  buildIAPayload() {
    // TODO: implementar estruturação de dados para envio à Solana
    return {};
  }

  /**
   * Serializa o FollowUp para objeto plano.
   * @returns {Object}
   *
   * TODO: Integrar com CRMRepository.saveFollowUp()
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói um FollowUp a partir de objeto serializado.
   * @param {Object} data
   * @returns {FollowUp}
   *
   * TODO: Validar status e type contra os enums antes de instanciar
   */
  static fromJSON(data) {
    // TODO: implementar
    return new FollowUp('', '', '', '', '');
  }
}
