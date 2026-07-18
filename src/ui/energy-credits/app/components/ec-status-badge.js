/**
 * ESA OS — UI / Energy Credits / App / Components
 * Badges de status reutilizáveis.
 */

const PAYMENT_MAP = {
  paid:    { cls: 'ec-badge-paid',    label: 'Pago' },
  open:    { cls: 'ec-badge-open',    label: 'Em Aberto' },
  overdue: { cls: 'ec-badge-overdue', label: 'Vencido' },
  pending: { cls: 'ec-badge-pending', label: 'Pendente' },
};

const IMPORT_MAP = {
  pending:   { cls: 'ec-badge-gold',  label: 'Pendente' },
  matched:   { cls: 'ec-badge-blue',  label: 'Vinculado' },
  confirmed: { cls: 'ec-badge-green', label: 'Confirmado' },
  replaced:  { cls: 'ec-badge-gray',  label: 'Substituído' },
  discarded: { cls: 'ec-badge-red',   label: 'Descartado' },
};

export function ecPaymentBadge(status) {
  const { cls, label } = PAYMENT_MAP[status] || { cls: 'ec-badge-gray', label: status || '—' };
  return `<span class="ec-badge ${cls}">${label}</span>`;
}

export function ecImportStatusBadge(status) {
  const { cls, label } = IMPORT_MAP[status] || { cls: 'ec-badge-gray', label: status || '—' };
  return `<span class="ec-badge ${cls}">${label}</span>`;
}

export function ecPreviewBadge() {
  return `<span class="ec-badge ec-badge-preview">PRÉVIA</span>`;
}

export function ecBadge(text, cls = 'ec-badge-gray') {
  return `<span class="ec-badge ${cls}">${text}</span>`;
}

export function ecCoverageBadge(level, text) {
  const cls = level === 'low' ? 'ec-coverage-low' : level === 'high' ? 'ec-coverage-high' : 'ec-coverage-adequate';
  return `<span class="ec-badge ${cls}">${text}</span>`;
}
