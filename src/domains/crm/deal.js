/**
 * ESA OS — CRM Domain
 * Deal
 *
 * Representa uma oportunidade comercial no CRM ESA OS.
 * É a entidade central do domínio CRM.
 *
 * Responsabilidades:
 * - Armazenar todos os atributos de uma oportunidade comercial
 * - Gerenciar o ciclo de vida do Deal (etapas, status, histórico)
 * - Agregar Activity e FollowUp vinculados
 * - Calcular probabilidade e previsão de fechamento
 * - Rastrear a origem e o responsável pela captação
 * - Suportar anexos e documentos relacionados
 *
 * Ciclo de vida de um Deal:
 *   Criado → [Etapas do Pipeline] → Fechado Ganho | Fechado Perdido | Pausado
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * O legado armazena deals em crm/deals/{id} no Firebase RTDB com
 * campos: nome, empresa, telefone, valor, produto, funil, etapa,
 * status, responsavel, captador, historico.
 * Esta classe representa o modelo evoluído, sem acoplamento ao legado.
 */

import { FOLLOWUP_STATUS } from './followup.js';

/**
 * Status macro de um Deal ao longo de seu ciclo de vida.
 *
 * TODO: Sincronizar com STAGE_TYPE (WON / LOST) para consistência ao fechar
 */
export const DEAL_STATUS = {
  OPEN:    'open',    // Ativo e em progresso no funil
  WON:     'won',     // Fechado com sucesso
  LOST:    'lost',    // Perdido — sem conversão
  PAUSED:  'paused',  // Pausado temporariamente (ex: aguardando cliente)
};

/**
 * Origens possíveis de um Deal para rastreamento de canal.
 *
 * TODO: Tornar configurável por Pipeline e por Organization
 * TODO: Integrar com UTM tracking quando leads vierem de campanhas digitais
 */
export const DEAL_ORIGIN = {
  PROSPECTION:  'prospection',  // Gerado via módulo de Prospecção
  REFERRAL:     'referral',     // Indicação de cliente ou parceiro
  INBOUND:      'inbound',      // Lead inbound (site, landing page)
  CAMPAIGN:     'campaign',     // Campanha de marketing (tráfego pago)
  MANUAL:       'manual',       // Cadastrado manualmente sem origem definida
  IMPORT:       'import',       // Importado via CSV
};

/**
 * Representa uma oportunidade comercial no CRM ESA OS.
 */
export class Deal {
  /**
   * @param {string}      id              - Identificador único do Deal
   * @param {string}      title           - Título descritivo (ex: 'João Silva — Venda UFV')
   * @param {string}      clientName      - Nome do cliente (pessoa física ou jurídica)
   * @param {string}      clientCompany   - Empresa do cliente (opcional)
   * @param {string}      clientPhone     - Telefone de contato
   * @param {string}      responsibleUid  - UID da Person responsável pelo Deal
   * @param {string}      captorUid       - UID da Person que captou o lead (pode diferir do responsável)
   * @param {string}      stageId         - ID da Stage atual no Pipeline
   * @param {string}      pipelineId      - ID do Pipeline ao qual pertence
   * @param {string}      status          - Status macro: DEAL_STATUS.*
   * @param {number}      value           - Valor monetário estimado (R$)
   * @param {number|null} kwhValue        - Valor em kWh (específico para Assinatura de Energia)
   * @param {string}      product         - Produto negociado (ex: 'Venda UFV', 'Assinatura')
   * @param {string}      origin          - Canal de origem: DEAL_ORIGIN.*
   * @param {number}      probability     - Probabilidade de fechamento (0–100)
   * @param {number|null} forecastDate    - Previsão de fechamento (timestamp ms)
   * @param {string}      notes           - Observações gerais sobre o Deal
   * @param {Activity[]}  activities      - Lista de atividades vinculadas
   * @param {FollowUp[]}  followups       - Lista de follow-ups vinculados
   * @param {Object[]}    attachments     - Arquivos anexados (nome, url, tipo, tamanho)
   * @param {number}      createdAt       - Timestamp de criação (ms desde epoch)
   * @param {string}      createdBy       - UID de quem criou o Deal
   * @param {number|null} closedAt        - Timestamp de fechamento (ms desde epoch)
   */
  constructor(
    id,
    title,
    clientName,
    clientCompany = '',
    clientPhone = '',
    responsibleUid = '',
    captorUid = '',
    stageId = '',
    pipelineId = '',
    status = DEAL_STATUS.OPEN,
    value = 0,
    kwhValue = null,
    product = '',
    origin = DEAL_ORIGIN.MANUAL,
    probability = 0,
    forecastDate = null,
    notes = '',
    activities = [],
    followups = [],
    attachments = [],
    createdAt = Date.now(),
    createdBy = '',
    closedAt = null
  ) {
    this.id = id;
    this.title = title;
    this.clientName = clientName;
    this.clientCompany = clientCompany;
    this.clientPhone = clientPhone;
    this.responsibleUid = responsibleUid;
    this.captorUid = captorUid;
    this.stageId = stageId;
    this.pipelineId = pipelineId;
    this.status = status;
    this.value = value;
    this.kwhValue = kwhValue;
    this.product = product;
    this.origin = origin;
    this.probability = probability;
    this.forecastDate = forecastDate;
    this.notes = notes;
    this.activities = activities;
    this.followups = followups;
    this.attachments = attachments;
    this.createdAt = createdAt;
    this.createdBy = createdBy;
    this.closedAt = closedAt;
  }

  /**
   * Move o Deal para uma nova Stage.
   * @param {string} stageId - ID da Stage destino
   * @param {string} movedBy - UID de quem realizou o movimento
   *
   * TODO: Validar transição via Stage.canTransitionTo() antes de mover
   * TODO: Registrar movimento no histórico como Activity de tipo SYSTEM
   * TODO: Recalcular probability com base na nova Stage
   * TODO: Disparar evento 'deal:stage-changed' para atualizar métricas do Pipeline
   */
  moveToStage(stageId, movedBy = '') {
    // TODO: implementar
  }

  /**
   * Fecha o Deal como ganho.
   * @param {number} finalValue - Valor final fechado (pode diferir de value estimado)
   * @param {string} closedBy   - UID de quem fechou
   *
   * TODO: Setar status = DEAL_STATUS.WON e closedAt = Date.now()
   * TODO: Mover para Stage terminal 'closed_won' automaticamente
   * TODO: Disparar evento 'deal:won' para Metrics e Forecast
   */
  close(finalValue, closedBy = '') {
    // TODO: implementar
  }

  /**
   * Fecha o Deal como perdido.
   * @param {string} reason  - Motivo da perda (obrigatório para análise)
   * @param {string} lostBy  - UID de quem registrou a perda
   *
   * TODO: Setar status = DEAL_STATUS.LOST e closedAt = Date.now()
   * TODO: Persistir motivo para análise de churn e melhoria do funil
   * TODO: Disparar evento 'deal:lost' para Metrics
   */
  markAsLost(reason, lostBy = '') {
    // TODO: implementar
  }

  /**
   * Pausa o Deal temporariamente.
   * @param {string} reason  - Motivo da pausa
   *
   * TODO: Setar status = DEAL_STATUS.PAUSED
   * TODO: Registrar data de pausa para calcular tempo total ativo
   */
  pause(reason = '') {
    // TODO: implementar
  }

  /**
   * Retoma um Deal pausado.
   *
   * TODO: Setar status = DEAL_STATUS.OPEN
   * TODO: Sugerir próxima Activity via Solana após retomada
   */
  resume() {
    // TODO: implementar
  }

  /**
   * Verifica se o Deal está em aberto (ativo no funil).
   * @returns {boolean}
   */
  isOpen() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se o Deal foi fechado (ganho ou perdido).
   * @returns {boolean}
   */
  isClosed() {
    // TODO: implementar
    return false;
  }

  /**
   * Adiciona uma Activity ao Deal.
   * @param {Activity} activity
   *
   * TODO: Validar que activity.dealId === this.id antes de adicionar
   */
  addActivity(activity) {
    // TODO: implementar
  }

  /**
   * Adiciona um FollowUp ao Deal.
   * @param {FollowUp} followup
   *
   * TODO: Validar que followup.dealId === this.id
   * TODO: Atualizar status do Deal com base no status do FollowUp se for WON ou LOST
   */
  addFollowUp(followup) {
    // TODO: implementar
  }

  /**
   * Adiciona um anexo ao Deal.
   * @param {{ name: string, url: string, type: string, sizeBytes: number }} attachment
   *
   * TODO: Validar tipo e tamanho do arquivo (máx 10MB por arquivo)
   * TODO: Integrar com Firebase Storage quando persistência for implementada
   */
  addAttachment(attachment) {
    // TODO: implementar
  }

  /**
   * Retorna o último FollowUp registrado, ou null se não houver.
   * @returns {FollowUp | null}
   *
   * TODO: Ordenar por createdAt de forma eficiente
   */
  getLastFollowUp() {
    // TODO: implementar
    return null;
  }

  /**
   * Retorna o tempo decorrido desde a criação do Deal em dias.
   * @returns {number}
   *
   * TODO: Excluir períodos pausados do cálculo (tempo ativo real)
   */
  getAgeDays() {
    // TODO: implementar
    return 0;
  }

  /**
   * Retorna o valor a ser considerado nos indicadores.
   * Para Assinatura de Energia, retorna kwhValue; para os demais, value.
   * @returns {{ amount: number, unit: 'BRL' | 'kWh' }}
   *
   * TODO: Resolver unidade via Pipeline ao invés de lógica embutida no Deal
   */
  getEffectiveValue() {
    // TODO: implementar
    return { amount: 0, unit: 'BRL' };
  }

  /**
   * Serializa o Deal para objeto plano.
   * @returns {Object}
   *
   * TODO: Integrar com CRMRepository.saveDeal()
   * TODO: Não incluir activities e followups completos — apenas IDs (lazy loading)
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói um Deal a partir de objeto serializado.
   * @param {Object} data
   * @returns {Deal}
   *
   * TODO: Reidratar activities e followups quando carregados separadamente
   * TODO: Validar status e origin contra os enums
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Deal('', '', '');
  }
}
