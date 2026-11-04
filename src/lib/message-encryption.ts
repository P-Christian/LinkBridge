import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Envelope versions (SEC-018).
 *
 * - `v1` — original format: one shared master key for every conversation, no
 *   HKDF and no AAD. Kept decrypt-only so existing rows stay readable.
 * - `v2` — current format: HKDF-SHA256 subkey scoped to the conversation, plus
 *   the conversation context bound as AAD.
 */
const LEGACY_VERSION = "v1";
const CURRENT_VERSION = "v2";

const HKDF_SALT = "vos-sync/message-encryption/v2";
const HKDF_INFO_PREFIX = "message-key:";
const AAD_PREFIX = `${CURRENT_VERSION}|`;

/**
 * Context used when a caller genuinely has no conversation id (e.g. a preview
 * built from a row that did not select `conversation_id`). It is a constant,
 * so such rows still get the KDF and the versioned envelope, but they share
 * one subkey instead of a per-conversation one — see the caller note on
 * `encryptMessage`.
 */
const UNSCOPED_CONTEXT = "unscoped";

function getKey(): Buffer {
  const secret = process.env.MESSAGE_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("MESSAGE_ENCRYPTION_KEY is not configured.");
  }

  const key = Buffer.from(secret, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      "MESSAGE_ENCRYPTION_KEY must be a base64-encoded 32-byte key."
    );
  }

  return key;
}

/**
 * Canonical context for a conversation. Route params arrive as strings and
 * Directus rows as numbers, so both forms must collapse to the same key —
 * `"12"`, `12` and `" 12 "` all mean the same conversation.
 * Returns `null` when the caller supplied nothing usable.
 */
function expectedContext(
  conversationId?: string | number | null
): string | null {
  if (typeof conversationId === "number") {
    return Number.isFinite(conversationId) ? String(conversationId) : null;
  }

  if (typeof conversationId === "string") {
    const trimmed = conversationId.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function contextFor(
  conversationId?: string | number | null
): string {
  return expectedContext(conversationId) ?? UNSCOPED_CONTEXT;
}

/** Per-conversation subkey; the master key never encrypts data directly. */
function deriveContextKey(context: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      getKey(),
      Buffer.from(HKDF_SALT, "utf8"),
      Buffer.from(`${HKDF_INFO_PREFIX}${context}`, "utf8"),
      KEY_LENGTH
    )
  );
}

/** AAD binds the envelope to its version + context. */
function aadFor(context: string): Buffer {
  return Buffer.from(`${AAD_PREFIX}${context}`, "utf8");
}

/**
 * Encrypts plaintext message using AES-256-GCM under a key derived for
 * `conversationId`.
 *
 * Output format:
 * `v2:<contextBase64Url>:<ivBase64>:<authTagBase64>:<ciphertextBase64>`
 *
 * @param conversationId optional but strongly preferred — pass the conversation
 *   the row belongs to so the subkey and the AAD are scoped to it. Omitting it
 *   falls back to a single shared `unscoped` subkey (`v1` behaviour improved
 *   only by the KDF), which is why every caller that has an id available should
 *   forward it.
 */
export function encryptMessage(
  plaintext: string,
  conversationId?: string | number | null
): string {
  const context = contextFor(conversationId);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, deriveContextKey(context), iv);
  cipher.setAAD(aadFor(context));

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    CURRENT_VERSION,
    Buffer.from(context, "utf8").toString("base64url"),
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/** Decrypts a `v1` row: shared master key, no KDF, no AAD. */
function decryptLegacy(payload: string): string {
  const [, ivBase64, authTagBase64, encryptedBase64] = payload.split(":");

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted message format.");
  }

  const key = getKey();

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Decrypts a versioned AES-256-GCM ciphertext payload (`v2` or legacy `v1`).
 *
 * The `v2` envelope carries its own context so rows stay readable by callers
 * that cannot supply one. When `conversationId` IS supplied it is verified
 * against that context: a ciphertext produced for another conversation is
 * rejected instead of being silently honoured.
 */
export function decryptMessage(
  payload: string,
  conversationId?: string | number | null
): string {
  const [version, second, third, fourth, fifth] = payload.split(":");

  if (version === LEGACY_VERSION) {
    return decryptLegacy(payload);
  }

  if (version !== CURRENT_VERSION) {
    throw new Error("Unsupported message encryption version.");
  }

  const [contextBase64Url, ivBase64, authTagBase64, encryptedBase64] = [
    second,
    third,
    fourth,
    fifth,
  ];

  if (!contextBase64Url || !ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted message format.");
  }

  const context = Buffer.from(contextBase64Url, "base64url").toString("utf8");

  // A `v2` row written before a call site knew its conversation id carries the
  // `unscoped` marker. It has no conversation to conflict with, so it must stay
  // readable once callers start passing one — otherwise rolling out the extra
  // argument would lock out the messages written in between.
  const expected = expectedContext(conversationId);
  if (expected !== null && context !== UNSCOPED_CONTEXT && expected !== context) {
    throw new Error(
      "Encrypted message does not belong to the requested conversation."
    );
  }

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    deriveContextKey(context),
    iv
  );
  decipher.setAAD(aadFor(context));
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Legacy plaintext rows are never silently downgraded: every pass-through is
 * counted and surfaced once (then every 100th) so the migration is visible in
 * logs without flooding them.
 */
let legacyPlaintextRows = 0;

function noteLegacyPlaintextRow(): void {
  legacyPlaintextRows += 1;

  if (legacyPlaintextRows === 1 || legacyPlaintextRows % 100 === 0) {
    console.warn(
      "[message-encryption] Served " +
        legacyPlaintextRows +
        " legacy plaintext message_content row(s) without decryption. " +
        'Rows must start with "v1:" or "v2:" to be treated as encrypted; ' +
        "re-encrypt them or migrate the collection."
    );
  }
}

/**
 * Safely decrypts message_content:
 * - If null/undefined, returns null.
 * - If it starts with "v2:", decrypts with the per-conversation subkey (and,
 *   when `conversationId` is supplied, verifies the row belongs to it).
 * - If it starts with "v1:", decrypts with the legacy shared key.
 * - If neither, it is a pre-encryption plaintext row: returned as-is, but
 *   counted and warned about.
 * - Decryption errors return "[Unable to decrypt message]".
 */
export function safeDecryptMessage(
  content: string | null | undefined,
  conversationId?: string | number | null
): string | null {
  if (content == null) return null;
  if (typeof content !== "string") return null;

  if (
    content.startsWith(`${CURRENT_VERSION}:`) ||
    content.startsWith(`${LEGACY_VERSION}:`)
  ) {
    try {
      return decryptMessage(content, conversationId);
    } catch (error) {
      console.error("Failed to decrypt message:", error);
      return "[Unable to decrypt message]";
    }
  }

  noteLegacyPlaintextRow();

  return content;
}
