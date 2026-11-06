import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  authenticateCookieSession,
  isFreelancerSession,
} from "@/lib/authenticated-session";
import { sendNotificationEmail } from "@/lib/mail";
import type { StudentInvitationErrorCode } from "@/modules/auth/student-invitation/errors";
import {
  completeOwnedAcceptance,
  StudentInvitationAcceptanceError,
} from "@/modules/auth/student-invitation/invitation.acceptance";
import {
  StudentInvitationEducationError,
  synchronizeRosterEducation,
} from "@/modules/auth/student-invitation/invitation.education";
import {
  InvitationChallengeError,
  verifyInvitationChallenge,
} from "@/modules/auth/student-invitation/invitation.challenge";
import {
  findInvitationById,
  findInvitationByToken,
  findSchoolById,
  findStudentById,
  linkStudentAccount,
} from "@/modules/auth/student-invitation/invitation.repo";
import {
  canonicalizeEmail,
  fingerprintCanonicalEmail,
  getInvitationState,
  isLinkedToSession,
} from "@/modules/auth/student-invitation/invitation.service";
import { readWelcomeDeferral } from "@/modules/auth/student-invitation/welcome-deferral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifySchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(/^[A-Za-z0-9_-]+$/u),
    otp: z.string().trim().regex(/^\d{6}$/u).optional(),
  })
  .strict();
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

function verifyJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function conflictJson(code: StudentInvitationErrorCode): NextResponse {
  return verifyJson({ error: "Invitation cannot be accepted.", code }, 409);
}

/** Verify roster-email control, link the account, then consume the invitation. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await authenticateCookieSession();
  if (!session) {
    return verifyJson(
      { error: "Authentication required.", code: "UNAUTHENTICATED" },
      401
    );
  }
  if (!isFreelancerSession(session)) {
    return conflictJson("INVITATION_ROLE_INVALID");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return verifyJson(
      { error: "Invalid request.", code: "INVALID_REQUEST" },
      400
    );
  }
  const input = verifySchema.safeParse(body);
  if (!input.success) {
    return verifyJson(
      { error: "Invalid request.", code: "INVALID_REQUEST" },
      400
    );
  }

  try {
    const invitation = await findInvitationByToken(input.data.token);
    const student = invitation
      ? await findStudentById(invitation.student_id)
      : null;
    if (!invitation || !student || invitation.school_id !== student.school_id) {
      return verifyJson(
        { error: "Invitation cannot be accepted.", code: "INVITATION_INVALID" },
        400
      );
    }

    if (student.registered_user_id !== null) {
      if (!isLinkedToSession(student, session.userId)) {
        return conflictJson("INVITATION_OWNERSHIP_CONFLICT");
      }
      await synchronizeRosterEducation({ userId: session.userId, student });
      await completeOwnedAcceptance({
        sessionUserId: session.userId,
        invitation,
        student,
      });
      return verifyJson({ state: "linked" });
    }
    if (invitation.is_used) {
      return verifyJson(
        { error: "Invitation cannot be accepted.", code: "INVITATION_USED" },
        400
      );
    }
    const invitationState = getInvitationState(invitation, student, Date.now());
    if (invitationState === "expired") {
      return verifyJson(
        { error: "Invitation cannot be accepted.", code: "INVITATION_EXPIRED" },
        400
      );
    }
    if (invitationState !== "valid") {
      return verifyJson(
        { error: "Invitation cannot be accepted.", code: "INVITATION_INVALID" },
        400
      );
    }

    const rawAccountEmail = session.user.user_email ?? "";
    const rawRosterEmail = student.email ?? "";
    const accountEmail = canonicalizeEmail(rawAccountEmail);
    const rosterEmail = canonicalizeEmail(rawRosterEmail);
    if (!accountEmail || !rosterEmail) {
      return verifyJson(
        {
          error: "Invitation service is unavailable.",
          code: "SERVICE_UNAVAILABLE",
        },
        503
      );
    }
    const sameEmail = accountEmail === rosterEmail;
    console.info("[student-invitation.verify] Email comparison decision", {
      correlationId: crypto.randomUUID(),
      sameEmail,
      accountRawLength: rawAccountEmail.length,
      accountNormalizedLength: accountEmail.length,
      rosterRawLength: rawRosterEmail.length,
      rosterNormalizedLength: rosterEmail.length,
      accountFingerprint: fingerprintCanonicalEmail(accountEmail),
      rosterFingerprint: fingerprintCanonicalEmail(rosterEmail),
      invitationState,
    });
    if (!sameEmail) {
      if (!input.data.otp) {
        return verifyJson(
          { error: "Invalid verification code.", code: "OTP_REQUIRED" },
          400
        );
      }
      await verifyInvitationChallenge(input.data.otp, {
        invitationId: invitation.invitation_id,
        userId: session.userId,
        email: rosterEmail,
      });
    }

    const [latestInvitation, latestStudent] = await Promise.all([
      findInvitationById(invitation.invitation_id),
      findStudentById(student.student_id),
    ]);
    if (
      !latestInvitation ||
      !latestStudent ||
      latestInvitation.school_id !== latestStudent.school_id
    ) {
      return conflictJson("INVITATION_INVALID");
    }
    if (latestStudent.registered_user_id !== null) {
      if (!isLinkedToSession(latestStudent, session.userId)) {
        return conflictJson("INVITATION_OWNERSHIP_CONFLICT");
      }
      await synchronizeRosterEducation({ userId: session.userId, student: latestStudent });
      await completeOwnedAcceptance({
        sessionUserId: session.userId,
        invitation: latestInvitation,
        student: latestStudent,
      });
      return verifyJson({ state: "linked" });
    }
    const latestState = getInvitationState(
      latestInvitation,
      latestStudent,
      Date.now()
    );
    if (latestState === "expired") {
      return conflictJson("INVITATION_EXPIRED");
    }
    if (latestState === "used") {
      return conflictJson("INVITATION_USED");
    }
    if (latestState !== "valid") {
      return conflictJson("INVITATION_INVALID");
    }
    const latestEmail = latestStudent.email;
    const latestRosterEmail = canonicalizeEmail(latestEmail ?? "");
    if (
      !latestEmail ||
      !latestRosterEmail ||
      latestRosterEmail !== rosterEmail
    ) {
      return conflictJson("INVITATION_INVALID");
    }

    const link = await linkStudentAccount({
      studentId: latestStudent.student_id,
      userId: session.userId,
      schoolId: latestStudent.school_id,
      rosterEmail: latestEmail,
    });
    if (link.kind === "conflict") {
      return conflictJson("INVITATION_OWNERSHIP_CONFLICT");
    }

    const linkedResponse = verifyJson({ state: "linked" });
    if (link.created) {
      const pass = readWelcomeDeferral(
        request.cookies.get("vs_welcome_pending")?.value
      );
      const recipient = session.user.user_email?.trim();
      if (
        pass &&
        pass.userId === String(session.userId) &&
        pass.invitationId === String(latestInvitation.invitation_id) &&
        recipient
      ) {
        const school = await findSchoolById(latestInvitation.school_id);
        const schoolName = school?.school_name.trim() || "your school";
        // sendMail swallows SMTP errors, so delivery is not observable at this
        // layer; the pass is single-use and release is at-most-once best effort.
        void sendNotificationEmail(
          recipient,
          "Welcome to LinkBridge",
          `Your LinkBridge account is now linked to ${schoolName}.`
        );
        linkedResponse.cookies.delete("vs_welcome_pending");
      }
    }

    const sync = await synchronizeRosterEducation({ userId: session.userId, student: link.student });
    await completeOwnedAcceptance({
      sessionUserId: session.userId,
      invitation: latestInvitation,
      student: sync.student,
    });
    return linkedResponse;
  } catch (error: unknown) {
    if (error instanceof StudentInvitationEducationError) {
      return verifyJson(
        {
          error:
            error.statusCode === 503
              ? "Invitation service is unavailable."
              : error.statusCode === 400
                ? "Invalid request."
                : "Invitation cannot be accepted.",
          code: error.code,
        },
        error.statusCode
      );
    }
    if (error instanceof InvitationChallengeError) {
      return verifyJson(
        {
          error: "Invalid verification code.",
          code: error.code,
          ...(error.attemptsRemaining !== undefined
            ? { attemptsRemaining: error.attemptsRemaining }
            : {}),
        },
        error.statusCode
      );
    }
    if (error instanceof StudentInvitationAcceptanceError) {
      return verifyJson(
        {
          error:
            error.statusCode === 503
              ? "Invitation service is unavailable."
              : "Invitation cannot be accepted.",
          code: error.code,
        },
        error.statusCode
      );
    }
    console.error("[student-invitation.verify] Request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return verifyJson(
      {
        error: "Invitation service is unavailable.",
        code: "SERVICE_UNAVAILABLE",
      },
      503
    );
  }
}
