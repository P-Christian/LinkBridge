// src/modules/auth/linkedin/linkedin.service.ts
import crypto from "crypto";
import * as jose from "jose";
import { deriveJwtPurposeSecret } from "@/lib/jwt-purpose-secret";
import {
  getGoogleAllowedOrigins,
  resolveRequestOrigin,
} from "@/modules/auth/google/google.service";

export class LinkedInOAuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "LinkedInOAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const CANONICAL_CALLBACK_PATH = "/api/auth/linkedin/callback";

export interface LinkedInOAuthTransaction {
  jti: string;
  state: string;
  nonce: string;
  code_verifier?: string;
  redirect_uri: string;
  mode: "login" | "signup" | "link";
  linkUserId?: string | number;
  linkSessionEpoch?: string | null;
  returnTo?: string;
  popup?: boolean;
  created_at: number;
}

export interface LinkedInUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  email: string;
  email_verified: boolean;
}

export interface LinkedInRegistrationPayload {
  jti: string;
  purpose: "linkedin-registration";
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  sub: string;
  exp: number;
}

// In-memory atomic consumption stores to prevent replay attacks
const consumedTransactions = new Map<string, number>();
const consumedRegistrations = new Map<string, number>();
const TRANSACTION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupExpiredTokens(store: Map<string, number>, ttlMs: number) {
  const now = Date.now();
  for (const [key, timestamp] of store.entries()) {
    if (now - timestamp > ttlMs) {
      store.delete(key);
    }
  }
}

/** Atomically marks a transaction ID as consumed. Returns false if already consumed or replayed. */
export function consumeOAuthTransaction(jti: string): boolean {
  cleanupExpiredTokens(consumedTransactions, TRANSACTION_TTL_MS);
  if (consumedTransactions.has(jti)) {
    return false;
  }
  consumedTransactions.set(jti, Date.now());
  return true;
}

/** Atomically marks a registration token JTI as consumed. Returns false if already consumed or replayed. */
export function consumeLinkedInRegistration(jti: string): boolean {
  cleanupExpiredTokens(consumedRegistrations, 15 * 60 * 1000);
  if (consumedRegistrations.has(jti)) {
    return false;
  }
  consumedRegistrations.set(jti, Date.now());
  return true;
}

/** Resolves and strictly validates canonical redirect URI against allowlist */
export function resolveCanonicalRedirectUri(
  incomingHost: string | null,
  incomingProto?: string | null
): string {
  const allowedOrigins = getGoogleAllowedOrigins();

  const explicitUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
  if (explicitUri) {
    try {
      const url = new URL(explicitUri);
      if (url.pathname === CANONICAL_CALLBACK_PATH) {
        return explicitUri;
      }
    } catch {
      // Ignore invalid URL
    }
  }

  if (!incomingHost) {
    throw new LinkedInOAuthError("Host header is required for OAuth initiation.", "INVALID_HOST", 400);
  }

  const cleanHost = incomingHost.trim();
  const proto =
    incomingProto?.trim() ||
    (cleanHost.includes("localhost") || cleanHost.startsWith("127.0.0.1") ? "http" : "https");

  let requestOrigin: string;
  let incomingHostname = "";
  try {
    const parsedUrl = new URL(`${proto}://${cleanHost}`);
    requestOrigin = parsedUrl.origin.toLowerCase();
    incomingHostname = parsedUrl.hostname.toLowerCase();
  } catch {
    throw new LinkedInOAuthError(`Invalid host header: ${incomingHost}`, "INVALID_HOST", 400);
  }

  // 1. Exact origin match
  const exactOrigin = allowedOrigins.find((allowed) => {
    try {
      return new URL(allowed).origin.toLowerCase() === requestOrigin;
    } catch {
      return false;
    }
  });
  if (exactOrigin) return `${exactOrigin}${CANONICAL_CALLBACK_PATH}`;

  // 2. Host match or normalized hostname match (handles reverse proxy ports e.g. :4000)
  const matchedOrigin = allowedOrigins.find((allowed) => {
    try {
      const u = new URL(allowed);
      return (
        u.host.toLowerCase() === cleanHost.toLowerCase() ||
        (Boolean(incomingHostname) && u.hostname.toLowerCase() === incomingHostname)
      );
    } catch {
      return false;
    }
  });

  if (!matchedOrigin) {
    throw new LinkedInOAuthError(`Untrusted host header: ${incomingHost}`, "UNTRUSTED_HOST", 400);
  }

  return `${matchedOrigin}${CANONICAL_CALLBACK_PATH}`;
}

export { resolveRequestOrigin };

/** 32-byte key for JWE encryption (A256GCM), separate from the state-signing key */
function getEncryptionKey(): Uint8Array {
  return deriveJwtPurposeSecret("linkedin-oauth-encryption");
}

/** Key for signing the OAuth transaction cookie; never the access-session key */
function getSigningSecret(): Uint8Array {
  return deriveJwtPurposeSecret("linkedin-oauth-state");
}

/** Creates a secure signed OAuth transaction token for cookies */
export async function sealOAuthTransaction(tx: LinkedInOAuthTransaction): Promise<string> {
  return new jose.SignJWT({ ...tx })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(tx.jti)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSigningSecret());
}

/** Unseals and verifies the OAuth transaction token */
export async function unsealOAuthTransaction(token: string): Promise<LinkedInOAuthTransaction | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSigningSecret(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.jti !== "string" ||
      typeof payload.state !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.redirect_uri !== "string"
    ) {
      return null;
    }

    const mode: "login" | "signup" | "link" =
      payload.mode === "signup"
        ? "signup"
        : payload.mode === "link"
        ? "link"
        : "login";

    return {
      jti: payload.jti,
      state: payload.state,
      nonce: payload.nonce,
      code_verifier: typeof payload.code_verifier === "string" ? payload.code_verifier : undefined,
      redirect_uri: payload.redirect_uri,
      mode,
      linkUserId:
        typeof payload.linkUserId === "string" || typeof payload.linkUserId === "number"
          ? payload.linkUserId
          : undefined,
      linkSessionEpoch:
        typeof payload.linkSessionEpoch === "string" ? payload.linkSessionEpoch : undefined,
      returnTo: typeof payload.returnTo === "string" ? payload.returnTo : undefined,
      popup: typeof payload.popup === "boolean" ? payload.popup : undefined,
      created_at: typeof payload.created_at === "number" ? payload.created_at : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Generates OAuth authorization parameters for LinkedIn OpenID Connect */
export function generateOAuthParams(
  redirectUri: string,
  mode: "login" | "signup" | "link",
  options?: {
    linkUserId?: string | number;
    linkSessionEpoch?: string | null;
    returnTo?: string;
    popup?: boolean;
  }
): {
  transaction: LinkedInOAuthTransaction;
  authUrl: string;
} {
  const clientId = (process.env.LINKEDIN_CLIENT_ID || process.env.LINKEDIN_CLIENT)?.trim();
  if (!clientId) {
    throw new LinkedInOAuthError("LINKEDIN_CLIENT_ID is not configured.", "CONFIGURATION_ERROR", 500);
  }

  const state = crypto.randomBytes(32).toString("hex");
  const nonce = crypto.randomBytes(32).toString("hex");
  const jti = crypto.randomUUID();

  const transaction: LinkedInOAuthTransaction = {
    jti,
    state,
    nonce,
    redirect_uri: redirectUri,
    mode,
    linkUserId: options?.linkUserId,
    linkSessionEpoch: options?.linkSessionEpoch,
    returnTo: options?.returnTo,
    popup: options?.popup,
    created_at: Date.now(),
  };

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email",
    nonce,
  });

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

  return { transaction, authUrl };
}

/** Exchanges authorization code for LinkedIn tokens */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; id_token?: string }> {
  const clientId = (process.env.LINKEDIN_CLIENT_ID || process.env.LINKEDIN_CLIENT)?.trim();
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET || process.env.LINKEDIN_SECRET)?.trim();

  if (!clientId || !clientSecret) {
    throw new LinkedInOAuthError("LinkedIn OAuth credentials are not fully configured.", "CONFIGURATION_ERROR", 500);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    let detail = "Failed to exchange authorization code with LinkedIn.";
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed?.error_description) {
        detail = `${parsed.error_description} (${parsed.error || res.status})`;
      } else if (parsed?.error) {
        detail = `${parsed.error} (${res.status})`;
      }
    } catch {
      // Keep fallback
    }
    console.error("[LinkedIn OAuth] Token exchange failed:", res.status, errorBody);
    throw new LinkedInOAuthError(detail, "OAUTH_EXCHANGE_FAILED", res.status);
  }

  const data = await res.json();
  if (!data?.access_token) {
    throw new LinkedInOAuthError("Invalid token response received from LinkedIn.", "OAUTH_RESPONSE_INVALID", 400);
  }

  return {
    access_token: data.access_token,
    id_token: typeof data.id_token === "string" ? data.id_token : undefined,
  };
}

/** Fetches full user profile claims from LinkedIn OpenID Connect UserInfo endpoint */
export async function fetchLinkedInUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error("[LinkedIn OAuth] UserInfo request failed:", res.status, errorBody);
    throw new LinkedInOAuthError("Failed to fetch LinkedIn user profile.", "OAUTH_USERINFO_FAILED", 400);
  }

  const data = await res.json();
  if (!data?.sub) {
    throw new LinkedInOAuthError("LinkedIn profile missing subject claim.", "OAUTH_INVALID_PROFILE", 400);
  }

  if (typeof data.email !== "string" || !data.email.trim()) {
    throw new LinkedInOAuthError("LinkedIn profile missing email address.", "EMAIL_MISSING", 400);
  }

  return {
    sub: String(data.sub),
    name: typeof data.name === "string" ? data.name : undefined,
    given_name: typeof data.given_name === "string" ? data.given_name : undefined,
    family_name: typeof data.family_name === "string" ? data.family_name : undefined,
    picture: typeof data.picture === "string" ? data.picture : undefined,
    locale: typeof data.locale === "string" ? data.locale : undefined,
    email: data.email.trim().toLowerCase(),
    email_verified: Boolean(data.email_verified ?? true),
  };
}

/** Encrypts incomplete LinkedIn registration profile using JWE (A256GCM) */
export async function encryptLinkedInRegistration(data: {
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  sub: string;
}): Promise<string> {
  const key = getEncryptionKey();
  const jti = crypto.randomUUID();
  const payload: LinkedInRegistrationPayload = {
    jti,
    purpose: "linkedin-registration",
    email: data.email.trim().toLowerCase(),
    name: data.name,
    given_name: data.given_name,
    family_name: data.family_name,
    picture: data.picture,
    locale: data.locale,
    sub: data.sub,
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  };

  return new jose.CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
}

/** Decrypts and verifies incomplete LinkedIn registration token */
export async function decryptLinkedInRegistration(jwe: string): Promise<LinkedInRegistrationPayload | null> {
  try {
    const key = getEncryptionKey();
    const { plaintext } = await jose.compactDecrypt(jwe, key);
    const decoded = JSON.parse(new TextDecoder().decode(plaintext)) as LinkedInRegistrationPayload;

    if (
      decoded.purpose !== "linkedin-registration" ||
      typeof decoded.email !== "string" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.jti !== "string" ||
      typeof decoded.exp !== "number"
    ) {
      return null;
    }

    if (Date.now() / 1000 > decoded.exp) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
