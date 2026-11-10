import { RegistrationError } from "./registration.errors";
import { deriveJwtPurposeSecret } from "@/lib/jwt-purpose-secret";

/** HKDF info label for the registration OTP / IP-hash subkey (SEC-019). */
const OTP_HMAC_PURPOSE = "registration-otp";

export interface RegistrationConfig {
  /** Exactly 32 bytes used only for the registration payload envelope. */
  payloadKey: Uint8Array;
  /**
   * Independent secret used only for registration OTP HMACs/IP hashes: the
   * dedicated `REGISTRATION_OTP_HMAC_SECRET`, else the `registration-otp`
   * HKDF subkey of `JWT_SECRET` — never `JWT_SECRET` itself.
   */
  otpHmacSecret: string;
  /** Server-only Turnstile secret (the shared helper reads the same env key). */
  turnstileSecret: string;
  directusBaseUrl: string;
  directusToken: string;
  isV2Enabled: boolean;
  otpLifetimeMs: number;
  maxOtpAttempts: number;
  resendCooldownMs: number;
  maxResends: number;
  challengeLifetimeMs: number;
  verificationLeaseDurationMs: number;
  maxCleanupBatch: number;
  rateLimitEmailHourly: number;
  rateLimitIpHourly: number;
}

export const REGISTRATION_CONSTANTS = {
  OTP_LIFETIME_MS: 10 * 60 * 1000, // 10 minutes
  MAX_OTP_ATTEMPTS: 5,
  RESEND_COOLDOWN_MS: 60 * 1000, // 60 seconds
  MAX_RESENDS: 5,
  CHALLENGE_LIFETIME_MS: 24 * 60 * 60 * 1000, // 24 hours
  VERIFICATION_LEASE_DURATION_MS: 30 * 1000, // 30 seconds
  MAX_CLEANUP_BATCH: 20,
  RATE_LIMIT_EMAIL_HOURLY: 5,
  RATE_LIMIT_IP_HOURLY: 15,
} as const;

const PAYLOAD_KEY_BYTES = 32;

/** Read the rollout flag without forcing unavailable Phase 3 secrets to load. */
export function isRegistrationV2Enabled(): boolean {
  return process.env.REGISTRATION_V2_ENABLED?.trim() === "true";
}

function configurationError(message: string): RegistrationError {
  return new RegistrationError(message, "CONFIGURATION_ERROR", 500);
}

/**
 * Decode the payload key without deriving or inventing a fallback key. The
 * deployment contract is base64, but accepting an explicit 32-byte value is
 * useful for local secret stores that do not encode binary values.
 */
function resolvePayloadKey(rawKey: string): Uint8Array {
  const base64Candidate = rawKey.replace(/\s+/gu, "");
  const isBase64 =
    /^[A-Za-z0-9+/]+={0,2}$/u.test(base64Candidate) &&
    base64Candidate.length % 4 === 0;

  if (isBase64) {
    const decoded = Buffer.from(base64Candidate, "base64");
    if (decoded.length === PAYLOAD_KEY_BYTES) {
      return new Uint8Array(decoded);
    }
  }

  // Do not hash a weak/incorrect value into a key. Only an explicitly
  // supplied 32-byte value may use this compatibility form.
  const rawBytes = Buffer.from(rawKey, "utf8");
  if (rawBytes.length === PAYLOAD_KEY_BYTES) {
    return new Uint8Array(rawBytes);
  }

  throw configurationError(
    "REGISTRATION_PAYLOAD_KEY must decode to exactly 32 bytes (base64 recommended)."
  );
}

export function getRegistrationConfig(): RegistrationConfig {
  // Fail closed: the previous hardcoded 32-byte literal meant every deployment
  // that forgot the variable shared one publicly-known envelope key.
  const rawPayloadKey = process.env.REGISTRATION_PAYLOAD_KEY?.trim();

  if (!rawPayloadKey) {
    throw configurationError(
      "REGISTRATION_PAYLOAD_KEY must be configured (base64-encoded 32 bytes)."
    );
  }

  const payloadKey = resolvePayloadKey(rawPayloadKey);

  // A dedicated secret is preferred. Without one we must not hand the raw
  // `JWT_SECRET` to the OTP HMAC — an access token and an OTP hash used to be
  // keyed identically — so we take the domain-separated HKDF subkey instead.
  // `deriveJwtPurposeSecret` fails closed (via `requireJwtSecret`) when
  // `JWT_SECRET` is missing or shorter than 32 characters.
  const explicitOtpHmacSecret = process.env.REGISTRATION_OTP_HMAC_SECRET?.trim();
  const otpHmacSecret =
    explicitOtpHmacSecret ||
    (process.env.JWT_SECRET?.trim()
      ? Buffer.from(deriveJwtPurposeSecret(OTP_HMAC_PURPOSE)).toString("hex")
      : "");

  if (!otpHmacSecret) {
    throw configurationError(
      "REGISTRATION_OTP_HMAC_SECRET must be configured, or JWT_SECRET so the registration-otp subkey can be derived."
    );
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET?.trim();

  if (!turnstileSecret) {
    throw configurationError("TURNSTILE_SECRET must be configured.");
  }

  const directusBaseUrl = (
    process.env.DIRECTUS_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/u, "");

  const directusToken = process.env.DIRECTUS_STATIC_TOKEN || "";

  return {
    payloadKey,
    otpHmacSecret,
    turnstileSecret,
    directusBaseUrl,
    directusToken,
    isV2Enabled: isRegistrationV2Enabled(),
    otpLifetimeMs: REGISTRATION_CONSTANTS.OTP_LIFETIME_MS,
    maxOtpAttempts: REGISTRATION_CONSTANTS.MAX_OTP_ATTEMPTS,
    resendCooldownMs: REGISTRATION_CONSTANTS.RESEND_COOLDOWN_MS,
    maxResends: REGISTRATION_CONSTANTS.MAX_RESENDS,
    challengeLifetimeMs: REGISTRATION_CONSTANTS.CHALLENGE_LIFETIME_MS,
    verificationLeaseDurationMs:
      REGISTRATION_CONSTANTS.VERIFICATION_LEASE_DURATION_MS,
    maxCleanupBatch: REGISTRATION_CONSTANTS.MAX_CLEANUP_BATCH,
    rateLimitEmailHourly: REGISTRATION_CONSTANTS.RATE_LIMIT_EMAIL_HOURLY,
    rateLimitIpHourly: REGISTRATION_CONSTANTS.RATE_LIMIT_IP_HOURLY,
  };
}
