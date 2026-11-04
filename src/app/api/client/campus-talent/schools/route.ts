// src/app/api/client/campus-talent/schools/route.ts
// GET: Search verified schools for the Campus Talent discovery view.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
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

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const city = searchParams.get("city")?.trim() || "";
    const schoolType = searchParams.get("type")?.trim() || "";

    // Build filters — only verified, active, public schools
    const filters: string[] = [
      "filter[verification_status][_eq]=VERIFIED",
      "filter[is_active][_eq]=1",
      "filter[is_public][_eq]=1",
    ];

    if (query) {
      filters.push(`filter[_or][0][school_name][_icontains]=${encodeURIComponent(query)}`);
      filters.push(`filter[_or][1][city_municipality][_icontains]=${encodeURIComponent(query)}`);
      filters.push(`filter[_or][2][province][_icontains]=${encodeURIComponent(query)}`);
    }
    if (city) filters.push(`filter[city_municipality][_icontains]=${encodeURIComponent(city)}`);
    if (schoolType) filters.push(`filter[school_type][_eq]=${encodeURIComponent(schoolType)}`);

    const fields = [
      "school_id",
      "school_name",
      "school_type",
      "school_logo_url",
      "city_municipality",
      "province",
      "country",
      "school_description",
      "school_website",
      "verification_status",
    ].join(",");

    const url = `${DIRECTUS_BASE}/items/vs_school?${filters.join("&")}&fields=${fields}&limit=50&sort[]=school_name`;
    const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
    if (!res.ok) throw new Error(`School fetch failed: ${res.statusText}`);

    const json = await res.json();
    const schools = (json.data ?? []) as Array<Record<string, unknown>>;

    // Enrich with student count and course count per school
    const enriched = await Promise.all(
      schools.map(async (school) => {
        const schoolId = school.school_id as number;

        const [studentRes, courseRes] = await Promise.all([
          fetch(
            `${DIRECTUS_BASE}/items/vs_school_student?filter[school_id][_eq]=${schoolId}&aggregate[count]=student_id`,
            { headers: getHeaders(), cache: "no-store" }
          ),
          fetch(
            `${DIRECTUS_BASE}/items/vs_school_course?filter[school_id][_eq]=${schoolId}&filter[course_status][_eq]=Active&aggregate[count]=school_course_id`,
            { headers: getHeaders(), cache: "no-store" }
          ),
        ]);

        const studentCount = studentRes.ok
          ? ((await studentRes.json()).data?.[0]?.count?.student_id ?? 0)
          : 0;
        const courseCount = courseRes.ok
          ? ((await courseRes.json()).data?.[0]?.count?.school_course_id ?? 0)
          : 0;

        return {
          ...school,
          school_logo_url: resolveAssetUrl(school.school_logo_url as string | null | undefined),
          student_count: Number(studentCount),
          course_count: Number(courseCount),
        };
      })
    );

    return NextResponse.json({ data: enriched, total: enriched.length });
  } catch (err: unknown) {
    console.error("[campus-talent/schools GET]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
