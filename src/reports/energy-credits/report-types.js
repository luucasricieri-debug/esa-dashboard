/**
 * ESA OS — Reports / Energy Credits
 * Constantes de tipos e contrato de distribuição de relatórios.
 */

/** Versão do contrato de relatório (incrementar em quebras de compatibilidade). */
export const REPORT_VERSION = '1.0';

/** Tipos de relatório estáveis — usados em reportType do contrato. */
export const REPORT_TYPE = Object.freeze({
  OWNER_MONTHLY:         'owner-monthly',
  BENEFICIARY_MONTHLY:   'beneficiary-monthly',
  ESA_INTERNAL_MONTHLY:  'esa-internal-monthly',
  ESA_FINANCIAL_MONTHLY: 'esa-financial-monthly',
});

/**
 * Opções futuras de distribuição.
 * Declarativas — não implementam envio, PDF, ou download real.
 */
export const DISTRIBUTION_DEFAULTS = Object.freeze({
  pdfReady:      false,
  downloadable:  true,
  emailReady:    false,
  whatsappReady: false,
  manualDelivery: true,
});
