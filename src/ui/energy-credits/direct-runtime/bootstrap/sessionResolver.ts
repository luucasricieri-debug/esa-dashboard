// ── Session token resolver — Gate 7 ──────────────────────────────────────────
// Reads HMAC session token from browser storage (never localStorage for PII).
// token format: { sessionToken: string, expiresAt?: string, ... }
// Preference: sessionStorage (short-lived) → localStorage (remember-me).

interface StoredSession {
  sessionToken?: string;
  expiresAt?: string;
  [k: string]: unknown;
}

function parseSession(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    const token = parsed?.sessionToken;
    if (!token || typeof token !== 'string') return null;
    // Let the backend verify expiry; skip client-side check to avoid clock skew.
    return token;
  } catch {
    return null;
  }
}

export function resolveSessionToken(): string | null {
  try {
    const ss = parseSession(sessionStorage.getItem('esa_session'));
    if (ss) return ss;
    return parseSession(localStorage.getItem('esa_remember'));
  } catch {
    // Storage access denied (e.g. private-browsing with strict settings)
    return null;
  }
}
