// src/lib/ai/encryption.ts
// Secure server-side credential encryption at rest and masking.
// Never expose raw keys in responses, logs, or client-side code.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

/** AES-GCM standard nonce size — what new records use (SEC-020). */
const IV_LENGTH = 12;

/** Envelope tag written by `encryptApiKey`. */
const CURRENT_VERSION = "v2";

/** AES-GCM auth tags are always 16 bytes. */
const AUTH_TAG_BYTES = 16;

const HEX_RE = /^[0-9a-fA-F]+$/u;

/** Parse a hex envelope part; `null` when it is not usable hex material. */
function parseHexPart(
  part: string,
  expectedBytes?: number
): Buffer | null {
  if (!part || part.length % 2 !== 0 || !HEX_RE.test(part)) return null;

  const buffer = Buffer.from(part, "hex");

  if (expectedBytes !== undefined && buffer.length !== expectedBytes) {
    return null;
  }

  return buffer;
}

/** Derive a 32-byte master encryption key from environment secrets */
function getMasterSecret(): Buffer {
  const secret =
    process.env.AI_CREDENTIALS_SECRET ||
    process.env.DIRECTUS_STATIC_TOKEN ||
    process.env.AUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[ai-encryption] FATAL: Missing AI_CREDENTIALS_SECRET, DIRECTUS_STATIC_TOKEN, or AUTH_SECRET in production environment."
      );
    }
    console.warn(
      "[ai-encryption] ⚠️ No encryption secret defined in environment. Using dev-only volatile fallback key."
    );
    return crypto.createHash("sha256").update("vos-sync-dev-volatile-key").digest();
  }

  // Key derivation is intentionally unchanged: the stored envelopes are keyed
  // with it, so rotating it would strand every provider credential on disk.
  return crypto.createHash("sha256").update(secret).digest();
}

/** Encrypt raw API key using AES-256-GCM.
 * Format: `v2:<ivHex(12B)>:<authTagHex(16B)>:<ciphertextHex>`
 */
export function encryptApiKey(rawKey: string): string {
  if (!rawKey) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterSecret(), iv);

  const encrypted = Buffer.concat([cipher.update(rawKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${CURRENT_VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a `v2` envelope. */
function decryptEnvelope(iv: Buffer, tag: Buffer, encryptedText: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, getMasterSecret(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Un-versioned pre-hardening records were written as `iv:tag:ciphertext` with a
 * 16-byte IV. The IV length is taken from the blob itself (AES-GCM accepts any
 * IV size), so those rows still decrypt while a new write is always 12 bytes.
 */
function parseLegacyEnvelope(payload: string): [Buffer, Buffer, Buffer] | null {
  const parts = payload.split(":");
  if (parts.length !== 3) return null;

  const iv = parseHexPart(parts[0]);
  const tag = parseHexPart(parts[1], AUTH_TAG_BYTES);
  const encryptedText = parseHexPart(parts[2]);

  if (!iv || !tag || !encryptedText || iv.length < 8) return null;

  return [iv, tag, encryptedText];
}

/**
 * Legacy plaintext is only tolerated when the value cannot be an envelope at
 * all, and every pass-through is logged (first time, then every 50th) so a
 * credential stored unencrypted at rest is never invisible.
 */
let plaintextPassthroughs = 0;

function notePlaintextPassthrough(): void {
  plaintextPassthroughs += 1;

  if (plaintextPassthroughs === 1 || plaintextPassthroughs % 50 === 0) {
    console.warn(
      "[ai-encryption] Passed through " +
        plaintextPassthroughs +
        " stored provider key(s) that are not an encrypted envelope. " +
        "Credentials in this shape sit in the config file as plaintext; " +
        "re-save the provider key to encrypt it under the v2 format."
    );
  }
}

/** Decrypt raw API key using AES-256-GCM */
export function decryptApiKey(encryptedPayload?: string): string {
  if (!encryptedPayload) return "";

  const parts = encryptedPayload.split(":");

  if (parts.length === 4 && parts[0] === CURRENT_VERSION) {
    const iv = parseHexPart(parts[1]);
    const tag = parseHexPart(parts[2], AUTH_TAG_BYTES);
    const encryptedText = parseHexPart(parts[3]);

    if (!iv || !tag || !encryptedText || iv.length < 8) {
      // Tagged as an envelope but malformed: fail closed rather than treat a
      // corrupt ciphertext as a literal API key.
      console.error("[ai-encryption] ❌ Malformed v2 API key envelope.");
      return "";
    }

    try {
      return decryptEnvelope(iv, tag, encryptedText);
    } catch (err) {
      console.error("[ai-encryption] ❌ Failed to decrypt API key:", err instanceof Error ? err.message : err);
      return "";
    }
  }

  const legacy = parseLegacyEnvelope(encryptedPayload);

  if (!legacy) {
    // A tagged envelope of a version this build cannot read must never be
    // handed back as if it were the literal key.
    if (parts.length === 4 && /^v\d+$/u.test(parts[0])) {
      console.error(`[ai-encryption] ❌ Unsupported API key envelope version "${parts[0]}".`);
      return "";
    }

    notePlaintextPassthrough();
    return encryptedPayload;
  }

  try {
    return decryptEnvelope(...legacy);
  } catch (err) {
    console.error("[ai-encryption] ❌ Failed to decrypt API key:", err instanceof Error ? err.message : err);
    return "";
  }
}

/**
 * Mask a key for client-safe responses. Only the last 4 characters are
 * revealed — enough to tell two credentials apart, never enough to leak a
 * prefix that identifies the account or environment.
 */
export function maskApiKey(rawOrEncryptedKey?: string): string {
  if (!rawOrEncryptedKey) return "";
  const raw = decryptApiKey(rawOrEncryptedKey);
  if (!raw || raw.length <= 8) return "••••••••";
  return `••••••••${raw.slice(-4)}`;
}
