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

function writeActiveOrgId(orgId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_ORG_KEY, orgId);
  } catch {
    // sessionStorage may be unavailable in non-browser environments
  }
}

function buildRequestBody(activeOrgId: string | null): string {
  return activeOrgId ? JSON.stringify({ organizationId: activeOrgId }) : '{}';
}

export function clearActiveOrganization(): void {
  try {
    sessionStorage.removeItem(ACTIVE_ORG_KEY);
  } catch {
    // sessionStorage may be unavailable in non-browser environments
  }
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

async function _fetchAndParse(
  sessionToken: string,
  body: string,
): Promise<OrgContextResolution> {
  try {
    const res = await fetchContext(sessionToken, body);
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

export async function resolveOrganizationContext(
  sessionToken: string,
): Promise<OrgContextResolution> {
  const activeOrgId = readActiveOrgId();
  const first = await _fetchAndParse(sessionToken, buildRequestBody(activeOrgId));

  // Auto-select the single available organization when no explicit selection exists.
  // Covers: fresh sessions, new tabs, Ctrl+Shift+R, logout+login, renamed browsers.
  if (!activeOrgId && first.context) {
    const avail = first.context.availableOrganizations;
    if (Array.isArray(avail) && avail.length === 1 && avail[0].id) {
      writeActiveOrgId(avail[0].id);
      // Re-resolve with explicit org ID to confirm on the server side.
      const confirmed = await _fetchAndParse(
        sessionToken,
        JSON.stringify({ organizationId: avail[0].id }),
      );
      if (confirmed.context) return confirmed;
      // If re-resolve fails, fall back to the already-correct first result.
    }
  }

  return first;
}
