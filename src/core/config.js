/**
 * ESA Core v2 — Config
 *
 * Este arquivo centraliza configurações globais da futura plataforma.
 *
 * IMPORTANTE:
 * Este arquivo ainda NÃO está conectado ao index.html.
 * Nenhuma alteração aqui afeta a produção.
 */

export const ESA_CORE_VERSION = '2.0.0-alpha';

export const ESA_APP_NAME = 'ESA OS';

export const ESA_APP_LEGACY_NAME = 'ESA Dashboard';

export const ESA_ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

export const ESA_CURRENT_ENVIRONMENT = ESA_ENVIRONMENTS.DEVELOPMENT;

export const ESA_CORE_PRINCIPLES = [
  'Preservar o sistema atual',
  'Evoluir incrementalmente',
  'Não quebrar produção',
  'Centralizar regras compartilhadas no Core',
  'Documentar antes de implementar',
  'Segurança por padrão',
  'Auditoria obrigatória'
];