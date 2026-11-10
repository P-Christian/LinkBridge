// src/modules/client/company-profile/services/client-company-profile.service.ts

import { CompanyProfile, CompanyProfileMeta } from "../types";

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

export function calculateCompletionPercent(company: Record<string, unknown>): number {
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

  const total = fields.length + 1;
  return Math.round((filled / total) * 100);
}

export interface ClientCompanyProfileData {
  company: CompanyProfile | null;
  meta: CompanyProfileMeta | null;
  error?: string | null;
}

export async function getClientCompanyProfileData(userId: number): Promise<ClientCompanyProfileData> {
  if (!DIRECTUS_BASE) {
    throw new Error("Directus base URL not configured.");
  }

  const linkUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${userId}&fields=company_id,company_user_role,is_primary_contact&limit=1`;
  const linkRes = await fetch(linkUrl, { headers: getHeaders(), cache: "no-store" });

  if (!linkRes.ok) {
    const errorText = await linkRes.text();
    throw new Error(`Failed to resolve company association: ${errorText}`);
  }

  const linkJson = await linkRes.json();
  const links = linkJson.data;

  if (!Array.isArray(links) || links.length === 0) {
    return {
      company: null,
      meta: null,
      error: "No company associated with this account.",
    };
  }

  const companyId = links[0].company_id;

  // Fetch vs_company record
  const companyUrl = `${DIRECTUS_BASE}/items/vs_company/${companyId}?fields=*`;
  const companyRes = await fetch(companyUrl, {
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!companyRes.ok) {
    const errorText = await companyRes.text();
    throw new Error(`Failed to fetch company profile: ${errorText}`);
  }

  const companyJson = await companyRes.json();
  const companyData = companyJson.data ?? null;
  const computedPercent = companyData ? calculateCompletionPercent(companyData) : 0;

  let publicRejectionReason: string | null = (companyData?.rejection_reason as string) || null;
  let workflowStatus: string | null = null;
  if (companyId) {
    try {
      const verifUrl = `${DIRECTUS_BASE}/items/vs_company_verifications?filter[company_id][_eq]=${companyId}&sort=-created_at,-id&limit=1`;
      const verifRes = await fetch(verifUrl, { headers: getHeaders(), cache: "no-store" });
      if (verifRes.ok) {
        const verifJson = await verifRes.json();
        const latestV = verifJson.data?.[0];
        if (latestV?.public_rejection_reason) {
          publicRejectionReason = latestV.public_rejection_reason;
        }
        if (latestV?.status) {
          workflowStatus = String(latestV.status).toUpperCase();
        }
      }
    } catch (e) {
      console.warn("Failed to fetch latest vs_company_verifications in company-profile:", e);
    }
  }

  const company: CompanyProfile | null = companyData
    ? {
        ...companyData,
        profile_completion_percent: computedPercent,
        verification_workflow_status: workflowStatus,
        rejection_reason: publicRejectionReason || companyData.rejection_reason || null,
        public_rejection_reason: publicRejectionReason || companyData.rejection_reason || null,
      }
    : null;

  const meta: CompanyProfileMeta = {
    company_user_role: links[0].company_user_role,
    is_primary_contact: links[0].is_primary_contact,
  };

  return { company, meta };
}
