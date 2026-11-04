/* eslint-disable @typescript-eslint/no-explicit-any */
// src/modules/public/company-profile/services/company-profile.service.ts

import {
  TrustedCompany,
  PublicCompanyProfile,
  CompanyJobFilters,
  BrowseCompanyFilters,
  PaginatedCompanyJobs,
  PaginatedBrowseCompanies,
  CompanyReview,
  CompanyReviewReport
} from "../types";
import { formatAssetUrl } from "@/lib/utils";

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

// Caller limits are untrusted: the admin token would otherwise allow limit=-1 or huge pages.
const MAX_PAGE_LIMIT = 50;
// Bounds the scans that aggregate in memory instead of paging in Directus.
const DIRECTUS_SCAN_LIMIT = 2000;

function clampLimit(value: number | undefined, fallback: number, max = MAX_PAGE_LIMIT): number {
  const n = Math.floor(Number(value));
  return Math.min(Math.max(Number.isFinite(n) && n > 0 ? n : fallback, 1), max);
}

function clampPage(value: number | undefined): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function getTrustedCompanies(limit = 20): Promise<TrustedCompany[]> {
  try {
    const headers = getHeaders();
    
    // 1. Fetch active jobs to compute counts per company
    const jobsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_posting?filter[status][_eq]=ACTIVE&limit=${DIRECTUS_SCAN_LIMIT}&fields=company_id`,
      { headers, cache: "no-store" }
    );
    const jobsData = jobsRes.ok ? await jobsRes.json() : { data: [] };
    const activeJobs = jobsData.data || [];
    const jobCounts: Record<number, number> = {};
    activeJobs.forEach((job: any) => {
      const cid = job.company_id;
      if (cid) {
        jobCounts[cid] = (jobCounts[cid] || 0) + 1;
      }
    });

    // 2. Fetch verified public active companies
    const url = new URL(`${DIRECTUS_BASE}/items/vs_company`);
    url.searchParams.append("filter[verification_status][_eq]", "VERIFIED");
    url.searchParams.append("filter[is_public][_eq]", "true");
    url.searchParams.append("filter[is_active][_eq]", "true");
    url.searchParams.append("fields", "company_id,company_code,company_name,company_logo,industry_id.industry_name,verification_status");
    url.searchParams.append("limit", String(clampLimit(limit, 20)));

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) return [];
    
    const json = await res.json();
    const records = json.data || [];

    return records.map((c: any) => ({
      companyId: c.company_id,
      companyCode: c.company_code,
      companyName: c.company_name,
      companyLogo: formatAssetUrl(c.company_logo),
      industryName: c.industry_id?.industry_name || null,
      activeJobs: jobCounts[c.company_id] || 0,
      verified: c.verification_status === "VERIFIED",
    }));
  } catch (err) {
    console.error("Error fetching trusted companies:", err);
    return [];
  }
}

export async function getPublicCompanyByCode(companyCode: string): Promise<PublicCompanyProfile | null> {
  try {
    const headers = getHeaders();
    const url = new URL(`${DIRECTUS_BASE}/items/vs_company`);
    url.searchParams.append("filter[company_code][_eq]", companyCode);
    url.searchParams.append("filter[verification_status][_eq]", "VERIFIED");
    url.searchParams.append("filter[is_public][_eq]", "true");
    url.searchParams.append("filter[is_active][_eq]", "true");
    url.searchParams.append(
      "fields",
      "company_id,company_code,company_name,company_legal_name,industry_id.industry_name,company_size_id.company_size_name,year_established,company_logo,company_cover,company_description,company_mission,company_vision,company_culture,company_benefits,company_tags,company_website,company_facebook,company_linkedin,company_instagram,company_x,company_youtube,company_contact,company_email,company_address,company_brgy,company_city,company_province,company_country,company_zipCode,verification_status,is_public,is_active"
    );
    url.searchParams.append("limit", "1");

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.data?.[0];
    if (!raw) return null;

    // Fetch active jobs count for this specific company
    const jobsCountUrl = `${DIRECTUS_BASE}/items/vs_job_posting?filter[company_id][_eq]=${raw.company_id}&filter[status][_eq]=ACTIVE&limit=0&meta=filter_count`;
    const jobsCountRes = await fetch(jobsCountUrl, { headers, cache: "no-store" });
    const jobsCountJson = jobsCountRes.ok ? await jobsCountRes.json() : { meta: { filter_count: 0 } };
    const count = jobsCountJson.meta?.filter_count || 0;

    // Form address details
    const addressParts = [
      raw.company_address,
      raw.company_brgy,
      raw.company_city,
      raw.company_province,
      raw.company_country,
      raw.company_zipCode
    ].filter(Boolean);
    const fullAddress = addressParts.join(", ") || null;

    // Return sanitized DTO structure
    return {
      company_id: raw.company_id,
      company_code: raw.company_code,
      company_name: raw.company_name,
      company_legal_name: raw.company_legal_name,
      industry_name: raw.industry_id?.industry_name || null,
      company_size_name: raw.company_size_id?.company_size_name || null,
      year_established: raw.year_established ? Number(raw.year_established) : null,
      company_logo: formatAssetUrl(raw.company_logo),
      company_cover: formatAssetUrl(raw.company_cover),
      company_description: raw.company_description || null,
      company_mission: raw.company_mission || null,
      company_vision: raw.company_vision || null,
      company_culture: raw.company_culture || null,
      company_benefits: raw.company_benefits || null,
      company_tags: raw.company_tags || null,
      company_website: raw.company_website || null,
      company_facebook: raw.company_facebook || null,
      company_linkedin: raw.company_linkedin || null,
      company_instagram: raw.company_instagram || null,
      company_x: raw.company_x || null,
      company_youtube: raw.company_youtube || null,
      company_contact: raw.company_contact || null,
      company_email: raw.company_email || null,
      company_address: fullAddress,
      verification_status: raw.verification_status,
      is_public: !!raw.is_public,
      is_active: !!raw.is_active,
      activeJobsCount: count,
    };
  } catch (err) {
    console.error("Error fetching company by code:", err);
    return null;
  }
}

export async function getPublicCompanyJobs(
  companyId: number,
  filters: CompanyJobFilters,
  pagination: { page: number; limit: number }
): Promise<PaginatedCompanyJobs> {
  try {
    const headers = getHeaders();
    const url = new URL(`${DIRECTUS_BASE}/items/vs_job_posting`);
    
    url.searchParams.append("filter[company_id][_eq]", String(companyId));
    url.searchParams.append("filter[status][_eq]", "ACTIVE");

    if (filters.search) {
      url.searchParams.append("filter[job_title][_icontains]", filters.search);
    }
    if (filters.job_type && filters.job_type !== "ALL") {
      url.searchParams.append("filter[job_type][_eq]", filters.job_type);
    }
    if (filters.work_arrangement && filters.work_arrangement !== "ALL") {
      url.searchParams.append("filter[work_arrangement][_eq]", filters.work_arrangement);
    }
    if (filters.experience_level && filters.experience_level !== "ALL") {
      url.searchParams.append("filter[experience_level][_eq]", filters.experience_level);
    }

    const limit = clampLimit(pagination.limit, 5);
    const page = clampPage(pagination.page);
    const offset = (page - 1) * limit;

    url.searchParams.append("limit", String(limit));
    url.searchParams.append("offset", String(offset));
    url.searchParams.append("meta", "filter_count");
    url.searchParams.append("sort[]", "-created_at");

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) return { jobs: [], total: 0 };
    const json = await res.json();
    const data = json.data || [];
    const total = json.meta?.filter_count || 0;

    const jobIds = data.map((j: any) => j.job_id);
    const skillsMap: Record<number, string[]> = {};
    if (jobIds.length > 0) {
      const skillsRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_skills_map?filter[job_id][_in]=${jobIds.join(",")}&fields=job_id,skill_id.skill_name&limit=500`,
        { headers, cache: "no-store" }
      );
      if (skillsRes.ok) {
        const skillsJson = await skillsRes.json();
        (skillsJson.data || []).forEach((m: any) => {
          const jobId = m.job_id;
          if (!skillsMap[jobId]) skillsMap[jobId] = [];
          if (m.skill_id?.skill_name) {
            skillsMap[jobId].push(m.skill_id.skill_name);
          }
        });
      }
    }

    const formattedJobs = data.map((j: any) => {
      // Employers that opted out of publishing their range must not leak it via the company jobs tab.
      const salaryVisible = !(
        j.show_salary_range === false || j.show_salary_range === 0 || j.show_salary_range === "0"
      );
      let salaryText = "Salary not disclosed";
      if (j.salary_negotiable) {
        salaryText = "Negotiable";
      } else if (salaryVisible) {
        const curr = j.currency || "PHP";
        if (j.salary_type === "Fixed Salary" && j.salary_min) {
          salaryText = `${curr} ${Number(j.salary_min).toLocaleString()} / mo`;
        } else if (j.salary_min && j.salary_max) {
          salaryText = `${curr} ${Number(j.salary_min).toLocaleString()} – ${Number(j.salary_max).toLocaleString()} / mo`;
        } else if (j.salary_min) {
          salaryText = `${curr} ${Number(j.salary_min).toLocaleString()}+ / mo`;
        }
      }

      const date = new Date(j.created_at);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      let postedText = `${diffDays}d ago`;
      if (diffMins < 60) postedText = `${diffMins}m ago`;
      else if (diffHours < 24) postedText = `${diffHours}h ago`;

      return {
        id: j.job_id,
        title: j.job_title,
        category: j.job_category,
        type: j.job_type,
        work_arrangement: j.work_arrangement,
        location: j.job_location,
        department: j.job_department || null,
        salary: salaryText,
        posted: postedText,
        tags: (skillsMap[j.job_id] || []).slice(0, 3),
        description: j.job_description || "",
        salary_min: salaryVisible && j.salary_min ? Number(j.salary_min) : null,
        salary_max: salaryVisible && j.salary_max ? Number(j.salary_max) : null,
        salary_currency: j.currency || "PHP",
        experience_level: j.experience_level || "Any Experience",
        created_at: j.created_at || new Date().toISOString(),
      };
    });

    return { jobs: formattedJobs, total };
  } catch (err) {
    console.error("Error fetching company jobs:", err);
    return { jobs: [], total: 0 };
  }
}

export async function getBrowseCompanies(
  filters: BrowseCompanyFilters,
  pagination: { page: number; limit: number }
): Promise<PaginatedBrowseCompanies> {
  try {
    const headers = getHeaders();
    
    // Fetch active jobs maps
    const jobsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_posting?filter[status][_eq]=ACTIVE&limit=${DIRECTUS_SCAN_LIMIT}&fields=company_id`,
      { headers, cache: "no-store" }
    );
    const jobsData = jobsRes.ok ? await jobsRes.json() : { data: [] };
    const activeJobs = jobsData.data || [];
    const jobCounts: Record<number, number> = {};
    activeJobs.forEach((job: any) => {
      const cid = job.company_id;
      if (cid) {
        jobCounts[cid] = (jobCounts[cid] || 0) + 1;
      }
    });

    const url = new URL(`${DIRECTUS_BASE}/items/vs_company`);
    url.searchParams.append("filter[verification_status][_eq]", "VERIFIED");
    url.searchParams.append("filter[is_public][_eq]", "true");
    url.searchParams.append("filter[is_active][_eq]", "true");

    if (filters.search) {
      url.searchParams.append("filter[company_name][_icontains]", filters.search);
    }
    if (filters.industry && filters.industry !== "ALL") {
      url.searchParams.append("filter[industry_id][_eq]", filters.industry);
    }
    if (filters.size && filters.size !== "ALL") {
      url.searchParams.append("filter[company_size_id][_eq]", filters.size);
    }
    if (filters.location) {
      url.searchParams.append("filter[company_city][_icontains]", filters.location);
    }

    url.searchParams.append("fields", "company_id,company_code,company_name,company_legal_name,industry_id.industry_name,company_size_id.company_size_name,year_established,company_logo,company_cover,company_description,company_mission,company_vision,company_culture,company_benefits,company_tags,company_website,company_facebook,company_linkedin,company_instagram,company_x,company_youtube,company_contact,company_email,company_address,company_brgy,company_city,company_province,company_country,company_zipCode,verification_status,is_public,is_active");
    url.searchParams.append("limit", String(DIRECTUS_SCAN_LIMIT));

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) return { companies: [], total: 0 };
    const json = await res.json();
    const data = json.data || [];

    let companies: PublicCompanyProfile[] = data.map((raw: any) => {
      const addressParts = [
        raw.company_address,
        raw.company_brgy,
        raw.company_city,
        raw.company_province,
        raw.company_country,
        raw.company_zipCode
      ].filter(Boolean);
      const fullAddress = addressParts.join(", ") || null;

      return {
        company_id: raw.company_id,
        company_code: raw.company_code,
        company_name: raw.company_name,
        company_legal_name: raw.company_legal_name,
        industry_name: raw.industry_id?.industry_name || null,
        company_size_name: raw.company_size_id?.company_size_name || null,
        year_established: raw.year_established ? Number(raw.year_established) : null,
        company_logo: formatAssetUrl(raw.company_logo),
        company_cover: formatAssetUrl(raw.company_cover),
        company_description: raw.company_description || null,
        company_mission: raw.company_mission || null,
        company_vision: raw.company_vision || null,
        company_culture: raw.company_culture || null,
        company_benefits: raw.company_benefits || null,
        company_tags: raw.company_tags || null,
        company_website: raw.company_website || null,
        company_facebook: raw.company_facebook || null,
        company_linkedin: raw.company_linkedin || null,
        company_instagram: raw.company_instagram || null,
        company_x: raw.company_x || null,
        company_youtube: raw.company_youtube || null,
        company_contact: raw.company_contact || null,
        company_email: raw.company_email || null,
        company_address: fullAddress,
        verification_status: raw.verification_status,
        is_public: !!raw.is_public,
        is_active: !!raw.is_active,
        activeJobsCount: jobCounts[raw.company_id] || 0,
      };
    });

    if (filters.activeJobsOnly) {
      companies = companies.filter(c => c.activeJobsCount > 0);
    }

    const total = companies.length;
    const page = clampPage(pagination.page);
    const limit = clampLimit(pagination.limit, 10);
    const offset = (page - 1) * limit;
    const paginatedCompanies = companies.slice(offset, offset + limit);

    return { companies: paginatedCompanies, total };
  } catch (err) {
    console.error("Error fetching browse companies:", err);
    return { companies: [], total: 0 };
  }
}

export async function getIndustries(): Promise<{ industry_id: number; industry_name: string }[]> {
  try {
    const headers = getHeaders();
    const res = await fetch(`${DIRECTUS_BASE}/items/vs_industry?filter[is_active][_eq]=true&limit=${DIRECTUS_SCAN_LIMIT}&sort[]=industry_name`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.error("Error fetching industries:", e);
    return [];
  }
}

export async function getCompanySizes(): Promise<{ company_size_id: number; company_size_name: string }[]> {
  try {
    const headers = getHeaders();
    const res = await fetch(`${DIRECTUS_BASE}/items/vs_company_size?filter[is_active][_eq]=true&limit=${DIRECTUS_SCAN_LIMIT}`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.error("Error fetching company sizes:", e);
    return [];
  }
}

// Capped so an anonymous caller cannot export a company's whole review corpus.
const REVIEWS_LIMIT = 50;

// Only the columns ReviewsTab / AboutTab render; company_id, status and updated_at are not consumed.
const REVIEW_PUBLIC_FIELDS =
  "review_id,reviewer_user_id,employment_status,job_title,overall_rating,work_life_balance_rating,compensation_rating,management_rating,career_growth_rating,review_title,pros,cons,review_text,is_anonymous,created_at";

export async function getPublicCompanyReviews(
  companyId: number,
  limit?: number
): Promise<CompanyReview[]> {
  try {
    const headers = getHeaders();
    const url = new URL(`${DIRECTUS_BASE}/items/vs_company_review`);

    const safeLimit = clampLimit(limit, REVIEWS_LIMIT, REVIEWS_LIMIT);

    url.searchParams.append("filter[company_id][_eq]", String(companyId));
    url.searchParams.append("filter[status][_eq]", "PUBLISHED");
    url.searchParams.append("fields", REVIEW_PUBLIC_FIELDS);
    url.searchParams.append("limit", String(safeLimit));
    url.searchParams.append("sort[]", "-created_at");

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) return [];
    
    const json = await res.json();
    const data = (json.data || []) as Record<string, unknown>[];

    return data.map((r) => ({
      review_id: Number(r.review_id),
      reviewer_user_id: r.is_anonymous ? null : Number(r.reviewer_user_id),
      employment_status: r.employment_status as "CURRENT_EMPLOYEE" | "FORMER_EMPLOYEE",
      job_title: (r.job_title as string) || null,
      overall_rating: Number(r.overall_rating || 0),
      work_life_balance_rating: r.work_life_balance_rating ? Number(r.work_life_balance_rating) : null,
      compensation_rating: r.compensation_rating ? Number(r.compensation_rating) : null,
      management_rating: r.management_rating ? Number(r.management_rating) : null,
      career_growth_rating: r.career_growth_rating ? Number(r.career_growth_rating) : null,
      review_title: (r.review_title as string) || null,
      pros: (r.pros as string) || null,
      cons: (r.cons as string) || null,
      review_text: (r.review_text as string) || "",
      is_anonymous: !!r.is_anonymous,
      created_at: (r.created_at as string) || "",
    }));
  } catch (err) {
    console.error("Error fetching company reviews:", err);
    return [];
  }
}

export async function createCompanyReview(
  companyId: number,
  data: Partial<CompanyReview>,
  userId: number
): Promise<CompanyReview | null> {
  try {
    const headers = getHeaders();
    const payload = {
      company_id: companyId,
      reviewer_user_id: userId,
      employment_status: data.employment_status,
      job_title: data.job_title || null,
      overall_rating: data.overall_rating,
      work_life_balance_rating: data.work_life_balance_rating || null,
      compensation_rating: data.compensation_rating || null,
      management_rating: data.management_rating || null,
      career_growth_rating: data.career_growth_rating || null,
      review_title: data.review_title || null,
      pros: data.pros || null,
      cons: data.cons || null,
      review_text: data.review_text,
      is_anonymous: data.is_anonymous ? 1 : 0,
      status: "PUBLISHED",
    };

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_company_review`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Failed to insert review to Directus:", errText);
      return null;
    }

    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.error("Error creating company review:", err);
    return null;
  }
}

export async function createReviewReport(
  reviewId: number,
  data: Partial<CompanyReviewReport>,
  userId: number
): Promise<CompanyReviewReport | null> {
  try {
    const headers = getHeaders();
    const payload = {
      review_id: reviewId,
      reporter_user_id: userId,
      reason_code: data.reason_code,
      report_details: data.report_details || null,
      status: "PENDING",
    };

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_company_review_report`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Failed to insert review report to Directus:", errText);
      return null;
    }

    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.error("Error creating review report:", err);
    return null;
  }
}
