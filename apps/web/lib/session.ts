export type AppSession = {
  idToken: string;
  accessToken: string;
  expires_in?: number;
};

const STORAGE_KEY = "carshowroom_session";

// --- load / save / clear ---
export function loadSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: { id_token: string; access_token: string; expires_in?: number }) {
  const shaped: AppSession = { idToken: s.id_token, accessToken: s.access_token, expires_in: s.expires_in };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shaped));
  notify();
}

export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  try { sessionStorage.removeItem("oauth_state"); } catch {}
  try { sessionStorage.removeItem("oauth_returnTo"); } catch {}
  notify();
}

// --- tiny pub/sub so components re-render on session change ---
type Sub = () => void;
const subs = new Set<Sub>();
function notify() { subs.forEach((fn) => fn()); }

/** Subscribe to session changes; returns a cleanup that removes the listener (void) */
export function subscribe(fn: Sub): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn); // ensure cleanup returns void, not boolean
  };
}

// keep windows in sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) notify();
  });
}
