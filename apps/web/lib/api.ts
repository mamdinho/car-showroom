const API = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");

type FetchOpts = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  idToken?: string | null;
  body?: any;
  cache?: RequestCache;
};

async function handle(res: Response) {
  // OK with no content
  if (res.status === 204) return null;

  // Try to parse body if any
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // not JSON; return raw text to the caller
      data = text;
    }
  }

  if (!res.ok) {
    // Normalise error shape for caller
    const msg =
      (data && (data.error || data.message)) ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

async function request(path: string, opts: FetchOpts = {}) {
  const headers: Record<string, string> = {};
  if (opts.idToken) headers["Authorization"] = `Bearer ${opts.idToken}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(API + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? "no-store",
  });

  return handle(res);
}

export function apiGet(path: string, idToken?: string | null) {
  return request(path, { idToken: idToken ?? null });
}
export function apiPost(path: string, idToken: string, body: any) {
  return request(path, { method: "POST", idToken, body });
}
export function apiPut(path: string, idToken: string, body: any) {
  return request(path, { method: "PUT", idToken, body });
}
export function apiPatch(path: string, idToken: string, body: any) {
  return request(path, { method: "PATCH", idToken, body });
}
export function apiDelete(path: string, idToken: string) {
  return request(path, { method: "DELETE", idToken });
}
