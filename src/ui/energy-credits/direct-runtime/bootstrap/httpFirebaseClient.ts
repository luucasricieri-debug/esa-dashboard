// ── HTTP Firebase Client — Gate 7 ─────────────────────────────────────────────
// Wraps calls to /.netlify/functions/energy-credits-data.
// The UI never accesses Firebase directly; this is the sole network path.
//
// Exposed interface matches EnergyCreditsFirebaseRepository expectations:
//   get(path)         → returns raw value (null if absent)
//   set(path, value)  → writes value, throws on failure

const ENDPOINT = '/.netlify/functions/energy-credits-data';

export interface HttpFirebaseClient {
  get(path: string): Promise<unknown>;
  set(path: string, value: unknown): Promise<void>;
}

async function callEndpoint(body: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: string }> {
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
    throw new Error(`[ESA] Erro do servidor (${response.status}): ${(json as { error?: string }).error ?? 'erro desconhecido'}`);
  }

  return json as { ok: boolean; data?: unknown; error?: string };
}

export function createHttpFirebaseClient(sessionToken: string): HttpFirebaseClient {
  return {
    async get(path: string): Promise<unknown> {
      const result = await callEndpoint({ sessionToken, operation: 'get', path });
      return result.data ?? null;
    },

    async set(path: string, value: unknown): Promise<void> {
      const result = await callEndpoint({ sessionToken, operation: 'set', path, value });
      if (!result.ok) {
        throw new Error(`[ESA] Falha na escrita (${path}): ${result.error ?? 'erro desconhecido'}`);
      }
    },
  };
}

export async function loadEnergyCreditsSnapshot(sessionToken: string): Promise<Record<string, unknown[]>> {
  const result = await callEndpoint({ sessionToken, operation: 'snapshot' });
  if (!result.ok) {
    throw new Error(`[ESA] Falha ao carregar snapshot: ${result.error ?? 'erro desconhecido'}`);
  }
  return (result.data ?? {}) as Record<string, unknown[]>;
}
