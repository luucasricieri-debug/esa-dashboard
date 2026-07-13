/**
 * ESA OS — Reports / Energy Credits
 * Public API + Singleton
 */

export { REPORT_VERSION, REPORT_TYPE, DISTRIBUTION_DEFAULTS } from './report-types.js';
export { EnergyCreditsReportService }                         from './energy-credits-report-service.js';

import { energyCreditsQueryService } from '../../queries/energy-credits/index.js';
import { EnergyCreditsReportService } from './energy-credits-report-service.js';

export const energyCreditsReportService = new EnergyCreditsReportService(energyCreditsQueryService);
