// ── HTTP Firebase Client — Gate 7 / Gate 8B ───────────────────────────────────
// Wraps calls to /.netlify/functions/energy-credits-data.
// A UI nunca acessa Firebase diretamente; este é o único caminho de rede.
//
// Gate 8B: aceita orgContext opcional; inclui organizationId no body quando
// em modo organização. Adiciona setVersioned() para escritas com versionamento.

import type { DataSource, OrganizationContext, SnapshotResult } from '../multitenancy/types.js';

const ENDPOINT = '/.netlify/functions/energy-credits-data';

export interface HttpFirebaseClient {
  get(path: string): Promise<unknown>;
  set(path: string, value: unknown): Promise<void>;
  setVersioned(
    path: string,
    value: unknown,
    expectedVersion: number,
    clientRequestId: string,
  ): Promise<{ version: number }>;
}

export class VersionConflictException extends Error {
  readonly expectedVersion: number;
  readonly currentVersion: number;

  constructor(expectedVersion: number, currentVersion: number) {
    super(`Conflito de versão: esperado ${expectedVersion}, atual ${currentVersion}`);
    this.name = 'VersionConflictException';
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
  }
}

async function callEndpoint(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string; version?: number }> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(`[ESA] Sem conexão com o servidor: ${(networkErr as Error).message}`);
  }

  const json = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));

  if (!response.ok) {
    throw new Error(
      `[ESA] Erro do servidor (${response.status}): ${(json as { error?: string }).error ?? 'erro desconhecido'}`,
    );
  }

  return json as { ok: boolean; data?: unknown; error?: string; version?: number };
}

export function createHttpFirebaseClient(
  sessionToken: string,
  orgContext?: OrganizationContext | null,
): HttpFirebaseClient {
  // Somente inclui org context quando em modo organização — nunca para single-user
  const orgBody: Record<string, unknown> = (orgContext?.tenancyMode === 'organization')
    ? { organizationId: orgContext.organizationId, tenancyMode: orgContext.tenancyMode }
    : {};

  return {
    async get(path: string): Promise<unknown> {
      const result = await callEndpoint({ sessionToken, operation: 'get', path, ...orgBody });
      return result.data ?? null;
    },

    async set(path: string, value: unknown): Promise<void> {
      const result = await callEndpoint({ sessionToken, operation: 'set', path, value, ...orgBody });
      if (!result.ok) {
        throw new Error(`[ESA] Falha na escrita (${path}): ${result.error ?? 'erro desconhecido'}`);
      }
    },

    async setVersioned(
      path: string,
      value: unknown,
      expectedVersion: number,
      clientRequestId: string,
    ): Promise<{ version: number }> {
      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken,
            operation: 'set',
            path,
            value,
            ...orgBody,
            expectedVersion,
            requestId: clientRequestId,
          }),
        });
      } catch (networkErr) {
        throw new Error(`[ESA] Sem conexão com o servidor: ${(networkErr as Error).message}`);
      }

      const json = (await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }))) as {
        ok: boolean;
        version?: number;
        code?: string;
        expectedVersion?: number;
        currentVersion?: number;
        error?: string;
      };

      if (response.status === 409) {
        throw new VersionConflictException(
          json.expectedVersion ?? expectedVersion,
          json.currentVersion ?? -1,
        );
      }

      if (!response.ok) {
        throw new Error(
          `[ESA] Erro do servidor (${response.status}): ${json.error ?? 'erro desconhecido'}`,
        );
      }

      return { version: json.version ?? expectedVersion + 1 };
    },
  };
}

export async function loadEnergyCreditsSnapshot(
  sessionToken: string,
  orgContext?: OrganizationContext | null,
): Promise<SnapshotResult> {
  const orgBody: Record<string, unknown> = (orgContext?.tenancyMode === 'organization')
    ? { organizationId: orgContext.organizationId, tenancyMode: orgContext.tenancyMode }
    : {};

  const result = await callEndpoint({ sessionToken, operation: 'snapshot', ...orgBody });
  if (!result.ok) {
    throw new Error(`[ESA] Falha ao carregar snapshot: ${result.error ?? 'erro desconhecido'}`);
  }

  const raw = result as unknown as {
    ok: boolean;
    data: Record<string, unknown[]>;
    dataSource: DataSource;
    migrationRequired: boolean;
  };

  return {
    data: (raw.data ?? {}) as Record<string, unknown[]>,
    dataSource: raw.dataSource ?? 'legacy-single-user',
    migrationRequired: raw.migrationRequired ?? false,
  };
}
