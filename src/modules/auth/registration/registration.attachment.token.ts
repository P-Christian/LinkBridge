import * as jose from "jose";
import { deriveJwtPurposeSecret } from "@/lib/jwt-purpose-secret";
import { AuthSessionUser } from "./registration.session";

const ATTACHMENT_PURPOSE = "registration-attachments";

/**
 * A short-lived capability used only for the upload that immediately follows
 * successful OTP verification. This avoids depending on the new auth cookie
 * being observable by a second request in the same browser turn.
 */
export async function issueRegistrationAttachmentToken(
  user: AuthSessionUser
): Promise<string> {
  return new jose.SignJWT({
    purpose: ATTACHMENT_PURPOSE,
    role: user.role,
    role_id: user.role_id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.user_id))
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(deriveJwtPurposeSecret(ATTACHMENT_PURPOSE));
}

/** An attachment capability is never a session, so it never takes the session key. */
export async function verifyRegistrationAttachmentToken(
  token: string
): Promise<jose.JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(
      token,
      deriveJwtPurposeSecret(ATTACHMENT_PURPOSE)
    );
    if (payload.purpose !== ATTACHMENT_PURPOSE) return null;
    return payload;
  } catch {
    return null;
  }
}
