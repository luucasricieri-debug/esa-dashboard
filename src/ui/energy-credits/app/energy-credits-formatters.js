/**
 * ESA OS — UI / Energy Credits / App
 * Formatadores de valor para a UI de Créditos ESA Energia.
 * Todas as funções são puras e não acessam DOM.
 */

export function formatCurrencyBRL(value) {
  if (value == null || isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

export function formatKwh(value, decimals = 2) {
  if (value == null || isNaN(Number(value))) return '—';
  const n = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
  return `${n} kWh`;
}

export function formatPercentage(value, decimals = 1) {
  if (value == null || isNaN(Number(value))) return '—';
  const n = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
  return `${n}%`;
}

export function formatReferenceMonth(month) {
  if (!month) return '—';
  const parts = String(month).split('-');
  const year = parts[0];
  const m = parseInt(parts[1], 10);
  const labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${labels[m - 1] || parts[1]}/${year}`;
}

export function formatDateBR(date) {
  if (!date) return '—';
  try {
    const raw = String(date);
    const d = new Date(raw.length === 10 ? raw + 'T00:00:00' : raw);
    return d.toLocaleDateString('pt-BR');
  } catch (_) {
    return String(date);
  }
}

export function formatCoverageMonths(value) {
  if (value == null || isNaN(Number(value))) return { text: '—', level: 'none' };
  const n = Number(value);
  const text =
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' meses';
  const level = n <= 0.25 ? 'low' : n <= 1.5 ? 'adequate' : 'high';
  return { text, level };
}

export function formatDocument(doc) {
  if (!doc) return '—';
  const d = String(doc).replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
}

export function formatNumber(value, decimals = 0) {
  if (value == null || isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
}

export function currentReferenceMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function coverageBadgeClass(level) {
  if (level === 'low') return 'ec-coverage-low';
  if (level === 'high') return 'ec-coverage-high';
  return 'ec-coverage-adequate';
}
