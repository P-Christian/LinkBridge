// src/app/api/client/company-profile/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (
  process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ""
).replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/** Manila wall clock, naive — the form these `datetime` columns are read with. */
function getPHTimestampForDB(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// ─────────────────────────────────────────────
// POST — Submit company profile for verification
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus base URL not configured." },
        { status: 500 }
      );
    }

    const userId = Number(session.userId);

    // 1. Resolve company association
    const linkUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${userId}&fields=company_id,company_user_role&limit=1`;
    const linkRes = await fetch(linkUrl, { headers: getHeaders(), cache: "no-store" });
    const linkJson = await linkRes.json();
    const link = linkJson.data?.[0];

    if (!link) {
      return NextResponse.json(
        { error: "No company associated with this account." },
        { status: 404 }
      );
    }

    const role = String(link.company_user_role || "").toUpperCase();
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "You do not have permission to submit this company profile." },
        { status: 403 }
      );
    }

    const companyId =
      typeof link.company_id === "object" && link.company_id !== null
        ? link.company_id.company_id
        : link.company_id;

    // 2. Fetch current company data to validate required fields
    const companyUrl = `${DIRECTUS_BASE}/items/vs_company/${companyId}?fields=*`;
    const companyRes = await fetch(companyUrl, { headers: getHeaders(), cache: "no-store" });

    if (!companyRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch company profile for validation." },
        { status: companyRes.status }
      );
    }

    const companyJson = await companyRes.json();
    const company = companyJson.data;

    if (!company) {
      return NextResponse.json({ error: "Company record not found." }, { status: 404 });
    }

    // 3. Block re-submission if already Pending or Verified (unless revision/corrections requested)
    if (
      company.verification_status === "PENDING_VERIFICATION" ||
      company.verification_status === "VERIFIED"
    ) {
      let isCorrectionRequired = false;
      try {
        const verifUrl = `${DIRECTUS_BASE}/items/vs_company_verifications?filter[company_id][_eq]=${companyId}&sort=-created_at,-id&limit=1&fields=status`;
        const verifRes = await fetch(verifUrl, { headers: getHeaders(), cache: "no-store" });
        if (verifRes.ok) {
          const verifJson = await verifRes.json();
          const latestStatus = String(verifJson.data?.[0]?.status || "").toUpperCase();
          isCorrectionRequired = latestStatus === "CORRECTION_REQUIRED";
        }
      } catch (e) {
        console.warn("Could not check latest verification status:", e);
      }

      if (!isCorrectionRequired) {
        return NextResponse.json(
          {
            error:
              company.verification_status === "VERIFIED"
                ? "This company profile is already verified."
                : "This profile is already pending verification.",
          },
          { status: 400 }
        );
      }
    }

    // 4. Validate required fields before allowing submission
    const missingFields: string[] = [];

    const required: Array<{ key: string; label: string }> = [
      { key: "company_name", label: "Company Display Name" },
      { key: "company_legal_name", label: "Legal Company Name" },
      { key: "company_email", label: "Business Email" },
      { key: "company_contact", label: "Contact Number" },
      { key: "company_description", label: "Company Description" },
      { key: "industry_id", label: "Industry" },
      { key: "company_size_id", label: "Company Size" },
      { key: "company_province", label: "Province" },
      { key: "company_city", label: "City / Municipality" },
      { key: "company_address", label: "Street Address" },
      { key: "company_logo", label: "Company Logo" },
    ];

    for (const { key, label } of required) {
      const val = company[key];
      if (val === null || val === undefined || String(val).trim() === "") {
        missingFields.push(label);
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Please complete the following required fields before submitting: ${missingFields.join(", ")}.`,
          missingFields,
        },
        { status: 422 }
      );
    }

    // 4b. Verify required verification documents in vs_company_document
    // A failed read must not fall through: the PATCH below would mark the
    // company PENDING_VERIFICATION with no documents behind it, and the admin
    // queue would show a submission nobody can review.
    try {
      const docCheckUrl = `${DIRECTUS_BASE}/items/vs_company_document?filter[company_id][_eq]=${companyId}&limit=1&fields=company_document_id`;
      const docCheckRes = await fetch(docCheckUrl, { headers: getHeaders(), cache: "no-store" });
      if (!docCheckRes.ok) {
        return NextResponse.json(
          { error: "Your uploaded documents could not be verified. Nothing was submitted. Please try again." },
          { status: 502 }
        );
      }
      const docCheckJson = await docCheckRes.json();
      const uploadedDocs = docCheckJson.data || [];
      if (uploadedDocs.length === 0) {
        return NextResponse.json(
          { error: "Please upload required verification documents before submitting your profile." },
          { status: 422 }
        );
      }
    } catch (docErr) {
      console.warn("Could not check vs_company_document records:", docErr);
      return NextResponse.json(
        { error: "Your uploaded documents could not be verified. Nothing was submitted. Please try again." },
        { status: 502 }
      );
    }

    // 5. Patch company record: set status to PENDING_VERIFICATION + submitted_at, reset rejection_reason
    const nowPH = getPHTimestampForDB();
    const patchPayload = {
      verification_status: "PENDING_VERIFICATION",
      submitted_at: nowPH,
      rejection_reason: null,
    };

    const patchRes = await fetch(`${DIRECTUS_BASE}/items/vs_company/${companyId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(patchPayload),
    });

    const patchText = await patchRes.text();
    let patchData: unknown = null;
    try {
      patchData = patchText ? JSON.parse(patchText) : null;
    } catch {
      patchData = null;
    }

    if (!patchRes.ok) {
      return NextResponse.json(
        { error: "Failed to submit company profile for verification." },
        { status: patchRes.status }
      );
    }

    // 6. Log the submission so the admin review queue reads the newest workflow state
    //    (a resubmission after "Needs Revision" must supersede the CORRECTION_REQUIRED row).
    //    Without this row the employer is PENDING_VERIFICATION but invisible to
    //    the review queue, so the failure has to reach the response.
    let queueLogged = true;
    try {
      const verifInsertRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_verifications`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          company_id: companyId,
          submitted_by_user_id: userId,
          verification_type: "INITIAL_REGISTRATION",
          status: "PENDING_VERIFICATION",
          submitted_at: nowPH,
          public_rejection_reason: null,
        }),
      });
      if (!verifInsertRes.ok) {
        queueLogged = false;
        console.warn("Could not log company verification submission:", await verifInsertRes.text());
      }
    } catch (logErr) {
      queueLogged = false;
      console.warn("Could not log company verification submission:", logErr);
    }

    const patchedCompany = ((patchData as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      message: queueLogged
        ? "Company profile submitted for verification successfully."
        : "Your profile is pending verification, but the review queue entry was not created. Please submit again.",
      warnings: queueLogged
        ? []
        : ["The admin review queue entry was not created. Your submission may not be reviewed."],
      company: {
        ...patchedCompany,
        verification_status: "PENDING_VERIFICATION",
        verification_workflow_status: "PENDING_VERIFICATION",
        rejection_reason: null,
        public_rejection_reason: null,
      },
    });
  } catch (err: unknown) {
    console.error("POST /api/client/company-profile/submit error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}
