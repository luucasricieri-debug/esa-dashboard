// ============================================================
// ESA OS — Standalone Provider Bootstrap — Gate 7
// IIFE: inicializa ESA Core, conecta ao Firebase (via Netlify Functions),
// hidrata repositório em memória + read model, expõe PersistentUiProvider
// via window.__ESA_UI_PROVIDER__ para o bridge.js consumir.
//
// Segurança:
//   - Sessão validada antes de qualquer acesso ao backend
//   - uid extraído do token apenas para auditoria (segurança real no servidor)
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

declare global {
  interface Window {
    ESA_OS?: unknown;
    __ESA_UI_PROVIDER__?: unknown;
    __ESA_UI_PROVIDER_STATUS__?: { status: 'ready' | 'error'; reason?: string };
    __ESA_UI_PROVIDER_ERROR__?: { code: string; message: string };
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

      // ── 2. Initialize ESA Core ───────────────────────────────────────────────
      (ESA as { initialize(): void }).initialize();
      window.ESA_OS = ESA;

      // ── 3. Build HTTP client and load Firebase snapshot ──────────────────────
      const httpClient = createHttpFirebaseClient(sessionToken);
      const snapshot = await loadEnergyCreditsSnapshot(sessionToken);

      // ── 4. Hydrate memory repository (mutation target) ───────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memoryRepo = (ESA as any).getEnergyCreditsRepository();
      memoryRepo.hydrateFromSnapshot(snapshot);

      // ── 5. Hydrate read model (query source) ─────────────────────────────────
      (ESA as { hydrateEnergyCreditsReadModel(s: unknown, o: unknown): void })
        .hydrateEnergyCreditsReadModel(snapshot, { replace: true });

      // ── 6. Build Firebase repository backed by HTTP client ───────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firebaseRepo = (ESA as any).createEnergyCreditsFirebaseRepository(httpClient);

      // ── 7. Build inner UIProvider (reads from hydrated read model) ───────────
      const UIProviderCtor = EnergyCreditsUIProvider as new (app: unknown) => unknown;
      const inner = new UIProviderCtor(ESA) as Record<string, (...args: unknown[]) => unknown>;

      // ── 8. Wrap with persistent write-through ────────────────────────────────
      const provider = createPersistentUiProvider(inner, firebaseRepo, memoryRepo, ESA as {
        hydrateEnergyCreditsReadModel(s: unknown, o: { replace: boolean }): void
      }, uid);

      // ── 9. Expose and signal readiness ───────────────────────────────────────
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
