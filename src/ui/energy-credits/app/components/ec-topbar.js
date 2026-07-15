/**
 * ESA OS — UI / Energy Credits / App / Components
 * Topbar HTML snippet.
 */

import { getRouteLabel } from '../energy-credits-navigation.js';
import { ICONS } from '../energy-credits-navigation.js';

export function ecTopbarHtml({ route, persistenceMode, onExit }) {
  const label = getRouteLabel(route);
  const previewBadge = persistenceMode === 'preview'
    ? `<div class="ec-preview-badge"><span class="ec-preview-dot"></span>MODO DE PRÉVIA</div>`
    : '';
  const exitBtn = onExit
    ? `<button class="ec-topbar-btn" data-action="exit-module" title="Sair do módulo">
        <span style="width:14px;height:14px;">${ICONS.back}</span>Sair
       </button>`
    : '';

  const hamburger = `
    <button class="ec-hamburger ec-mobile-only" data-action="sidebar-open" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  `;

  const refreshBtn = `
    <button class="ec-topbar-btn ec-btn-icon" data-action="refresh" title="Atualizar">
      <span style="width:14px;height:14px;">${ICONS.refresh}</span>
    </button>
  `;

  return `
    ${hamburger}
    <div class="ec-topbar-title">
      Gestão de Créditos
      <span class="ec-topbar-route">/ ${label}</span>
    </div>
    <div class="ec-topbar-actions">
      ${previewBadge}
      ${refreshBtn}
      ${exitBtn}
    </div>
  `;
}
