import { sendNotificationEmail } from "@/lib/mail";
import { canAuthenticate } from "@/lib/status-validator";
import { createAuditRecordRepo } from "@/modules/vos-admin/audit-trail";
import { RegistrationError } from "./registration.errors";
import { RegistrationProvisioningRepository } from "./registration.provisioning.repo";
import type {
  RegistrationChallengeRecord,
  RegistrationRole,
  SealedRegistrationPayloadV1,
} from "./registration.types";
import { provisionClientGraph } from "./provisioners/client.provisioner";
import { provisionFreelancerGraph } from "./provisioners/freelancer.provisioner";
import { provisionSchoolGraph } from "./provisioners/school.provisioner";
import { releaseParkedRequestsForSchool } from "@/modules/school-request-routing";

export interface ProvisionedRegistrationUser extends Record<string, unknown> {
  user_id: string | number;
  user_email: string;
  role: string;
  role_id: number;
  registration_key: string;
  status: string;
  otp_verified: boolean | number | string;
  user_fname?: string;
  user_lname?: string;
  is_blocked?: boolean | number | string | null;
  lock_until?: string | null;
}

export interface RegistrationProvisioningOptions {
  readonly deferWelcomeEmail?: boolean;
}

const USER_FIELDS = [
  "user_id",
  "user_email",
  "role",
  "role_id",
  "registration_key",
  "status",
  "otp_verified",
  "otp_verified_at",
  "user_fname",
  "user_lname",
  "is_blocked",
  "lock_until",
] as const;

const ROLE_IDS: Record<RegistrationRole, number> = {
  FREELANCER: 1,
  CLIENT: 2,
  SCH_ADMIN: 4,
};

function canonicalRole(value: unknown): string {
  const role = String(value ?? "").trim().toUpperCase();
  if (role === "EMPLOYER") return "CLIENT";
  if (role === "SCHOOL_ADMIN") return "SCH_ADMIN";
  return role;
}

function conflict(message: string): RegistrationError {
  return new RegistrationError(message, "PROVISIONING_CONFLICT", 409);
}

function isTerminalClientConflict(error: unknown): error is RegistrationError {
  return (
    error instanceof RegistrationError &&
    (error.code === "COMPANY_EMAIL_CONFLICT" ||
      error.code === "COMPANY_TIN_CONFLICT")
  );
}

function isTerminalSchoolConflict(error: unknown): error is RegistrationError {
  return error instanceof RegistrationError && error.code === "SCHOOL_CONFLICT";
}

function assertCompatibleUser(
  user: ProvisionedRegistrationUser,
  challenge: RegistrationChallengeRecord,
  payload: SealedRegistrationPayloadV1
): void {
  if (
    String(user.registration_key) !== challenge.challenge_id ||
    user.user_email.trim().toLowerCase() !== challenge.email_normalized ||
    canonicalRole(user.role) !== payload.role ||
    Number(user.role_id) !== ROLE_IDS[payload.role]
  ) {
    throw conflict("Existing registration record is incompatible.");
  }
  const status = String(user.status ?? "").toUpperCase();
  if (
    status !== "PROVISIONING" &&
    status !== "ACTIVE" &&
    status !== "PENDING_VERIFICATION"
  ) {
    throw conflict("Existing registration record has an incompatible status.");
  }
}

export class RegistrationProvisioningService {
  constructor(
    private readonly repo = new RegistrationProvisioningRepository()
  ) { }

  async provision(
    challenge: RegistrationChallengeRecord,
    payload: SealedRegistrationPayloadV1,
    options?: RegistrationProvisioningOptions
  ): Promise<ProvisionedRegistrationUser> {
    if (
      challenge.challenge_id !== payload.challengeId ||
      challenge.email_normalized !== payload.email ||
      challenge.role !== payload.role ||
      challenge.status !== "VERIFYING"
    ) {
      throw conflict("Registration challenge and payload are incompatible.");
    }

    let user = await this.repo.findOne<ProvisionedRegistrationUser>(
      "vs_user",
      { registration_key: challenge.challenge_id },
      USER_FIELDS
    );

    if (!user) {
      const emailOwner = await this.repo.findOne<ProvisionedRegistrationUser>(
        "vs_user",
        { user_email: payload.email },
        USER_FIELDS
      );
      if (emailOwner) {
        throw conflict("Email address became unavailable during registration.");
      }

      try {
        user = await this.repo.create<ProvisionedRegistrationUser>("vs_user", {
          ...payload.userData,
          role: payload.role,
          role_id: ROLE_IDS[payload.role],
          registration_key: challenge.challenge_id,
          status: "PROVISIONING",
          otp_verified: 0,
        });
      } catch (error) {
        // A failed/timeout response may still have committed. Reconcile by the
        // unique registration key before deciding whether the saga failed.
        user = await this.repo.findOne<ProvisionedRegistrationUser>(
          "vs_user",
          { registration_key: challenge.challenge_id },
          USER_FIELDS
        );
        if (!user) throw error;
      }
    }

    assertCompatibleUser(user, challenge, payload);

    let provisionedSchoolId: number | null = null;
    try {
      if (payload.role === "CLIENT") {
        if (!payload.clientData) throw conflict("Client registration data is missing.");
        await provisionClientGraph(this.repo, user, payload.clientData);
      } else if (payload.role === "FREELANCER") {
        if (!payload.freelancerData) {
          throw conflict("Freelancer registration data is missing.");
        }
        await provisionFreelancerGraph(this.repo, user, payload.freelancerData);
      } else {
        if (!payload.schoolData) {
          throw conflict("School registration data is missing.");
        }
        const graph = await provisionSchoolGraph(this.repo, user, payload.schoolData);
        const sid = Number(graph.school?.school_id);
        provisionedSchoolId = Number.isSafeInteger(sid) && sid > 0 ? sid : null;
      }
    } catch (error: unknown) {
      if (
        ((payload.role === "CLIENT" && isTerminalClientConflict(error)) ||
          (payload.role === "SCH_ADMIN" && isTerminalSchoolConflict(error))) &&
        String(user.status).toUpperCase() === "PROVISIONING"
      ) {
        try {
          await this.repo.delete("vs_user", user.user_id);
        } catch {
          throw new RegistrationError(
            "Registration cleanup could not be completed. Please try again.",
            "PROVISIONING_FAILED",
            503
          );
        }
      }
      throw error;
    }

    const wasAlreadyProvisioned = ["ACTIVE", "PENDING_VERIFICATION"].includes(
      String(user.status).toUpperCase()
    );
    if (!wasAlreadyProvisioned) {
      try {
        user = await this.repo.update<ProvisionedRegistrationUser>(
          "vs_user",
          user.user_id,
          {
            status: "PENDING_VERIFICATION",
            otp_verified: 1,
            otp_verified_at: new Date().toISOString(),
          }
        );
      } catch (error) {
        const reconciled = await this.repo.findOne<ProvisionedRegistrationUser>(
          "vs_user",
          { registration_key: challenge.challenge_id },
          USER_FIELDS
        );
        if (!reconciled || !canAuthenticate(reconciled)) throw error;
        user = reconciled;
      }
    }

    const activeUser = await this.repo.findOne<ProvisionedRegistrationUser>(
      "vs_user",
      { registration_key: challenge.challenge_id },
      USER_FIELDS
    );
    if (!activeUser || !canAuthenticate(activeUser)) {
      throw new RegistrationError(
        "Provisioned account did not pass the activation gate.",
        "PROVISIONING_FAILED",
        503
      );
    }

    if (!wasAlreadyProvisioned)
      await this.emitBestEffortEffects(activeUser, options, provisionedSchoolId);
    return activeUser;
  }

  private async emitBestEffortEffects(
    user: ProvisionedRegistrationUser,
    options?: RegistrationProvisioningOptions,
    schoolId?: number | null
  ): Promise<void> {
    const numericUserId = Number(user.user_id);
    const effects: Array<Promise<unknown>> = [
      createAuditRecordRepo({
        event_type: "USER_REGISTRATION_COMPLETED",
        event_category: "AUTHENTICATION",
        action: "REGISTER",
        status: "SUCCESS",
        actor_type: "USER",
        actor_user_id: Number.isSafeInteger(numericUserId)
          ? numericUserId
          : null,
        reason: "Challenge-backed registration completed (pending verification)",
      }),
    ];
    if (!options?.deferWelcomeEmail) {
      effects.push(
        sendNotificationEmail(
          user.user_email,
          "Welcome to LinkBridge",
          "Your LinkBridge account has been created and is pending admin verification."
        )
      );
    }
    if (typeof schoolId === "number" && Number.isInteger(schoolId) && schoolId > 0) {
      effects.push(releaseParkedRequestsForSchool(schoolId));
    }
    await Promise.allSettled(effects);
  }
}
