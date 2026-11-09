// src/app/api/client/campus-talent/schools/[id]/students/route.ts
// GET: Fetch students for a specific school, resolving registered user profiles.

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
import { AcademicCandidate, EnhancedCandidate } from "@/modules/matching-engine/campus/types";
import { resolveCurriculumDomain } from "@/modules/matching-engine/campus/curriculumTaxonomy";
import { classifySkillNames } from "@/modules/client/campus-talent/utils/skillClassifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SchoolRow {
  school_id?: number;
  school_name?: string | null;
  verification_status?: string | null;
  is_active?: boolean | number | null;
}

interface StudentRow extends Record<string, unknown> {
  student_id: number;
  student_number?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  school_year?: string | null;
  gpa?: string | number | null;
  invitation_status?: string | null;
  registered_user_id?: number | null;
  school_course_id?: number | CourseRow | null;
}

interface CourseRow {
  school_course_id: number;
  course_name?: string | null;
  course_code?: string | null;
  degree?: string | null;
}

interface SkillAttachRow {
  user_id: number;
  skill_id?: { skill_name?: string | null } | string | number | null;
}

interface ProfileAttachRow {
  user_id: number;
  profile_headline?: string | null;
  professional_summary?: string | null;
}

interface ExpAttachRow {
  user_id: number;
  start_date?: string | null;
  end_date?: string | null;
  is_current_role?: boolean | number | null;
}

function maskStudentNumber(num?: string | null): string | null {
  if (!num || typeof num !== "string") return null;
  const clean = num.trim();
  if (clean.length <= 4) return clean;
  return `***${clean.slice(-4)}`;
}

/**
 * A missing or unparseable date used to contribute 1970: `new Date(null)` is
 * the epoch, so one blank start_date gave the student five decades of work
 * history that the employer then ranked on.
 */
function safeYear(raw?: string | null): number | null {
  if (!raw) return null;
  const y = new Date(raw).getFullYear();
  return Number.isFinite(y) ? y : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { isVerified, verification_status } = await checkCompanyVerificationStatus(userId);
    if (!isVerified) {
      return NextResponse.json(
        { error: `Restricted: Company status is ${verification_status}.` },
        { status: 403 }
      );
    }

    const { id } = await params;
    const schoolId = toId(id);
    if (!schoolId) {
      return NextResponse.json({ error: "Invalid school ID." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q")?.trim() || "";
    const courseFilter = searchParams.get("course_id")?.trim() || "";
    const courseId = courseFilter ? toId(courseFilter) : null;
    if (courseFilter && !courseId) {
      return NextResponse.json({ error: "Invalid course ID." }, { status: 400 });
    }

    // Fetch school info for context. Only Directus' own 404 may tell the
    // employer the school is gone; every other status means it could not be
    // read, and answering 404 makes an outage look like a deleted school.
    const schoolRes = await directusSettled<{ data?: SchoolRow }>(`/items/vs_school/${schoolId}`, {
      query: "fields=school_id,school_name,verification_status,is_active",
    });
    if (!schoolRes.ok) {
      if (schoolRes.status === 404) {
        return NextResponse.json({ error: "School not found." }, { status: 404 });
      }
      return NextResponse.json(
        { error: "School details could not be read. Please try again." },
        { status: 502 }
      );
    }
    const schoolData = schoolRes.data?.data;
    const isSchoolActive = schoolData?.is_active === true || schoolData?.is_active === 1;
    const isSchoolVerified = String(schoolData?.verification_status ?? "").toUpperCase() === "VERIFIED";
    if (!schoolData || !isSchoolActive || !isSchoolVerified) {
      return NextResponse.json({ error: "School is not accessible." }, { status: 403 });
    }

    // Fetch student roster
    const studentFilters: string[] = [`filter[school_id][_eq]=${schoolId}`];
    if (courseId) studentFilters.push(`filter[school_course_id][_eq]=${courseId}`);
    if (search) {
      studentFilters.push(`filter[_or][0][first_name][_icontains]=${encodeURIComponent(search)}`);
      studentFilters.push(`filter[_or][1][last_name][_icontains]=${encodeURIComponent(search)}`);
      studentFilters.push(`filter[_or][2][email][_icontains]=${encodeURIComponent(search)}`);
    }

    const studentFields = [
      "student_id",
      "student_number",
      "first_name",
      "middle_name",
      "last_name",
      "email",
      "school_year",
      "gpa",
      "invitation_status",
      "invited_at",
      "registered_user_id",
      "school_course_id.school_course_id",
      "school_course_id.course_name",
      "school_course_id.course_code",
      "school_course_id.degree",
    ].join(",");

    // The roster had no bottom: `limit=200` returned the first 200 surnames and
    // the client then sent that slice to the match endpoint, so on a school of
    // any size the employer ranked a prefix of the cohort and was shown a
    // `total` counted from it.
    const [rawStudents, rawCourses] = await Promise.all([
      directusItems<StudentRow>("vs_school_student", {
        query: `${studentFilters.join("&")}&fields=${studentFields}&sort[]=last_name&sort[]=student_id&limit=-1`,
      }),
      directusItems<CourseRow>("vs_school_course", {
        query: `filter[school_id][_eq]=${schoolId}&fields=school_course_id,course_name,course_code,degree&limit=-1`,
      }),
    ]);

    const courseMap: Record<number, { course_name: string; course_code: string; degree: string }> = {};
    for (const c of rawCourses) {
      const cId = Number(c.school_course_id);
      if (cId) {
        courseMap[cId] = {
          course_name: String(c.course_name ?? ""),
          course_code: String(c.course_code ?? ""),
          degree: String(c.degree ?? ""),
        };
      }
    }

    // Resolve registered user profiles for students with registered_user_id
    const registeredUserIds = rawStudents
      .filter((s) => s.registered_user_id)
      .map((s) => Number(s.registered_user_id));

    type SkillMap = Record<number, string[]>;
    type ProfileMap = Record<number, { profile_headline: string | null; professional_summary: string | null }>;
    type ExpMap = Record<number, number>;
    type ResumeMap = Record<number, boolean>;

    const skillMap: SkillMap = {};
    const profileMap: ProfileMap = {};
    const expMap: ExpMap = {};
    const resumeMap: ResumeMap = {};

    if (registeredUserIds.length > 0) {
      // Each of these used to answer "no rows" when Directus was unreachable,
      // so an outage rendered a real graduate with no skills, no headline, zero
      // years of experience and no resume — and the resume read was capped at 10
      // rows for the whole roster, so past the tenth upload every student
      // displayed as having none even on a healthy read.
      const [rawSkills, rawProfiles, rawExp, rawResumes] = await Promise.all([
        directusItemsWhereIn<SkillAttachRow>(
          "vs_user_skills_map",
          "user_id",
          registeredUserIds,
          "user_id,skill_id.skill_name"
        ),
        directusItemsWhereIn<ProfileAttachRow>(
          "vs_job_seeker_profile",
          "user_id",
          registeredUserIds,
          "user_id,profile_headline,professional_summary"
        ),
        directusItemsWhereIn<ExpAttachRow>(
          "vs_work_experience",
          "user_id",
          registeredUserIds,
          "user_id,start_date,end_date,is_current_role"
        ),
        directusItemsWhereIn<{ user_id: number }>(
          "vs_job_seeker_resumes",
          "user_id",
          registeredUserIds,
          "user_id"
        ),
      ]);

      for (const row of rawSkills) {
        const uid = Number(row.user_id);
        if (!uid) continue;
        if (!skillMap[uid]) skillMap[uid] = [];
        const skill = row.skill_id;
        const name =
          skill && typeof skill === "object" ? skill.skill_name : undefined;
        if (name) skillMap[uid].push(name);
      }

      for (const row of rawProfiles) {
        const uid = Number(row.user_id);
        if (!uid) continue;
        profileMap[uid] = {
          profile_headline: row.profile_headline ?? null,
          professional_summary: row.professional_summary ?? null,
        };
      }

      for (const row of rawExp) {
        const uid = Number(row.user_id);
        if (!uid) continue;
        const start = safeYear(row.start_date);
        if (start === null) continue;
        const end = row.is_current_role
          ? new Date().getFullYear()
          : safeYear(row.end_date) ?? start;
        expMap[uid] = (expMap[uid] ?? 0) + Math.max(0, end - start);
      }

      for (const row of rawResumes) {
        const uid = Number(row.user_id);
        if (uid) resumeMap[uid] = true;
      }
    }

    const candidates: (AcademicCandidate | EnhancedCandidate)[] = rawStudents.map((s) => {
      let courseName: string | null = null;
      let courseCode: string | null = null;
      let degree: "Associate" | "Bachelor" | "Master" | "Doctorate" | null = null;

      if (s.school_course_id && typeof s.school_course_id === "object") {
        const courseObj = s.school_course_id as CourseRow;
        courseName = courseObj.course_name ? String(courseObj.course_name) : null;
        courseCode = courseObj.course_code ? String(courseObj.course_code) : null;
        degree = (courseObj.degree as "Associate" | "Bachelor" | "Master" | "Doctorate" | null) ?? null;
      } else if (s.school_course_id) {
        const cId = Number(s.school_course_id);
        const mapped = courseMap[cId];
        if (mapped) {
          courseName = mapped.course_name || null;
          courseCode = mapped.course_code || null;
          degree = (mapped.degree as "Associate" | "Bachelor" | "Master" | "Doctorate" | null) ?? null;
        }
      }
      const registeredUserId = s.registered_user_id ? Number(s.registered_user_id) : null;

      const base = {
        studentId: Number(s.student_id),
        studentNumber: maskStudentNumber(s.student_number ? String(s.student_number) : null),
        firstName: String(s.first_name ?? ""),
        middleName: s.middle_name ? String(s.middle_name) : null,
        lastName: String(s.last_name ?? ""),
        email: String(s.email ?? ""),
        schoolId,
        schoolName: String(schoolData.school_name ?? ""),
        courseName,
        courseCode,
        degree,
        schoolYear: String(s.school_year ?? ""),
        gpa: s.gpa !== null && s.gpa !== undefined ? Number(s.gpa) : null,
        invitationStatus: String(s.invitation_status ?? "Not Sent"),
      };

      if (!registeredUserId) {
        const { competencies } = resolveCurriculumDomain(courseName);
        const { technicalSkills, softSkills } = classifySkillNames(competencies);
        return {
          ...base,
          isRegistered: false as const,
          registeredUserId: null,
          technicalSkills,
          softSkills,
        };
      }

      const userSkills = skillMap[registeredUserId] ?? [];
      const { technicalSkills, softSkills } = classifySkillNames(userSkills);

      return {
        ...base,
        isRegistered: true as const,
        registeredUserId,
        profileHeadline: profileMap[registeredUserId]?.profile_headline ?? null,
        professionalSummary: profileMap[registeredUserId]?.professional_summary ?? null,
        verifiedSkills: userSkills,
        technicalSkills,
        softSkills,
        workExperienceYears: expMap[registeredUserId] ?? 0,
        hasResume: resumeMap[registeredUserId] ?? false,
        certifications: [],
      };
    });

    return NextResponse.json({
      schoolId,
      schoolName: schoolData.school_name,
      data: candidates,
      total: candidates.length,
      registeredCount: candidates.filter((c) => c.isRegistered).length,
    });
  } catch (err: unknown) {
    console.error("[campus-talent/schools/[id]/students GET]", err);
    // A roster that could not be read is not an empty cohort: the employer has
    // to be told the school's students are unavailable, not shown a page with
    // nobody on it.
    if (err instanceof DirectusError) {
      return NextResponse.json(
        { error: "Student list could not be read. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
