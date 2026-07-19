'use strict';

// ── ESA OS — Backend Permission Matrix — Gate 8B ─────────────────────────────
// Espelho do multitenancy/permissionMatrix.ts para uso nos Netlify Functions.
// FONTE DE VERDADE para verificação de permissões no servidor.
// Nunca confiar em role/permissions do browser.

const ROLE_PERMISSIONS = {
  owner:     ['energyCredits.read','energyCredits.create','energyCredits.update','energyCredits.delete','energyCredits.settlement.read','energyCredits.settlement.write','energyCredits.financial.read','energyCredits.financial.write','energyCredits.import','energyCredits.alerts.manage','organization.members.read','organization.members.manage'],
  admin:     ['energyCredits.read','energyCredits.create','energyCredits.update','energyCredits.delete','energyCredits.settlement.read','energyCredits.settlement.write','energyCredits.financial.read','energyCredits.financial.write','energyCredits.import','energyCredits.alerts.manage','organization.members.read','organization.members.manage'],
  manager:   ['energyCredits.read','energyCredits.create','energyCredits.update','energyCredits.settlement.read','energyCredits.settlement.write','energyCredits.financial.read','energyCredits.import','energyCredits.alerts.manage','organization.members.read'],
  operator:  ['energyCredits.read','energyCredits.create','energyCredits.update','energyCredits.settlement.read','energyCredits.import'],
  financial: ['energyCredits.read','energyCredits.settlement.read','energyCredits.settlement.write','energyCredits.financial.read','energyCredits.financial.write'],
  viewer:    ['energyCredits.read','energyCredits.settlement.read','energyCredits.financial.read'],
};

function hasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

module.exports = { ROLE_PERMISSIONS, hasPermission };
