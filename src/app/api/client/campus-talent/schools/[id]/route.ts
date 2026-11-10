// src/app/api/client/campus-talent/schools/[id]/route.ts
// GET: Fetch school profile details for Campus Talent client view.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import {
  DirectusError,
  directusItems,
  directusSettled,
} from "@/lib/server/directus";
import { toId } from "@/lib/server/route";
import { PublicSchoolAdminProfile } from "@/modules/public/public-profile/services/public-profile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SchoolRow {
  school_id: number;
  school_name?: string | null;
  school_type?: string | null;
  school_logo_url?: string | null;
  school_cover?: string | null;
  school_description?: string | null;
  school_mission?: string | null;
  school_values?: string | null;
  school_email?: string | null;
  school_contact_no?: string | null;
  school_website?: string | null;
  school_facebook?: string | null;
  school_linkedin?: string | null;
  address_line?: string | null;
  barangay?: string | null;
  city_municipality?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  verification_status?: string | null;
  is_active?: boolean | number | null;
}

interface CourseRow {
  school_course_id: number;
  course_name: string;
  course_code?: string | null;
  degree?: string | null;
  course_status?: string;
}

interface CountRow {
  count?: { student_id?: number | string } | null;
}

interface SchoolAdminRow {
  user_id?: {
    user_id?: number;
    user_fname?: string;
    user_lname?: string;
    user_email?: string;
    profile_image_url?: string | null;
  } | null;
}

function resolveAssetUrl(fileId?: string | null): string | null {
  if (!fileId || typeof fileId !== "string" || !fileId.trim()) return null;
  const t = fileId.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/api/assets/")) return t;
  if (t.startsWith("/assets/")) return `/api${t}`;
  const parts = t.split("/");
  const lastPart = parts[parts.length - 1];
  return lastPart ? `/api/assets/${lastPart}` : null;
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
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
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

    // 1. Fetch school details. Only Directus' own 404 may tell the employer the
    // school is gone; answering 404 to an outage deletes a partner school.
    const schoolRes = await directusSettled<{ data?: SchoolRow }>(`/items/vs_school/${schoolId}`, {
      query: "fields=*",
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
    const school = schoolRes.data?.data;
    const isSchoolActive = school?.is_active === true || school?.is_active === 1;
    const isSchoolVerified = String(school?.verification_status ?? "").toUpperCase() === "VERIFIED";
    if (!school || !isSchoolActive || !isSchoolVerified) {
      return NextResponse.json({ error: "School is not accessible." }, { status: 403 });
    }

    // 2. Fetch courses, student count, and admin in parallel.
    // These three used to fall back to "no rows": the school page then showed
    // 0 students and 0 courses, and `course_count` came from a list the Directus
    // default cap had already cut to 100. A count that could not be read is not
    // a count of zero, so the reads fail the request instead.
    const [courses, countRows, adminRows] = await Promise.all([
      directusItems<CourseRow>("vs_school_course", {
        query:
          `filter[school_id][_eq]=${schoolId}&filter[course_status][_eq]=Active` +
          "&fields=school_course_id,course_name,course_code,degree,course_status" +
          "&sort[]=course_name&limit=-1",
      }),
      directusItems<CountRow>("vs_school_student", {
        query: `filter[school_id][_eq]=${schoolId}&aggregate[count]=student_id`,
      }),
      directusItems<SchoolAdminRow>("vs_school_admin", {
        query:
          `filter[school_id][_eq]=${schoolId}&filter[is_active][_eq]=1` +
          "&fields=user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_email,user_id.profile_image_url" +
          "&limit=1",
      }),
    ]);

    const rawCount = countRows[0]?.count?.student_id;
    const studentCount = Number(rawCount ?? 0);

    const adminUser = adminRows[0]?.user_id ?? null;

    const addressParts = [
      school.address_line,
      school.barangay,
      school.city_municipality,
      school.province,
      school.postal_code,
      school.country,
    ].filter(Boolean);

    const profile: PublicSchoolAdminProfile = {
      user_id: adminUser?.user_id ?? 0,
      user_fname: adminUser?.user_fname ?? "",
      user_lname: adminUser?.user_lname ?? "",
      user_email: adminUser?.user_email ?? (school.school_email || ""),
      avatar_url: resolveAssetUrl(adminUser?.profile_image_url) ?? undefined,
      headline: school.school_name ?? "",
      school_id: school.school_id,
      school_name: school.school_name ?? "",
      school_type: school.school_type || "University",
      school_logo_url: resolveAssetUrl(school.school_logo_url),
      school_cover: resolveAssetUrl(school.school_cover),
      school_description: school.school_description || null,
      school_mission: school.school_mission || null,
      school_values: school.school_values || null,
      school_email: school.school_email || null,
      school_contact_no: school.school_contact_no || null,
      school_website: school.school_website || null,
      school_address: addressParts.join(", "),
      course_count: courses.length,
      student_count: Number.isFinite(studentCount) ? studentCount : 0,
      courses: courses.map((c) => ({
        school_course_id: c.school_course_id,
        course_name: c.course_name,
        course_code: c.course_code,
        course_status: c.course_status,
      })),
      social_links: {
        facebook: school.school_facebook || null,
        linkedin: school.school_linkedin || null,
      },
    };

    return NextResponse.json({ data: profile });
  } catch (err: unknown) {
    console.error("[campus-talent/schools/[id] GET]", err);
    if (err instanceof DirectusError) {
      return NextResponse.json(
        { error: "School details could not be read. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
