// ── Session token resolver — Gate 7 / Session Compat Fix ─────────────────────
// Reads HMAC session token from browser storage.
// If stored session has uid+login but no token, calls session-token exchange endpoint.
// Error codes: no_session | invalid_session_format | unauthorized |
//              session_exchange_failed | backend_unavailable

export interface SessionResolution {
  token: string | null;
  code: string | null;
}

interface StoredSession {
  uid?: string;
  login?: string;
  sessionToken?: string;
  expiresAt?: string;
  [k: string]: unknown;
}

function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

async function exchangeSessionToken(
  uid: string,
  login: string,
): Promise<{ token: string | null; code: string }> {
  try {
    const res = await fetch('/.netlify/functions/session-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, login }),
    });
    if (res.status === 401) return { token: null, code: 'unauthorized' };
    if (!res.ok) return { token: null, code: 'session_exchange_failed' };
    const data = (await res.json()) as { sessionToken?: string };
    const token = typeof data?.sessionToken === 'string' ? data.sessionToken : null;
    return { token, code: token ? 'ok' : 'session_exchange_failed' };
  } catch {
    return { token: null, code: 'backend_unavailable' };
  }
}

function cacheToken(token: string): void {
  try {
    const raw = sessionStorage.getItem('esa_session');
    const stored = parseStoredSession(raw) ?? {};
    stored.sessionToken = token;
    sessionStorage.setItem('esa_session', JSON.stringify(stored));
  } catch {
    // storage write failure is non-fatal
  }
}

export async function resolveSessionToken(): Promise<SessionResolution> {
  let parsed: StoredSession | null = null;
  try {
    parsed = parseStoredSession(sessionStorage.getItem('esa_session'));
    if (!parsed) parsed = parseStoredSession(localStorage.getItem('esa_remember'));
  } catch {
    return { token: null, code: 'no_session' };
  }

  if (!parsed) return { token: null, code: 'no_session' };

  if (!parsed.uid || typeof parsed.uid !== 'string') {
    return { token: null, code: 'invalid_session_format' };
  }

  // Session has a signed token → return it (backend verifies expiry)
  if (parsed.sessionToken && typeof parsed.sessionToken === 'string') {
    return { token: parsed.sessionToken, code: null };
  }

  // Session has uid+login but no token → exchange with backend
  const login = typeof parsed.login === 'string' ? parsed.login.trim() : '';
  if (!login) return { token: null, code: 'invalid_session_format' };

  const { token, code } = await exchangeSessionToken(parsed.uid, login);
  if (token) {
    cacheToken(token);
    return { token, code: null };
  }
  return { token: null, code };
}
