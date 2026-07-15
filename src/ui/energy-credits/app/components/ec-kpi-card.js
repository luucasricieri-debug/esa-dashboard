/**
 * ESA OS — UI / Energy Credits / App / Components
 * KPI card HTML snippet.
 */

export function ecKpiCard({ label, value, meta = '', route = '', accentClass = '' }) {
  const clickable = route ? 'ec-kpi-clickable' : '';
  const data = route ? `data-route="${route}"` : '';
  return `
    <div class="ec-kpi-card ${clickable} ${accentClass}" ${data}>
      <div class="ec-kpi-label">${label}</div>
      <div class="ec-kpi-value">${value}</div>
      ${meta ? `<div class="ec-kpi-meta">${meta}</div>` : ''}
    </div>
  `;
}

export function ecKpiGrid(cards) {
  return `<div class="ec-kpi-grid">${cards.map(ecKpiCard).join('')}</div>`;
}
