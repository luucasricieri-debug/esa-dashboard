/**
 * ESA OS — Energy Credits Legacy Bridge
 *
 * Monta o módulo React de Gestão de Créditos dentro do dashboard legado.
 * Controla visibilidade do host, lifecycle de mount/unmount e cleanup no logout.
 *
 * CONSTRAINTS:
 *  - NÃO usa iframe
 *  - NÃO conecta Firebase diretamente
 *  - NÃO usa preview provider no dashboard real
 *  - persistenceMode: 'preview' — sem persistência financeira ativa
 *  - Não publica produção (branch core-v2 only)
 */

import { EnergyCreditsUIProvider } from './energy-credits-ui-provider.js';

const HOST_ID   = 'esa-energy-credits-react-root';
const BANNER_ID = 'esa-preview-banner';
const BUNDLE    = '/assets/energy-credits/energy-credits-react.js';

let _unmount  = null;
let _mounted  = false;
let _bundle   = null;

// ── Bundle lazy load ──────────────────────────────────────────────────────────

async function loadBundle() {
  if (!_bundle) {
    _bundle = await import(BUNDLE);
  }
  return _bundle;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function host()    { return document.getElementById(HOST_ID); }
function banner()  { return document.getElementById(BANNER_ID); }
function content() { return document.getElementById('content'); }

// ── Activate (show + mount) ───────────────────────────────────────────────────

async function activate() {
  const h = host();
  const b = banner();
  const c = content();

  document.body.classList.add('esa-energy-credits-active');
  if (h) h.style.display = 'block';
  if (b) b.style.display = 'block';
  if (c) c.style.display = 'none';

  if (_mounted) return;

  try {
    const esa = window.ESA_OS;
    if (!esa) {
      console.warn('[ESA Bridge] ESA_OS ainda não disponível. Aguardando próximo tick...');
      setTimeout(activate, 300);
      return;
    }

    const uiProvider = new EnergyCreditsUIProvider(esa);
    const mod        = await loadBundle();
    const adapter    = mod.createProviderAdapter(uiProvider);

    _unmount = mod.mountEnergyCreditsReactApp({
      mountElement: h,
      provider: adapter,
      options: {
        defaultView:     'dashboard',
        persistenceMode: 'preview',
        onExit: () => window.goPage('prosp'),
      },
    });

    _mounted = true;
    console.log('[ESA Bridge] Módulo React montado com provider real (preview mode).');
  } catch (err) {
    console.error('[ESA Bridge] Erro ao montar módulo React:', err);
  }
}

// ── Deactivate (hide, preserva estado interno React) ─────────────────────────

function deactivate() {
  const h = host();
  const b = banner();
  const c = content();

  document.body.classList.remove('esa-energy-credits-active');
  if (h) h.style.display = 'none';
  if (b) b.style.display = 'none';
  if (c) c.style.display = '';
}

// ── Cleanup (unmount — chamado somente no logout) ─────────────────────────────

function cleanup() {
  if (_unmount) {
    try { _unmount(); } catch (e) { console.error('[ESA Bridge] Erro no unmount:', e); }
    _unmount = null;
  }
  _mounted = false;
  deactivate();
}

// ── Patch window.goPage ───────────────────────────────────────────────────────
// Intercept ANTES de chamar o goPage original para controlar visibilidade do host.

const _origGoPage = window.goPage;

window.goPage = function (page) {
  if (page === 'creditos') {
    // Atualizar estado de navegação legado manualmente
    document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('nav-creditos');
    if (navEl) navEl.classList.add('active');
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = 'Gestão de Créditos';
    // Mostrar host React
    activate();
  } else {
    deactivate();
    _origGoPage(page);
  }
};

// ── Patch window.doLogout ─────────────────────────────────────────────────────
// Garante cleanup do React antes de limpar sessão.

const _origDoLogout = window.doLogout;

window.doLogout = function () {
  cleanup();
  _origDoLogout();
};

console.log('[ESA Bridge] Bridge de Gestão de Créditos inicializado.');
