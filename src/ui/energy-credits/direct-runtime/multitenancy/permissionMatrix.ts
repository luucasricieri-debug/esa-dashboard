// ── ESA OS — Matriz Central de Permissões — Gate 8A ─────────────────────────
// Fonte de verdade única para permissões por role.
// NUNCA hardcodar permissões em outros módulos; importar hasPermission() aqui.

import type { OrganizationPermission, OrganizationRole } from './types.js';

export const ROLE_PERMISSIONS: Readonly<Record<OrganizationRole, ReadonlyArray<OrganizationPermission>>> = {
  owner: [
    'energyCredits.read',
    'energyCredits.create',
    'energyCredits.update',
    'energyCredits.delete',
    'energyCredits.settlement.read',
    'energyCredits.settlement.write',
    'energyCredits.financial.read',
    'energyCredits.financial.write',
    'energyCredits.import',
    'energyCredits.alerts.manage',
    'organization.members.read',
    'organization.members.manage',
  ],
  admin: [
    'energyCredits.read',
    'energyCredits.create',
    'energyCredits.update',
    'energyCredits.delete',
    'energyCredits.settlement.read',
    'energyCredits.settlement.write',
    'energyCredits.financial.read',
    'energyCredits.financial.write',
    'energyCredits.import',
    'energyCredits.alerts.manage',
    'organization.members.read',
    'organization.members.manage',
  ],
  manager: [
    'energyCredits.read',
    'energyCredits.create',
    'energyCredits.update',
    'energyCredits.settlement.read',
    'energyCredits.settlement.write',
    'energyCredits.financial.read',
    'energyCredits.import',
    'energyCredits.alerts.manage',
    'organization.members.read',
  ],
  operator: [
    'energyCredits.read',
    'energyCredits.create',
    'energyCredits.update',
    'energyCredits.settlement.read',
    'energyCredits.import',
  ],
  financial: [
    'energyCredits.read',
    'energyCredits.settlement.read',
    'energyCredits.settlement.write',
    'energyCredits.financial.read',
    'energyCredits.financial.write',
  ],
  viewer: [
    'energyCredits.read',
    'energyCredits.settlement.read',
    'energyCredits.financial.read',
  ],
};

export function hasPermission(role: OrganizationRole, permission: OrganizationPermission): boolean {
  return (ROLE_PERMISSIONS[role] as OrganizationPermission[] | undefined)?.includes(permission) ?? false;
}

export function getPermissionsForRole(role: OrganizationRole): OrganizationPermission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
