import { randomBytes } from "node:crypto";

// Pure OAuth logic — no DB or Next.js imports, so it can be used identically from
// the Next.js app (server actions/route handlers) and from the standalone
// scripts/schwab-auth.ts host script. This is the "decouple from frontend" seam.

const AUTHORIZE_URL = "https://api.schwabapi.com/v1/oauth/authorize";
const TOKEN_URL = "https://api.schwabapi.com/v1/oauth/token";

export interface SchwabOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function loadOAuthConfigFromEnv(): SchwabOAuthConfig {
  const clientId = process.env.SCHWAB_CLIENT_ID;
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET;
  const redirectUri = process.env.SCHWAB_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, and SCHWAB_REDIRECT_URI must all be set (see .env.example)."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope: string;
  expires_in: number; // seconds
  id_token?: string;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope: string;
  /** epoch ms when accessToken expires */
  expiresAt: number;
}

/** Generates a random state value to guard the authorization redirect against CSRF. */
export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizationUrl(config: SchwabOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function basicAuthHeader(config: SchwabOAuthConfig): string {
  return "Basic " + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
}

function toTokenResult(raw: RawTokenResponse): TokenResult {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    tokenType: raw.token_type,
    scope: raw.scope,
    expiresAt: Date.now() + raw.expires_in * 1000,
  };
}

async function postToTokenEndpoint(
  config: SchwabOAuthConfig,
  body: URLSearchParams
): Promise<TokenResult> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    // Never include tokens/secrets in error messages or logs.
    throw new Error(`Schwab token request failed: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as RawTokenResponse;
  return toTokenResult(raw);
}

export function exchangeCodeForTokens(
  config: SchwabOAuthConfig,
  code: string
): Promise<TokenResult> {
  return postToTokenEndpoint(
    config,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    })
  );
}

export function refreshAccessToken(
  config: SchwabOAuthConfig,
  refreshToken: string
): Promise<TokenResult> {
  return postToTokenEndpoint(
    config,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}
