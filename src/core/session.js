/**
 * ESA Core v2 — Session
 *
 * Responsável por padronizar a futura gestão de sessão da plataforma.
 *
 * IMPORTANTE:
 * Este arquivo ainda NÃO está conectado ao index.html.
 */

const SESSION_KEY = 'esa_core_session_v2';

export function saveSession(session) {
  if (!session) return;

  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...session,
      savedAt: new Date().toISOString()
    })
  );
}

export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasSession() {
  return !!getSession();
}