import { NextRequest, NextResponse } from "next/server";
import { createReferralRecord } from "@/modules/freelancer/freelancer-referrals/services/referral.service";
import { sendMail } from "@/lib/mail";
import { createNotification } from "@/lib/notifications";
import { authenticateRequest, isFreelancerSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

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

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isFreelancerSession(session)) {
      return NextResponse.json({ error: "Forbidden: freelancer role required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => ({}));
    const { job_id, recipient_email, referral_type, expiry_days, expires_at } = body;

    if (!job_id) {
      return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
    }

    const type = referral_type === "OPEN" ? "OPEN" : "CLOSED";
    const result = await createReferralRecord(
      userId,
      Number(job_id),
      type === "CLOSED" ? recipient_email : undefined,
      type,
      expiry_days ? Number(expiry_days) : undefined,
      expires_at ? String(expires_at) : undefined
    );

    // If an email is supplied for closed referral, send the invite via SMTP
    if (type === "CLOSED" && recipient_email) {
      const jobRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${job_id}?fields=job_title,company_id.company_name`, {
        headers: getHeaders(),
        cache: "no-store",
      });
      let jobTitle = "Opportunity";
      let companyName = "LinkBridge Partner";
      if (jobRes.ok) {
        const jData = (await jobRes.json()).data;
        jobTitle = jData?.job_title || jobTitle;
        companyName = jData?.company_id?.company_name || companyName;
      }

      const userRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}?fields=user_fname,user_lname`, {
        headers: getHeaders(),
        cache: "no-store",
      });
      let referrerName = "A friend";
      if (userRes.ok) {
        const u = (await userRes.json()).data;
        referrerName = `${u?.user_fname ?? ""} ${u?.user_lname ?? ""}`.trim() || referrerName;
      }

      const inviteUrl = `${req.nextUrl.origin}/referral/${result.token}`;

      await sendMail({
        to: recipient_email,
        subject: `${referrerName} referred you to a job: ${jobTitle}`,
        text: `Hello!\n\n${referrerName} has referred you to view the ${jobTitle} position at ${companyName}.\n\nView details and apply here: ${inviteUrl}\n\nBest regards,\nLinkBridge Team`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>You have been referred!</h2>
            <p><strong>${referrerName}</strong> has invited you to view the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>
            <p style="margin: 24px 0;">
              <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Job Details & Apply</a>
            </p>
            <p style="font-size: 12px; color: #777; margin-top: 40px;">If you did not expect this invitation, you can safely ignore this email.</p>
          </div>
        `,
      }).catch((err) => console.error("Referral SMTP invite email error:", err));

      // Check if recipient is a registered freelancer/user
      try {
        const recipientRes = await fetch(`${DIRECTUS_BASE}/items/vs_user?filter[user_email][_eq]=${encodeURIComponent(recipient_email.trim().toLowerCase())}&fields=user_id`, {
          headers: getHeaders(),
          cache: "no-store",
        });
        if (recipientRes.ok) {
          const recJson = await recipientRes.json();
          const recData = recJson.data || [];
          if (recData.length > 0) {
            const recipientUserId = Number(recData[0].user_id);
            await createNotification({
              event_type: "referral_received",
              recipient_user_id: recipientUserId,
              entity_type: "job_referral",
              entity_id: result.referral.referral_id,
              category: "Referrals",
              title: "New Job Referral Opportunity",
              message: `${referrerName} has referred you to the position: ${jobTitle}. Click to review details and accept.`,
              action_url: `/referral/${result.token}`,
            });
          }
        }
      } catch (err) {
        console.error("Failed to notify recipient user in-app:", err);
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const errorMsg = safeErrorMessage(err, "Failed to create referral.");
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isFreelancerSession(session)) {
      return NextResponse.json({ error: "Forbidden: freelancer role required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_referral?filter[referrer_user_id][_eq]=${userId}&sort[]=-created_at&fields=*,job_id.job_id,job_id.job_title&limit=200`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch referrals." }, { status: 500 });
    }

    const json = await res.json();
    const referrals: Record<string, unknown>[] = json.data || [];

    if (referrals.length === 0) {
      return NextResponse.json({ referrals: [] });
    }

    const referralIds = referrals.map((r) => r.referral_id as number).filter(Boolean);

    // 1. Fetch claims to obtain claimant info for closed referrals
    const claimsMap: Record<number, string> = {};
    try {
      const claimsRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_referral_claim?filter[referral_id][_in]=${referralIds.join(",")}&fields=referral_id,candidate_user_id.user_fname,candidate_user_id.user_lname,candidate_user_id.user_email&limit=500`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (claimsRes.ok) {
        const claimsJson = await claimsRes.json();
        for (const c of claimsJson.data || []) {
          const u = c.candidate_user_id;
          if (u) {
            const name = `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() || u.user_email || "Candidate";
            claimsMap[c.referral_id] = name;
          }
        }
      }
    } catch (claimErr) {
      console.error("Error fetching claims for referral table:", claimErr);
    }

    // 2. Fetch application counts for open referrals
    const appCountsMap: Record<number, number> = {};
    try {
      const appsRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_application_referral?filter[referral_id][_in]=${referralIds.join(",")}&fields=referral_id&limit=1000`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (appsRes.ok) {
        const appsJson = await appsRes.json();
        for (const a of appsJson.data || []) {
          const rId = Number(a.referral_id);
          appCountsMap[rId] = (appCountsMap[rId] || 0) + 1;
        }
      }
    } catch (appErr) {
      console.error("Error fetching application counts for referral table:", appErr);
    }

    const enriched = referrals.map((r) => {
      const rId = r.referral_id as number;
      const isPublicOpen = r.display_hint === "Public share link" || !r.recipient_email_hash;
      const referralType = isPublicOpen ? "OPEN" : "CLOSED";
      return {
        ...r,
        referral_type: referralType,
        application_count: appCountsMap[rId] ?? 0,
        claimant_name: claimsMap[rId] ?? null,
      };
    });

    return NextResponse.json({ referrals: enriched });
  } catch (err: unknown) {
    const errorMsg = safeErrorMessage(err, "An error occurred");
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
