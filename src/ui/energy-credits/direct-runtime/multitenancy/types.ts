// ── ESA OS — Multitenancy Type Contracts — Gate 8A ───────────────────────────
// Modelos organizacionais, memberships, contextos e versionamento otimista.
// Nenhum desses tipos altera os paths Firebase existentes nesta missão.

export type TenancyMode = 'single-user' | 'organization';

export type OrganizationRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'operator'
  | 'financial'
  | 'viewer';

export type OrganizationPermission =
  | 'energyCredits.read'
  | 'energyCredits.create'
  | 'energyCredits.update'
  | 'energyCredits.delete'
  | 'energyCredits.settlement.read'
  | 'energyCredits.settlement.write'
  | 'energyCredits.financial.read'
  | 'energyCredits.financial.write'
  | 'energyCredits.import'
  | 'energyCredits.alerts.manage'
  | 'organization.members.read'
  | 'organization.members.manage';

// Firebase path: organizations/{organizationId}
export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'inactive';
  createdAt: number;
  updatedAt: number;
  createdBy: string; // uid do owner
}

// Firebase path: organizations/{organizationId}/members/{uid}
// Cross-ref:     users/{uid}/memberships/{organizationId}
export interface OrganizationMembership {
  organizationId: string;
  uid: string;
  role: OrganizationRole;
  status: 'active' | 'suspended' | 'pending';
  permissions: OrganizationPermission[]; // sobreposição por registro; default = role
  createdAt: number;
  updatedAt: number;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  role: OrganizationRole;
}

// Contexto resolvido pelo backend — nunca pelo browser
export interface OrganizationContext {
  tenancyMode: TenancyMode;
  organizationId: string;
  organizationName: string;
  uid: string;
  role: OrganizationRole | 'single-user';
  permissions: OrganizationPermission[];
  availableOrganizations: OrganizationSummary[];
}

// ── Versionamento otimista — contrato para Gate 8B ───────────────────────────
// Toda entidade mutável adicionará estes campos ao ser escrita no Firebase.
export interface VersionedRecord {
  version: number;    // incrementado a cada escrita
  updatedAt: number;  // epoch ms
  updatedBy: string;  // uid
}

export interface OptimisticWriteOptions {
  expectedVersion: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

// HTTP 409 retornado pelo backend em conflito de versão
export interface VersionConflictError {
  code: 'version_conflict';
  expectedVersion: number;
  currentVersion: number;
}
