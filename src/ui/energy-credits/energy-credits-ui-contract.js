/**
 * ESA OS — UI / Energy Credits
 * Contrato de capacidades da UI de Créditos ESA Energia.
 */

export const ENERGY_CREDITS_UI_CAPABILITIES = Object.freeze({
  DASHBOARD: Object.freeze([
    'executive_summary',
    'generating_unit_summary',
    'beneficiary_summary',
    'financial_summary',
    'alerts_summary',
  ]),
  ALLOCATION: Object.freeze([
    'consumption_average',
    'allocation_plan',
    'beneficiary_balance',
    'credit_balance',
    'credit_balance_history',
    'allocation_plan_query',
    'consumption_average_query',
  ]),
  BILLING: Object.freeze([
    'beneficiary_billing',
  ]),
  REPORTS: Object.freeze([
    'owner_monthly_report',
    'beneficiary_monthly_report',
    'esa_internal_monthly_report',
    'esa_financial_monthly_report',
  ]),
  CSV_IMPORT: Object.freeze([
    'import_from_csv',
    'import_from_rows',
  ]),
  UTILITY_BILL_IMPORT: Object.freeze([
    'create',
    'match',
    'link',
    'prepare_beneficiary',
    'review',
    'duplicate_detect',
    'confirm',
    'replace',
    'discard',
    'query',
    'search',
    'unlinked',
    'data_sources',
    'billing_input',
  ]),
  CADASTROS: Object.freeze([
    'create_generating_unit',
    'create_beneficiary_unit',
    'update_generating_unit',
    'update_beneficiary_unit',
  ]),
  COMMERCIAL_TERMS: Object.freeze([
    'get',
    'update',
  ]),
  SETTLEMENT_RECIPIENT: Object.freeze([
    'get',
    'update',
  ]),
  INVOICE_PAYMENT: Object.freeze([
    'confirm',
    'reopen',
  ]),
  OWNER_SETTLEMENT_PAYMENT: Object.freeze([
    'confirm',
    'reopen',
  ]),
  CSV_TEMPLATE: Object.freeze([
    'get',
    'supported_types',
  ]),
  PROVIDER: Object.freeze([
    'get_capabilities',
    'get_stats',
  ]),
});

export const ENERGY_CREDITS_UI_VERSION = '1.0.0';
