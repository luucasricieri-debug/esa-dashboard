/**
 * ESA OS — Contexts / Solana
 * Public API (Barrel Export)
 *
 * Ponto de entrada público do contexto Solana.
 * Consumidores devem importar exclusivamente deste arquivo.
 */

export {
  SolanaCommercialContextBuilder,
  CONTEXT_VERSION,
  CONTEXT_TYPE,
  CONTEXT_DOMAIN,
  ORGANIZATION_ID,
  CAPABILITIES,
  RESTRICTIONS,
} from './commercial-context-builder.js';
