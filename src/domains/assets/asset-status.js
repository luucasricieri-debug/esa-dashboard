/**
 * ESA OS — Assets Domain
 * AssetStatus
 *
 * Catálogo de status operacional de ativos.
 *
 * IMPORTANTE: NÃO conectado ao Dashboard legado. Sem máquina de estados.
 */

export const ASSET_STATUS = {
  PLANNED:           'PLANNED',           // Aprovado e aguardando implantação
  UNDER_CONSTRUCTION:'UNDER_CONSTRUCTION',// Em obras / instalação
  COMMISSIONING:     'COMMISSIONING',     // Em processo de comissionamento
  OPERATIONAL:       'OPERATIONAL',       // Em operação normal
  DEGRADED:          'DEGRADED',          // Operando com desempenho reduzido
  MAINTENANCE:       'MAINTENANCE',       // Em manutenção programada ou corretiva
  OFFLINE:           'OFFLINE',           // Desligado / sem comunicação
  DECOMMISSIONED:    'DECOMMISSIONED',    // Encerrado definitivamente
};

/** Ativos que estão produzindo ou disponíveis para operar */
export const ACTIVE_STATUSES = [
  ASSET_STATUS.OPERATIONAL,
  ASSET_STATUS.DEGRADED,
];

/** Ativos que existem mas não estão produzindo */
export const NON_OPERATIONAL_STATUSES = [
  ASSET_STATUS.PLANNED,
  ASSET_STATUS.UNDER_CONSTRUCTION,
  ASSET_STATUS.COMMISSIONING,
  ASSET_STATUS.MAINTENANCE,
  ASSET_STATUS.OFFLINE,
];

/** Ativos que não terão mais operação */
export const TERMINAL_STATUSES = [
  ASSET_STATUS.DECOMMISSIONED,
];

/**
 * @param {string} status - ASSET_STATUS.*
 * @returns {boolean}
 * TODO: implementar
 */
export function isActiveStatus(status) {
  // TODO: implementar
  return false;
}

/**
 * @param {string} status - ASSET_STATUS.*
 * @returns {boolean}
 * TODO: implementar
 */
export function isTerminalStatus(status) {
  // TODO: implementar
  return false;
}
