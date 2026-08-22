"use server";

import { DbTokenStore } from "@/lib/schwab/token-store";
import { SchwabClient } from "@/lib/schwab/client";

// Schwab refresh tokens expire ~7 days after being issued/refreshed.
const REAUTH_WARNING_AFTER_MS = 6 * 24 * 60 * 60 * 1000;

export interface SchwabConnectionStatus {
  connected: boolean;
  lastConnectedAt: string | null;
  accessTokenExpiresAt: string | null;
  needsReauthSoon: boolean;
}

// Only non-secret metadata is returned here — never pass tokens to a client component.
export async function getSchwabConnectionStatus(): Promise<SchwabConnectionStatus> {
  const meta = await new DbTokenStore().getMetadata();
  if (!meta) {
    return { connected: false, lastConnectedAt: null, accessTokenExpiresAt: null, needsReauthSoon: false };
  }

  return {
    connected: true,
    lastConnectedAt: meta.updatedAt.toISOString(),
    accessTokenExpiresAt: new Date(meta.expiresAt).toISOString(),
    needsReauthSoon: Date.now() - meta.updatedAt.getTime() > REAUTH_WARNING_AFTER_MS,
  };
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

export async function testSchwabConnection(): Promise<TestConnectionResult> {
  try {
    const accounts = await new SchwabClient(new DbTokenStore()).getAccounts();
    return { ok: true, message: `Connected — ${accounts.length} account(s) visible.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection test failed." };
  }
}
