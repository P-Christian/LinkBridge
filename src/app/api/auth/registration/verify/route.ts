import { NextRequest } from "next/server";
import { COOKIE_NAME, getCookieOptions } from "@/lib/auth-utils";
import {
  clearRegistrationChallengeCookie,
  getChallengeId,
  handleRegistrationRouteError,
  parseRegistrationJson,
  RegistrationChallengeRepository,
  RegistrationError,
  RegistrationProvisioningService,
  registrationJson,
  RegistrationService,
  requireRegistrationV2,
  verifyOtpInputSchema,
} from "@/modules/auth/registration";
import {
  getJwtVerificationSecret,
  issueRegistrationSession,
} from "@/modules/auth/registration/registration.session";
import { issueRegistrationAttachmentToken } from "@/modules/auth/registration/registration.attachment.token";
import {
  findInvitationByToken,
  findStudentById,
} from "@/modules/auth/student-invitation/invitation.repo";
import { getInvitationState } from "@/modules/auth/student-invitation/invitation.service";
import { issueWelcomeDeferral } from "@/modules/auth/student-invitation/welcome-deferral";
import {
  decryptGoogleRegistration,
  linkUserIdentity,
} from "@/modules/auth/google/google.service";
import { decryptLinkedInRegistration } from "@/modules/auth/linkedin/linkedin.service";
import { decryptFacebookRegistration } from "@/modules/auth/facebook/facebook.service";
import { createAuditRecordRepo } from "@/modules/vos-admin/audit-trail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WELCOME_DEFERRAL_COOKIE_NAME = "vs_welcome_pending";
const WELCOME_DEFERRAL_COOKIE_MAX_AGE_SECONDS = 86_400;

export async function POST(request: NextRequest) {
  const disabled = requireRegistrationV2();
  if (disabled) return disabled;

  const challengeRepo = new RegistrationChallengeRepository();
  let lease:
    | Awaited<ReturnType<RegistrationService["verifyOtpAndAcquireLease"]>>
    | undefined;
  try {
    // Fail before OTP state changes if session signing is not configured.
    getJwtVerificationSecret();
    const challengeId = getChallengeId(request);
    const input = await parseRegistrationJson(request, verifyOtpInputSchema);
    const invitationToken = request.headers
      .get("x-student-invitation-token")
      ?.trim();
    let welcomeDeferralInvitationId: number | null = null;
    if (invitationToken) {
      try {
        const invitation = await findInvitationByToken(invitationToken);
        const student = invitation
          ? await findStudentById(invitation.student_id)
          : null;
        if (getInvitationState(invitation, student, Date.now()) === "valid") {
          welcomeDeferralInvitationId = invitation?.invitation_id ?? null;
        }
      } catch {
        welcomeDeferralInvitationId = null;
      }
    }
    lease = await new RegistrationService(
      challengeRepo
    ).verifyOtpAndAcquireLease(
      challengeId,
      input.otp,
      input.sealedPayload
    );

    // Defer the welcome email ONLY for invitation-originated FREELANCER
    // registrations. CLIENT, SCH_ADMIN, and non-invitation FREELANCER
    // registrations keep the immediate welcome and never receive the
    // vs_welcome_pending pass.
    const deferWelcomeEmail =
      welcomeDeferralInvitationId !== null &&
      lease.payload.role === "FREELANCER";

    const provisioningService = new RegistrationProvisioningService();
    const user = deferWelcomeEmail
      ? await provisioningService.provision(lease.challenge, lease.payload, {
          deferWelcomeEmail: true,
        })
      : await provisioningService.provision(lease.challenge, lease.payload);
    await challengeRepo.consumeChallenge(
      challengeId,
      lease.challenge.state_version,
      lease.leaseId
    );

    // Link federated provider identities (Google / LinkedIn) if registration was initiated via social OAuth
    const googleRegCookie = request.cookies.get("vos_sync_google_reg")?.value;
    if (googleRegCookie) {
      try {
        const googlePayload = await decryptGoogleRegistration(googleRegCookie);
        if (googlePayload?.sub && googlePayload?.email) {
          await linkUserIdentity({
            userId: user.user_id,
            provider: "google",
            providerSubject: googlePayload.sub,
            providerEmail: googlePayload.email,
            providerName: googlePayload.name ?? null,
          });

          createAuditRecordRepo({
            event_type: "USER_IDENTITY_LINKED",
            event_category: "AUTHENTICATION",
            action: "LINK_IDENTITY",
            status: "SUCCESS",
            actor_type: user.role_id === 3 ? "ADMIN" : "USER",
            actor_user_id: Number(user.user_id),
            reason: `Automatically linked Google identity upon user registration for ${googlePayload.email}`,
          });
        }
      } catch (err) {
        console.error("[registration/verify] Failed to link Google identity:", err);
      }
    }

    const linkedInRegCookie = request.cookies.get("vos_sync_linkedin_reg")?.value;
    if (linkedInRegCookie) {
      try {
        const linkedInPayload = await decryptLinkedInRegistration(linkedInRegCookie);
        if (linkedInPayload?.sub && linkedInPayload?.email) {
          await linkUserIdentity({
            userId: user.user_id,
            provider: "linkedin",
            providerSubject: linkedInPayload.sub,
            providerEmail: linkedInPayload.email,
            providerName: linkedInPayload.name ?? null,
          });

          createAuditRecordRepo({
            event_type: "USER_IDENTITY_LINKED",
            event_category: "AUTHENTICATION",
            action: "LINK_IDENTITY",
            status: "SUCCESS",
            actor_type: user.role_id === 3 ? "ADMIN" : "USER",
            actor_user_id: Number(user.user_id),
            reason: `Automatically linked LinkedIn identity upon user registration for ${linkedInPayload.email}`,
          });
        }
      } catch (err) {
        console.error("[registration/verify] Failed to link LinkedIn identity:", err);
      }
    }

    const facebookRegCookie = request.cookies.get("vos_sync_facebook_reg")?.value;
    if (facebookRegCookie) {
      try {
        const facebookPayload = await decryptFacebookRegistration(facebookRegCookie);
        if (facebookPayload?.id && facebookPayload?.email) {
          await linkUserIdentity({
            userId: user.user_id,
            provider: "facebook",
            providerSubject: facebookPayload.id,
            providerEmail: facebookPayload.email,
            providerName: facebookPayload.name ?? null,
          });

          createAuditRecordRepo({
            event_type: "USER_IDENTITY_LINKED",
            event_category: "AUTHENTICATION",
            action: "LINK_IDENTITY",
            status: "SUCCESS",
            actor_type: user.role_id === 3 ? "ADMIN" : "USER",
            actor_user_id: Number(user.user_id),
            reason: `Automatically linked Facebook identity upon user registration for ${facebookPayload.email}`,
          });
        }
      } catch (err) {
        console.error("[registration/verify] Failed to link Facebook identity:", err);
      }
    }

    const session = await issueRegistrationSession(user);
    const attachmentToken = await issueRegistrationAttachmentToken(user);
    let response = registrationJson({
      ok: true,
      role: lease.payload.role,
      destination: session.destination,
      attachmentToken,
    });
    // Clear the narrow challenge cookie first and write the root auth cookie
    // last. This is robust to development proxies that incorrectly retain
    // only the final Set-Cookie header from a multi-cookie response.
    response = clearRegistrationChallengeCookie(response);
    if (googleRegCookie) {
      response.cookies.set({
        name: "vos_sync_google_reg",
        value: "",
        maxAge: 0,
        path: "/",
      });
    }
    if (linkedInRegCookie) {
      response.cookies.set({
        name: "vos_sync_linkedin_reg",
        value: "",
        maxAge: 0,
        path: "/",
      });
    }
    if (facebookRegCookie) {
      response.cookies.set({
        name: "vos_sync_facebook_reg",
        value: "",
        maxAge: 0,
        path: "/",
      });
    }
    if (deferWelcomeEmail && welcomeDeferralInvitationId !== null) {
      response.cookies.set({
        name: WELCOME_DEFERRAL_COOKIE_NAME,
        value: issueWelcomeDeferral(
          user.user_id,
          welcomeDeferralInvitationId
        ),
        ...getCookieOptions(
          true,
          "/",
          WELCOME_DEFERRAL_COOKIE_MAX_AGE_SECONDS
        ),
      });
    }
    response.cookies.set({
      name: COOKIE_NAME,
      value: session.token,
      ...getCookieOptions(true),
    });
    return response;
  } catch (error) {
    const terminalCompanyConflict =
      error instanceof RegistrationError &&
      (error.code === "COMPANY_EMAIL_CONFLICT" ||
        error.code === "COMPANY_TIN_CONFLICT");
    const terminalSchoolConflict =
      error instanceof RegistrationError && error.code === "SCHOOL_CONFLICT";
    let releasedChallenge:
      | Awaited<ReturnType<RegistrationChallengeRepository["releaseVerificationLease"]>>
      | undefined;
    if (lease) {
      try {
        releasedChallenge = await challengeRepo.releaseVerificationLease(
          lease.challenge.challenge_id,
          lease.challenge.state_version,
          true,
          lease.leaseId
        );
      } catch {
        // The consume may have committed or the lease may have expired. A
        // later retry reconciles by registration_key before creating records.
      }
    }

    if ((terminalCompanyConflict || terminalSchoolConflict) && lease && releasedChallenge) {
      try {
        await challengeRepo.cancelChallenge(
          lease.challenge.challenge_id,
          releasedChallenge.state_version,
          "ACTIVE"
        );
        return clearRegistrationChallengeCookie(
          handleRegistrationRouteError(error)
        );
      } catch {
        return handleRegistrationRouteError(
          new RegistrationError(
            "Registration cleanup could not be completed. Please try again.",
            "PROVISIONING_FAILED",
            503
          )
        );
      }
    }

    return handleRegistrationRouteError(error);
  }
}
