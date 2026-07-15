/**
 * ESA OS — UI / Energy Credits / App / Components
 * Error state HTML snippet.
 */

const ERROR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="10.29 3.86 1.82 18 2 18 22 18 22.18 18 13.71 3.86 10.29 3.86"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

export function ecErrorState(errors, { onRetry } = {}) {
  const msg = Array.isArray(errors)
    ? (errors[0]?.message || errors[0] || 'Erro desconhecido')
    : (errors || 'Erro desconhecido');

  const retryBtn = onRetry
    ? `<button class="ec-btn ec-btn-secondary ec-btn-sm" data-action="retry">Tentar novamente</button>`
    : '';

  return `
    <div class="ec-error-state">
      <div class="ec-error-icon">${ERROR_ICON}</div>
      <div class="ec-error-title">Não foi possível carregar</div>
      <div class="ec-error-message">${msg}</div>
      ${retryBtn}
    </div>
  `;
}
