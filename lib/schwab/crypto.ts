import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended nonce size for GCM

function loadKey(): Buffer {
  const raw = process.env.SCHWAB_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SCHWAB_TOKEN_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SCHWAB_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of `openssl rand -base64 32`).");
  }
  return key;
}

export interface EncryptedPayload {
  iv: string; // base64
  ciphertext: string; // base64
  authTag: string; // base64
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = loadKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
