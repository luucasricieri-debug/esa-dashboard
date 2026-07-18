/**
 * ESA OS — UI / Energy Credits / App / Components
 * Loading state HTML snippet.
 */

export function ecLoadingState(text = 'Carregando...') {
  return `
    <div class="ec-loading">
      <div class="ec-spinner"></div>
      <span class="ec-loading-text">${text}</span>
    </div>
  `;
}
