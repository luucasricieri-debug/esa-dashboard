// ── Persistent UIProvider — Gate 7 / Gate 8B ──────────────────────────────────
// Wraps EnergyCreditsUIProvider com estratégia de escrita Firebase-first.
// Somente os quatro métodos de mutação são interceptados; leituras passam direto.
//
// Gate 8B: suporta modo organização com versionamento otimista (setVersioned).
// Modo single-user: inalterado.

import { VersionConflictException, type HttpFirebaseClient } from './httpFirebaseClient.js';
import type { OrganizationContext } from '../multitenancy/types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Repo = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MemRepo = any;
type ESAFacade = { hydrateEnergyCreditsReadModel(snapshot: unknown, opts: { replace: boolean }): void };
type AnyResult = { ok: boolean; data?: unknown; errors?: unknown[]; warnings?: unknown[]; metadata?: unknown };

function backendError(op: string): AnyResult {
  return {
    ok: false,
    errors: [{ code: 'BACKEND_UNAVAILABLE', message: `Falha ao salvar no servidor (${op}). Tente novamente.` }],
  };
}

function versionConflictError(): AnyResult {
  return {
    ok: false,
    errors: [{ code: 'VERSION_CONFLICT', message: 'Conflito de versão. Recarregue e tente novamente.' }],
  };
}

function syncStores(
  collection: 'generatingUnits' | 'beneficiaryUnits',
  entity: unknown,
  memoryRepo: MemRepo,
  esa: ESAFacade,
): void {
  if (collection === 'generatingUnits') {
    memoryRepo.saveGeneratingUnit(entity);
    esa.hydrateEnergyCreditsReadModel({ generatingUnits: [entity] }, { replace: false });
  } else {
    memoryRepo.saveBeneficiaryUnit(entity);
    esa.hydrateEnergyCreditsReadModel({ beneficiaryUnits: [entity] }, { replace: false });
  }
}

function writeAuditLog(
  firebaseRepo: Repo,
  targetType: string,
  targetId: string,
  action: string,
  uid: string,
  result: 'success' | 'error',
): void {
  const createdAt = new Date().toISOString();
  const requestId = crypto.randomUUID();
  const id = `${targetType}::${targetId}::${action}::${createdAt}`;
  firebaseRepo
    .appendCreditAuditLog({
      id, requestId, targetType, targetId, action,
      userId: uid, organizationId: uid, createdAt, result,
    })
    .catch(() => {}); // best-effort — audit log nunca bloqueia o usuário
}

function loadFromMemory(
  memoryRepo: MemRepo,
  collection: 'generatingUnits' | 'beneficiaryUnits',
  id: string,
): unknown | null {
  const result = collection === 'generatingUnits'
    ? memoryRepo.getGeneratingUnit(id)
    : memoryRepo.getBeneficiaryUnit(id);
  return result?.ok && result.data ? result.data : null;
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createPersistentUiProvider(
  inner: Record<string, (...args: unknown[]) => unknown>,
  firebaseRepo: Repo,
  memoryRepo: MemRepo,
  esa: ESAFacade,
  uid: string,
  orgContext?: OrganizationContext | null,
  httpClient?: HttpFirebaseClient | null,
): Record<string, (...args: unknown[]) => unknown> {

  const isOrgMode = orgContext?.tenancyMode === 'organization' && httpClient != null;

  async function createUnit(
    collection: 'generatingUnits' | 'beneficiaryUnits',
    innerMethod: string,
    saveMethod: string,
    targetType: string,
    input: Record<string, unknown>,
  ): Promise<AnyResult> {
    const id = (typeof input.id === 'string' && input.id) ? input.id : crypto.randomUUID();
    const withId = { ...input, id };
    const domainResult = (inner[innerMethod](withId) as AnyResult | null);
    if (!domainResult?.ok) {
      return domainResult ?? { ok: false, errors: [{ code: 'DOMAIN_VALIDATION', message: 'Validação de domínio falhou' }] };
    }
    const entity = domainResult.data;

    if (isOrgMode) {
      const clientRequestId = crypto.randomUUID();
      const entityPath = `energyCredits/${collection}/${id}`;
      try {
        const { version } = await httpClient.setVersioned(entityPath, entity, 0, clientRequestId);
        const entityWithVersion = { ...(entity as object), version };
        syncStores(collection, entityWithVersion, memoryRepo, esa);
        writeAuditLog(firebaseRepo, targetType, id, 'create', uid, 'success');
        return { ok: true, data: entityWithVersion };
      } catch (err) {
        if (err instanceof VersionConflictException) return versionConflictError();
        return backendError(innerMethod);
      }
    }

    // Modo single-user — inalterado
    const fbResult: AnyResult = await firebaseRepo[saveMethod](entity);
    if (!fbResult.ok) return backendError(innerMethod);
    syncStores(collection, entity, memoryRepo, esa);
    writeAuditLog(firebaseRepo, targetType, id, 'create', uid, 'success');
    return { ok: true, data: entity };
  }

  async function updateUnit(
    collection: 'generatingUnits' | 'beneficiaryUnits',
    saveMethod: string,
    targetType: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<AnyResult> {
    const existing = loadFromMemory(memoryRepo, collection, id);
    if (!existing) {
      const code = collection === 'generatingUnits' ? 'GU_NOT_FOUND' : 'UB_NOT_FOUND';
      return { ok: false, errors: [{ code, message: `${collection === 'generatingUnits' ? 'UG' : 'UB'} ${id} não encontrada` }] };
    }
    const updated = { ...(existing as object), ...patch, id, updatedAt: new Date().toISOString() };

    if (isOrgMode) {
      const existingVersion = typeof (existing as { version?: number }).version === 'number'
        ? (existing as { version?: number }).version!
        : 0;
      const entityPath = `energyCredits/${collection}/${id}`;
      const clientRequestId = crypto.randomUUID();
      try {
        const { version } = await httpClient.setVersioned(entityPath, updated, existingVersion, clientRequestId);
        const updatedWithVersion = { ...(updated as object), version };
        syncStores(collection, updatedWithVersion, memoryRepo, esa);
        writeAuditLog(firebaseRepo, targetType, id, 'update', uid, 'success');
        return { ok: true, data: updatedWithVersion };
      } catch (err) {
        if (err instanceof VersionConflictException) return versionConflictError();
        return backendError(`update ${collection}`);
      }
    }

    // Modo single-user — inalterado
    const fbResult: AnyResult = await firebaseRepo[saveMethod](updated);
    if (!fbResult.ok) return backendError(`update ${collection}`);
    syncStores(collection, updated, memoryRepo, esa);
    writeAuditLog(firebaseRepo, targetType, id, 'update', uid, 'success');
    return { ok: true, data: updated };
  }

  const WRITE_METHODS: Record<string, (...args: unknown[]) => Promise<AnyResult>> = {
    createGeneratingUnit: (input: unknown) =>
      createUnit('generatingUnits', 'createGeneratingUnit', 'saveGeneratingUnit', 'generatingUnit', input as Record<string, unknown>),
    updateGeneratingUnit: (id: unknown, patch: unknown) =>
      updateUnit('generatingUnits', 'saveGeneratingUnit', 'generatingUnit', id as string, patch as Record<string, unknown>),
    createBeneficiaryUnit: (input: unknown) =>
      createUnit('beneficiaryUnits', 'createBeneficiaryUnit', 'saveBeneficiaryUnit', 'beneficiaryUnit', input as Record<string, unknown>),
    updateBeneficiaryUnit: (id: unknown, patch: unknown) =>
      updateUnit('beneficiaryUnits', 'saveBeneficiaryUnit', 'beneficiaryUnit', id as string, patch as Record<string, unknown>),
  };

  return new Proxy({} as Record<string, (...args: unknown[]) => unknown>, {
    get(_t, prop: string) {
      if (Object.prototype.hasOwnProperty.call(WRITE_METHODS, prop)) return WRITE_METHODS[prop];
      const val = inner[prop];
      return typeof val === 'function' ? val.bind(inner) : val;
    },
  });
}
