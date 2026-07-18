/**
 * ESA OS — UI / Energy Credits / App
 * Gerenciamento de estado local da UI de Créditos ESA Energia.
 * Pub/sub simples sem dependências externas.
 */

const DEFAULT_STATE = {
  route: 'dashboard',
  routeParams: {},
  persistenceMode: 'preview',
  sidebarOpen: false,
  capabilities: null,
};

export function createEnergyCreditsState(initial = {}) {
  let _state = Object.assign({}, DEFAULT_STATE, initial);
  const _listeners = new Set();

  function get() {
    return Object.assign({}, _state);
  }

  function set(patch) {
    _state = Object.assign({}, _state, patch);
    _listeners.forEach((fn) => fn(get()));
  }

  function subscribe(fn) {
    _listeners.add(fn);
    return function unsubscribe() {
      _listeners.delete(fn);
    };
  }

  function reset() {
    set(Object.assign({}, DEFAULT_STATE));
  }

  return { get, set, subscribe, reset };
}
