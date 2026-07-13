/**
 * ESA OS — Energy Domain / Credits
 * Constants
 *
 * Status enums centralizados do módulo de gestão de créditos.
 * Todos os valores são strings lowercase para consistência com o restante do ESA OS.
 */

export const OPERATIONAL_STATUS = Object.freeze({
  ACTIVE:         'active',
  INACTIVE:       'inactive',
  MAINTENANCE:    'maintenance',
  DECOMMISSIONED: 'decommissioned',
});

export const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE:    'active',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
  PENDING:   'pending',
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING:   'pending',
  PAID:      'paid',
  OVERDUE:   'overdue',
  CANCELLED: 'cancelled',
  PARTIAL:   'partial',
});

export const STATEMENT_STATUS = Object.freeze({
  OPEN:      'open',
  REVIEW:    'review',
  CLOSED:    'closed',
  PAID:      'paid',
  CANCELLED: 'cancelled',
});

export const CREDIT_ALLOCATION_STATUS = Object.freeze({
  PENDING:               'pending',
  CONFIRMED:             'confirmed',
  PARTIALLY_COMPENSATED: 'partially_compensated',
  COMPENSATED:           'compensated',
  CANCELLED:             'cancelled',
});
