import crypto from "node:crypto";
import { deriveJwtPurposeSecret } from "@/lib/jwt-purpose-secret";

const WELCOME_DEFERRAL_PURPOSE = "welcome-deferral";

const WELCOME_DEFERRAL_VERSION = 1;
const WELCOME_DEFERRAL_LIFETIME_SECONDS = 86_400;
const HMAC_HEX_LENGTH = 64;

type WelcomeDeferralPayload = {
  readonly v: 1;
  readonly uid: string;
  readonly iid: string;
  readonly exp: number;
};

export function issueWelcomeDeferral(
  userId: string | number,
  invitationId: string | number
): string {
  const payload: WelcomeDeferralPayload = {
    v: WELCOME_DEFERRAL_VERSION,
    uid: String(userId),
    iid: String(invitationId),
    exp:
      Math.floor(Date.now() / 1000) + WELCOME_DEFERRAL_LIFETIME_SECONDS,
  };
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", deriveJwtPurposeSecret(WELCOME_DEFERRAL_PURPOSE))
    .update(encodedPayload, "utf8")
    .digest("hex");
  return `${encodedPayload}.${signature}`;
}

export function readWelcomeDeferral(
  token: string | null | undefined
): { userId: string; invitationId: string; exp: number } | null {
  if (!token) return null;

  try {
    const separatorIndex = token.indexOf(".");
    if (
      separatorIndex <= 0 ||
      separatorIndex !== token.lastIndexOf(".") ||
      separatorIndex === token.length - 1
    ) {
      return null;
    }

    const encodedPayload = token.slice(0, separatorIndex);
    const signatureHex = token.slice(separatorIndex + 1);
    if (
      !/^[A-Za-z0-9_-]+$/u.test(encodedPayload) ||
      signatureHex.length !== HMAC_HEX_LENGTH ||
      !/^[0-9a-f]+$/u.test(signatureHex)
    ) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", deriveJwtPurposeSecret(WELCOME_DEFERRAL_PURPOSE))
      .update(encodedPayload, "utf8")
      .digest();
    const suppliedSignature = Buffer.from(signatureHex, "hex");
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      return null;
    }

    const payloadBuffer = Buffer.from(encodedPayload, "base64url");
    if (payloadBuffer.toString("base64url") !== encodedPayload) return null;

    const payload: unknown = JSON.parse(payloadBuffer.toString("utf8"));
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("v" in payload) ||
      payload.v !== WELCOME_DEFERRAL_VERSION ||
      !("uid" in payload) ||
      typeof payload.uid !== "string" ||
      !("iid" in payload) ||
      typeof payload.iid !== "string" ||
      !("exp" in payload) ||
      typeof payload.exp !== "number" ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      userId: payload.uid,
      invitationId: payload.iid,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
