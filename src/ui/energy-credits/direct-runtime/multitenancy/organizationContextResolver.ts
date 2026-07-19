// ── ESA OS — Organization Context Resolver — Gate 8A ────────────────────────
// Chama o endpoint oficial para obter o contexto organizacional do usuário.
// O backend valida token, memberships e permissões — nunca o browser.

import type { OrganizationContext } from './types.js';

export interface OrgContextResolution {
  context: OrganizationContext | null;
  code: string | null; // null quando context está presente
}

const ACTIVE_ORG_KEY = 'esa_active_organization';

function readActiveOrgId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_ORG_KEY);
  } catch {
    return null;
  }
}

function buildRequestBody(activeOrgId: string | null): string {
  return activeOrgId ? JSON.stringify({ organizationId: activeOrgId }) : '{}';
}

async function fetchContext(sessionToken: string, body: string): Promise<Response> {
  return fetch('/.netlify/functions/organization-context', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body,
  });
}

export async function resolveOrganizationContext(
  sessionToken: string,
): Promise<OrgContextResolution> {
  const activeOrgId = readActiveOrgId();
  try {
    const res = await fetchContext(sessionToken, buildRequestBody(activeOrgId));
    if (res.status === 401) return { context: null, code: 'unauthorized' };
    if (res.status === 403) return { context: null, code: 'forbidden' };
    if (!res.ok) return { context: null, code: 'context_unavailable' };
    const data = (await res.json()) as { ok?: boolean; data?: OrganizationContext };
    if (!data?.ok || !data.data) return { context: null, code: 'context_unavailable' };
    return { context: data.data, code: null };
  } catch {
    return { context: null, code: 'backend_unavailable' };
  }
}
