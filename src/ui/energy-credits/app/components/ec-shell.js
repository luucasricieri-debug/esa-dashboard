/**
 * ESA OS — UI / Energy Credits / App / Components
 * Shell layout HTML — estrutura sidebar + topbar + main.
 * Não acessa document. Retorna string HTML.
 */

export function ecShellHtml() {
  return `
    <div class="ec-drawer-overlay" data-action="sidebar-close"></div>
    <div class="ec-sidebar-wrapper" id="ec-sidebar"></div>
    <div class="ec-main">
      <div class="ec-topbar" id="ec-topbar"></div>
      <div class="ec-main-content" id="ec-content"></div>
    </div>
  `;
}
