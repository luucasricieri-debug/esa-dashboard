/**
 * ESA OS — UI / Energy Credits / App
 * Roteador — mapeia nomes de rota às classes de view.
 * Todos os imports são estáticos para que o tree-shaking funcione
 * e para evitar dynamic import() que quebra em alguns ambientes de teste.
 */

import { EcDashboardView }          from './views/ec-dashboard-view.js';
import { EcGeneratingUnitsView }    from './views/ec-generating-units-view.js';
import { EcBeneficiaryUnitsView }   from './views/ec-beneficiary-units-view.js';
import { EcMonthlySettlementView }  from './views/ec-monthly-settlement-view.js';
import { EcCsvImportView }          from './views/ec-csv-import-view.js';
import { EcUtilityBillImportView }  from './views/ec-utility-bill-import-view.js';
import { EcReportsView }            from './views/ec-reports-view.js';
import { EcFinancialView }          from './views/ec-financial-view.js';
import { EcAlertsView }             from './views/ec-alerts-view.js';

export const EC_ROUTE_REGISTRY = Object.freeze({
  'dashboard':           EcDashboardView,
  'generating-units':    EcGeneratingUnitsView,
  'beneficiary-units':   EcBeneficiaryUnitsView,
  'monthly-settlement':  EcMonthlySettlementView,
  'csv-import':          EcCsvImportView,
  'utility-bill-import': EcUtilityBillImportView,
  'reports':             EcReportsView,
  'financial':           EcFinancialView,
  'alerts':              EcAlertsView,
});

export function createEnergyCreditsRouter(registry = EC_ROUTE_REGISTRY) {
  return {
    resolve(route) {
      return registry[route] ?? null;
    },
    getRoutes() {
      return Object.keys(registry);
    },
    isValidRoute(route) {
      return Object.prototype.hasOwnProperty.call(registry, route);
    },
  };
}
