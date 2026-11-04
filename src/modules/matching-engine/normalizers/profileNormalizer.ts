// src/modules/matching-engine/normalizers/profileNormalizer.ts

import { NormalizedProfile, NormalizedWorkEntry, NormalizedEduEntry, NormalizedCertEntry } from "../types/profileTypes";
import { normalizeTitle } from "./titleNormalizer";
import { normalizeSkills } from "./skillNormalizer";

export function normalizeRawCandidate(raw: {
  user_id: number;
  name: string;
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  availability_status?: string | null;
  skills?: string[];
  work_experience?: Array<{
    company_name: string;
    job_title: string;
    job_description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    is_current_role?: boolean;
  }>;
  education?: Array<{
    id?: number | null;
    status?: string | null;
    school_name?: string | null;
    course_name?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }>;
  certifications?: Array<{
    certificate_name: string;
    issuing_organization?: string | null;
  }>;
  social_links?: Array<{ platform_name: string; profile_url: string }>;
}): NormalizedProfile {
  const workHistory: NormalizedWorkEntry[] = (raw.work_experience ?? []).map((w) => {
    let years = 0;
    if (w.start_date) {
      const start = new Date(w.start_date);
      const end = w.is_current_role ? new Date() : w.end_date ? new Date(w.end_date) : new Date();
      const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      years = Number((months / 12).toFixed(1));
    }
    return {
      company: w.company_name,
      title: w.job_title,
      description: w.job_description ?? null,
      startDate: w.start_date ?? null,
      endDate: w.end_date ?? null,
      isCurrent: w.is_current_role ?? false,
      years,
    };
  });

  const titlesSet = new Set<string>();
  if (raw.headline) titlesSet.add(normalizeTitle(raw.headline));
  for (const w of workHistory) {
    if (w.title) titlesSet.add(normalizeTitle(w.title));
  }

  const education: NormalizedEduEntry[] = (raw.education ?? []).map((e) => ({
    id: e.id ?? null,
    status: e.status ?? null,
    school: e.school_name ?? null,
    course: e.course_name ?? null,
    startDate: e.start_date ?? null,
    endDate: e.end_date ?? null,
  }));

  const certifications: NormalizedCertEntry[] = (raw.certifications ?? []).map((c) => ({
    name: c.certificate_name,
    issuer: c.issuing_organization ?? null,
  }));

  const portfolioLinks: string[] = (raw.social_links ?? []).map((s) => s.profile_url);

  // Compute profile completeness score (0-100)
  let completeness = 0;
  if (workHistory.length > 0) completeness += 25;
  if (raw.summary && raw.summary.length > 50) completeness += 20;
  if ((raw.skills ?? []).length > 0) completeness += 20;
  if (education.some((e) => e.status === "Verified")) completeness += 15;
  if (certifications.length > 0 || portfolioLinks.length > 0) completeness += 20;

  // Activity score (placeholder: based on isCurrent role / active presence)
  const hasCurrentRole = workHistory.some((w) => w.isCurrent);
  const activityScore = hasCurrentRole ? 90 : 70;

  return {
    id: raw.user_id,
    name: raw.name,
    headline: raw.headline ?? null,
    summary: raw.summary ?? null,
    location: raw.location ?? "",
    availability: raw.availability_status ?? "AVAILABLE",
    titles: Array.from(titlesSet),
    skills: normalizeSkills(raw.skills ?? []),
    workHistory,
    education,
    certifications,
    portfolioLinks,
    profileCompletenessScore: Math.min(100, completeness),
    activityScore,
  };
}
