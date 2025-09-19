const cfg = {
  region: process.env.NEXT_PUBLIC_REGION!,
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!.replace(/\/$/, ""),
  clientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
  logoutRedirectUri: process.env.NEXT_PUBLIC_LOGOUT_REDIRECT_URI!,
};

export function buildAuthorizeUrl(codeChallenge: string, state: string) {
  const url = new URL(cfg.domain + "/oauth2/authorize");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("state", state);
  return url.toString();
}

export function buildLogoutUrl(idTokenHint?: string) {
  const url = new URL(cfg.domain + "/logout");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("logout_uri", cfg.logoutRedirectUri);
  if (idTokenHint) url.searchParams.set("id_token_hint", idTokenHint);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const tokenUrl = cfg.domain + "/oauth2/token";
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", cfg.clientId);
  body.set("code", code);
  body.set("redirect_uri", cfg.redirectUri);
  body.set("code_verifier", codeVerifier);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Token exchange failed");
  return res.json() as Promise<{
    id_token: string;
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }>;
}
