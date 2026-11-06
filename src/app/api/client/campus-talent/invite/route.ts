// src/app/api/client/campus-talent/invite/route.ts
// POST: Sends a campus recruitment invitation to a student.
//
// 2-step non-transactional pattern (email ≠ ACID transaction):
//   1. Create vs_campus_talent_invitation record with status = PENDING
//   2. Attempt sendMail()
//   3. Update record to SENT or FAILED
//   4. Only update vs_school_student.invitation_status to "Invited" after SENT
//
// This is the authoritative pattern — email is a side effect, not a transaction participant.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import {
  rateLimitRetryAfterMs,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import { transporter, MAIL_FROM } from "@/lib/mail/transporter";
import {
  DirectusError,
  directusItems,
  directusRequest,
  directusSettled,
} from "@/lib/server/directus";
import { CampusInvitationPayload } from "@/modules/matching-engine/campus/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vossync.com";
const INVITATION_EXPIRES_DAYS = 30;

interface StudentRow {
  student_id: number;
  school_id?: number | string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  course_name?: string | null;
  registered_user_id?: number | string | null;
}

interface SchoolRow {
  school_id?: number;
  verification_status?: string | null;
  is_active?: boolean | number | null;
}

interface JobRow {
  job_id: number;
  company_id?: number | string | null;
  job_title?: string | null;
}

interface InvitationRow {
  invitation_id: number;
  token: string;
  expires_at: string;
}

/**
 * Only Directus' own 404 may tell the caller a row is gone. Any other status
 * means it could not be read, and answering 404 or 403 turns an outage into a
 * verdict about a student, a school, or who owns a posting.
 */
function missingOrOutage(status: number, entity: string): NextResponse {
  if (status === 404) {
    return NextResponse.json({ error: `${entity} not found.` }, { status: 404 });
  }
  return NextResponse.json(
    { error: `${entity} could not be read. Please try again.` },
    { status: 502 }
  );
}

function escapeHtml(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPHDateTime(date: Date = new Date()): string {
  const dtf = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return dtf.format(date).replace(" ", "T");
}

async function findActiveStudentInvitation(
  studentId: number,
  schoolId?: number | null
): Promise<InvitationRow | null> {
  const schoolFilter = schoolId ? `&filter[school_id][_eq]=${schoolId}` : "";
  // A failed read used to answer "no live invitation exists", which minted a
  // second token for the same student and emailed it while the first still
  // worked. The read has to fail the request instead.
  const rows = await directusItems<InvitationRow>("vs_student_invitation", {
    query: `filter[student_id][_eq]=${studentId}${schoolFilter}&filter[is_used][_eq]=0&sort[]=-created_at&limit=1`,
  });
  return rows[0] ?? null;
}

async function createStudentInvitation(
  studentId: number,
  schoolId: number,
  token: string,
  expiresAt: string,
  createdAt: string
): Promise<InvitationRow | null> {
  const envelope = await directusRequest<{ data?: InvitationRow }>(
    "/items/vs_student_invitation",
    {
      method: "POST",
      body: {
        student_id: studentId,
        school_id: schoolId,
        token,
        expires_at: expiresAt,
        is_used: 0,
        created_at: createdAt,
      },
    }
  );
  return envelope?.data ?? null;
}

async function updateStudentInvitationStatus(
  studentId: number,
  status: "Invited",
  invitedAt: string
): Promise<void> {
  await directusRequest(`/items/vs_school_student/${studentId}`, {
    method: "PATCH",
    body: {
      invitation_status: status,
      invited_at: invitedAt,
    },
  });
}

function buildInvitationHtml(
  payload: CampusInvitationPayload,
  actionLink: string,
  isRegisteredUser: boolean
): string {
  const studentName = escapeHtml(payload.recipientName);
  const companyName = escapeHtml(payload.companyName || "A partner employer");
  const schoolText = payload.schoolName ? ` at <strong>${escapeHtml(payload.schoolName)}</strong>` : "";
  const jobTitleEscaped = payload.jobTitle ? escapeHtml(payload.jobTitle) : "";
  const courseNameEscaped = payload.courseName ? escapeHtml(payload.courseName) : "";

  if (payload.jobTitle) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Career Opportunity — ${jobTitleEscaped}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 32px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb;">
    <h2 style="color: #1e293b; margin-top: 0;">You have been invited to apply!</h2>
    <p style="color: #475569;">Hello <strong>${studentName}</strong>,</p>
    <p style="color: #475569;">
      <strong>${companyName}</strong> has reviewed your academic profile${schoolText}
      and would like to invite you to apply for the following role:
    </p>
    <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <strong style="color: #0c4a6e;">${jobTitleEscaped}</strong>
      ${courseNameEscaped ? `<p style="margin: 4px 0; color: #475569; font-size: 14px;">Matched to your program: ${courseNameEscaped}</p>` : ""}
    </div>
    <p style="color: #475569;">${isRegisteredUser ? "Click the button below to view the job posting:" : "Click the button below to register on LinkBridge and view the full opportunity:"}</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${actionLink}"
         style="background: #0ea5e9; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
        ${isRegisteredUser ? "View Opportunity" : "Register & View Opportunity"}
      </a>
    </div>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
      This invitation was sent to ${escapeHtml(payload.recipientEmail)}. If you believe you received this in error, you may ignore this email.
    </p>
  </div>
</body>
</html>`;
  }

  // General platform registration invitation
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invitation to Connect on LinkBridge</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 32px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb;">
    <h2 style="color: #1e293b; margin-top: 0;">Connect with ${companyName} on LinkBridge!</h2>
    <p style="color: #475569;">Hello <strong>${studentName}</strong>,</p>
    <p style="color: #475569;">
      <strong>${companyName}</strong> has discovered your academic profile${schoolText} on LinkBridge and invites you to join the talent network.
    </p>
    <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <strong style="color: #0c4a6e;">Campus Talent Network</strong>
      <p style="margin: 4px 0; color: #475569; font-size: 14px;">Register your verified student profile to connect with hiring teams, showcase your projects, and access career opportunities.</p>
    </div>
    <p style="color: #475569;">Click the button below to register your account on LinkBridge:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${actionLink}"
         style="background: #0ea5e9; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
        Register on LinkBridge
      </a>
    </div>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
      This invitation expires in ${INVITATION_EXPIRES_DAYS} days. If you believe you received this in error, you may ignore this email.
    </p>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json(
        { error: "Forbidden: employer access required." },
        { status: 403 }
      );
    }

    const userId = Number(session.userId);
    const { isVerified, verification_status, companyId } = await checkCompanyVerificationStatus(userId);
    if (!isVerified || !companyId) {
      return NextResponse.json(
        { error: `Restricted: Company status is ${verification_status}.` },
        { status: 403 }
      );
    }

    // SEC-039: one POST sends one real email and had no limiter at all.
    const userRetryAfterMs = rateLimitRetryAfterMs("campus-invite:user", String(userId), 60, 3_600_000);
    if (userRetryAfterMs) return tooManyRequestsResponse(userRetryAfterMs);

    const body = (await req.json()) as CampusInvitationPayload;
    const { jobId, schoolName } = body;
    let { courseName, jobTitle, companyName } = body;

    const studentId = Number(body.studentId);
    if (!Number.isSafeInteger(studentId) || studentId <= 0) {
      return NextResponse.json({ error: "Missing required student ID." }, { status: 400 });
    }
    if (jobId !== null && jobId !== undefined && !Number.isSafeInteger(Number(jobId))) {
      return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
    }

    // Authoritatively resolve student record from database to prevent open mail relay
    const sRes = await directusSettled<StudentRow>(`/items/vs_school_student/${studentId}`, {
      query:
        "fields=student_id,school_id,first_name,last_name,email,course_name,registered_user_id",
    });
    if (!sRes.ok) {
      return missingOrOutage(sRes.status, "Student record");
    }
    const dbStudent = sRes.data;
    if (!dbStudent) {
      return NextResponse.json({ error: "Student record not found." }, { status: 404 });
    }

    const recipientEmail = String(dbStudent.email ?? "").trim();
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json({ error: "Student does not have a valid registered institutional email." }, { status: 400 });
    }

    const recipientRetryAfterMs = rateLimitRetryAfterMs("campus-invite:recipient", recipientEmail, 5, 86_400_000);
    if (recipientRetryAfterMs) return tooManyRequestsResponse(recipientRetryAfterMs);

    const recipientName = [dbStudent.first_name, dbStudent.last_name].filter(Boolean).join(" ") || body.recipientName || "Student";
    // The invitation and the student PATCH are keyed off the row we just read,
    // never off the school id the caller sent (SEC-039).
    const schoolId = Number(dbStudent.school_id) || 0;
    const schoolRes = await directusSettled<SchoolRow>(`/items/vs_school/${schoolId}`, {
      query: "fields=school_id,verification_status,is_active",
    });
    // An unreadable school row used to fall into the "not accessible" branch
    // below, so an outage refused the invitation as an authorization verdict and
    // told the employer the partner school was the problem.
    if (!schoolRes.ok) {
      return missingOrOutage(schoolRes.status, "Student's school");
    }
    const schoolData = schoolRes.data;
    if (!schoolData?.is_active || schoolData?.verification_status !== "VERIFIED") {
      return NextResponse.json({ error: "Student's school is not accessible." }, { status: 403 });
    }
    if (!courseName) courseName = dbStudent.course_name;
    const registeredUserId = dbStudent.registered_user_id ? Number(dbStudent.registered_user_id) : null;

    // Resolve and verify company name
    if (!companyName && companyId) {
      try {
        const company = await directusRequest<{ data?: { company_name?: string | null } }>(
          `/items/vs_company/${companyId}`,
          { query: "fields=company_name" }
        );
        companyName = company?.data?.company_name || "";
      } catch {
        // Only the email's wording depends on this; the invitation itself is
        // addressed from the student row, so a miss falls back to the generic
        // "Partner Employer" line rather than failing the send.
      }
    }

    // Verify job ownership to prevent cross-tenant IDOR
    if (jobId) {
      const jRes = await directusSettled<JobRow>(`/items/vs_job_posting/${Number(jobId)}`, {
        query: "fields=job_id,job_title,company_id",
      });
      if (!jRes.ok) {
        return missingOrOutage(jRes.status, "Job posting");
      }
      if (Number(jRes.data?.company_id) !== Number(companyId)) {
        return NextResponse.json({ error: "Forbidden: You do not own this job posting." }, { status: 403 });
      }
      jobTitle = jRes.data?.job_title || jobTitle;
    }

    // Normalize empty strings/0 to null
    const safeJobId = jobId && Number(jobId) > 0 ? Number(jobId) : null;
    const safeJobTitle = safeJobId ? jobTitle?.trim() || null : null;

    const nowPH = getPHDateTime();
    const expiresDate = new Date(Date.now() + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    const expiresAt = getPHDateTime(expiresDate);

    let actionLink = "";
    let invitationId: number | null = null;
    const warnings: string[] = [];

    if (!registeredUserId) {
      // Unregistered student -> Issue vs_student_invitation token for /student-register
      const existingInvitation = await findActiveStudentInvitation(studentId, schoolId);
      let inviteToken = "";
      if (existingInvitation) {
        inviteToken = existingInvitation.token;
        invitationId = existingInvitation.invitation_id;
      } else {
        inviteToken = randomBytes(32).toString("hex");
        const createdRecord = await createStudentInvitation(
          studentId,
          schoolId || 0,
          inviteToken,
          expiresAt,
          nowPH
        );
        if (!createdRecord) {
          return NextResponse.json(
            { error: "Invitation could not be recorded. Please try again." },
            { status: 502 }
          );
        }
        invitationId = createdRecord.invitation_id;
      }
      actionLink = `${APP_URL}/student-register?token=${inviteToken}`;
    } else {
      // Already registered student -> Direct to job application or portal
      actionLink = safeJobId ? `${APP_URL}/jobs/${safeJobId}` : `${APP_URL}/dashboard`;

      if (safeJobId) {
        // A swallowed failure here used to return `success: true` with no
        // `vs_applicant_invitation` row, so the employer saw an emailed
        // invitation that the applicant's own invitation list never showed.
        try {
          const appInvEnvelope = await directusRequest<{ data?: { invitation_id?: number } }>(
            "/items/vs_applicant_invitation",
            {
              method: "POST",
              body: {
                company_id: companyId,
                applicant_user_id: registeredUserId,
                job_id: safeJobId,
                subject: safeJobTitle ? `Job Opportunity: ${safeJobTitle}` : "Career Invitation",
                message: `You have been invited by ${companyName || "a partner employer"} for the position: ${safeJobTitle || "Open Role"} on LinkBridge.`,
                status: "PENDING",
                created_by: userId,
                created_at: nowPH,
                updated_at: nowPH,
              },
            }
          );
          invitationId = appInvEnvelope?.data?.invitation_id ?? null;
        } catch (appInvErr: unknown) {
          console.error("[campus-talent/invite] vs_applicant_invitation error:", appInvErr);
          warnings.push(
            "The email was sent but this invitation was not recorded in the candidate's applicant list."
          );
        }
      }
    }

    const invitationPayload: CampusInvitationPayload = {
      studentId,
      schoolId: schoolId || 0,
      jobId: safeJobId,
      companyId,
      recipientEmail,
      recipientName,
      schoolName: schoolName || "Partner Institution",
      courseName,
      jobTitle: safeJobTitle,
      companyName: companyName || "Partner Employer",
      recruiterId: userId,
    };

    // ── Attempt email dispatch ────────────────────────────────────────
    let emailSent = false;
    const emailSubject = safeJobTitle
      ? `Career Opportunity: ${safeJobTitle} at ${invitationPayload.companyName}`
      : `Invitation to connect with ${invitationPayload.companyName} on LinkBridge`;

    try {
      await transporter.sendMail({
        from: MAIL_FROM,
        to: recipientEmail,
        subject: emailSubject,
        html: buildInvitationHtml(invitationPayload, actionLink, Boolean(registeredUserId)),
      });
      emailSent = true;
    } catch (mailErr: unknown) {
      console.error("[campus-talent/invite] SMTP failure:", mailErr);
    }

    // ── Update vs_school_student status upon successful dispatch ──────
    if (emailSent) {
      // The PATCH used to be fire-and-forget: when it failed the employer was
      // told the invite succeeded while the roster still showed the student as
      // never invited.
      try {
        await updateStudentInvitationStatus(studentId, "Invited", nowPH);
      } catch (statusErr: unknown) {
        console.error("[campus-talent/invite] invitation_status update failed:", statusErr);
        warnings.push(
          "The invitation was emailed but the student's roster status could not be updated."
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          invitationId,
          error: "Invitation record was created but email delivery failed. You may retry.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      invitationId,
      sentTo: recipientEmail,
      expiresAt,
      warnings,
    });
  } catch (err: unknown) {
    console.error("[campus-talent/invite POST]", err);
    if (err instanceof DirectusError) {
      return NextResponse.json(
        { error: "Invitation could not be prepared. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
