/**
 * ESA OS — UI / Energy Credits / App / Components
 * Empty state HTML snippet.
 */

const DEFAULT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

export function ecEmptyState({ title = 'Nenhum dado disponível', text = '', icon = DEFAULT_ICON, action = '' } = {}) {
  return `
    <div class="ec-empty">
      <div class="ec-empty-icon">${icon}</div>
      <div class="ec-empty-title">${title}</div>
      ${text ? `<div class="ec-empty-text">${text}</div>` : ''}
      ${action ? `<div class="ec-mt-2">${action}</div>` : ''}
    </div>
  `;
}
