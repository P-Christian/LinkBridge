// src/modules/auth/google/google.service.ts
import crypto from "crypto";
import * as jose from "jose";
import { deriveJwtPurposeSecret } from "@/lib/jwt-purpose-secret";
 
export class GoogleOAuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "GoogleOAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// src/modules/auth/google/google.service.ts
export function getGoogleAllowedOrigins(): string[] {
  const configured = process.env.ALLOWED_ORIGINS;

  if (!configured) {
    throw new Error(
      "ALLOWED_ORIGINS must be configured"
    );
  }

  const origins = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const validatedOrigins = origins.map((origin) => {
    const url = new URL(origin);

    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        `Invalid configured Google OAuth origin: ${origin}`
      );
    }

    return url.origin;
  });

  return [...new Set(validatedOrigins)];
}

export const CANONICAL_CALLBACK_PATH = "/api/auth/google/callback";

export interface GoogleOAuthTransaction {
  jti: string;
  state: string;
  nonce: string;
  code_verifier: string;
  redirect_uri: string;
  mode: "login" | "signup" | "link";
  linkUserId?: string | number;
  linkSessionEpoch?: string | null;
  returnTo?: string;
  popup?: boolean;
  created_at: number;
}

export interface GoogleIdTokenClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  nonce?: string;
}

export interface GoogleRegistrationPayload {
  jti: string;
  purpose: "google-registration";
  email: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
  sub: string;
  exp: number;
}

// In-memory atomic consumption stores with automatic eviction to prevent transaction and registration replay
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
export function consumeGoogleRegistration(jti: string): boolean {
  cleanupExpiredTokens(consumedRegistrations, 15 * 60 * 1000);
  if (consumedRegistrations.has(jti)) {
    return false;
  }
  consumedRegistrations.set(jti, Date.now());
  return true;
}

/** Resolves and strictly validates canonical redirect URI against allowlist */
export function resolveCanonicalRedirectUri(incomingHost: string | null, incomingProto?: string | null): string {
  const allowedOrigins = getGoogleAllowedOrigins();

  // If explicitly configured in environment, verify against allowlist format
  const explicitUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicitUri) {
    try {
      const url = new URL(explicitUri);
      const isAllowed = allowedOrigins.some((allowed) => {
        const allowedUrl = new URL(allowed);
        return allowedUrl.origin.toLowerCase() === url.origin.toLowerCase();
      });
      if (isAllowed && url.pathname === CANONICAL_CALLBACK_PATH) {
        return explicitUri;
      }
    } catch {
      // Invalid URL in env, fall through to host check
    }
  }

  if (!incomingHost) {
    throw new GoogleOAuthError("Host header is required for OAuth initiation.", "INVALID_HOST", 400);
  }

  const cleanHost = incomingHost.trim();
  const proto = incomingProto?.trim() || (cleanHost.includes("localhost") || cleanHost.startsWith("127.0.0.1") ? "http" : "https");

  let requestOrigin: string;
  let incomingHostname = "";
  try {
    const parsedUrl = new URL(`${proto}://${cleanHost}`);
    requestOrigin = parsedUrl.origin.toLowerCase();
    incomingHostname = parsedUrl.hostname.toLowerCase();
  } catch {
    throw new GoogleOAuthError(`Invalid host header: ${incomingHost}`, "INVALID_HOST", 400);
  }

  // 1. Try exact origin match (protocol + host + port)
  const exactOrigin = allowedOrigins.find((allowed) => {
    try {
      return new URL(allowed).origin.toLowerCase() === requestOrigin;
    } catch {
      return false;
    }
  });
  if (exactOrigin) return `${exactOrigin}${CANONICAL_CALLBACK_PATH}`;

  // 2. Fallback to host match or normalized hostname match (handles reverse proxy ports e.g. :4000)
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
    throw new GoogleOAuthError(`Untrusted host header: ${incomingHost}`, "UNTRUSTED_HOST", 400);
  }

  return `${matchedOrigin}${CANONICAL_CALLBACK_PATH}`;
}

/**
 * Resolves the client-facing public origin from forwarded proxy headers or host header,
 * strictly matching against trusted origins to prevent redirecting to internal listener ports (e.g. localhost:4000).
 */
export function resolveRequestOrigin(
  incomingHost: string | null,
  incomingProto?: string | null,
  fallbackOrigin?: string
): string {
  const allowedOrigins = getGoogleAllowedOrigins();

  if (incomingHost) {
    const cleanHost = incomingHost.trim();
    const proto =
      incomingProto?.trim() ||
      (cleanHost.includes("localhost") || cleanHost.startsWith("127.0.0.1") ? "http" : "https");

    let reqOrigin = "";
    let incomingHostname = "";
    try {
      const parsedUrl = new URL(`${proto}://${cleanHost}`);
      reqOrigin = parsedUrl.origin.toLowerCase();
      incomingHostname = parsedUrl.hostname.toLowerCase();
    } catch {
      // ignore invalid URL
    }

    if (reqOrigin) {
      const exactMatch = allowedOrigins.find((allowed) => {
        try {
          return new URL(allowed).origin.toLowerCase() === reqOrigin;
        } catch {
          return false;
        }
      });
      if (exactMatch) return exactMatch;
    }

    const hostMatch = allowedOrigins.find((allowed) => {
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
    if (hostMatch) return hostMatch;
    // An unmatched Host must never become the redirect base — fall through to the configured origin.
  }

  return fallbackOrigin || allowedOrigins[0] ;
}

/** 32-byte key for JWE authenticated encryption (A256GCM), separate from the state-signing key */
function getEncryptionKey(): Uint8Array {
  return deriveJwtPurposeSecret("google-oauth-encryption");
}

/** Key for signing the OAuth transaction cookie; never the access-session key */
function getSigningSecret(): Uint8Array {
  return deriveJwtPurposeSecret("google-oauth-state");
}

/** Creates a secure signed OAuth transaction token for cookies */
export async function sealOAuthTransaction(tx: GoogleOAuthTransaction): Promise<string> {
  return new jose.SignJWT({ ...tx })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(tx.jti)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSigningSecret());
}

/** Unseals and verifies the OAuth transaction token */
export async function unsealOAuthTransaction(token: string): Promise<GoogleOAuthTransaction | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSigningSecret(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.jti !== "string" ||
      typeof payload.state !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.code_verifier !== "string" ||
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
      code_verifier: payload.code_verifier,
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

/** Generates OAuth authorization parameters */
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
  transaction: GoogleOAuthTransaction;
  authUrl: string;
} {
  const clientId = process.env.GOOGLE_CLIENT?.trim();
  if (!clientId) {
    throw new GoogleOAuthError("GOOGLE_CLIENT is not configured.", "CONFIGURATION_ERROR", 500);
  }

  const state = crypto.randomBytes(32).toString("hex");
  const nonce = crypto.randomBytes(32).toString("hex");
  const code_verifier = crypto.randomBytes(32).toString("base64url");
  const code_challenge = crypto.createHash("sha256").update(code_verifier).digest("base64url");
  const jti = crypto.randomUUID();

  const transaction: GoogleOAuthTransaction = {
    jti,
    state,
    nonce,
    code_verifier,
    redirect_uri: redirectUri,
    mode,
    linkUserId: options?.linkUserId,
    linkSessionEpoch: options?.linkSessionEpoch,
    returnTo: options?.returnTo,
    popup: options?.popup,
    created_at: Date.now(),
  };

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return { transaction, authUrl };
}

/** Exchanges authorization code for Google tokens */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ id_token: string; access_token: string }> {
  const clientId = process.env.GOOGLE_CLIENT?.trim();
  const clientSecret = process.env.GOOGLE_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new GoogleOAuthError("Google OAuth credentials are not fully configured.", "CONFIGURATION_ERROR", 500);
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error("[Google OAuth] Token exchange failed:", res.status, errorBody);
    throw new GoogleOAuthError("Failed to exchange authorization code with Google.", "OAUTH_EXCHANGE_FAILED", 400);
  }

  const data = await res.json();
  if (!data?.id_token || !data?.access_token) {
    throw new GoogleOAuthError("Invalid token response received from Google.", "OAUTH_RESPONSE_INVALID", 400);
  }

  return { id_token: data.id_token, access_token: data.access_token };
}

// Cached Google JWKS set instance
const googleJwks = jose.createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Cryptographically verifies Google ID Token signature and claims */
export async function verifyGoogleIdToken(idToken: string, expectedNonce: string): Promise<GoogleIdTokenClaims> {
  const clientId = process.env.GOOGLE_CLIENT?.trim();
  if (!clientId) {
    throw new GoogleOAuthError("GOOGLE_CLIENT is not configured.", "CONFIGURATION_ERROR", 500);
  }

  const { payload } = await jose.jwtVerify(idToken, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  if (typeof payload.email !== "string" || !payload.email) {
    throw new GoogleOAuthError("Google ID token missing email claim.", "OAUTH_INVALID_TOKEN", 400);
  }

  if (payload.email_verified !== true) {
    throw new GoogleOAuthError("Google account email is not verified.", "EMAIL_NOT_VERIFIED", 400);
  }

  if (payload.nonce !== expectedNonce) {
    throw new GoogleOAuthError("Google ID token nonce mismatch.", "OAUTH_NONCE_MISMATCH", 400);
  }

  return {
    sub: String(payload.sub),
    email: payload.email.trim().toLowerCase(),
    email_verified: true,
    name: typeof payload.name === "string" ? payload.name : undefined,
    given_name: typeof payload.given_name === "string" ? payload.given_name : undefined,
    family_name: typeof payload.family_name === "string" ? payload.family_name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
    nonce: typeof payload.nonce === "string" ? payload.nonce : undefined,
  };
}

/** Encrypts incomplete Google registration profile using JWE (A256GCM) */
export async function encryptGoogleRegistration(data: {
  email: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
  sub: string;
}): Promise<string> {
  const key = getEncryptionKey();
  const jti = crypto.randomUUID();
  const payload: GoogleRegistrationPayload = {
    jti,
    purpose: "google-registration",
    email: data.email.trim().toLowerCase(),
    given_name: data.given_name,
    family_name: data.family_name,
    name: data.name,
    picture: data.picture,
    sub: data.sub,
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  };

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  return new jose.CompactEncrypt(plaintext)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
}

/** Decrypts and verifies incomplete Google registration profile */
export async function decryptGoogleRegistration(token: string): Promise<GoogleRegistrationPayload | null> {
  try {
    const key = getEncryptionKey();
    const { plaintext } = await jose.compactDecrypt(token, key);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as GoogleRegistrationPayload;

    if (parsed.purpose !== "google-registration" || typeof parsed.email !== "string") {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (parsed.exp && parsed.exp < nowSec) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export interface GooglePendingLinkPayload {
  jti: string;
  purpose: "google-pending-link";
  userId: number | string;
  sub: string;
  email: string;
  name?: string;
  exp: number;
}

const consumedPendingLinks = new Map<string, number>();

/** Atomically marks a pending link token JTI as consumed. Returns false if already consumed or replayed. */
export function consumeGooglePendingLink(jti: string): boolean {
  cleanupExpiredTokens(consumedPendingLinks, 10 * 60 * 1000);
  if (consumedPendingLinks.has(jti)) {
    return false;
  }
  consumedPendingLinks.set(jti, Date.now());
  return true;
}

/** Encrypts pending Google link payload using JWE (A256GCM) */
export async function sealPendingLinkToken(data: {
  userId: number | string;
  sub: string;
  email: string;
  name?: string;
}): Promise<string> {
  const key = getEncryptionKey();
  const jti = crypto.randomUUID();
  const payload: GooglePendingLinkPayload = {
    jti,
    purpose: "google-pending-link",
    userId: data.userId,
    sub: data.sub,
    email: data.email.trim().toLowerCase(),
    name: data.name,
    exp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
  };

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  return new jose.CompactEncrypt(plaintext)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
}

/** Decrypts and verifies pending Google link token */
export async function unsealPendingLinkToken(token: string): Promise<GooglePendingLinkPayload | null> {
  try {
    const key = getEncryptionKey();
    const { plaintext } = await jose.compactDecrypt(token, key);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as GooglePendingLinkPayload;

    if (
      parsed.purpose !== "google-pending-link" ||
      !parsed.userId ||
      !parsed.sub ||
      !parsed.email ||
      !parsed.jti
    ) {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (parsed.exp && parsed.exp < nowSec) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export * from "./identity.repo";