/**
 * ESA OS — UI / Energy Credits / App
 * EnergyCreditsApp — orquestrador principal da UI de Créditos ESA Energia.
 *
 * Uso:
 *   const app = createEnergyCreditsApp({ provider, mountElement });
 *   app.mount();
 *   app.navigate('generating-units');
 *   app.unmount();
 *
 * NÃO acessa document no nível de importação do módulo.
 */

import { createEnergyCreditsRouter } from './energy-credits-router.js';
import { createEnergyCreditsState }  from './energy-credits-state.js';
import { ecShellHtml }               from './components/ec-shell.js';
import { ecSidebarHtml }             from './components/ec-sidebar.js';
import { ecTopbarHtml }              from './components/ec-topbar.js';

export class EnergyCreditsApp {
  constructor({ provider, mountElement, options = {} }) {
    if (!provider || typeof provider !== 'object') throw new TypeError('[EnergyCreditsApp] provider é obrigatório');
    if (!mountElement) throw new TypeError('[EnergyCreditsApp] mountElement é obrigatório');
    this._provider    = provider;
    this._el          = mountElement;
    this._opts        = { persistenceMode: 'preview', initialRoute: 'dashboard', ...options };
    this._router      = createEnergyCreditsRouter();
    this._state       = createEnergyCreditsState({ persistenceMode: this._opts.persistenceMode });
    this._currentRoute = this._opts.initialRoute;
    this._currentView  = null;
    this._mounted      = false;
    this._shellHandler = null;
  }

  mount() {
    if (this._mounted) return this;
    this._injectStyles();
    this._el.classList.add('ec-app');
    this._el.innerHTML = ecShellHtml();
    this._shellHandler = (e) => this._onShellClick(e);
    this._el.addEventListener('click', this._shellHandler);
    this._navigate(this._currentRoute);
    this._mounted = true;
    return this;
  }

  unmount() {
    this._destroyCurrentView();
    if (this._el && this._shellHandler) this._el.removeEventListener('click', this._shellHandler);
    if (this._el) { this._el.innerHTML = ''; this._el.classList.remove('ec-app'); }
    this._mounted = false;
    return this;
  }

  navigate(route, params = {}) {
    return this._navigate(route, params);
  }

  refresh() {
    if (typeof this._currentView?.render === 'function') {
      const content = this._el?.querySelector('#ec-content');
      if (content) this._currentView.render(content);
    }
    return this;
  }

  getCurrentRoute() { return this._currentRoute; }

  getState() { return this._state.get(); }

  _injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('ec-app-styles')) return;
    const link = document.createElement('link');
    link.id   = 'ec-app-styles';
    link.rel  = 'stylesheet';
    const base = import.meta.url.replace(/\/energy-credits-app\.js([?#].*)?$/, '');
    link.href = `${base}/styles/energy-credits-app.css`;
    document.head.appendChild(link);
  }

  _navigate(route, params = {}) {
    const ViewClass = this._router.resolve(route);
    if (!ViewClass) return false;
    this._destroyCurrentView();
    this._currentRoute = route;
    this._state.set({ route, routeParams: params });
    const content = this._el?.querySelector('#ec-content');
    if (!content) return false;
    const view = new ViewClass({
      provider: this._provider,
      state:    this._state,
      navigate: (r, p) => this._navigate(r, p),
    });
    this._currentView = view;
    view.render(content);
    this._updateSidebar();
    this._updateTopbar();
    return true;
  }

  _destroyCurrentView() {
    if (this._currentView?.destroy) this._currentView.destroy();
    this._currentView = null;
  }

  _updateSidebar() {
    const sb = this._el?.querySelector('#ec-sidebar');
    if (!sb) return;
    sb.innerHTML = ecSidebarHtml(this._currentRoute, true);
  }

  _updateTopbar() {
    const tb = this._el?.querySelector('#ec-topbar');
    if (!tb) return;
    tb.innerHTML = ecTopbarHtml({
      route:           this._currentRoute,
      persistenceMode: this._state.get().persistenceMode,
      onExit:          typeof this._opts.onExit === 'function',
    });
  }

  _onShellClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const route  = e.target.closest('[data-route]')?.dataset.route;

    if (route && this._router.isValidRoute(route)) { this._navigate(route); return; }
    if (action === 'exit-module')   { this._opts.onExit?.(); return; }
    if (action === 'refresh')       { this.refresh(); return; }
    if (action === 'sidebar-open')  { this._openSidebar(); return; }
    if (action === 'sidebar-close') { this._closeSidebar(); return; }
  }

  _openSidebar() {
    this._el?.querySelector('.ec-sidebar-wrapper')?.classList.add('ec-open');
    this._el?.querySelector('.ec-drawer-overlay')?.classList.add('ec-visible');
  }

  _closeSidebar() {
    this._el?.querySelector('.ec-sidebar-wrapper')?.classList.remove('ec-open');
    this._el?.querySelector('.ec-drawer-overlay')?.classList.remove('ec-visible');
  }
}

export function createEnergyCreditsApp(options) {
  return new EnergyCreditsApp(options);
}

export function mountEnergyCreditsApp(options) {
  return new EnergyCreditsApp(options).mount();
}
