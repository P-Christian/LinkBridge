import { RegistrationError } from "../registration.errors";
import type { SchoolProvisioningInput } from "../registration.types";
import { RegistrationProvisioningRepository } from "../registration.provisioning.repo";
import { parseDirectusUtcDateTime } from "../registration.timestamps";
import { getPHTimeString } from "@/lib/utils";

type ProvisioningId = string | number;
type ProvisioningRecord = Record<string, unknown>;

export interface ProvisioningUser extends ProvisioningRecord {
  user_id: ProvisioningId;
  user_email: string;
  role?: string | null;
  role_id?: ProvisioningId | null;
  registration_key?: string | null;
}

export interface ProvisioningResource {
  collection: string;
  id: ProvisioningId;
}

interface ProvisioningLedger {
  created: ProvisioningResource[];
  ambiguous: boolean;
}

export interface SchoolProvisioningResult {
  school: ProvisioningRecord;
  schoolAdmin: ProvisioningRecord;
  invitation: ProvisioningRecord | null;
  created: ProvisioningResource[];
}

const SCHOOL_COLLECTION = "vs_school";
const SCHOOL_ADMIN_COLLECTION = "vs_school_admin";
const INVITATION_COLLECTION = "vs_invite_token";

// Keep every provisioning lookup explicit. These are the fields used by this
// provisioner and mirror the names present in the legacy school routes.
const SCHOOL_FIELDS = [
  "school_id",
  "school_name",
  "school_type",
  "school_email",
  "city_municipality",
  "province",
  "barangay",
  "address_line",
  "school_status",
  "profile_completion_percent",
  "created_by",
] as const;

const SCHOOL_ADMIN_FIELDS = [
  "school_admin_id",
  "school_id",
  "user_id",
  "is_active",
] as const;

const INVITATION_FIELDS = [
  "token_id",
  "token",
  "invited_email",
  "is_used",
  "expires_at",
  "school_id",
  // Only real vs_invite_token columns may be selected: Directus rejects (403)
  // unknown fields, which would fail the entire provisioning read. Ownership
  // and replay evidence is carried by registration_key.
  "registration_key",
] as const;

function isRecord(value: unknown): value is ProvisioningRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProvisioningId(value: unknown): value is ProvisioningId {
  return (
    (typeof value === "string" && value.trim().length > 0) ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

function recordId(record: ProvisioningRecord, ...keys: string[]): ProvisioningId | null {
  for (const key of keys) {
    const value = record[key];
    if (isProvisioningId(value)) return value;
    if (isRecord(value)) {
      const nested = recordId(value, "id", "school_id", "user_id", "token_id");
      if (nested !== null) return nested;
    }
  }
  return null;
}

function requireId(
  record: ProvisioningRecord,
  message: string,
  ...keys: string[]
): ProvisioningId {
  const id = recordId(record, ...keys);
  if (id === null) {
    throw new RegistrationError(message, "PROVISIONING_FAILED", 503);
  }
  return id;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length > 0 ? normalized : null;
}

export function normalizeSchoolIdentityName(value: string): string | null {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return normalized.length > 0 ? normalized : null;
}

function sameId(left: unknown, right: unknown): boolean {
  return isProvisioningId(left) && isProvisioningId(right) && String(left) === String(right);
}

function hasDifferentOwner(record: ProvisioningRecord, userId: ProvisioningId): boolean {
  return isProvisioningId(record.created_by) && !sameId(record.created_by, userId);
}

function relationId(value: unknown): ProvisioningId | null {
  if (isProvisioningId(value)) return value;
  if (!isRecord(value)) return null;
  return recordId(value, "school_id", "id");
}

function isUsed(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function provisioningFailure(): RegistrationError {
  return new RegistrationError(
    "School registration could not be completed. Please try again.",
    "PROVISIONING_FAILED",
    503
  );
}

/**
 * A failed invitation PATCH may have committed even when its response was
 * lost. Keep this marker internal so the coordinator does not compensate a
 * graph that is needed to prove ownership on the next retry.
 */
class InvitationConsumptionUncertainError extends Error {
  constructor() {
    super("Invitation consumption outcome is uncertain.");
    this.name = "InvitationConsumptionUncertainError";
  }
}

async function compensateCreatedResources(
  repo: RegistrationProvisioningRepository,
  ledger: ProvisioningLedger
): Promise<void> {
  if (ledger.ambiguous || ledger.created.length === 0) return;

  // Resources are recorded only after a successful create response with a
  // stable ID. Delete children before parents and stop if a child cannot be
  // removed, avoiding a parent delete that could violate a live FK.
  for (let index = ledger.created.length - 1; index >= 0; index -= 1) {
    const resource = ledger.created[index];
    try {
      await repo.delete(resource.collection, resource.id);
    } catch (error: unknown) {
      console.error("[registration.school.provisioner] Compensation failed", {
        collection: resource.collection,
        error: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      });
      break;
    }
  }
}

function invitationFailure(): RegistrationError {
  return new RegistrationError(
    "The school invitation is invalid or no longer available.",
    "INVITATION_INVALID",
    409
  );
}

function schoolConflict(): RegistrationError {
  return new RegistrationError(
    "A school with this name is already registered.",
    "SCHOOL_CONFLICT",
    409
  );
}

function isKnownNonAmbiguousFailure(error: unknown): boolean {
  if (error instanceof RegistrationError) {
    return (
      error.code === "CONFIGURATION_ERROR" ||
      error.code === "INVITATION_INVALID" ||
      error.code === "PROVISIONING_CONFLICT" ||
      error.code === "SCHOOL_CONFLICT" ||
      (error.code === "PROVISIONING_FAILED" && error.statusCode === 409)
    );
  }
  if (isRecord(error)) {
    const status = Number(error.status ?? error.statusCode);
    return status === 409;
  }
  return false;
}

function isHandledDownstreamFailure(error: unknown): boolean {
  return isKnownNonAmbiguousFailure(error);
}

function validateUser(user: ProvisioningUser): void {
  if (
    !isProvisioningId(user?.user_id) ||
    !normalizeEmail(user?.user_email)
  ) {
    throw new RegistrationError(
      "Registration user context is invalid.",
      "PROVISIONING_CONFLICT",
      409
    );
  }

  if (
    user.role !== undefined &&
    user.role !== null &&
    (typeof user.role !== "string" || user.role.toUpperCase() !== "SCH_ADMIN")
  ) {
    throw new RegistrationError(
      "Registration role does not match the school administrator graph.",
      "PROVISIONING_CONFLICT",
      409
    );
  }
}

function validateSchoolData(data: SchoolProvisioningInput): void {
  if (
    !data ||
    typeof data.school_name !== "string" ||
    typeof data.school_type !== "string" ||
    typeof data.school_province !== "string" ||
    typeof data.school_city !== "string" ||
    !data.school_name.trim() ||
    !data.school_type.trim() ||
    !data.school_province.trim() ||
    !data.school_city.trim() ||
    (data.school_brgy !== undefined &&
      data.school_brgy !== null &&
      typeof data.school_brgy !== "string") ||
    (data.school_address_line !== undefined &&
      data.school_address_line !== null &&
      typeof data.school_address_line !== "string") ||
    (data.invitation_token !== undefined &&
      data.invitation_token !== null &&
      typeof data.invitation_token !== "string")
  ) {
    throw new RegistrationError(
      "School registration data is incomplete.",
      "PROVISIONING_CONFLICT",
      409
    );
  }
  if (normalizeSchoolIdentityName(data.school_name) === null) {
    throw new RegistrationError(
      "School registration data is incomplete.",
      "PROVISIONING_CONFLICT",
      409
    );
  }
}

function assertInvitationEmail(
  invitation: ProvisioningRecord,
  user: ProvisioningUser
): void {
  const invitedEmail = normalizeEmail(invitation.invited_email);
  if (!invitedEmail || invitedEmail !== normalizeEmail(user.user_email)) {
    throw invitationFailure();
  }
}

function invitationOwnerMatches(
  invitation: ProvisioningRecord,
  user: ProvisioningUser
): boolean {
  const ownerId =
    relationId(invitation.used_by_user_id) ??
    relationId(invitation.consumed_by_user_id) ??
    relationId(invitation.user_id);
  if (ownerId !== null && !sameId(ownerId, user.user_id)) return false;

  const ownerRegistrationKey =
    invitation.registration_key ??
    invitation.used_by_registration_key ??
    invitation.consumed_by_registration_key;
  if (
    ownerRegistrationKey !== undefined &&
    ownerRegistrationKey !== null &&
    String(ownerRegistrationKey) !== String(user.registration_key ?? "")
  ) {
    return false;
  }

  return true;
}

function schoolMatchesSelfSignup(
  school: ProvisioningRecord,
  user: ProvisioningUser,
  data: SchoolProvisioningInput
): boolean {
  const existingBarangay = optionalText(school.barangay);
  const requestedBarangay = optionalText(data.school_brgy);
  const existingAddressLine = optionalText(school.address_line);
  const requestedAddressLine = optionalText(data.school_address_line);
  return (
    sameId(school.created_by, user.user_id) &&
    normalizeEmail(school.school_email) === normalizeEmail(user.user_email) &&
    typeof school.school_name === "string" &&
    normalizeSchoolIdentityName(school.school_name) ===
      normalizeSchoolIdentityName(data.school_name) &&
    String(school.school_type ?? "").trim() === data.school_type.trim() &&
    String(school.city_municipality ?? "").trim() === data.school_city.trim() &&
    String(school.province ?? "").trim() === data.school_province.trim() &&
    existingBarangay === requestedBarangay &&
    existingAddressLine === requestedAddressLine
  );
}

async function findNormalizedSchoolMatches(
  repo: RegistrationProvisioningRepository,
  data: SchoolProvisioningInput,
  ownerId?: ProvisioningId
): Promise<ProvisioningRecord[]> {
  const requestedName = normalizeSchoolIdentityName(data.school_name);
  if (requestedName === null) return [];
  const candidates = ownerId !== undefined
    ? await repo.findSchoolIdentityCandidatesForOwner<ProvisioningRecord>(
        SCHOOL_FIELDS,
        ownerId
      )
    : await repo.findSchoolIdentityCandidates<ProvisioningRecord>(SCHOOL_FIELDS);
  return candidates.filter(
    (candidate) =>
      typeof candidate.school_name === "string" &&
      normalizeSchoolIdentityName(candidate.school_name) === requestedName
  );
}

function resolveCompatibleSelfSignupMatch(
  matches: readonly ProvisioningRecord[],
  user: ProvisioningUser,
  data: SchoolProvisioningInput
): ProvisioningRecord | null {
  for (const match of matches) {
    if (schoolMatchesSelfSignup(match, user, data)) return match;
  }
  if (matches.some((match) => hasDifferentOwner(match, user.user_id))) {
    throw schoolConflict();
  }
  if (matches.length > 0) {
    throw new RegistrationError(
      "Existing school registration is incompatible.",
      "PROVISIONING_CONFLICT",
      409
    );
  }
  return null;
}

async function findSchoolAdminLink(
  repo: RegistrationProvisioningRepository,
  schoolId: ProvisioningId,
  userId: ProvisioningId
): Promise<ProvisioningRecord | null> {
  return (await repo.findOne(SCHOOL_ADMIN_COLLECTION, {
    school_id: schoolId,
    user_id: userId,
  }, SCHOOL_ADMIN_FIELDS)) as ProvisioningRecord | null;
}

async function ensureSchoolAdminLink(
  repo: RegistrationProvisioningRepository,
  schoolId: ProvisioningId,
  user: ProvisioningUser,
  ledger: ProvisioningLedger
): Promise<ProvisioningRecord> {
  const existing = await findSchoolAdminLink(repo, schoolId, user.user_id);
  if (existing) {
    if (
      existing.is_active === false ||
      existing.is_active === 0 ||
      existing.is_active === "false" ||
      existing.is_active === "0"
    ) {
      const linkId = requireId(
        existing,
        "School administrator link has no stable identifier.",
        "school_admin_id",
        "id"
      );
      try {
        return (await repo.update(SCHOOL_ADMIN_COLLECTION, linkId, {
          is_active: true,
        })) as ProvisioningRecord;
      } catch (error: unknown) {
        if (!isKnownNonAmbiguousFailure(error)) ledger.ambiguous = true;
        throw error;
      }
    }
    return existing;
  }

  const linkPayload = {
    school_id: schoolId,
    user_id: user.user_id,
    is_active: true,
  };

  try {
    const createdLink = (await repo.create(
      SCHOOL_ADMIN_COLLECTION,
      linkPayload
    )) as ProvisioningRecord;
    const linkId = requireId(
      createdLink,
      "Created school administrator link has no stable identifier.",
      "school_admin_id",
      "id"
    );
    ledger.created.push({
      collection: SCHOOL_ADMIN_COLLECTION,
      id: linkId,
    });
    return createdLink;
  } catch (error: unknown) {
    // A unique-pair conflict or an ambiguous response may mean another retry
    // created the link. Reconcile by the natural key before reporting failure.
    let reconciled: ProvisioningRecord | null;
    try {
      reconciled = await findSchoolAdminLink(repo, schoolId, user.user_id);
    } catch {
      ledger.ambiguous = true;
      throw error;
    }
    if (reconciled) {
      ledger.ambiguous = true;
      return reconciled;
    }
    if (!isKnownNonAmbiguousFailure(error)) ledger.ambiguous = true;
    throw error;
  }
}

async function markSchoolPendingVerification(
  repo: RegistrationProvisioningRepository,
  schoolId: ProvisioningId,
  ledger: ProvisioningLedger
): Promise<ProvisioningRecord> {
  try {
    return (await repo.update(SCHOOL_COLLECTION, schoolId, {
      school_status: "Pending",
      verification_status: "PENDING_VERIFICATION",
      submitted_at: getPHTimeString(),
    })) as ProvisioningRecord;
  } catch (error: unknown) {
    if (!isKnownNonAmbiguousFailure(error)) ledger.ambiguous = true;
    throw error;
  }
}

async function resolveSelfSignupSchool(
  repo: RegistrationProvisioningRepository,
  user: ProvisioningUser,
  data: SchoolProvisioningInput,
  ledger: ProvisioningLedger
): Promise<ProvisioningRecord> {
  const ownerMatches = await findNormalizedSchoolMatches(repo, data, user.user_id);
  const existing = resolveCompatibleSelfSignupMatch(ownerMatches, user, data);
  if (existing) return existing;

  resolveCompatibleSelfSignupMatch(
    await findNormalizedSchoolMatches(repo, data),
    user,
    data
  );

  const schoolPayload: ProvisioningRecord = {
    school_name: data.school_name,
    school_type: data.school_type,
    school_email: normalizeEmail(user.user_email),
    city_municipality: data.school_city,
    province: data.school_province,
    school_status: "Draft",
    profile_completion_percent: 40,
    created_by: user.user_id,
  };
  const barangay = optionalText(data.school_brgy);
  const addressLine = optionalText(data.school_address_line);
  if (barangay) schoolPayload.barangay = barangay;
  if (addressLine) schoolPayload.address_line = addressLine;

  try {
    const school = (await repo.create(
      SCHOOL_COLLECTION,
      schoolPayload
    )) as ProvisioningRecord;
    const schoolId = requireId(
      school,
      "Created school has no stable identifier.",
      "school_id",
      "id"
    );
    ledger.created.push({ collection: SCHOOL_COLLECTION, id: schoolId });
    return school;
  } catch (error: unknown) {
    let matches: ProvisioningRecord[];
    try {
      matches = await findNormalizedSchoolMatches(repo, data, user.user_id);
    } catch {
      ledger.ambiguous = true;
      throw error;
    }
    const reconciled = resolveCompatibleSelfSignupMatch(matches, user, data);
    if (reconciled) {
      ledger.ambiguous = true;
      return reconciled;
    }
    if (!isKnownNonAmbiguousFailure(error)) ledger.ambiguous = true;
    throw error;
  }
}

function validateInvitationExpiry(invitation: ProvisioningRecord): void {
  const expiresAt = parseDirectusUtcDateTime(invitation.expires_at);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    throw invitationFailure();
  }
}

async function resolveInvitedSchool(
  repo: RegistrationProvisioningRepository,
  invitation: ProvisioningRecord,
  data: SchoolProvisioningInput
): Promise<ProvisioningRecord> {
  const schoolId = relationId(invitation.school_id);
  if (schoolId === null) throw invitationFailure();

  if (
    data.invited_school_id !== null &&
    data.invited_school_id !== undefined &&
    !sameId(data.invited_school_id, schoolId)
  ) {
    throw invitationFailure();
  }

  const school = (await repo.findOne(SCHOOL_COLLECTION, {
    school_id: schoolId,
  }, SCHOOL_FIELDS)) as ProvisioningRecord | null;
  if (!school) throw invitationFailure();
  return school;
}

async function consumeInvitation(
  repo: RegistrationProvisioningRepository,
  invitation: ProvisioningRecord,
  user: ProvisioningUser,
  schoolId: ProvisioningId
): Promise<ProvisioningRecord> {
  const invitationId = requireId(
    invitation,
    "Invitation has no stable identifier.",
    "token_id",
    "id"
  );
  const invitationToken =
    typeof invitation.token === "string" ? invitation.token.trim() : "";
  if (!invitationToken) throw invitationFailure();

  const hasUserOwnershipField = Object.prototype.hasOwnProperty.call(
    invitation,
    "used_by_user_id"
  );
  const hasRegistrationOwnershipField = Object.prototype.hasOwnProperty.call(
    invitation,
    "registration_key"
  );
  if (!hasUserOwnershipField && !hasRegistrationOwnershipField) {
    throw new RegistrationError(
      "Invitation retry ownership is not configured.",
      "CONFIGURATION_ERROR",
      503
    );
  }
  if (!user.registration_key?.trim()) {
    throw new RegistrationError(
      "Registration retry ownership is not available.",
      "PROVISIONING_CONFLICT",
      409
    );
  }

  const ownershipPatch: ProvisioningRecord = { is_used: true };
  if (hasUserOwnershipField) ownershipPatch.used_by_user_id = user.user_id;
  if (hasRegistrationOwnershipField) {
    ownershipPatch.registration_key = user.registration_key;
  }

  let updated: ProvisioningRecord;
  try {
    updated = (await repo.update(
      INVITATION_COLLECTION,
      invitationId,
      ownershipPatch
    )) as ProvisioningRecord;
  } catch (error: unknown) {
    // A timeout may have committed the consume. Re-read and accept only when
    // the resulting used token is still compatible with this user's graph.
    let reconciled: ProvisioningRecord | null;
    try {
      reconciled = (await repo.findOne(INVITATION_COLLECTION, {
        token: invitationToken,
      }, INVITATION_FIELDS)) as ProvisioningRecord | null;
    } catch {
      // The PATCH result is unknown and the reconciliation read also failed.
      // Do not compensate the graph: the invite may already be consumed and
      // must remain available as ownership evidence for a later retry.
      throw new InvitationConsumptionUncertainError();
    }
    if (
      reconciled &&
      isUsed(reconciled.is_used) &&
      normalizeEmail(reconciled.invited_email) === normalizeEmail(user.user_email) &&
      invitationOwnerMatches(reconciled, user)
    ) {
      try {
        const link = await findSchoolAdminLink(repo, schoolId, user.user_id);
        if (link) return reconciled;
      } catch {
        // The invitation is known to be owned by this user, but the graph
        // read is inconclusive. Preserve both records for reconciliation.
        throw new InvitationConsumptionUncertainError();
      }
      // A consumed invitation without a provable graph cannot be safely
      // rolled back. Keep it and fail closed until a later retry reconciles it.
      throw new InvitationConsumptionUncertainError();
    }
    if (
      reconciled &&
      isUsed(reconciled.is_used) &&
      normalizeEmail(reconciled.invited_email) === normalizeEmail(user.user_email)
    ) {
      // The token is now owned by another registration key/user. Never
      // attempt to undo that consume; only the current invocation's graph is
      // eligible for compensation by the caller.
      throw invitationFailure();
    }
    throw error;
  }

  // A successful PATCH followed by a stale/missing read is still an
  // uncertain cross-record state. Only a confirmed owner read is safe to
  // return; a confirmed different owner is a deterministic conflict.
  let owned: ProvisioningRecord | null;
  try {
    owned = (await repo.findOne(INVITATION_COLLECTION, {
      token: invitationToken,
    }, INVITATION_FIELDS)) as ProvisioningRecord | null;
  } catch {
    throw new InvitationConsumptionUncertainError();
  }
  if (
    owned &&
    isUsed(owned.is_used) &&
    normalizeEmail(owned.invited_email) === normalizeEmail(user.user_email) &&
    invitationOwnerMatches(owned, user)
  ) {
    return updated;
  }
  if (
    owned &&
    isUsed(owned.is_used) &&
    normalizeEmail(owned.invited_email) === normalizeEmail(user.user_email)
  ) {
    throw invitationFailure();
  }
  throw new InvitationConsumptionUncertainError();
}

/**
 * Provision the school-admin graph after OTP verification.
 *
 * This function never creates a user, uploads files, or changes activation
 * state. The provisioning coordinator owns the user row and the activation
 * commit point; this slice only ensures school/link/invitation state.
 */
export async function provisionSchoolGraph(
  repo: RegistrationProvisioningRepository,
  user: ProvisioningUser,
  data: SchoolProvisioningInput
): Promise<SchoolProvisioningResult> {
  validateUser(user);
  validateSchoolData(data);

  const ledger: ProvisioningLedger = { created: [], ambiguous: false };
  const invitationToken = data.invitation_token?.trim() || null;

  try {
    if (!invitationToken && data.invited_school_id !== null && data.invited_school_id !== undefined) {
      throw invitationFailure();
    }

    if (!invitationToken) {
      const school = await resolveSelfSignupSchool(repo, user, data, ledger);
      const schoolId = requireId(
        school,
        "School has no stable identifier.",
        "school_id",
        "id"
      );
      const schoolAdmin = await ensureSchoolAdminLink(
        repo,
        schoolId,
        user,
        ledger
      );
      const submittedSchool = await markSchoolPendingVerification(
        repo,
        schoolId,
        ledger
      );
      return {
        school: submittedSchool,
        schoolAdmin,
        invitation: null,
        created: ledger.created,
      };
    }

    const invitation = (await repo.findOne(INVITATION_COLLECTION, {
      token: invitationToken,
    }, INVITATION_FIELDS)) as ProvisioningRecord | null;
    if (!invitation) throw invitationFailure();
    assertInvitationEmail(invitation, user);

    const alreadyUsed = isUsed(invitation.is_used);
    if (alreadyUsed) {
      // A used invite is resumable only if the same registration-key user is
      // already linked to this exact school. Never create a second link from
      // an invitation that was consumed by another registration.
      if (!user.registration_key || !invitationOwnerMatches(invitation, user)) {
        throw invitationFailure();
      }
      const school = await resolveInvitedSchool(repo, invitation, data);
      const schoolId = requireId(
        school,
        "School has no stable identifier.",
        "school_id",
        "id"
      );
      const existingLink = await findSchoolAdminLink(
        repo,
        schoolId,
        user.user_id
      );
      if (!existingLink) throw invitationFailure();
      const schoolAdmin =
        existingLink.is_active === false ||
        existingLink.is_active === 0 ||
        existingLink.is_active === "false" ||
        existingLink.is_active === "0"
          ? await ensureSchoolAdminLink(repo, schoolId, user, ledger)
          : existingLink;
      const submittedSchool = await markSchoolPendingVerification(
        repo,
        schoolId,
        ledger
      );
      return {
        school: submittedSchool,
        schoolAdmin,
        invitation,
        created: ledger.created,
      };
    }

    validateInvitationExpiry(invitation);
    const school = await resolveInvitedSchool(repo, invitation, data);
    const schoolId = requireId(
      school,
      "School has no stable identifier.",
      "school_id",
      "id"
    );
    const schoolAdmin = await ensureSchoolAdminLink(
      repo,
      schoolId,
      user,
      ledger
    );
    const consumedInvitation = await consumeInvitation(
      repo,
      invitation,
      user,
      schoolId
    );
    const submittedSchool = await markSchoolPendingVerification(
      repo,
      schoolId,
      ledger
    );

    return {
      school: submittedSchool,
      schoolAdmin,
      invitation: consumedInvitation,
      created: ledger.created,
    };
  } catch (error: unknown) {
    if (isHandledDownstreamFailure(error)) {
      await compensateCreatedResources(repo, ledger);
    }
    if (error instanceof InvitationConsumptionUncertainError) {
      console.error(
        "[registration.school.provisioner] Invitation consumption is uncertain",
        { error: error.name }
      );
      throw provisioningFailure();
    }
    if (error instanceof RegistrationError) throw error;
    console.error("[registration.school.provisioner] Provisioning failed", {
      error: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    });
    throw provisioningFailure();
  }
}

/**
 * Best-effort initiate-time school-name pre-check.
 *
 * It reuses the SAME candidate retrieval and the SAME normalizer as the
 * provisioning-time guard (`resolveSelfSignupSchool`) so the early check and
 * the enforcing guard can never disagree about what "same name" means.
 *
 * A conflict is reported ONLY when ownership is POSITIVELY established as a
 * different person: a normalized-name candidate whose `created_by` is a valid
 * provisioning id whose owner email resolves and differs from the registering
 * email. A missing, invalid, or unresolvable `created_by` never blocks, and an
 * owner that resolves to the registering email is a same-user retry that
 * provisioning reconciles idempotently.
 *
 * This is explicitly NOT race-safe and never replaces provisioning, which
 * remains the authoritative duplicate guard.
 */
export async function findConflictingSchoolOwnerEmail(
  repo: RegistrationProvisioningRepository,
  schoolName: string,
  registeringEmail: string
): Promise<string | null> {
  const requestedName = normalizeSchoolIdentityName(schoolName);
  if (requestedName === null) return null;

  const registeringEmailNormalized = normalizeEmail(registeringEmail);
  const candidates = await repo.findSchoolIdentityCandidates<ProvisioningRecord>(
    SCHOOL_FIELDS
  );

  for (const candidate of candidates) {
    if (
      typeof candidate.school_name !== "string" ||
      normalizeSchoolIdentityName(candidate.school_name) !== requestedName
    ) {
      continue;
    }
    if (!isProvisioningId(candidate.created_by)) continue;

    let ownerEmail: string | null;
    try {
      ownerEmail = await repo.findUserEmailById(candidate.created_by);
    } catch {
      // The owner row may have been deleted by earlier terminal cleanup or the
      // read may have failed. Ownership is not positively established here, so
      // skip this candidate and let the user proceed.
      continue;
    }
    const ownerEmailNormalized = normalizeEmail(ownerEmail);
    if (!ownerEmailNormalized) continue;
    if (ownerEmailNormalized !== registeringEmailNormalized) {
      return ownerEmailNormalized;
    }
  }

  return null;
}

export interface SelfSignupSchoolNameCheckOptions {
  readonly role: string;
  readonly schoolName: string;
  readonly email: string;
  readonly invitationToken?: string | null;
}

/**
 * Fail-open initiate-time guard, run before any challenge is created or OTP is
 * sent. Only self-signup SCH_ADMIN (no invitation token) is ever checked;
 * invited signup and every other role are untouched.
 *
 * Any lookup/network/malformed-record failure is logged and swallowed so a
 * broken pre-check can never block signup. Only a positively-established
 * foreign owner raises the existing `SCHOOL_CONFLICT` (409).
 */
export async function assertSelfSignupSchoolNameAvailable(
  options: SelfSignupSchoolNameCheckOptions
): Promise<void> {
  if (options.role !== "SCH_ADMIN") return;
  if (options.invitationToken?.trim()) return;

  let conflictOwnerEmail: string | null;
  try {
    const repo = new RegistrationProvisioningRepository();
    conflictOwnerEmail = await findConflictingSchoolOwnerEmail(
      repo,
      options.schoolName,
      options.email
    );
  } catch (error: unknown) {
    console.error(
      "[registration.school.provisioner] School-name pre-check failed open",
      {
        error: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      }
    );
    return;
  }

  if (conflictOwnerEmail !== null) throw schoolConflict();
}
