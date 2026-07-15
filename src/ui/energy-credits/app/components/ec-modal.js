/**
 * ESA OS — UI / Energy Credits / App / Components
 * Modal DOM helper — monta e remove o modal no container pai.
 */

const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

export function ecModalHtml({ title, body, footer = '', size = '' }) {
  const sizeClass = size === 'lg' ? 'ec-modal-lg' : size === 'sm' ? 'ec-modal-sm' : '';
  return `
    <div class="ec-modal-backdrop" data-action="close-modal">
      <div class="ec-modal ${sizeClass}" role="dialog" aria-modal="true">
        <div class="ec-modal-header">
          <div class="ec-modal-title">${title}</div>
          <button class="ec-modal-close" data-action="close-modal" aria-label="Fechar">${CLOSE_ICON}</button>
        </div>
        <div class="ec-modal-body">${body}</div>
        ${footer ? `<div class="ec-modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `;
}

export function ecOpenModal(container, html) {
  const prev = container.querySelector('.ec-modal-backdrop');
  if (prev) prev.remove();
  const el = document.createElement('div');
  el.innerHTML = html;
  const modal = el.firstElementChild;
  container.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'close-modal') ecCloseModal(container);
  });
  return modal;
}

export function ecCloseModal(container) {
  container.querySelector('.ec-modal-backdrop')?.remove();
}
