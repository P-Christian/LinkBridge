// src/app/api/client/talent-profile/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import {
  DirectusError,
  directusItems,
  directusItemsWhereIn,
  directusSettled,
} from "@/lib/server/directus";
import { toId } from "@/lib/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Directus wraps a single-item read as `{ data: {...} }`. */
interface DirectusRow<T> {
  data?: T;
}

interface TalentUserRow {
  user_id: number;
  user_fname?: string | null;
  user_lname?: string | null;
  user_email?: string | null;
  user_contact?: string | null;
  user_city?: string | null;
  user_province?: string | null;
  user_brgy?: string | null;
  profile_image_url?: string | null;
  gender?: string | null;
  nationality?: string | null;
}

interface TalentProfileRow {
  profile_id: number;
  profile_headline?: string | null;
  professional_summary?: string | null;
  profile_visibility?: string | null;
  expected_salary?: string | number | null;
}

interface TalentSkillRow {
  id: number;
  skill_id?: { id?: number; skill_name?: string } | null;
}

interface TalentWorkRow {
  id: number;
  company_name: string;
  job_title: string;
  location?: string | null;
  location_type?: string | null;
  employment_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current_role?: boolean | null;
  job_description?: string | null;
}

interface TalentEduRow {
  employee_education_id: number;
  school_id?: { school_name?: string; city_municipality?: string; province?: string } | null;
  school_course_id?: { course_name?: string } | null;
  education_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface TalentCertRow {
  id: number;
  certificate_name: string;
  issuing_organization: string;
  issue_date?: string | null;
  credential_url?: string | null;
}

interface TalentSocialRow {
  id: number;
  platform_name: string;
  profile_url: string;
}

interface TalentResumeRow {
  id: number;
  file_url: string;
  file_name?: string | null;
  is_primary: boolean;
  uploaded_at?: string | null;
}

interface TalentJobPreferenceRow {
  id: number;
  work_setup?: string | null;
  preferred_location?: string | null;
}

function toProtectedAssetUrl(fileReference: string): string {
  const raw = String(fileReference || "");
  const fileId = raw.includes("/assets/")
    ? raw.split("/assets/").pop()?.split(/[?#]/u)[0]
    : raw.split(/[?#]/u)[0];
  return fileId ? `/api/assets/${encodeURIComponent(fileId)}` : "";
}

function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "";
  const parts = email.trim().split("@");
  if (parts.length !== 2) return "***";
  const [name, domain] = parts;
  if (name.length <= 2) return `${name.slice(0, 1)}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== "string") return null;
  const clean = phone.trim();
  if (clean.length <= 4) return "****";
  return `***-***-${clean.slice(-4)}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const talentUserId = toId(id);

    if (talentUserId === null) {
      return NextResponse.json({ error: "Invalid talent ID." }, { status: 400 });
    }

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
      return NextResponse.json(
        {
          error: `Restricted: Your company is ${verification_status}. Viewing talent profiles requires company verification.`,
          verification_status,
        },
        { status: 403 }
      );
    }

    // ────────────────────────────────────────────
    // Parallel fetch: all profile data
    //
    // Each read is fatal on failure. This payload is what an employer judges a
    // candidate on, and every one of these used to answer `[]` or `null` when
    // Directus was unreachable, so an outage was indistinguishable from a
    // candidate who has no skills, no history and no education.
    // ────────────────────────────────────────────
    const [userRes, profileRows, skillsData, workData, eduData, certData, socialData, savedRows, jobPrefRows] =
      await Promise.all([
        // Basic user info
        directusSettled<DirectusRow<TalentUserRow>>(`/items/vs_user/${talentUserId}`, {
          query: "fields=user_id,user_fname,user_lname,user_email,user_contact,user_city,user_province,user_brgy,profile_image_url,gender,nationality",
        }),
        // Job seeker profile
        directusItems<TalentProfileRow>("vs_job_seeker_profile", {
          query: `filter[user_id][_eq]=${talentUserId}&fields=profile_id,profile_headline,professional_summary,profile_visibility,expected_salary&limit=1`,
        }),
        // Skills
        directusItems<TalentSkillRow>("vs_user_skills_map", {
          query: `filter[user_id][_eq]=${talentUserId}&fields=id,skill_id.id,skill_id.skill_name&limit=-1`,
        }),
        // Work experience
        directusItems<TalentWorkRow>("vs_work_experience", {
          query: `filter[user_id][_eq]=${talentUserId}&fields=id,company_name,job_title,location,location_type,employment_type,start_date,end_date,is_current_role,job_description&sort[]=-start_date&limit=-1`,
        }),
        // Education
        directusItems<TalentEduRow>("vs_employee_education", {
          query: `filter[user_id][_eq]=${talentUserId}&fields=employee_education_id,school_id.school_name,school_id.city_municipality,school_id.province,school_course_id.course_name,education_status,start_date,end_date&limit=-1`,
        }),
        // Certifications
        directusItems<TalentCertRow>("vs_certifications", {
          query: `filter[user_id][_eq]=${talentUserId}&fields=id,certificate_name,issuing_organization,issue_date,credential_url&limit=-1`,
        }),
        // Social links
        directusItems<TalentSocialRow>("vs_user_social_links", {
          query: `filter[user_id][_eq]=${talentUserId}&fields=id,platform_name,profile_url&limit=-1`,
        }),
        // Is saved?
        companyId
          ? directusItems<{ saved_applicant_id: number; notes?: string | null }>("vs_saved_applicant", {
              query: `filter[company_id][_eq]=${companyId}&filter[applicant_user_id][_eq]=${talentUserId}&fields=saved_applicant_id,notes&limit=1`,
            })
          : Promise.resolve([]),
        // Job preferences (work setup)
        directusItems<TalentJobPreferenceRow>("vs_job_preferences", {
          query: `filter[user_id][_eq]=${talentUserId}&fields=id,work_setup,preferred_location&limit=1`,
        }).catch(() => []),
      ]);

    if (!userRes.ok) {
      // An unreachable Directus is not a candidate who does not exist.
      if (userRes.status !== 404) {
        console.error("[talent-profile] user read failed:", userRes.error);
        return NextResponse.json(
          { error: "Talent profile could not be read. Please try again." },
          { status: 502 }
        );
      }
      return NextResponse.json({ error: "Talent not found." }, { status: 404 });
    }

    const userData = userRes.data?.data;
    if (!userData) {
      return NextResponse.json({ error: "Talent not found." }, { status: 404 });
    }

    const profileData = profileRows[0] ?? null;

    // "Recruiters Only" is meant for exactly this caller. Anything other than the
    // two employer-visible values stays denied, as before.
    const visibility = profileData?.profile_visibility;
    if (profileData && visibility !== "Public" && visibility !== "Recruiters Only") {
      return NextResponse.json({ error: "This profile is not publicly visible." }, { status: 403 });
    }

    // Work experience skills, scoped to this talent's experience rows so the
    // read is bounded to one profile instead of the whole junction table.
    let workSkillsData: Array<{
      experience_id: number;
      skill_id?: { skill_name?: string } | null;
    }> = [];
    if (workData.length > 0) {
      workSkillsData = await directusItemsWhereIn<{
        experience_id: number;
        skill_id?: { skill_name?: string } | null;
      }>(
        "vs_work_experience_skills",
        "experience_id",
        workData.map((w) => Number(w.id)),
        "experience_id,skill_id.skill_name"
      );
    }

    // Work experience skill map
    const workSkillMap = new Map<number, string[]>();
    for (const row of workSkillsData) {
      const name = row.skill_id?.skill_name;
      if (!name) continue;
      if (!workSkillMap.has(row.experience_id)) workSkillMap.set(row.experience_id, []);
      workSkillMap.get(row.experience_id)!.push(name);
    }

    // Resumes — only return URLs if company is VERIFIED (already confirmed above)
    const resumeData = await directusItems<TalentResumeRow>("vs_job_seeker_resumes", {
      query: `filter[user_id][_eq]=${talentUserId}&fields=id,file_url,file_name,is_primary,uploaded_at&sort[]=-is_primary&limit=10`,
    });

    const savedRecord = savedRows[0] ?? null;
    const isSaved = Boolean(savedRecord);
    const savedNotes = savedRecord?.notes ?? null;

    const location = [userData.user_city, userData.user_province].filter(Boolean).join(", ");
    const skills = skillsData
      .map((s) => s.skill_id?.skill_name)
      .filter(Boolean) as string[];

    const experienceYears = (() => {
      let totalMonths = 0;
      for (const exp of workData) {
        if (!exp.start_date) continue;
        const start = new Date(exp.start_date);
        const end = exp.is_current_role ? new Date() : exp.end_date ? new Date(exp.end_date) : new Date();
        totalMonths += Math.max((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()), 0);
      }
      return Number((totalMonths / 12).toFixed(1));
    })();

    const currentRole = workData.find((w) => w.is_current_role);
    const availabilityStatus: "AVAILABLE" | "EMPLOYED" | "OPEN" | "IMMEDIATELY_AVAILABLE" =
      currentRole ? "EMPLOYED" : "AVAILABLE";

    const profile = {
      user_id: userData.user_id,
      name: `${userData.user_fname} ${userData.user_lname}`.trim(),
      email: maskEmail(userData.user_email),
      phone: maskPhone(userData.user_contact),
      profile_image_url: userData.profile_image_url ?? null,
      gender: userData.gender ?? null,
      nationality: userData.nationality ?? null,
      location,
      headline: profileData?.profile_headline ?? null,
      summary: profileData?.professional_summary ?? null,
      expected_salary: profileData?.expected_salary ?? null,
      profile_visibility: profileData?.profile_visibility ?? "Public",
      availability_status: availabilityStatus,
      skills,
      experience_years: experienceYears,
      work_experience: workData.map((w) => ({
        id: w.id,
        company_name: w.company_name,
        job_title: w.job_title,
        location: w.location ?? null,
        location_type: w.location_type ?? null,
        employment_type: w.employment_type ?? null,
        start_date: w.start_date ?? null,
        end_date: w.end_date ?? null,
        is_current_role: Boolean(w.is_current_role),
        description: w.job_description ?? null,
        skills: workSkillMap.get(w.id) ?? [],
      })),
      education: eduData.map((e) => ({
        id: e.employee_education_id,
        school_name: e.school_id?.school_name ?? null,
        school_location: [e.school_id?.city_municipality, e.school_id?.province].filter(Boolean).join(", ") || null,
        course_name: e.school_course_id?.course_name ?? null,
        education_status: e.education_status ?? null,
        start_date: e.start_date ?? null,
        end_date: e.end_date ?? null,
      })),
      certifications: certData.map((c) => ({
        id: c.id,
        certificate_name: c.certificate_name,
        issuing_organization: c.issuing_organization,
        issue_date: c.issue_date ?? null,
        credential_url: c.credential_url ?? null,
      })),
      social_links: socialData.map((s) => ({
        id: s.id,
        platform_name: s.platform_name,
        profile_url: s.profile_url,
      })),
      // Resumes only visible to VERIFIED companies (isVerified already confirmed)
      resumes: resumeData.map((r) => ({
        id: r.id,
        file_url: toProtectedAssetUrl(r.file_url),
        file_name: r.file_name ?? null,
        is_primary: r.is_primary,
        uploaded_at: r.uploaded_at ?? null,
      })),
      is_saved: isSaved,
      saved_notes: savedNotes,
      work_setup: jobPrefRows[0]?.work_setup ?? null,
    };

    return NextResponse.json({ profile });
  } catch (err: unknown) {
    console.error("[talent-profile] Error:", err);
    const upstream = err instanceof DirectusError;
    return NextResponse.json(
      {
        error: upstream
          ? "Talent profile could not be read. Please try again."
          : "Internal server error.",
      },
      { status: upstream ? 502 : 500 }
    );
  }
}
