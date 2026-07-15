/**
 * ESA OS — UI / Energy Credits / App / Components
 * Sidebar navigation HTML snippet.
 */

import { NAV_SECTIONS } from '../energy-credits-navigation.js';

export function ecSidebarHtml(activeRoute, onClose) {
  const sections = NAV_SECTIONS.map(({ section, items }) => {
    const sectionHtml = `<div class="ec-sb-section">${section}</div>`;
    const itemsHtml = items.map(({ route, label, icon }) => {
      const active = route === activeRoute ? 'ec-active' : '';
      return `
        <button class="ec-sb-item ${active}" data-route="${route}">
          <span class="ec-sb-icon">${icon}</span>
          <span>${label}</span>
        </button>
      `;
    }).join('');
    return sectionHtml + itemsHtml;
  }).join('');

  const closeBtn = onClose
    ? `<div class="ec-sb-footer ec-mobile-only"><button class="ec-sb-close-btn" data-action="sidebar-close">Fechar menu</button></div>`
    : '';

  return `
    <div class="ec-sb-header">
      <div class="ec-sb-brand">⚡ ESA ENERGIA</div>
      <div class="ec-sb-sub">Créditos &amp; Energia Solar</div>
    </div>
    <nav class="ec-sb-nav">${sections}</nav>
    ${closeBtn}
  `;
}
