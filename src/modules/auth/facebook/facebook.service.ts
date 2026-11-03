// src/modules/auth/facebook/facebook.service.ts
import crypto from "crypto";
import * as jose from "jose";
import { deriveJwtPurposeSecret } from "@/lib/jwt-purpose-secret";
import {
  getGoogleAllowedOrigins,
  resolveRequestOrigin,
} from "@/modules/auth/google/google.service";

export class FacebookOAuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "FacebookOAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const CANONICAL_CALLBACK_PATH = "/api/auth/facebook/callback";

export interface FacebookOAuthTransaction {
  jti: string;
  state: string;
  nonce: string;
  redirect_uri: string;
  mode: "login" | "signup" | "link";
  linkUserId?: string | number;
  linkSessionEpoch?: string | null;
  returnTo?: string;
  popup?: boolean;
  created_at: number;
}

export interface FacebookUserInfo {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  picture?: string;
  email: string;
}

export interface FacebookRegistrationPayload {
  jti: string;
  purpose: "facebook-registration";
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  picture?: string;
  id: string;
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
export function consumeFacebookRegistration(jti: string): boolean {
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

  const explicitUri = process.env.FACEBOOK_REDIRECT_URI?.trim();
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
    throw new FacebookOAuthError("Host header is required for OAuth initiation.", "INVALID_HOST", 400);
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
    throw new FacebookOAuthError(`Invalid host header: ${incomingHost}`, "INVALID_HOST", 400);
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
    throw new FacebookOAuthError(`Untrusted host header: ${incomingHost}`, "UNTRUSTED_HOST", 400);
  }

  return `${matchedOrigin}${CANONICAL_CALLBACK_PATH}`;
}

export { resolveRequestOrigin };

/** 32-byte key for JWE encryption (A256GCM), separate from the state-signing key */
function getEncryptionKey(): Uint8Array {
  return deriveJwtPurposeSecret("facebook-oauth-encryption");
}

/** Key for signing the OAuth transaction cookie; never the access-session key */
function getSigningSecret(): Uint8Array {
  return deriveJwtPurposeSecret("facebook-oauth-state");
}

/** Creates a secure signed OAuth transaction token for cookies */
export async function sealOAuthTransaction(tx: FacebookOAuthTransaction): Promise<string> {
  return new jose.SignJWT({ ...tx })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(tx.jti)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSigningSecret());
}

/** Unseals and verifies the OAuth transaction token */
export async function unsealOAuthTransaction(token: string): Promise<FacebookOAuthTransaction | null> {
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

/** Generates OAuth authorization parameters for Facebook Login */
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
  transaction: FacebookOAuthTransaction;
  authUrl: string;
} {
  const clientId = (process.env.FACEBOOK_ID || process.env.FACEBOOK_APP_ID)?.trim();
  if (!clientId) {
    throw new FacebookOAuthError("FACEBOOK_ID is not configured.", "CONFIGURATION_ERROR", 500);
  }

  const state = crypto.randomBytes(32).toString("hex");
  const nonce = crypto.randomBytes(32).toString("hex");
  const jti = crypto.randomUUID();

  const transaction: FacebookOAuthTransaction = {
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
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: "email,public_profile",
  });

  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;

  return { transaction, authUrl };
}

/** Exchanges authorization code for Facebook User Access Token */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
  const clientId = (process.env.FACEBOOK_ID || process.env.FACEBOOK_APP_ID)?.trim();
  const clientSecret = (process.env.FACEBOOK_SECRET || process.env.FACEBOOK_APP_SECRET)?.trim();

  if (!clientId || !clientSecret) {
    throw new FacebookOAuthError("Facebook OAuth credentials are not fully configured.", "CONFIGURATION_ERROR", 500);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch("https://graph.facebook.com/v20.0/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    let detail = "Failed to exchange authorization code with Facebook.";
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed?.error?.message) {
        detail = `${parsed.error.message} (${parsed.error.code || res.status})`;
      }
    } catch {
      // Fallback message
    }
    console.error("[Facebook OAuth] Token exchange failed:", res.status, errorBody);
    throw new FacebookOAuthError(detail, "OAUTH_EXCHANGE_FAILED", res.status);
  }

  const data = await res.json();
  if (!data?.access_token) {
    throw new FacebookOAuthError("Invalid token response received from Facebook.", "OAUTH_RESPONSE_INVALID", 400);
  }

  return {
    access_token: data.access_token,
    token_type: typeof data.token_type === "string" ? data.token_type : undefined,
    expires_in: typeof data.expires_in === "number" ? data.expires_in : undefined,
  };
}

/** Fetches full user profile details from Facebook Graph API */
export async function fetchFacebookUserInfo(accessToken: string): Promise<FacebookUserInfo> {
  const clientId = (process.env.FACEBOOK_ID || process.env.FACEBOOK_APP_ID)?.trim();
  const clientToken = (process.env.FACEBOOK_TOKEN || process.env.FACEBOOK_CLIENT_TOKEN)?.trim();
  const clientSecret = (process.env.FACEBOOK_SECRET || process.env.FACEBOOK_APP_SECRET)?.trim();

  // Optional app token validation via debug_token
  const appSecretOrToken = clientToken || clientSecret;
  if (clientId && appSecretOrToken) {
    try {
      const appAccessToken = `${clientId}|${appSecretOrToken}`;
      const debugRes = await fetch(
        `https://graph.facebook.com/v20.0/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`,
        { cache: "no-store" }
      );
      if (debugRes.ok) {
        const debugData = await debugRes.json();
        if (debugData?.data?.is_valid === false) {
          throw new FacebookOAuthError("Facebook access token is invalid or expired.", "INVALID_TOKEN", 401);
        }
        if (debugData?.data?.app_id && String(debugData.data.app_id) !== String(clientId)) {
          throw new FacebookOAuthError("Facebook token was issued for an unauthorized application.", "APP_MISMATCH", 403);
        }
      }
    } catch (e: unknown) {
      if (e instanceof FacebookOAuthError) throw e;
      // Debug token check non-fatal if network/config glitch
      console.warn("[Facebook OAuth] Token debug verification skipped or non-fatal:", e);
    }
  }

  const res = await fetch(
    `https://graph.facebook.com/v20.0/me?fields=id,name,first_name,last_name,email,picture.width(400).height(400)&access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error("[Facebook OAuth] Profile request failed:", res.status, errorBody);
    throw new FacebookOAuthError("Failed to fetch Facebook user profile.", "OAUTH_PROFILE_FAILED", 400);
  }

  const data = await res.json();
  if (!data?.id) {
    throw new FacebookOAuthError("Facebook profile missing user ID.", "OAUTH_INVALID_PROFILE", 400);
  }

  if (typeof data.email !== "string" || !data.email.trim()) {
    throw new FacebookOAuthError(
      "Your Facebook account does not provide an email address. Please ensure an email is associated with your Facebook profile.",
      "EMAIL_MISSING",
      400
    );
  }

  const pictureUrl = data.picture?.data?.url && typeof data.picture.data.url === "string"
    ? data.picture.data.url
    : undefined;

  return {
    id: String(data.id),
    name: typeof data.name === "string" ? data.name : undefined,
    first_name: typeof data.first_name === "string" ? data.first_name : undefined,
    last_name: typeof data.last_name === "string" ? data.last_name : undefined,
    picture: pictureUrl,
    email: data.email.trim().toLowerCase(),
  };
}

/** Encrypts incomplete Facebook registration profile using JWE (A256GCM) */
export async function encryptFacebookRegistration(data: {
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  picture?: string;
  id: string;
}): Promise<string> {
  const key = getEncryptionKey();
  const jti = crypto.randomUUID();
  const payload: FacebookRegistrationPayload = {
    jti,
    purpose: "facebook-registration",
    email: data.email.trim().toLowerCase(),
    name: data.name,
    first_name: data.first_name,
    last_name: data.last_name,
    picture: data.picture,
    id: data.id,
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  };

  return new jose.CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
}

/** Decrypts and verifies incomplete Facebook registration token */
export async function decryptFacebookRegistration(jwe: string): Promise<FacebookRegistrationPayload | null> {
  try {
    const key = getEncryptionKey();
    const { plaintext } = await jose.compactDecrypt(jwe, key);
    const decoded = JSON.parse(new TextDecoder().decode(plaintext)) as FacebookRegistrationPayload;

    if (
      decoded.purpose !== "facebook-registration" ||
      typeof decoded.email !== "string" ||
      typeof decoded.id !== "string" ||
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
