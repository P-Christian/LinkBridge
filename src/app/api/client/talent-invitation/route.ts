// src/app/api/client/talent-invitation/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import { getPHTimeString } from "@/lib/utils";
import { createSystemMessage } from "@/lib/messaging/system-message";
import { sendInvitationEmail } from "@/lib/mail/services/job-mail";
import { isEmailEnabledForUser } from "@/lib/mail/preference-check";
import { isInAppEnabledForUser } from "@/lib/notifications/preference-check";
import { directusItems, directusSettled } from "@/lib/server/directus";
import { toId } from "@/lib/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — send a talent invitation
export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const { isVerified, verification_status, companyId } = await checkCompanyVerificationStatus(userId);
    if (!isVerified) {
      return NextResponse.json({ error: `Company not verified: ${verification_status}` }, { status: 403 });
    }

    if (!companyId) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const body = await req.json();
    const { talent_user_id, job_id, message, subject } = body;

    const candidateUserId = toId(talent_user_id);
    if (candidateUserId === null) {
      return NextResponse.json({ error: "A valid talent_user_id is required." }, { status: 400 });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "A message is required for the invitation." }, { status: 400 });
    }

    // Input bounds enforcement
    const trimmedMessage = message.trim().slice(0, 2000);
    const trimmedSubject = subject && typeof subject === "string" ? subject.trim().slice(0, 200) : null;

    // Strict Multi-Tenant IDOR Ownership Gate on Job Posting
    let verifiedJob: Record<string, unknown> | null = null;
    if (job_id) {
      const jobIdNum = toId(job_id);
      if (jobIdNum === null) {
        return NextResponse.json({ error: "Invalid job_id provided." }, { status: 400 });
      }

      const jobVerifyRes = await directusSettled<{ data?: Record<string, unknown>[] }>(
        "/items/vs_job_posting",
        {
          query: `filter[job_id][_eq]=${jobIdNum}&filter[company_id][_eq]=${companyId}&fields=job_id,job_title,job_description,job_location,work_arrangement,job_type,salary_min,salary_max,currency&limit=1`,
        }
      );
      if (!jobVerifyRes.ok) {
        return NextResponse.json({ error: "Failed to verify job ownership." }, { status: 502 });
      }
      verifiedJob = jobVerifyRes.data?.data?.[0] ?? null;

      if (!verifiedJob) {
        return NextResponse.json(
          { error: "Forbidden: Job posting not found or does not belong to your company." },
          { status: 403 }
        );
      }
    }

    const nowPH = getPHTimeString();

    // 1. Create invitation record
    const createRes = await directusSettled<{ data?: Record<string, unknown> }>(
      "/items/vs_applicant_invitation",
      {
        method: "POST",
        body: {
          company_id: companyId,
          applicant_user_id: candidateUserId,
          job_id: verifiedJob ? Number(verifiedJob.job_id) : null,
          subject: trimmedSubject,
          message: trimmedMessage,
          status: "PENDING",
          created_by: userId,
          created_at: nowPH,
          updated_at: nowPH,
        },
      }
    );

    if (!createRes.ok) {
      console.error("[talent-invitation POST] Failed to insert invitation:", createRes.error);
      return NextResponse.json({ error: "Failed to send invitation." }, { status: 502 });
    }

    const created = createRes.data?.data;

    // Anything that could not be delivered after the row exists is reported to
    // the caller instead of being logged and dropped.
    const warnings: string[] = [];

    // 2. Fetch candidate & company details to dispatch notifications
    const [candRes, compRes] = await Promise.all([
      directusSettled<{
        data?: { user_email?: string | null; user_fname?: string | null; user_lname?: string | null };
      }>(`/items/vs_user/${candidateUserId}`, { query: "fields=user_email,user_fname,user_lname" }),
      directusSettled<{ data?: { company_name?: string | null } }>(
        `/items/vs_company/${companyId}`,
        { query: "fields=company_name" }
      ),
    ]);

    const candidate = candRes.ok ? candRes.data?.data ?? null : null;
    const company = compRes.ok ? compRes.data?.data ?? null : null;

    // Both reads used to collapse to null on any failure, and the response still
    // said `success`. The recruiter saw the invitation as sent when nothing ever
    // reached the candidate, so an outage silently cost them the candidate's
    // attention. Nothing here is recoverable by retrying the request — the row
    // already exists — so the outcome is reported instead.
    if (!candRes.ok && candRes.status !== 404) {
      console.error("[talent-invitation POST] Candidate read failed:", candRes.error);
      warnings.push(
        "The invitation was recorded, but the candidate's profile could not be read so no notification was sent."
      );
    } else if (!candRes.ok) {
      warnings.push(
        "The invitation was recorded, but no candidate account was found to notify."
      );
    }
    if (!compRes.ok && compRes.status !== 404) {
      console.error("[talent-invitation POST] Company read failed:", compRes.error);
      warnings.push(
        "The invitation was recorded, but your company name could not be read, so the notice may be addressed incorrectly."
      );
    }

    const companyName = (company?.company_name as string) || "a company on VOS-Sync";
    const jobTitle = (verifiedJob?.job_title as string) || null;
    const jobDescription = (verifiedJob?.job_description as string) || null;
    const jobLocation = (verifiedJob?.job_location as string) || null;
    const workArrangement = (verifiedJob?.work_arrangement as string) || null;
    const jobType = (verifiedJob?.job_type as string) || null;

    let salaryRange: string | null = null;
    if (verifiedJob && (verifiedJob.salary_min || verifiedJob.salary_max)) {
      const curr = (verifiedJob.currency as string) || "PHP";
      const minStr = verifiedJob.salary_min ? Number(verifiedJob.salary_min).toLocaleString() : null;
      const maxStr = verifiedJob.salary_max ? Number(verifiedJob.salary_max).toLocaleString() : null;
      if (minStr && maxStr) {
        salaryRange = `${curr} ${minStr} - ${maxStr}`;
      } else if (minStr) {
        salaryRange = `${curr} ${minStr}+`;
      } else if (maxStr) {
        salaryRange = `Up to ${curr} ${maxStr}`;
      }
    }

    // 3. Read both preferences before dispatching anything. An unread preference
    // is not "enabled": an in-app message or a mail the candidate switched off
    // cannot be taken back, while a missed invitation is still visible in their
    // list, so the send is skipped and reported.
    const canSendInApp = await isInAppEnabledForUser(candidateUserId, "INVITATION_RECEIVED");
    const canSendEmail = await isEmailEnabledForUser(candidateUserId, "INVITATION_RECEIVED");
    if (canSendInApp === null || canSendEmail === null) {
      warnings.push(
        "The candidate's notification settings could not be read, so this invitation was not sent in-app or by email."
      );
    }

    // 4. Dispatch In-App Message (if user preference allows)
    if (canSendInApp) {
      try {
        await createSystemMessage({
          clientId: companyId,
          freelancerId: candidateUserId,
          jobId: verifiedJob ? Number(verifiedJob.job_id) : null,
          text: trimmedMessage,
          senderId: userId,
        });
      } catch (e) {
        console.error("Failed to create in-app message:", e);
        warnings.push("The invitation was recorded, but its in-app message was not delivered.");
      }
    }

    // 5. Dispatch Email Notification (if user preference allows)
    if (candidate?.user_email && canSendEmail) {
      const candidateName = [candidate.user_fname, candidate.user_lname].filter(Boolean).join(" ");
      try {
        await sendInvitationEmail(candidate.user_email, {
          candidateName,
          companyName,
          jobTitle,
          jobDescription,
          jobLocation,
          workArrangement,
          jobType,
          salaryRange,
          message: trimmedMessage,
        });
      } catch (e) {
        console.error("Failed to send notification email:", e);
        warnings.push("The invitation was recorded, but its email could not be sent.");
      }
    }

    return NextResponse.json({ success: true, invitation: created, warnings }, { status: 201 });
  } catch (err: unknown) {
    console.error("[talent-invitation POST] Error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// GET — list sent invitations for this company
export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const { isVerified, companyId } = await checkCompanyVerificationStatus(userId);
    if (!isVerified || !companyId) {
      return NextResponse.json({ invitations: [] }, { status: 200 });
    }

    const invitations = await directusItems<Record<string, unknown>>("vs_applicant_invitation", {
      query: `filter[company_id][_eq]=${companyId}&fields=invitation_id,applicant_user_id,job_id,subject,message,status,created_at&sort[]=-created_at&limit=-1`,
    });

    return NextResponse.json({ invitations });
  } catch (err: unknown) {
    console.error("[talent-invitation GET] Error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

