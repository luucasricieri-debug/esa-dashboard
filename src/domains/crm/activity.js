/**
 * ESA OS — CRM Domain
 * Activity
 *
 * Representa uma atividade comercial registrada sobre um Deal.
 * É o registro atômico de interação entre o responsável e o cliente.
 *
 * Responsabilidades:
 * - Modelar os dados de uma atividade (tipo, data, duração, resultado)
 * - Vincular a atividade a um Deal e a uma Person responsável
 * - Suportar agendamento e registro de conclusão
 * - Servir de base para o histórico de interações do Deal
 * - Alimentar métricas de produtividade (futuro)
 *
 * Tipos de atividade suportados:
 *   Ligação | WhatsApp | Visita | Reunião | Email | Observação | Tarefa
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * O legado registra atividades como eventos na Agenda (events/{date}/{id})
 * e como follow-ups em prospections/{uid}/{id}/followups/.
 * Esta classe unifica ambos os conceitos no novo modelo.
 */

/**
 * Tipos de atividade comercial disponíveis no CRM ESA OS.
 *
 * TODO: Permitir tipos customizados por organização via painel de admin
 */
export const ACTIVITY_TYPE = {
  CALL:        'call',        // Ligação telefônica
  WHATSAPP:    'whatsapp',    // Mensagem / conversa via WhatsApp
  VISIT:       'visit',       // Visita presencial ao cliente
  MEETING:     'meeting',     // Reunião (presencial ou online)
  EMAIL:       'email',       // Troca de e-mails
  NOTE:        'note',        // Observação ou anotação interna
  TASK:        'task',        // Tarefa a ser realizada
};

/**
 * Status possíveis de uma Activity ao longo do seu ciclo de vida.
 *
 * TODO: Adicionar status OVERDUE (vencida) com cálculo automático
 */
export const ACTIVITY_STATUS = {
  SCHEDULED:  'scheduled',   // Agendada, ainda não realizada
  DONE:       'done',        // Concluída com sucesso
  FAILED:     'failed',      // Realizada sem sucesso (ex: ligação sem resposta)
  CANCELED:   'canceled',    // Cancelada antes de ocorrer
};

/**
 * Representa uma atividade comercial vinculada a um Deal.
 */
export class Activity {
  /**
   * @param {string}      id             - Identificador único da atividade
   * @param {string}      dealId         - ID do Deal ao qual a atividade pertence
   * @param {string}      type           - Tipo: ACTIVITY_TYPE.*
   * @param {string}      status         - Status: ACTIVITY_STATUS.*
   * @param {string}      responsibleUid - UID da Person responsável pela atividade
   * @param {string}      title          - Título descritivo (ex: 'Ligação de prospecção')
   * @param {string}      description    - Detalhes, pauta, resultado (texto livre)
   * @param {number|null} scheduledAt    - Timestamp de agendamento (ms desde epoch)
   * @param {number|null} completedAt    - Timestamp de conclusão (ms desde epoch)
   * @param {number|null} durationMin    - Duração em minutos (para reuniões e visitas)
   * @param {number}      createdAt      - Timestamp de criação
   * @param {string}      createdBy      - UID de quem criou o registro
   */
  constructor(
    id,
    dealId,
    type,
    status = ACTIVITY_STATUS.SCHEDULED,
    responsibleUid = '',
    title = '',
    description = '',
    scheduledAt = null,
    completedAt = null,
    durationMin = null,
    createdAt = Date.now(),
    createdBy = ''
  ) {
    this.id = id;
    this.dealId = dealId;
    this.type = type;
    this.status = status;
    this.responsibleUid = responsibleUid;
    this.title = title;
    this.description = description;
    this.scheduledAt = scheduledAt;
    this.completedAt = completedAt;
    this.durationMin = durationMin;
    this.createdAt = createdAt;
    this.createdBy = createdBy;
  }

  /**
   * Marca a atividade como concluída com sucesso.
   * @param {string} notes - Observações pós-conclusão (opcional)
   *
   * TODO: Atualizar status para DONE e setar completedAt
   * TODO: Disparar evento 'activity:completed' para atualizar métricas
   * TODO: Verificar se há próxima atividade sugerida pela Solana
   */
  complete(notes = '') {
    // TODO: implementar
  }

  /**
   * Marca a atividade como falhada (ex: ligação sem resposta).
   * @param {string} reason - Motivo do insucesso
   *
   * TODO: Atualizar status para FAILED
   * TODO: Sugerir reagendamento automático após N tentativas falhadas
   */
  fail(reason = '') {
    // TODO: implementar
  }

  /**
   * Cancela a atividade agendada.
   * @param {string} reason - Motivo do cancelamento
   *
   * TODO: Atualizar status para CANCELED
   * TODO: Notificar convidados caso seja uma reunião com guests
   */
  cancel(reason = '') {
    // TODO: implementar
  }

  /**
   * Verifica se a atividade já foi realizada (DONE ou FAILED).
   * @returns {boolean}
   */
  isCompleted() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se a atividade está vencida (scheduledAt no passado e não concluída).
   * @returns {boolean}
   *
   * TODO: Considerar fuso horário da organização na comparação
   */
  isOverdue() {
    // TODO: implementar
    return false;
  }

  /**
   * Retorna o label legível para o tipo de atividade.
   * @returns {string}
   */
  getTypeLabel() {
    // TODO: implementar mapeamento de ACTIVITY_TYPE para string em pt-BR
    return '';
  }

  /**
   * Serializa a Activity para objeto plano.
   * @returns {Object}
   *
   * TODO: Integrar com ActivityRepository
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói uma Activity a partir de objeto serializado.
   * @param {Object} data
   * @returns {Activity}
   *
   * TODO: Validar tipo e status contra os enums antes de instanciar
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Activity('', '', ACTIVITY_TYPE.NOTE);
  }
}
