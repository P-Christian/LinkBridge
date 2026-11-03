import { hkdfSync } from "node:crypto";
import { requireJwtSecret } from "@/modules/auth/registration/registration.session";

const HKDF_SALT = "vos-sync/jwt-secret/v1";
const DERIVED_KEY_BYTES = 32;

/**
 * Domain-separated key for one token purpose (SEC-006).
 *
 * Access sessions, registration-attachment capabilities, OAuth state cookies
 * and IP-hashing all used to be signed with the same `JWT_SECRET`, so a leak
 * of any one of them was a full account-takeover primitive. Each purpose now
 * gets its own HKDF subkey, so nothing env-var has to be added and the master
 * secret never leaves this module.
 *
 * Node-only: `registration.session.ts` stays safe to import from the Edge
 * middleware, and only server code reaches for this.
 */
export function deriveJwtPurposeSecret(purpose: string): Uint8Array {
  return new Uint8Array(
    hkdfSync(
      "sha256",
      Buffer.from(requireJwtSecret(), "utf8"),
      Buffer.from(HKDF_SALT, "utf8"),
      Buffer.from(purpose, "utf8"),
      DERIVED_KEY_BYTES
    )
  );
}
