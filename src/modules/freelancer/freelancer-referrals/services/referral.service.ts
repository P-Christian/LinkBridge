import crypto from "crypto";
import { sendMail } from "@/lib/mail";
import { createNotification } from "@/lib/notifications";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

export function generateToken(): { plain: string; hash: string } {
  const plain = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(plain).digest("hex");
  return { plain, hash };
}

export async function getReferralPolicy(jobId?: number) {
  try {
    let url = `${DIRECTUS_BASE}/items/vs_referral_policy?filter[job_id][_null]=true&limit=1`;
    if (jobId) {
      url = `${DIRECTUS_BASE}/items/vs_referral_policy?filter[job_id][_eq]=${jobId}&limit=1`;
    }
    const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        return json.data[0];
      }
    }

    // Fallback if no specific policy exists
    if (jobId) {
      return getReferralPolicy();
    }
  } catch (err) {
    console.error("Error fetching referral policy:", err);
  }
  return { enabled: true, expiry_days: 30, limit_per_user: 10 };
}

export async function checkUserReferralLimit(userId: number, jobId: number): Promise<boolean> {
  try {
    const policy = await getReferralPolicy(jobId);
    if (!policy.enabled) return false;

    const countRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_referral?filter[referrer_user_id][_eq]=${userId}&filter[job_id][_eq]=${jobId}&filter[status][_in]=CREATED,SENT,OPENED,CLAIMED&limit=1&meta=filter_count`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (countRes.ok) {
      const json = await countRes.json();
      const count = json.meta?.filter_count ?? 0;
      return count < policy.limit_per_user;
    }
  } catch (err) {
    console.error("Error checking user referral limit:", err);
  }
  return true;
}

export async function createReferralRecord(
  userId: number,
  jobId: number,
  recipientEmail?: string,
  referralType: "CLOSED" | "OPEN" = "CLOSED",
  customExpiryDays?: number,
  customExpiresAt?: string
) {
  const { plain, hash } = generateToken();
  const policy = await getReferralPolicy(jobId);

  if (!policy.enabled) {
    throw new Error("Referrals are not enabled for this vacancy.");
  }

  const isWithinLimit = await checkUserReferralLimit(userId, jobId);
  if (!isWithinLimit) {
    throw new Error("You have reached the limit of active referrals for this job.");
  }

  const now = new Date();
  let expiresAt: Date;
  if (customExpiresAt && !isNaN(Date.parse(customExpiresAt))) {
    expiresAt = new Date(customExpiresAt);
  } else {
    const days = customExpiryDays && customExpiryDays > 0 ? customExpiryDays : policy.expiry_days;
    expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  const payload: Record<string, unknown> = {
    job_id: jobId,
    referrer_user_id: userId,
    token_hash: hash,
    status: recipientEmail ? "SENT" : "CREATED",
    expires_at: expiresAt.toISOString(),
  };

  if (referralType === "OPEN") {
    payload.display_hint = "Public share link";
    // Also include referral_type note if permitted by backend
  } else if (recipientEmail) {
    payload.recipient_email_hash = crypto.createHash("sha256").update(recipientEmail.trim().toLowerCase()).digest("hex");
    payload.display_hint = recipientEmail.trim().split("@")[0];
  }

  const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_referral`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.errors?.[0]?.message ?? "Failed to create referral record.");
  }

  const created = (await res.json()).data;

  // Log history
  await logReferralHistory(created.referral_id, "None", payload.status as string, "system", "Creation");

  return {
    referral: created,
    token: plain,
  };
}

export async function getReferralByToken(token: string) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  // Support both plain token (sha256 match) and direct token_hash copied from dashboard
  const filter = token.length === 64
    ? `filter[_or][0][token_hash][_eq]=${hash}&filter[_or][1][token_hash][_eq]=${token}`
    : `filter[token_hash][_eq]=${hash}`;
  const res = await fetch(
    `${DIRECTUS_BASE}/items/vs_job_referral?${filter}&fields=*,job_id.*,referrer_user_id.user_id,referrer_user_id.user_fname,referrer_user_id.user_lname&limit=1`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const referral = json.data && json.data.length > 0 ? json.data[0] : null;
  if (!referral) return null;

  // If referrer is a school admin, resolve their school name
  if (referral.referrer_user_id?.user_id) {
    try {
      const adminRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_school_admin?filter[user_id][_eq]=${referral.referrer_user_id.user_id}&fields=school_id.school_name,school_id.school_id,school_id.school_logo&limit=1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (adminRes.ok) {
        const adminJson = await adminRes.json();
        const schoolAdminRec = adminJson.data?.[0];
        if (schoolAdminRec?.school_id) {
          const s = typeof schoolAdminRec.school_id === "object" ? schoolAdminRec.school_id : {};
          referral.school_name = s.school_name || null;
          referral.is_school_admin = true;
        }
      }
    } catch (err) {
      console.warn("Could not check school admin attribution for referral:", err);
    }
  }

  return referral;
}

const CLAIMABLE_REFERRAL_STATUSES = ["CREATED", "SENT", "OPENED"];

/**
 * Claims the referral behind an opaque token. SEC-036: the invitation row is
 * re-read server-side and every assertion (self-referral, status, expiry,
 * invitee binding) is made against that row, and the job is taken from it too,
 * so a caller can no longer claim a sequential referral id for any job.
 */
export async function claimReferralRecord(
  referralId: number,
  candidateUserId: number,
  consentVersion: string,
  candidateEmail?: string | null
) {
  const refRes = await fetch(
    `${DIRECTUS_BASE}/items/vs_job_referral/${referralId}?fields=referrer_user_id,job_id,job_id.job_id,job_id.job_title,status,expires_at,recipient_email_hash,display_hint`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!refRes.ok) {
    throw new Error("Referral invitation not found or no longer valid.");
  }
  const refData: {
    referrer_user_id?: number | null;
    job_id?: number | { job_id?: number; job_title?: string } | null;
    status?: string | null;
    expires_at?: string | null;
    recipient_email_hash?: string | null;
    display_hint?: string | null;
  } | null = (await refRes.json()).data;
  if (!refData) {
    throw new Error("Referral invitation not found or no longer valid.");
  }

  if (Number(refData.referrer_user_id) === candidateUserId) {
    throw new Error("Self-referral is not allowed.");
  }

  const referralStatus = String(refData.status ?? "").toUpperCase();
  if (!CLAIMABLE_REFERRAL_STATUSES.includes(referralStatus)) {
    throw new Error("This referral invitation is no longer open for claiming.");
  }

  const expiresAtMs = refData.expires_at ? Date.parse(refData.expires_at) : NaN;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error("This referral invitation has expired.");
  }

  if (refData.recipient_email_hash) {
    const normalizedEmail = String(candidateEmail ?? "").trim().toLowerCase();
    const candidateHash = normalizedEmail
      ? crypto.createHash("sha256").update(normalizedEmail).digest("hex")
      : "";
    if (candidateHash !== refData.recipient_email_hash) {
      throw new Error("This referral invitation was addressed to a different email address.");
    }
  }

  const relatedJob = refData.job_id;
  const jobId = Number(
    relatedJob && typeof relatedJob === "object" ? relatedJob.job_id : relatedJob
  );
  if (!Number.isSafeInteger(jobId) || jobId <= 0) {
    throw new Error("This referral invitation is not linked to a job posting.");
  }
  const referralJobTitle =
    relatedJob && typeof relatedJob === "object" ? relatedJob.job_title ?? "" : "";

  // Create claim
  const claimPayload = {
    referral_id: referralId,
    candidate_user_id: candidateUserId,
    job_id: jobId,
    consent_version: consentVersion,
    consented_at: new Date().toISOString(),
    claim_status: "ACTIVE"
  };

  const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_referral_claim`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(claimPayload)
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.errors?.[0]?.message ?? "You have already claimed a referral for this job.");
  }

  const claim = (await res.json()).data;

  // Auto-bookmark this job for the candidate so the opportunity is saved to their account permanently
  try {
    const existingBookmarkRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_bookmark?filter[job_id][_eq]=${jobId}&filter[user_id][_eq]=${candidateUserId}&fields=bookmark_id&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    const existingJson = await existingBookmarkRes.json().catch(() => ({}));
    const hasBookmark = existingJson?.data && existingJson.data.length > 0;
    if (!hasBookmark) {
      await fetch(`${DIRECTUS_BASE}/items/vs_job_bookmark`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          job_id: jobId,
          user_id: candidateUserId,
          bookmarked_at: new Date().toISOString(),
        }),
      });
    }
  } catch (bmErr) {
    console.error("Auto-bookmark on referral claim error:", bmErr);
  }

  // Update main status for closed referrals (or track open referrals)
  const isPublicOpen = refData.display_hint === "Public share link" || !refData.recipient_email_hash;
  if (!isPublicOpen) {
    await fetch(`${DIRECTUS_BASE}/items/vs_job_referral/${referralId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status: "CLAIMED", claimed_at: new Date().toISOString() })
    });
  }

  await logReferralHistory(referralId, "SENT", "CLAIMED", `user:${candidateUserId}`, "Consent Bound");

  // Send in-app notification to referrer
  if (refData && refData.referrer_user_id) {
    try {
      let candidateName = "A candidate";
      const candRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${candidateUserId}?fields=user_fname,user_lname`, {
        headers: getHeaders(),
        cache: "no-store"
      });
      if (candRes.ok) {
        const cand = (await candRes.json()).data;
        candidateName = `${cand?.user_fname ?? ""} ${cand?.user_lname ?? ""}`.trim() || candidateName;
      }

      await createNotification({
        event_type: "referral_claimed",
        recipient_user_id: Number(refData.referrer_user_id),
        entity_type: "job_referral",
        entity_id: referralId,
        category: "Referral Updates",
        title: "Referral Invitation Accepted!",
        message: `${candidateName} has accepted your referral invite for the position ${referralJobTitle || "Opportunity"}.`,
        action_url: "/vos-sync/freelancer/referrals",
      });
    } catch (err) {
      console.error("Failed to send claim in-app notification to referrer:", err);
    }
  }

  return claim;
}

export async function logReferralHistory(referralId: number, fromStatus: string, toStatus: string, actor: string, reason?: string) {
  try {
    await fetch(`${DIRECTUS_BASE}/items/vs_job_referral_history`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        referral_id: referralId,
        from_status: fromStatus,
        to_status: toStatus,
        actor,
        reason_category: reason,
        occurred_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error("Failed to write referral history log:", err);
  }
}

export async function handleApplicationSubmissionReferral(applicationId: number, candidateUserId: number, jobId: number) {
  try {
    // 1. Fetch any active referral claim for this candidate and job
    const claimRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_referral_claim?filter[candidate_user_id][_eq]=${candidateUserId}&filter[job_id][_eq]=${jobId}&filter[claim_status][_eq]=ACTIVE&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!claimRes.ok) return;

    const claimJson = await claimRes.json();
    const claims = claimJson.data || [];
    if (claims.length === 0) return;

    const claim = claims[0];
    const referralId = claim.referral_id;

    // 2. Fetch the referral to find the referrer's user ID
    const refRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_referral/${referralId}?fields=*,referrer_user_id.user_id,referrer_user_id.user_email,referrer_user_id.user_fname,referrer_user_id.user_lname,job_id.job_title`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!refRes.ok) return;
    const referral = (await refRes.json()).data;
    if (!referral) return;

    const referrer = referral.referrer_user_id;
    if (!referrer) return;

    // 3. Create the immutable application-referral link
    const linkPayload = {
      application_id: applicationId,
      referral_id: referralId,
      referrer_user_id: referrer.user_id,
      attribution_policy_version: "1.0",
      attributed_at: new Date().toISOString()
    };

    const linkRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_application_referral`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(linkPayload)
    });

    if (!linkRes.ok) {
      console.error("Failed to link referral to application:", await linkRes.text());
      return;
    }

    // 4. Update the referral status to APPLIED and close the claim (if not open public link)
    const isPublicOpen = referral.display_hint === "Public share link" || !referral.recipient_email_hash;
    if (!isPublicOpen) {
      await fetch(`${DIRECTUS_BASE}/items/vs_job_referral/${referralId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status: "APPLIED" })
      });
    }

    await fetch(`${DIRECTUS_BASE}/items/vs_job_referral_claim/${claim.claim_id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ claim_status: "EXPIRED" })
    });

    await logReferralHistory(referralId, "CLAIMED", "APPLIED", `candidate:${candidateUserId}`, "Application Submitted");

    // 5. Send SMTP email notification to the referrer
    if (referrer.user_email) {
      const candidateRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${candidateUserId}?fields=user_fname,user_lname`, {
        headers: getHeaders(),
        cache: "no-store"
      });
      let candidateName = "A referred candidate";
      if (candidateRes.ok) {
        const cu = (await candidateRes.json()).data;
        candidateName = `${cu?.user_fname ?? ""} ${cu?.user_lname ?? ""}`.trim() || candidateName;
      }

      await sendMail({
        to: referrer.user_email,
        subject: `Your referral applied: ${referral.job_id?.job_title || "Vacancy"}`,
        text: `Hello ${referrer.user_fname}!\n\nGood news! ${candidateName}, whom you referred, has successfully submitted their application for the ${referral.job_id?.job_title || "Vacancy"} position.\n\nKeep track of your referrals here: ${process.env.NEXT_PUBLIC_APP_URL || ""}/vos-sync/freelancer/referrals\n\nBest regards,\nLinkBridge Team`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Good news! Your referral applied</h2>
            <p>Hello ${referrer.user_fname},</p>
            <p><strong>${candidateName}</strong>, whom you referred, has successfully submitted their application for the <strong>${referral.job_id?.job_title || "Vacancy"}</strong> position.</p>
            <p>You can track the status of your referrals in your dashboard.</p>
            <p style="font-size: 12px; color: #777; margin-top: 40px;">Thank you for sharing opportunities on LinkBridge!</p>
          </div>
        `,
      }).catch((err) => console.error("Referral application SMTP notification error:", err));

      // Trigger in-app notification to referrer
      try {
        await createNotification({
          event_type: "referral_applied",
          recipient_user_id: referrer.user_id,
          entity_type: "job_referral",
          entity_id: referralId,
          category: "Referral Updates",
          title: "Referral Candidate Applied!",
          message: `${candidateName} has submitted their application for the position ${referral.job_id?.job_title || "Vacancy"}.`,
          action_url: "/vos-sync/freelancer/referrals",
        });
      } catch (err) {
        console.error("Failed to send application in-app notification to referrer:", err);
      }
    }

  } catch (err) {
    console.error("Error processing application submission referral mapping:", err);
  }
}
