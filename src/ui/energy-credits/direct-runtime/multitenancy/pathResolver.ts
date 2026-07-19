// ── ESA OS — Path Resolver Central — Gate 8B ─────────────────────────────────
// Fonte de verdade única para paths Firebase de energyCredits.
// Nenhum path deve ser montado manualmente fora deste módulo.

import type { OrganizationContext } from './types.js';

export function resolveEnergyCreditsPath(context: OrganizationContext): string {
  if (context.tenancyMode === 'organization') {
    return `organizations/${context.organizationId}/energyCredits`;
  }
  return `users/${context.uid}/energyCredits`;
}

export function resolveLegacyEnergyCreditsPath(uid: string): string {
  return `users/${uid}/energyCredits`;
}

export function resolveEntityPath(context: OrganizationContext, collection: string, id: string): string {
  return `${resolveEnergyCreditsPath(context)}/${collection}/${id}`;
}
