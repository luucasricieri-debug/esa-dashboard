/**
 * ESA Core v2 — Permissions
 *
 * Responsável por padronizar os níveis de acesso da plataforma.
 *
 * IMPORTANTE:
 * Este arquivo ainda NÃO está conectado ao index.html.
 */

export const USER_LEVELS = {
  DIRETOR: 'diretor',
  GESTOR: 'gestor',
  TRAFEGO: 'trafego',
  EXECUTIVO: 'executivo',
  SDR: 'sdr',
  JACKELINE: 'jackeline',
  ENGENHARIA: 'engenharia',
  MARKETING: 'marketing'
};

export const USER_RANKS = {
  [USER_LEVELS.DIRETOR]: 0,
  [USER_LEVELS.GESTOR]: 1,
  [USER_LEVELS.TRAFEGO]: 1,
  [USER_LEVELS.EXECUTIVO]: 2,
  [USER_LEVELS.SDR]: 2,
  [USER_LEVELS.JACKELINE]: 2,
  [USER_LEVELS.ENGENHARIA]: 2,
  [USER_LEVELS.MARKETING]: 2
};

export function getUserRank(level) {
  return USER_RANKS[level] ?? 99;
}

export function isManagement(level) {
  return [
    USER_LEVELS.DIRETOR,
    USER_LEVELS.GESTOR,
    USER_LEVELS.TRAFEGO
  ].includes(level);
}

export function canAccessTeamData(level) {
  return isManagement(level);
}

export function canAccessSolana(level) {
  return [
    USER_LEVELS.DIRETOR,
    USER_LEVELS.GESTOR
  ].includes(level);
}

export function canAccessCRM(level) {
  return [
    USER_LEVELS.DIRETOR,
    USER_LEVELS.GESTOR,
    USER_LEVELS.TRAFEGO,
    USER_LEVELS.EXECUTIVO
  ].includes(level);
}