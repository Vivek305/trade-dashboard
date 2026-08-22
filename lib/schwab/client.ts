import {
  loadOAuthConfigFromEnv,
  exchangeCodeForTokens,
  refreshAccessToken,
  type SchwabOAuthConfig,
  type TokenResult,
} from "./oauth";
import type { SchwabTokenStore, SchwabTokens } from "./token-store";

const API_BASE = "https://api.schwabapi.com";

// Refresh a bit early to avoid racing the 30-minute access-token expiry.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

function toTokens(result: TokenResult): SchwabTokens {
  return { ...result };
}

/** Returns a currently-valid access token, refreshing and persisting it if needed. */
export async function getValidAccessToken(
  tokenStore: SchwabTokenStore,
  config: SchwabOAuthConfig = loadOAuthConfigFromEnv()
): Promise<string> {
  const tokens = await tokenStore.getTokens();
  if (!tokens) {
    throw new Error(
      "No Schwab tokens found. Run `npm run schwab:auth` on the host to connect this app to Schwab."
    );
  }

  if (Date.now() < tokens.expiresAt - EXPIRY_SAFETY_MARGIN_MS) {
    return tokens.accessToken;
  }

  const refreshed = toTokens(await refreshAccessToken(config, tokens.refreshToken));
  await tokenStore.saveTokens(refreshed);
  return refreshed.accessToken;
}

/** Completes the initial handshake (used by scripts/schwab-auth.ts) and persists the result. */
export async function completeAuthorization(
  tokenStore: SchwabTokenStore,
  code: string,
  config: SchwabOAuthConfig = loadOAuthConfigFromEnv()
): Promise<void> {
  const tokens = toTokens(await exchangeCodeForTokens(config, code));
  await tokenStore.saveTokens(tokens);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function schwabFetch(accessToken: string, path: string, init?: RequestInit): Promise<unknown> {
  let attempt = 0;
  for (;;) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      return response.json();
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new Error(`Schwab API request to ${path} failed: ${response.status} ${response.statusText}`);
    }

    const retryAfterHeader = response.headers.get("Retry-After");
    const delay = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : RETRY_BASE_DELAY_MS * 2 ** attempt;
    await sleep(delay);
    attempt += 1;
  }
}

// Minimal provisional shapes — only fields needed so far are typed. Full schema
// (legs, greeks, etc.) will be fleshed out when the trade-sync pipeline is built.
export interface SchwabAccount {
  securitiesAccount: {
    accountNumber: string;
    type: string;
    [key: string]: unknown;
  };
}

export interface SchwabTransaction {
  activityId: number;
  time: string;
  type: string;
  [key: string]: unknown;
}

export interface SchwabPriceHistoryBar {
  datetime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SchwabQuote {
  symbol: string;
  quote: Record<string, unknown>;
}

export class SchwabClient {
  constructor(private readonly tokenStore: SchwabTokenStore) {}

  private async accessToken(): Promise<string> {
    return getValidAccessToken(this.tokenStore);
  }

  async getAccounts(): Promise<SchwabAccount[]> {
    const token = await this.accessToken();
    return (await schwabFetch(token, "/trader/v1/accounts")) as SchwabAccount[];
  }

  async getTransactions(
    accountHash: string,
    opts: { startDate: string; endDate: string; types?: string }
  ): Promise<SchwabTransaction[]> {
    const token = await this.accessToken();
    const params = new URLSearchParams({
      startDate: opts.startDate,
      endDate: opts.endDate,
      ...(opts.types ? { types: opts.types } : {}),
    });
    return (await schwabFetch(
      token,
      `/trader/v1/accounts/${accountHash}/transactions?${params.toString()}`
    )) as SchwabTransaction[];
  }

  async getPriceHistory(
    symbol: string,
    opts: { periodType?: string; period?: number; frequencyType?: string; frequency?: number }
  ): Promise<{ candles: SchwabPriceHistoryBar[] }> {
    const token = await this.accessToken();
    const params = new URLSearchParams({ symbol, ...toStringRecord(opts) });
    return (await schwabFetch(token, `/marketdata/v1/pricehistory?${params.toString()}`)) as {
      candles: SchwabPriceHistoryBar[];
    };
  }

  async getQuotes(symbols: string[]): Promise<Record<string, SchwabQuote>> {
    const token = await this.accessToken();
    const params = new URLSearchParams({ symbols: symbols.join(",") });
    return (await schwabFetch(token, `/marketdata/v1/quotes?${params.toString()}`)) as Record<
      string,
      SchwabQuote
    >;
  }
}

function toStringRecord(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = String(value);
  }
  return result;
}
