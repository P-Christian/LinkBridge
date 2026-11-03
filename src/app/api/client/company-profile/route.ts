import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { getClientCompanyProfileData } from "@/modules/client/company-profile/services/client-company-profile.service";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const ALLOWED_PUBLIC_COLLECTIONS = new Set([
  "vs_industry",
  "vs_organization_type",
  "vs_company_size",
]);

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

const COMPANY_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const COMPANY_CODE_LENGTH = 6;
const COMPANY_CODE_MAX_ATTEMPTS = 5;

/**
 * The code keys an unauthenticated public lookup (/companies/[companyCode]), so
 * it must not be derivable from Math.random() the way the legacy mint was.
 */
function buildCompanyCode(): string {
  let suffix = "";
  for (let i = 0; i < COMPANY_CODE_LENGTH; i += 1) {
    suffix += COMPANY_CODE_ALPHABET[randomInt(COMPANY_CODE_ALPHABET.length)];
  }
  return `COMP-${suffix}`;
}

async function isCompanyCodeTaken(code: string): Promise<boolean> {
  const res = await fetch(
    `${DIRECTUS_BASE}/items/vs_company?filter[company_code][_eq]=${encodeURIComponent(code)}&fields=company_id&limit=1`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!res.ok) return false;
  const json = await res.json().catch(() => null);
  return ((json?.data?.length ?? 0) > 0);
}

/** Recalculate company profile completion percentage */
function calculateCompletionPercent(company: Record<string, unknown>): number {
  const fields = [
    "company_name",
    "company_legal_name",
    "company_email",
    "company_contact",
    "company_description",
    "industry_id",
    "organization_type_id",
    "company_size_id",
    "year_established",
    "company_province",
    "company_city",
    "company_brgy",
    "company_address",
    "company_zipCode",
    "company_logo",
    "company_cover",
    "registration_no",
    "company_tin",
    "company_website",
  ];

  let filled = 0;
  for (const f of fields) {
    const val = company[f];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      filled++;
    }
  }

  // Check if they have at least one social media link
  const socials = [
    "company_facebook",
    "company_linkedin",
    "company_instagram",
    "company_x",
    "company_youtube",
  ];
  const hasSocial = socials.some((f) => {
    const val = company[f];
    return val !== undefined && val !== null && String(val).trim() !== "";
  });
  if (hasSocial) {
    filled++;
  }

  const total = fields.length + 1; // 19 fields + 1 for any social media
  return Math.round((filled / total) * 100);
}

// ─────────────────────────────────────────────
// GET — Fetch company profile for logged-in client
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // ─────────────────────────────────────────────
    // DIRECTUS PROXY — for master data collections
    // (uses static token only — no user JWT needed)
    // ─────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const directusCollection = searchParams.get("directusCollection");

    if (directusCollection) {
      if (!ALLOWED_PUBLIC_COLLECTIONS.has(directusCollection)) {
        return NextResponse.json(
          { error: "Access to the requested collection is not permitted." },
          { status: 403 }
        );
      }
      if (!DIRECTUS_BASE) {
        return NextResponse.json({ error: "Directus base URL not configured." }, { status: 500 });
      }
      const proxyParams = new URLSearchParams(searchParams.toString());
      proxyParams.delete("directusCollection");
      if (!proxyParams.has("limit")) proxyParams.set("limit", "-1");
      const target = `${DIRECTUS_BASE}/items/${encodeURIComponent(directusCollection)}${proxyParams.toString() ? `?${proxyParams.toString()}` : ""}`;
      const res = await fetch(target, { method: "GET", headers: getHeaders(), cache: "no-store" });
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") || "application/json" },
      });
    }

    // ─────────────────────────────────────────────
    // AUTH CHECK
    // ─────────────────────────────────────────────
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus base URL not configured." },
        { status: 500 }
      );
    }

    const userId = Number(session.userId);
    const result = await getClientCompanyProfileData(userId);

    if (result.error && !result.company) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      company: result.company,
      meta: result.meta,
    });
  } catch (err: unknown) {
    console.error("GET /api/client/company-profile error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// POST — Setup / Onboard a new company profile
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus base URL not configured." },
        { status: 500 }
      );
    }

    const userId = Number(session.userId);

    // Check if company association already exists
    const linkUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${userId}&fields=company_id&limit=1`;
    const linkRes = await fetch(linkUrl, { headers: getHeaders(), cache: "no-store" });
    // A failed read is indistinguishable from "not linked yet" here, and the
    // create below cannot be undone: it would leave a second vs_company row for
    // the same account and fork the company-code / TIN uniqueness checks.
    if (!linkRes.ok) {
      return NextResponse.json(
        { error: "Your existing company link could not be verified. Nothing was created. Please try again." },
        { status: 502 }
      );
    }
    const linkJson = await linkRes.json();
    if (linkJson.data && linkJson.data.length > 0) {
      return NextResponse.json(
        { error: "A company profile is already associated with this account." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const {
      company_name,
      company_legal_name,
      company_email,
      company_contact,
      company_description,
      registration_no,
      company_tin,
    } = body;

    // Field Validations
    if (!company_name?.trim()) {
      return NextResponse.json({ error: "Company display name is required." }, { status: 400 });
    }
    if (!company_legal_name?.trim()) {
      return NextResponse.json({ error: "Legal company name is required." }, { status: 400 });
    }
    if (!company_email?.trim()) {
      return NextResponse.json({ error: "Company email is required." }, { status: 400 });
    }
    if (!company_contact?.trim()) {
      return NextResponse.json({ error: "Company contact number is required." }, { status: 400 });
    }
    if (!company_description?.trim()) {
      return NextResponse.json({ error: "Company description is required." }, { status: 400 });
    }

    // 1. Create company record in vs_company
    let randomCode = "";
    for (let attempt = 0; attempt < COMPANY_CODE_MAX_ATTEMPTS; attempt += 1) {
      const candidate = buildCompanyCode();
      if (!(await isCompanyCodeTaken(candidate))) {
        randomCode = candidate;
        break;
      }
    }
    if (!randomCode) {
      return NextResponse.json(
        { error: "Could not allocate a unique company code. Please try again." },
        { status: 502 }
      );
    }

    const companyPayload = {
      company_name: company_name.trim(),
      company_legal_name: company_legal_name.trim(),
      company_email: company_email.trim(),
      company_contact: company_contact.trim(),
      company_description: company_description.trim(),
      company_code: randomCode,
      registration_no: registration_no?.trim() || null,
      company_tin: company_tin?.trim() || null,
      verification_status: "DRAFT",
      is_active: 1,
      is_deleted: 0,
      created_by_user_id: userId,
    };

    const companyRes = await fetch(`${DIRECTUS_BASE}/items/vs_company`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(companyPayload),
    });

    const companyText = await companyRes.text();
    let companyData: { data?: { company_id?: number }; errors?: Array<{ message?: string }> } | null = null;
    try {
      companyData = companyText ? JSON.parse(companyText) : null;
    } catch {
      companyData = null;
    }

    if (!companyRes.ok) {
      return NextResponse.json(
        { error: companyData?.errors?.[0]?.message || "Failed to create company record." },
        { status: companyRes.status }
      );
    }

    const companyId = companyData?.data?.company_id;
    if (!companyId) {
      return NextResponse.json(
        { error: "Failed to retrieve the created company ID." },
        { status: 500 }
      );
    }

    // 2. Link company to user with OWNER role
    const linkPayload = {
      company_id: companyId,
      user_id: userId,
      company_user_role: "OWNER",
      is_primary_contact: 1,
      status: "ACTIVE",
    };

    const newLinkRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_user`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(linkPayload),
    });

    if (!newLinkRes.ok) {
      // Rollback company creation
      await fetch(`${DIRECTUS_BASE}/items/vs_company/${companyId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      return NextResponse.json(
        { error: "Failed to link company with your user account." },
        { status: newLinkRes.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Company setup completed successfully.",
      company: companyData?.data ?? null,
    });
  } catch (err: unknown) {
    console.error("POST /api/client/company-profile error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PATCH — Update allowed company fields
// ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus base URL not configured." },
        { status: 500 }
      );
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // Only OWNER or primary contact may update
    const linkUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${userId}&fields=company_id,company_user_role&limit=1`;
    const linkRes = await fetch(linkUrl, { headers: getHeaders(), cache: "no-store" });
    // An unreadable link must not become "you have no company" — that answers
    // 404 to the owner of a real company every time Directus blips.
    if (!linkRes.ok) {
      return NextResponse.json(
        { error: "Your company association could not be read. Please try again." },
        { status: 502 }
      );
    }
    const linkJson = await linkRes.json();
    const link = linkJson.data?.[0];

    if (!link) {
      return NextResponse.json({ error: "Company association not found." }, { status: 404 });
    }

    if (link.company_user_role !== "OWNER" && link.company_user_role !== "ADMIN") {
      return NextResponse.json(
        { error: "You do not have permission to update this company profile." },
        { status: 403 }
      );
    }

    const companyId = link.company_id;

    // Whitelist updatable fields (exclude verification_status, company_code, is_deleted)
    const ALLOWED_FIELDS = [
      "company_name",
      "company_legal_name",
      "company_email",
      "company_contact",
      "company_website",
      "company_description",
      "company_mission",
      "company_vision",
      "company_culture",
      "company_benefits",
      "industry_id",
      "organization_type_id",
      "company_size_id",
      "year_established",
      "company_province",
      "company_city",
      "company_brgy",
      "company_address",
      "company_zipCode",
      "registration_no",
      "company_tin",
      "company_logo",
      "company_cover",
      "company_facebook",
      "company_linkedin",
      "company_instagram",
      "company_x",
      "company_youtube",
      "company_tags",
      "is_public",
    ];

    const safePayload: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        safePayload[key] = body[key];
      }
    }

    if (Object.keys(safePayload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    // ── Input Validation & Sanitization ─────────────────────────────────
    // Display Name
    if ("company_name" in safePayload) {
      if (
        typeof safePayload.company_name !== "string" ||
        safePayload.company_name.trim().length < 2 ||
        safePayload.company_name.trim().length > 100
      ) {
        return NextResponse.json(
          { error: "Company display name must be between 2 and 100 characters." },
          { status: 400 }
        );
      }
      safePayload.company_name = safePayload.company_name.trim();
    }

    // Legal Name
    if ("company_legal_name" in safePayload) {
      if (
        typeof safePayload.company_legal_name !== "string" ||
        safePayload.company_legal_name.trim().length < 2 ||
        safePayload.company_legal_name.trim().length > 150
      ) {
        return NextResponse.json(
          { error: "Legal company name must be between 2 and 150 characters." },
          { status: 400 }
        );
      }
      safePayload.company_legal_name = safePayload.company_legal_name.trim();
    }

    // Company Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if ("company_email" in safePayload) {
      if (
        typeof safePayload.company_email !== "string" ||
        !emailRegex.test(safePayload.company_email.trim()) ||
        safePayload.company_email.trim().length > 100
      ) {
        return NextResponse.json(
          { error: "Please enter a valid company email address." },
          { status: 400 }
        );
      }
      safePayload.company_email = safePayload.company_email.trim();
    }

    // Company Contact
    const phoneRegex = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,9}$/;
    if ("company_contact" in safePayload) {
      if (
        typeof safePayload.company_contact !== "string" ||
        !phoneRegex.test(safePayload.company_contact.trim()) ||
        safePayload.company_contact.trim().length > 50
      ) {
        return NextResponse.json(
          { error: "Please enter a valid company contact number (e.g. 09123456789 or +63 912 345 6789)." },
          { status: 400 }
        );
      }
      safePayload.company_contact = safePayload.company_contact.trim();
    }

    // Registration Number (Unique in DB; convert blank to NULL)
    if ("registration_no" in safePayload) {
      if (
        safePayload.registration_no === null ||
        safePayload.registration_no === undefined ||
        (typeof safePayload.registration_no === "string" && safePayload.registration_no.trim() === "")
      ) {
        safePayload.registration_no = null;
      } else if (typeof safePayload.registration_no === "string") {
        const trimmedReg = safePayload.registration_no.trim();
        if (trimmedReg.length < 3 || trimmedReg.length > 50) {
          return NextResponse.json(
            { error: "Registration Number must be between 3 and 50 characters." },
            { status: 400 }
          );
        }
        safePayload.registration_no = trimmedReg;
      }
    }

    // Tax Identification Number (Unique in DB; accept continuous & hyphenated, convert blank to NULL)
    const tinRegex = /^\d{3}-?\d{3}-?\d{3}(-?\d{3})?$/;
    if ("company_tin" in safePayload) {
      if (
        safePayload.company_tin === null ||
        safePayload.company_tin === undefined ||
        (typeof safePayload.company_tin === "string" && safePayload.company_tin.trim() === "")
      ) {
        safePayload.company_tin = null;
      } else if (typeof safePayload.company_tin === "string") {
        const trimmedTin = safePayload.company_tin.trim();
        if (!tinRegex.test(trimmedTin) || trimmedTin.length > 20) {
          return NextResponse.json(
            { error: "Tax Identification Number (TIN) must be 9–12 digits (e.g., 000-000-000-000 or 000000000)." },
            { status: 400 }
          );
        }
        safePayload.company_tin = trimmedTin;
      }
    }

    // Company Description
    if ("company_description" in safePayload) {
      if (
        typeof safePayload.company_description !== "string" ||
        safePayload.company_description.trim().length < 20 ||
        safePayload.company_description.trim().length > 2000
      ) {
        return NextResponse.json(
          { error: "Company description must be between 20 and 2,000 characters." },
          { status: 400 }
        );
      }
      safePayload.company_description = safePayload.company_description.trim();
    }

    // Mission & Vision
    if ("company_mission" in safePayload) {
      if (typeof safePayload.company_mission === "string") {
        const trimmed = safePayload.company_mission.trim();
        if (trimmed.length > 1000) {
          return NextResponse.json(
            { error: "Mission statement cannot exceed 1,000 characters." },
            { status: 400 }
          );
        }
        safePayload.company_mission = trimmed || null;
      }
    }
    if ("company_vision" in safePayload) {
      if (typeof safePayload.company_vision === "string") {
        const trimmed = safePayload.company_vision.trim();
        if (trimmed.length > 1000) {
          return NextResponse.json(
            { error: "Vision statement cannot exceed 1,000 characters." },
            { status: 400 }
          );
        }
        safePayload.company_vision = trimmed || null;
      }
    }

    // Culture & Benefits
    if ("company_culture" in safePayload) {
      if (typeof safePayload.company_culture === "string") {
        const trimmed = safePayload.company_culture.trim();
        if (trimmed.length > 1500) {
          return NextResponse.json(
            { error: "Company culture text cannot exceed 1,500 characters." },
            { status: 400 }
          );
        }
        safePayload.company_culture = trimmed || null;
      }
    }
    if ("company_benefits" in safePayload) {
      if (typeof safePayload.company_benefits === "string") {
        const trimmed = safePayload.company_benefits.trim();
        if (trimmed.length > 1500) {
          return NextResponse.json(
            { error: "Perks & benefits text cannot exceed 1,500 characters." },
            { status: 400 }
          );
        }
        safePayload.company_benefits = trimmed || null;
      }
    }

    // Website & Social Links URL validation helper
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    const urlFields = [
      "company_website",
      "company_facebook",
      "company_linkedin",
      "company_instagram",
      "company_x",
      "company_youtube",
    ] as const;

    for (const uField of urlFields) {
      if (uField in safePayload) {
        if (typeof safePayload[uField] === "string") {
          const val = (safePayload[uField] as string).trim();
          if (val === "") {
            safePayload[uField] = null;
          } else {
            if (!urlRegex.test(val) || val.length > 500) {
              const fieldName = uField.replace("company_", "").replace(/_/g, " ");
              return NextResponse.json(
                { error: `Please enter a valid URL for ${fieldName}.` },
                { status: 400 }
              );
            }
            safePayload[uField] = val;
          }
        }
      }
    }

    // Company Tags
    if ("company_tags" in safePayload) {
      if (typeof safePayload.company_tags === "string") {
        const trimmedTags = safePayload.company_tags.trim();
        if (trimmedTags.length > 255) {
          return NextResponse.json(
            { error: "Company tags cannot exceed 255 characters." },
            { status: 400 }
          );
        }
        safePayload.company_tags = trimmedTags || null;
      }
    }

    // Year Established
    if ("year_established" in safePayload && safePayload.year_established !== null && safePayload.year_established !== undefined) {
      const year = Number(safePayload.year_established);
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1800 || year > currentYear + 1) {
        return NextResponse.json(
          { error: `Year established must be between 1800 and ${currentYear + 1}.` },
          { status: 400 }
        );
      }
      safePayload.year_established = year;
    }

    // Media fields: normalize empty strings to null
    if ("company_logo" in safePayload && typeof safePayload.company_logo === "string" && !safePayload.company_logo.trim()) {
      safePayload.company_logo = null;
    }
    if ("company_cover" in safePayload && typeof safePayload.company_cover === "string" && !safePayload.company_cover.trim()) {
      safePayload.company_cover = null;
    }

    if (
      "company_email" in safePayload &&
      typeof safePayload.company_email === "string" &&
      safePayload.company_email.trim()
    ) {
      const emailToCheck = safePayload.company_email.trim();
      const checkUrl = `${DIRECTUS_BASE}/items/vs_company?filter[company_email][_eq]=${encodeURIComponent(
        emailToCheck
      )}&filter[company_id][_neq]=${companyId}&fields=company_id&limit=1`;
      const checkRes = await fetch(checkUrl, { headers: getHeaders(), cache: "no-store" });
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        if (checkJson.data && checkJson.data.length > 0) {
          return NextResponse.json(
            { error: "This email address is already registered to another company profile." },
            { status: 409 }
          );
        }
      }
    }

    // Fetch existing company details to merge for completion recalculation
    const companyUrl = `${DIRECTUS_BASE}/items/vs_company/${companyId}?fields=*`;
    const companyRes = await fetch(companyUrl, { headers: getHeaders(), cache: "no-store" });
    let existingCompany: Record<string, unknown> = {};
    if (companyRes.ok) {
      const companyJson = await companyRes.json();
      existingCompany = companyJson.data ?? {};
    }

    const mergedCompany = { ...existingCompany, ...safePayload };
    const computedPercent = calculateCompletionPercent(mergedCompany);
    safePayload.profile_completion_percent = computedPercent;

    const patchRes = await fetch(`${DIRECTUS_BASE}/items/vs_company/${companyId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(safePayload),
    });

    const patchText = await patchRes.text();
    let patchData: { errors?: Array<{ message?: string; extensions?: { code?: string } }> } | null = null;
    try {
      patchData = patchText ? JSON.parse(patchText) : null;
    } catch {
      patchData = null;
    }

    if (!patchRes.ok) {
      console.error("PATCH /api/client/company-profile Directus error:", patchRes.status, patchText);

      const errLower = patchText.toLowerCase();
      if (errLower.includes("uk_company_tin") || errLower.includes("company_tin")) {
        return NextResponse.json(
          { error: "A company with this Tax Identification Number (TIN) already exists." },
          { status: 409 }
        );
      }
      if (errLower.includes("uk_company_registration") || errLower.includes("registration_no")) {
        return NextResponse.json(
          { error: "A company with this Registration Number already exists." },
          { status: 409 }
        );
      }
      if (errLower.includes("company_email")) {
        return NextResponse.json(
          { error: "This email address is already registered to another company profile." },
          { status: 409 }
        );
      }
      if (errLower.includes("company_tags") || (errLower.includes("too long") && errLower.includes("tags"))) {
        return NextResponse.json(
          { error: "Company tags cannot exceed 255 characters." },
          { status: 400 }
        );
      }

      const clientMessage = patchData?.errors?.[0]?.message || "Failed to update company profile. Please verify your submitted information.";
      return NextResponse.json(
        { error: clientMessage },
        { status: patchRes.status >= 500 ? 500 : 400 }
      );
    }

    const updated = await getClientCompanyProfileData(userId);

    return NextResponse.json({
      success: true,
      message: "Company profile updated successfully.",
      company: updated.company,
    });
  } catch (err: unknown) {
    console.error("PATCH /api/client/company-profile error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

