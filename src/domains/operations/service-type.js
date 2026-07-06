/**
 * ESA OS — Operations Domain
 * ServiceType
 *
 * Catálogo de tipos de serviço do Operations Domain.
 *
 * Responsabilidades:
 * - Definir todos os tipos de serviço executados pelas equipes técnicas
 * - Categorizar serviços por área (fotovoltaico, elétrico, O&M, etc.)
 * - Ser a única fonte de verdade sobre tipos de serviço
 *
 * Coberturas:
 * - Engenharia e instalações fotovoltaicas (ESA Solar)
 * - Estações de recarga de veículos elétricos (Movom)
 * - Baterias de armazenamento de energia
 * - Operação e Manutenção — O&M
 * - Serviços elétricos gerais
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não implementa lógica comercial.
 */

/**
 * Tipos de serviço executados em campo.
 */
export const SERVICE_TYPE = {
  SITE_SURVEY:               'SITE_SURVEY',               // Visita técnica de avaliação/vistoria
  ELECTRICAL_INSPECTION:     'ELECTRICAL_INSPECTION',     // Inspeção elétrica (NR10)
  SOLAR_INSTALLATION:        'SOLAR_INSTALLATION',        // Instalação de sistema fotovoltaico
  BATTERY_INSTALLATION:      'BATTERY_INSTALLATION',      // Instalação de sistema de bateria
  EV_CHARGER_INSTALLATION:   'EV_CHARGER_INSTALLATION',   // Instalação de carregador elétrico
  PREVENTIVE_MAINTENANCE:    'PREVENTIVE_MAINTENANCE',    // Manutenção preventiva (O&M)
  CORRECTIVE_MAINTENANCE:    'CORRECTIVE_MAINTENANCE',    // Manutenção corretiva (O&M)
  COMMISSIONING:             'COMMISSIONING',             // Comissionamento de sistema
  TECHNICAL_VISIT:           'TECHNICAL_VISIT',           // Visita técnica pós-venda
  ELECTRICAL_SERVICE:        'ELECTRICAL_SERVICE',        // Serviço elétrico geral (Movom)
  EMERGENCY_SERVICE:         'EMERGENCY_SERVICE',         // Atendimento de emergência
  OM_INSPECTION:             'OM_INSPECTION',             // Inspeção de O&M programada
  OTHER:                     'OTHER',                     // Outros serviços não categorizados
};

/**
 * Rótulos legíveis por tipo de serviço.
 *
 * TODO: Internacionalizar (i18n) quando o produto expandir
 */
export const SERVICE_TYPE_LABEL = {
  [SERVICE_TYPE.SITE_SURVEY]:             'Visita Técnica',
  [SERVICE_TYPE.ELECTRICAL_INSPECTION]:   'Inspeção Elétrica',
  [SERVICE_TYPE.SOLAR_INSTALLATION]:      'Instalação Fotovoltaica',
  [SERVICE_TYPE.BATTERY_INSTALLATION]:    'Instalação de Bateria',
  [SERVICE_TYPE.EV_CHARGER_INSTALLATION]: 'Instalação de Carregador',
  [SERVICE_TYPE.PREVENTIVE_MAINTENANCE]:  'Manutenção Preventiva',
  [SERVICE_TYPE.CORRECTIVE_MAINTENANCE]:  'Manutenção Corretiva',
  [SERVICE_TYPE.COMMISSIONING]:           'Comissionamento',
  [SERVICE_TYPE.TECHNICAL_VISIT]:         'Visita Técnica Pós-Venda',
  [SERVICE_TYPE.ELECTRICAL_SERVICE]:      'Serviço Elétrico',
  [SERVICE_TYPE.EMERGENCY_SERVICE]:       'Atendimento Emergencial',
  [SERVICE_TYPE.OM_INSPECTION]:           'Inspeção O&M',
  [SERVICE_TYPE.OTHER]:                   'Outro',
};

/**
 * Tipos de serviço que exigem formulário técnico obrigatório.
 *
 * TODO: Usar em validação de conclusão de WorkOrder
 */
export const REQUIRES_TECHNICAL_FORM = [
  SERVICE_TYPE.ELECTRICAL_INSPECTION,
  SERVICE_TYPE.SOLAR_INSTALLATION,
  SERVICE_TYPE.BATTERY_INSTALLATION,
  SERVICE_TYPE.EV_CHARGER_INSTALLATION,
  SERVICE_TYPE.COMMISSIONING,
  SERVICE_TYPE.OM_INSPECTION,
];

/**
 * Tipos de serviço que exigem assinatura do cliente para conclusão.
 *
 * TODO: Usar em validação de conclusão de WorkOrder
 */
export const REQUIRES_CUSTOMER_SIGNATURE = [
  SERVICE_TYPE.SOLAR_INSTALLATION,
  SERVICE_TYPE.BATTERY_INSTALLATION,
  SERVICE_TYPE.EV_CHARGER_INSTALLATION,
  SERVICE_TYPE.COMMISSIONING,
  SERVICE_TYPE.ELECTRICAL_SERVICE,
];

/**
 * Retorna o rótulo legível de um tipo de serviço.
 * @param {string} serviceType - SERVICE_TYPE.*
 * @returns {string}
 *
 * TODO: Implementar
 */
export function getServiceTypeLabel(serviceType) {
  // TODO: implementar
  return '';
}
