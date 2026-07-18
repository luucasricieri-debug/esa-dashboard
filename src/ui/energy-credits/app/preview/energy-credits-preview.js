/**
 * ESA OS — UI / Energy Credits / Preview
 * Orquestrador do harness de preview local.
 *
 * Monta EnergyCreditsApp com provider falso, sem Firebase, sem backend.
 * Expõe `window.ecPreviewApp` e `window.ecPreviewProvider` para inspeção.
 */

import { mountEnergyCreditsApp } from '../index.js';
import { createPreviewProvider }  from './energy-credits-preview-provider.js';

// ─── Montagem ──────────────────────────────────────────────────────────────────

const provider = createPreviewProvider();
const root     = document.getElementById('ec-preview-root');

if (!root) {
  throw new Error('[Preview] Elemento #ec-preview-root não encontrado no DOM.');
}

const app = mountEnergyCreditsApp({
  provider,
  mountElement: root,
  options: {
    persistenceMode: 'preview',
    initialRoute:    'dashboard',
    onExit: () => {
      console.info('[Preview] Saída solicitada pelo usuário via onExit.');
    },
  },
});

// ─── Preview controls ──────────────────────────────────────────────────────────

const ROUTES = [
  { route: 'dashboard',           label: 'Dashboard' },
  { route: 'generating-units',    label: 'UGs' },
  { route: 'beneficiary-units',   label: 'UBs' },
  { route: 'monthly-settlement',  label: 'Rateio' },
  { route: 'csv-import',          label: 'CSV' },
  { route: 'utility-bill-import', label: 'Faturas' },
  { route: 'reports',             label: 'Relatórios' },
  { route: 'financial',           label: 'Financeiro' },
  { route: 'alerts',              label: 'Alertas' },
];

function buildBar() {
  const bar = document.getElementById('ec-preview-bar');
  if (!bar) return;

  const btnHtml = ROUTES.map(
    ({ route, label }) =>
      `<button class="ec-pv-btn" data-route="${route}">${label}</button>`,
  ).join('');

  bar.innerHTML = `
    <span class="ec-pv-label">⚡ Preview — Créditos ESA</span>
    <div class="ec-pv-routes">${btnHtml}</div>
    <button class="ec-pv-collapse" id="ec-pv-collapse" title="Ocultar barra">▲</button>
  `;

  bar.addEventListener('click', (e) => {
    const route = e.target.closest('[data-route]')?.dataset.route;
    if (route) { app.navigate(route); _syncActive(); return; }

    if (e.target.id === 'ec-pv-collapse') {
      const isHidden = bar.classList.toggle('ec-pv-collapsed');
      e.target.textContent = isHidden ? '▼' : '▲';
    }
  });

  _syncActive();
}

function _syncActive() {
  const bar = document.getElementById('ec-preview-bar');
  if (!bar) return;
  const current = app.getCurrentRoute();
  bar.querySelectorAll('.ec-pv-btn').forEach((btn) => {
    btn.classList.toggle('ec-pv-btn-active', btn.dataset.route === current);
  });
}

buildBar();

// ─── Globals de inspeção ──────────────────────────────────────────────────────

window.ecPreviewApp      = app;
window.ecPreviewProvider = provider;
window.ecPreviewNavigate = (route) => { app.navigate(route); _syncActive(); };

console.info('[Preview] ESA Créditos montado. window.ecPreviewApp disponível.');
console.info('[Preview] Routes:', ROUTES.map((r) => r.route).join(', '));
