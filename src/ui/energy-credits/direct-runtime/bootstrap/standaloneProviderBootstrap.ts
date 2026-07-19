// ============================================================
// ESA OS — Standalone Provider Bootstrap — Gate 7 / Gate 8A / Gate 8B
// IIFE: inicializa ESA Core, conecta ao Firebase (via Netlify Functions),
// hidrata repositório em memória + read model, expõe PersistentUiProvider
// via window.__ESA_UI_PROVIDER__ para o bridge.js consumir.
//
// Gate 8A: resolve contexto organizacional antes dos repositórios.
//   - tenancyMode 'single-user' mantém compatibilidade total com Gate 7
//   - tenancyMode 'organization' prepara contexto para Gate 8B
// Gate 8B: orgContext baked no httpClient; dual-read via loadEnergyCreditsSnapshot;
//   escritas organizacionais com versionamento via persistentUiProvider.
//
// Segurança:
//   - Sessão validada antes de qualquer acesso ao backend
//   - uid extraído do token apenas para auditoria (segurança real no servidor)
//   - Contexto org validado no backend — nunca role/permissions do browser
//   - Sem PII em logs
//   - Sem Firebase diretamente na UI
//   - Sem credenciais hardcoded
// ============================================================

import { ESA }                                                    from '../../../../core/app.js';
import { EnergyCreditsUIProvider }                                from '../../energy-credits-ui-provider.js';
import { resolveSessionToken }                                    from './sessionResolver.js';
import type { SessionResolution }                                 from './sessionResolver.js';
import { createHttpFirebaseClient, loadEnergyCreditsSnapshot }    from './httpFirebaseClient.js';
import { createPersistentUiProvider }                             from './persistentUiProvider.js';
import { resolveOrganizationContext }                             from '../multitenancy/organizationContextResolver.js';
import type { OrganizationContext }                               from '../multitenancy/types.js';

declare global {
  interface Window {
    ESA_OS?: unknown;
    __ESA_UI_PROVIDER__?: unknown;
    __ESA_UI_PROVIDER_STATUS__?: { status: 'ready' | 'error'; reason?: string };
    __ESA_UI_PROVIDER_ERROR__?: { code: string; message: string };
    __ESA_ORG_CONTEXT__?: OrganizationContext | null;
  }
}

function decodeUidFromToken(token: string): string | null {
  try {
    const lastDot = token.lastIndexOf('.');
    if (lastDot <= 0) return null;
    const body = token.slice(0, lastDot);
    const padded = body + '=='.slice(0, (4 - (body.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { uid?: unknown; exp?: number };
    if (typeof payload.uid !== 'string' || !payload.uid) return null;
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

function dispatchProviderError(code: string, reason: string): void {
  window.__ESA_UI_PROVIDER_STATUS__ = { status: 'error', reason: code };
  window.__ESA_UI_PROVIDER_ERROR__ = { code, message: reason };
  window.dispatchEvent(new CustomEvent('esa:ui-provider:error', { detail: { code } }));
}

const ORG_CONTEXT_MESSAGES: Record<string, string> = {
  organization_invalid:       'Organização inválida ou acesso não autorizado.',
  organization_inactive:      'Organização inativa. Contacte o administrador.',
  membership_inactive:        'Sua associação a esta organização está inativa.',
  no_permission:              'Sem permissão para acessar esta organização.',
  organization_context_failed:'Não foi possível carregar o contexto organizacional.',
  forbidden:                  'Acesso negado a esta organização.',
};

(function bootstrapStandaloneProvider(): void {

  (async (): Promise<void> => {
    try {
      // ── 1. Session validation ────────────────────────────────────────────────
      const SESSION_ERROR_MESSAGES: Record<string, string> = {
        no_session:              'Sessão não encontrada. Faça login para acessar o painel.',
        invalid_session_format:  'Formato de sessão inválido. Faça login novamente.',
        session_exchange_failed: 'Não foi possível renovar a sessão. Faça login novamente.',
        unauthorized:            'Sessão não autorizada. Faça login novamente.',
        backend_unavailable:     'Serviço de autenticação indisponível. Tente novamente em instantes.',
      };

      const { token: sessionToken, code: sessionCode }: SessionResolution = await resolveSessionToken();
      if (!sessionToken) {
        const code = sessionCode ?? 'no_session';
        const msg = SESSION_ERROR_MESSAGES[code] ?? 'Erro de sessão desconhecido.';
        dispatchProviderError(code, msg);
        console.warn('[ESA Standalone]', code);
        return;
      }

      const uid = decodeUidFromToken(sessionToken);
      if (!uid) {
        dispatchProviderError('invalid_session', 'Token de sessão inválido ou expirado.');
        console.warn('[ESA Standalone] invalid_session');
        return;
      }

      // ── 2. Resolve organization context (Gate 8A) ───────────────────────────
      // Non-blocking: falha retorna null e tenancyMode='single-user' continua.
      // Nenhum path de dados muda nesta missão; contexto exposto para Gate 8B.
      const { context: orgContext, code: orgCode } = await resolveOrganizationContext(sessionToken);
      window.__ESA_ORG_CONTEXT__ = orgContext;
      if (orgCode) {
        const orgMsg = ORG_CONTEXT_MESSAGES[orgCode] ?? 'Não foi possível carregar o contexto organizacional.';
        console.warn('[ESA Standalone] org_context_code', orgCode, orgMsg);
      }
      console.info('[ESA Standalone] tenancy_mode', orgContext?.tenancyMode ?? 'single-user');

      // ── 3. Initialize ESA Core ───────────────────────────────────────────────
      (ESA as { initialize(): void }).initialize();
      window.ESA_OS = ESA;

      // ── 4. Build HTTP client and load Firebase snapshot ──────────────────────
      // Gate 8B: orgContext baked into client; routing to org vs legacy handled server-side.
      const httpClient = createHttpFirebaseClient(sessionToken, orgContext);
      const snapshotResult = await loadEnergyCreditsSnapshot(sessionToken, orgContext);
      const snapshot = snapshotResult.data;
      console.info('[ESA Standalone] snapshot_source', snapshotResult.dataSource, 'migration_required', snapshotResult.migrationRequired);

      // ── 5. Hydrate memory repository (mutation target) ───────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memoryRepo = (ESA as any).getEnergyCreditsRepository();
      memoryRepo.hydrateFromSnapshot(snapshot);

      // ── 6. Hydrate read model (query source) ─────────────────────────────────
      (ESA as { hydrateEnergyCreditsReadModel(s: unknown, o: unknown): void })
        .hydrateEnergyCreditsReadModel(snapshot, { replace: true });

      // ── 7. Build Firebase repository backed by HTTP client ───────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firebaseRepo = (ESA as any).createEnergyCreditsFirebaseRepository(httpClient);

      // ── 8. Build inner UIProvider (reads from hydrated read model) ───────────
      const UIProviderCtor = EnergyCreditsUIProvider as new (app: unknown) => unknown;
      const inner = new UIProviderCtor(ESA) as Record<string, (...args: unknown[]) => unknown>;

      // ── 9. Wrap with persistent write-through ────────────────────────────────
      // Gate 8B: passa orgContext + httpClient para habilitar escritas organizacionais com versionamento.
      const provider = createPersistentUiProvider(inner, firebaseRepo, memoryRepo, ESA as {
        hydrateEnergyCreditsReadModel(s: unknown, o: { replace: boolean }): void
      }, uid, orgContext, httpClient);

      // ── 10. Expose and signal readiness ──────────────────────────────────────
      window.__ESA_UI_PROVIDER__ = provider;
      window.__ESA_UI_PROVIDER_STATUS__ = { status: 'ready' };
      window.dispatchEvent(
        new CustomEvent('esa:ui-provider:ready', { detail: { source: 'standalone-bootstrap', uid } }),
      );
      console.info('[ESA Standalone] provider_initialized');

    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 200) : 'unknown';
      dispatchProviderError('bootstrap_failed', msg);
      console.error('[ESA Standalone] bootstrap_failed');
    }
  })();

})();
