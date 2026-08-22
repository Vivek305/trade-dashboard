import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { encrypt, decrypt, type EncryptedPayload } from "./crypto";

const SETTINGS_KEY = "schwab_tokens";

export interface SchwabTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope: string;
  /** epoch ms when accessToken expires */
  expiresAt: number;
}

export interface SchwabTokenMetadata {
  /** when the tokens were last saved (initial auth or refresh) — no secrets */
  updatedAt: Date;
  expiresAt: number;
  scope: string;
}

/** Decouples the OAuth/API client from any concrete storage backend. */
export interface SchwabTokenStore {
  getTokens(): Promise<SchwabTokens | null>;
  /** Non-secret status info, safe to pass to client components without decrypting tokens. */
  getMetadata(): Promise<SchwabTokenMetadata | null>;
  saveTokens(tokens: SchwabTokens): Promise<void>;
  clear(): Promise<void>;
}

interface StoredValue {
  accessToken: EncryptedPayload;
  refreshToken: EncryptedPayload;
  tokenType: string;
  scope: string;
  expiresAt: number;
}

export class DbTokenStore implements SchwabTokenStore {
  async getTokens(): Promise<SchwabTokens | null> {
    const rows = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1);
    const row = rows[0];
    if (!row?.value) return null;

    const stored = row.value as StoredValue;
    return {
      accessToken: decrypt(stored.accessToken),
      refreshToken: decrypt(stored.refreshToken),
      tokenType: stored.tokenType,
      scope: stored.scope,
      expiresAt: stored.expiresAt,
    };
  }

  async getMetadata(): Promise<SchwabTokenMetadata | null> {
    const rows = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1);
    const row = rows[0];
    if (!row?.value) return null;

    const stored = row.value as StoredValue;
    return { updatedAt: row.updatedAt, expiresAt: stored.expiresAt, scope: stored.scope };
  }

  async saveTokens(tokens: SchwabTokens): Promise<void> {
    const stored: StoredValue = {
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      expiresAt: tokens.expiresAt,
    };

    await db
      .insert(settings)
      .values({ key: SETTINGS_KEY, value: stored, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: stored, updatedAt: new Date() },
      });
  }

  async clear(): Promise<void> {
    await db.delete(settings).where(eq(settings.key, SETTINGS_KEY));
  }
}
